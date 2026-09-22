/**
 * Who may open a course, and what they have done in it.
 *
 * Nobody makes a password. A student is someone whose email address paid for
 * the course, proved in one of two ways:
 *
 *   - in the browser that paid: the checkout left a secret cookie in it and
 *     only its fingerprint travelled with the charge, so the thanks page can
 *     open the course there and then, for that course only;
 *   - anywhere else: a link sent to the address, which only whoever reads
 *     that inbox can use.
 *
 * Either way the browser is given a pass for this one store. What the pass
 * opens is asked of the creator's own Stripe account — the payments are the
 * record of who bought what — and kept for ten minutes so a lesson does not
 * wait on Stripe every time.
 *
 * Progress is kept per course and per student: which lessons they marked done
 * and when they last came back. That is all, and the creator sees it.
 */
import { createHash, randomBytes } from "node:crypto";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, SESSION_COOKIE, emailForSession, normaliseEmail } from "@/lib/auth";
import { NIMBUS_FROM, sendEmail } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount } from "@/lib/stripe-account";
import { recordDelivery } from "@/lib/delivery";
import type { ProductFile } from "@/lib/product-file";
import type { Product, Store } from "@/lib/store";
import { type Course, type CourseModule, lessonsInOrder, opensAt } from "@/lib/course";

/** The secret a course checkout leaves in the buyer's browser. */
export const BUYER_COOKIE = "nl_buyer";
export const BUYER_COOKIE_SECONDS = 24 * 60 * 60;
/** How long a browser stays let in. */
export const PASS_SECONDS = 90 * 24 * 60 * 60;
/** How long an emailed link works, and how many times it opens. */
export const LINK_SECONDS = 60 * 60;
const MAX_LINK_OPENS = 10;
/** How long an answer from Stripe about who bought what is reused. */
const PAID_SECONDS = 10 * 60;
const IP_LIMIT = 10;
const ADDRESS_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;
/** How long a signed video link plays for: one long sitting. */
export const VIDEO_URL_SECONDS = 4 * 60 * 60;

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const LIVE = new Set(["active", "trialing", "past_due"]);

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** The same address, however it was typed, as a key. */
export function emailKey(email: string): string {
  return sha(`nimbus-learner:${normaliseEmail(email)}`).slice(0, 32);
}

/** A key that stays with the store through a change of address. */
export function storeKey(store: Store): string {
  return store.statsId ?? sha(`nimbus-learn-store:${store.email}`).slice(0, 32);
}

export function passCookieName(store: Store): string {
  return `nl_learn_${storeKey(store).slice(0, 16)}`;
}

export function newBuyerKey(): { secret: string; fingerprint: string } {
  const secret = randomBytes(24).toString("hex");
  return { secret, fingerprint: buyerFingerprint(secret) };
}

export function buyerFingerprint(secret: string): string {
  return sha(`nimbus-buyer:${secret}`).slice(0, 40);
}

// ------------------------------------------------------------------ passes

type Pass = { e: string; k: string; c: string[] | "all" };
const passKey = (token: string) => `nl:learn:pass:${sha(token)}`;

/** Lets this browser in: to every course the address bought here, or to some. */
export async function mintPass(store: Store, email: string, scope: string[] | "all"): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const pass: Pass = { e: normaliseEmail(email), k: storeKey(store), c: scope };
  await redisPipeline([["SET", passKey(token), JSON.stringify(pass), "EX", PASS_SECONDS]]);
  return token;
}

async function readPass(store: Store, token: string | undefined): Promise<Pass | null> {
  if (!token || !TOKEN_PATTERN.test(token) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", passKey(token)]]);
  if (typeof raw !== "string") return null;
  try {
    const pass = JSON.parse(raw) as Pass;
    if (pass.k !== storeKey(store) || typeof pass.e !== "string") return null;
    if (pass.c !== "all" && !Array.isArray(pass.c)) return null;
    return pass;
  } catch {
    return null;
  }
}

export function passCookie(store: Store, token: string, secure: boolean): string {
  return `${passCookieName(store)}=${token}; Path=/; Max-Age=${PASS_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export type Learner = {
  email: string;
  /** Which courses this browser was let into; "all" once the address is proved. */
  scope: string[] | "all";
  /** The creator, looking at their own course. */
  owner: boolean;
};

type CookieJar = { get(name: string): { value: string } | undefined };

/** Whoever this browser belongs to, as far as this store is concerned. */
export async function learnerFrom(store: Store, cookies: CookieJar): Promise<Learner | null> {
  const signedIn = await emailForSession(cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (signedIn && normaliseEmail(signedIn) === normaliseEmail(store.email)) {
    return { email: signedIn, scope: "all", owner: true };
  }
  const pass = await readPass(store, cookies.get(passCookieName(store))?.value);
  if (pass) return { email: pass.e, scope: pass.c, owner: false };
  // Signed in to Nimbus with this address: the address is already proved.
  if (signedIn) return { email: signedIn, scope: "all", owner: false };
  return null;
}

// ------------------------------------------------------------ who paid

const ledgerKey = (store: Store, email: string) => `nl:learn:enr:${storeKey(store)}:${emailKey(email)}`;
const paidCacheKey = (store: Store, email: string) => `nl:learn:paid:${storeKey(store)}:${emailKey(email)}`;
const blockedKey = (courseId: string) => `nl:course:${courseId}:blocked`;

/** Written when a purchase is confirmed on the thanks page. */
export async function recordEnrollment(store: Store, email: string, productId: string, startSeconds: number): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisPipeline([
    ["HSETNX", ledgerKey(store, email), productId, String(Math.floor(startSeconds))],
    ["DEL", paidCacheKey(store, email)],
  ]);
}

type Listed = { data?: unknown };

/** Asks the creator's Stripe account what this address paid for here. */
async function paidAtStripe(store: Store, email: string): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  const account = store.stripeAccountId;
  if (!account) return found;
  const handles = new Set([store.handle, ...store.previousHandles]);
  const courses = new Map(store.products.filter((p) => p.course).map((p) => [p.id, p]));
  if (courses.size === 0) return found;

  // Stripe keeps the address as it was typed at checkout.
  const variants = [...new Set([email.trim(), normaliseEmail(email)])];
  for (const variant of variants) {
    const query = new URLSearchParams({ "customer_details[email]": variant, status: "complete", limit: "100" });
    query.append("expand[]", "data.subscription");
    const listed = (await onAccount("GET", account, `/checkout/sessions?${query}`)) as Listed;
    const rows = Array.isArray(listed.data) ? (listed.data as Record<string, unknown>[]) : [];
    for (const session of rows) {
      const meta = (session.metadata ?? {}) as Record<string, string>;
      if (!handles.has(meta.store ?? "")) continue;
      if (session.payment_status !== "paid") continue;
      const product = courses.get(meta.product ?? "");
      if (!product) continue;
      // A course sold as a membership is open while the membership runs.
      if (product.recurring && session.mode === "subscription" && meta.kind !== "plan") {
        const sub = session.subscription as { status?: unknown } | null;
        if (!sub || typeof sub !== "object" || typeof sub.status !== "string" || !LIVE.has(sub.status)) continue;
      }
      const created = typeof session.created === "number" ? session.created : Math.floor(Date.now() / 1000);
      const before = found.get(product.id);
      if (before === undefined || created < before) found.set(product.id, created);
    }
  }
  return found;
}

/**
 * The courses of this store this address may open, with when each began.
 * Memberships are always checked with Stripe; a one-off purchase recorded on
 * the thanks page is taken from our own record.
 */
export async function paidCourses(store: Store, email: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isRedisConfigured()) return result;
  const [cached, ledger] = await redisPipeline([
    ["GET", paidCacheKey(store, email)],
    ["HGETALL", ledgerKey(store, email)],
  ]);
  let fromStripe: Map<string, number> | null = null;
  if (typeof cached === "string") {
    try {
      fromStripe = new Map(Object.entries(JSON.parse(cached) as Record<string, number>));
    } catch {
      fromStripe = null;
    }
  }
  if (!fromStripe) {
    try {
      fromStripe = await paidAtStripe(store, email);
      await redisPipeline([["SET", paidCacheKey(store, email), JSON.stringify(Object.fromEntries(fromStripe)), "EX", PAID_SECONDS]]);
    } catch (error) {
      console.error("reading course purchases failed", error);
      fromStripe = new Map();
    }
  }
  const recorded = new Map<string, number>();
  if (Array.isArray(ledger)) {
    for (let i = 0; i + 1 < ledger.length; i += 2) recorded.set(String(ledger[i]), Number(ledger[i + 1]));
  } else if (ledger && typeof ledger === "object") {
    for (const [k, v] of Object.entries(ledger as Record<string, string>)) recorded.set(k, Number(v));
  }

  for (const product of store.products) {
    if (!product.course) continue;
    const start = product.recurring ? fromStripe.get(product.id) : recorded.get(product.id) ?? fromStripe.get(product.id);
    if (start !== undefined && Number.isFinite(start)) result.set(product.id, start);
  }

  // A student the creator took off the course stays off it.
  const withCourse = [...result.keys()]
    .map((id) => store.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p?.course));
  if (withCourse.length) {
    const flags = await redisPipeline(withCourse.map((p) => ["SISMEMBER", blockedKey(p.course!.id), emailKey(email)]));
    withCourse.forEach((p, i) => {
      if (flags[i] === 1 || flags[i] === "1") result.delete(p.id);
    });
  }
  return result;
}

export type CourseAccess =
  | { state: "open"; learner: Learner; start: number }
  | { state: "preview"; learner: Learner | null }
  | { state: "closed"; learner: Learner | null };

/** Whether this browser may take this course, and from when. */
export async function courseAccess(store: Store, product: Product, cookies: CookieJar): Promise<CourseAccess> {
  const learner = await learnerFrom(store, cookies);
  if (!learner || !product.course) return { state: "closed", learner };
  if (learner.owner) return { state: "open", learner, start: Math.floor(Date.now() / 1000) - 400 * 86_400 };
  if (learner.scope !== "all" && !learner.scope.includes(product.course.id)) return { state: "closed", learner };
  const paid = await paidCourses(store, learner.email);
  const start = paid.get(product.id);
  return start === undefined ? { state: "closed", learner } : { state: "open", learner, start };
}

// ------------------------------------------------------------ progress

const studentsKey = (courseId: string) => `nl:course:${courseId}:students`;
const doneKey = (courseId: string, email: string) => `nl:course:${courseId}:done:${emailKey(email)}`;

type StudentRow = { e: string; s: number; l: number };

/** Notes that a student opened the course, keeping when they began. */
export async function touchStudent(courseId: string, email: string, startSeconds: number): Promise<void> {
  if (!isRedisConfigured()) return;
  const key = studentsKey(courseId);
  const field = emailKey(email);
  const [raw] = await redisPipeline([["HGET", key, field]]);
  let row: StudentRow = { e: normaliseEmail(email), s: Math.floor(startSeconds), l: 0 };
  if (typeof raw === "string") {
    try {
      const old = JSON.parse(raw) as StudentRow;
      row = { e: old.e || row.e, s: Math.min(old.s || row.s, row.s), l: 0 };
    } catch {}
  }
  row.l = Math.floor(Date.now() / 1000);
  await redisPipeline([["HSET", key, field, JSON.stringify(row)]]);
}

export async function doneLessons(courseId: string, email: string): Promise<Set<string>> {
  if (!isRedisConfigured()) return new Set();
  const [raw] = await redisPipeline([["SMEMBERS", doneKey(courseId, email)]]);
  return new Set(Array.isArray(raw) ? (raw as string[]) : []);
}

export async function markLesson(courseId: string, email: string, lessonId: string, done: boolean): Promise<void> {
  await redisPipeline([[done ? "SADD" : "SREM", doneKey(courseId, email), lessonId]]);
}

export type Student = {
  email: string;
  since: number;
  lastSeen: number;
  done: number;
  blocked: boolean;
};

/** Everyone who has opened the course, with how far they got. */
export async function studentsOf(course: Course, limit = 500): Promise<{ students: Student[]; total: number }> {
  if (!isRedisConfigured()) return { students: [], total: 0 };
  const [raw, blockedRaw] = await redisPipeline([
    ["HGETALL", studentsKey(course.id)],
    ["SMEMBERS", blockedKey(course.id)],
  ]);
  const rows: StudentRow[] = [];
  const pairs: [string, string][] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) pairs.push([String(raw[i]), String(raw[i + 1])]);
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, string>)) pairs.push([k, v]);
  }
  for (const [, value] of pairs) {
    try {
      rows.push(JSON.parse(value) as StudentRow);
    } catch {}
  }
  rows.sort((a, b) => b.l - a.l);
  const shown = rows.slice(0, limit);
  const lessonIds = new Set(lessonsInOrder(course).map(({ lesson }) => lesson.id));
  const done = shown.length
    ? await redisPipeline(shown.map((row) => ["SMEMBERS", doneKey(course.id, row.e)]))
    : [];
  const blocked = new Set(Array.isArray(blockedRaw) ? (blockedRaw as string[]) : []);
  return {
    total: rows.length,
    students: shown.map((row, i) => ({
      email: row.e,
      since: row.s,
      lastSeen: row.l,
      done: Array.isArray(done[i]) ? (done[i] as string[]).filter((id) => lessonIds.has(id)).length : 0,
      blocked: blocked.has(emailKey(row.e)),
    })),
  };
}

/** Takes a student off a course, or lets them back on. */
export async function setBlocked(store: Store, courseId: string, email: string, blocked: boolean): Promise<void> {
  await redisPipeline([
    [blocked ? "SADD" : "SREM", blockedKey(courseId), emailKey(email)],
    ["DEL", paidCacheKey(store, email)],
  ]);
}

// ------------------------------------------------------------ media

/** A link the browser can play or fetch straight from storage, for a while. */
export async function signedMedia(file: ProductFile, seconds: number): Promise<string | null> {
  try {
    const token = await issueSignedToken({
      pathname: file.pathname,
      operations: ["get"],
      validUntil: Date.now() + seconds * 1000,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: "get",
      pathname: file.pathname,
      access: "private",
    });
    await recordDelivery(file.pathname, file.bytes);
    return presignedUrl;
  } catch (error) {
    console.error("signing a lesson video failed", error);
    return null;
  }
}

// ------------------------------------------------------------ emailed links

type LinkGrant = { e: string; k: string; h: string; p: string };
const linkKey = (token: string) => `nl:learn:link:${sha(token)}`;
const opensKey = (token: string) => `nl:learn:link:${sha(token)}:opens`;

function displayName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A store";
}

function senderAddress(): string {
  const match = NIMBUS_FROM.match(/<([^>]+)>/);
  return (match ? match[1] : NIMBUS_FROM).trim();
}

async function within(key: string, limit: number): Promise<boolean> {
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= limit;
}

export type LinkRequest = "sent" | "email" | "limited" | "error";

/**
 * Emails a way into the course, when the address bought it. "sent" either
 * way: only whoever reads the inbox learns whether it had.
 */
export async function requestCourseLink(input: {
  store: Store;
  product: Product;
  email: string;
  ip: string;
  origin: string;
}): Promise<LinkRequest> {
  const { store, product, ip, origin } = input;
  const raw = input.email.trim();
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) return "email";
  if (!isRedisConfigured() || !product.course) return "error";
  if (!(await within(`nl:learn:rate:ip:${sha(`${ip}|${store.handle}`).slice(0, 32)}`, IP_LIMIT))) return "limited";
  if (!(await within(`nl:learn:rate:addr:${emailKey(raw)}`, ADDRESS_LIMIT))) return "limited";

  const paid = await paidCourses(store, raw);
  if (!paid.has(product.id)) return "sent";
  return (await sendCourseLink(store, product, raw, origin)) ? "sent" : "error";
}

/** Sends the link itself. Also used when a buyer pays in another browser. */
export async function sendCourseLink(store: Store, product: Product, email: string, origin: string): Promise<boolean> {
  const token = randomBytes(32).toString("hex");
  const grant: LinkGrant = { e: normaliseEmail(email), k: storeKey(store), h: store.handle, p: product.id };
  await redisPipeline([["SET", linkKey(token), JSON.stringify(grant), "EX", LINK_SECONDS]]);
  const link = `${origin}/api/store/course/open?token=${token}`;
  return sendEmail({
    from: `"${displayName(store.name)} via Nimbus Labs" <${senderAddress()}>`,
    to: email,
    subject: `Your course: ${product.title}`.slice(0, 200),
    text: [
      `Here is your way into ${product.title}:`,
      "",
      link,
      "",
      "Open it on the phone or computer you want to learn on. That device then stays let in for 90 days, and every course you bought from this store opens on it. No password to make or remember.",
      "",
      "The link works for one hour. If you did not ask for it, ignore this email; nothing happens unless the link is used.",
      "",
      `Sent by Nimbus Labs on behalf of ${store.name}.`,
    ].join("\n"),
  });
}

/** Spends one open of an emailed link, and says who and what it was for. */
export async function openCourseLink(token: string): Promise<LinkGrant | null> {
  if (!TOKEN_PATTERN.test(token) || !isRedisConfigured()) return null;
  const [raw, , opens] = await redisPipeline([
    ["GET", linkKey(token)],
    ["SET", opensKey(token), "0", "EX", LINK_SECONDS, "NX"],
    ["INCR", opensKey(token)],
  ]);
  if (typeof raw !== "string" || Number(opens) > MAX_LINK_OPENS) return null;
  try {
    const grant = JSON.parse(raw) as LinkGrant;
    return typeof grant.e === "string" && typeof grant.h === "string" && typeof grant.p === "string" ? grant : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ drip emails

const DRIP_SET = "nl:courses:drip";
const dripMailKey = (courseId: string, email: string, moduleId: string) =>
  `nl:course:${courseId}:dripmail:${emailKey(email)}:${moduleId}`;

/** Remembers that this course opens modules over time, for the daily job. */
export async function registerDrip(store: Store, product: Product, course: Course): Promise<void> {
  const member = `${course.id}|${store.handle}|${product.id}`;
  const drips = course.modules.some((m) => m.dripDays > 0);
  await redisPipeline([[drips ? "SADD" : "SREM", DRIP_SET, member]]);
}

/**
 * Tells each student when a module opens for them. Once per student and
 * unit, and only for modules that opened in the last three days, so a
 * course that gains a drip module does not email about months gone by.
 */
export async function sendDripEmails(
  load: (handle: string) => Promise<Store | null>,
  loadCourse: (id: string) => Promise<Course | null>,
  origin: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ sent: number; courses: number }> {
  const counts = { sent: 0, courses: 0 };
  if (!isRedisConfigured()) return counts;
  const [raw] = await redisPipeline([["SMEMBERS", DRIP_SET]]);
  const members = Array.isArray(raw) ? (raw as string[]) : [];
  for (const member of members) {
    const [courseId, handle, productId] = member.split("|");
    const store = await load(handle);
    const product = store?.products.find((p) => p.id === productId);
    const course = product?.course?.id === courseId ? await loadCourse(courseId) : null;
    if (!store || !product || !course) {
      await redisPipeline([["SREM", DRIP_SET, member]]);
      continue;
    }
    const dripping = course.modules.filter((m) => m.dripDays > 0 && m.lessons.length > 0);
    if (dripping.length === 0) continue;
    counts.courses += 1;
    const { students } = await studentsOf(course, 5000);
    for (const student of students) {
      if (student.blocked) continue;
      for (const unit of dripping) {
        const at = opensAt(unit, student.since);
        if (at > nowSeconds || at < nowSeconds - 3 * 86_400) continue;
        const [claimed] = await redisPipeline([["SET", dripMailKey(course.id, student.email, unit.id), "1", "NX", "EX", 400 * 86_400]]);
        if (claimed === null) continue;
        const ok = await sendDripEmail(store, product, unit, student.email, origin);
        if (ok) counts.sent += 1;
        else await redisPipeline([["DEL", dripMailKey(course.id, student.email, unit.id)]]);
      }
    }
  }
  return counts;
}

async function sendDripEmail(store: Store, product: Product, unit: CourseModule, email: string, origin: string): Promise<boolean> {
  return sendEmail({
    from: `"${displayName(store.name)} via Nimbus Labs" <${senderAddress()}>`,
    to: email,
    subject: `Now open in ${product.title}: ${unit.title}`.slice(0, 200),
    text: [
      `${unit.title} is now open in ${product.title}, with ${unit.lessons.length} ${unit.lessons.length === 1 ? "lesson" : "lessons"}.`,
      "",
      `${origin}/@${store.handle}/course/${product.id}`,
      "",
      "If this device asks who you are, press the button on that page and a link comes to this address.",
      "",
      `Sent by Nimbus Labs on behalf of ${store.name}, because you are taking this course.`,
    ].join("\n"),
  });
}
