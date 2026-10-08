/**
 * Making the demo store, the way a creator makes theirs.
 *
 * The demo store is a store (lib/house-store.ts). Nobody can sign in to it,
 * so it is put together here instead of in the studio — and with nothing but
 * the functions the studio's own routes call: the handle is claimed, the
 * product is added, its price options are added, its files are put in the
 * store's own folder and attached, its picture and the store's photo are
 * kept where every store's are. Not one record is written by hand. Whatever
 * a creator's store is after those calls, this one is too, and a change to
 * any of them changes the demo with it.
 *
 * It runs as often as it is asked and does only what is missing:
 *
 *   - Every step first looks at the store as it is, and writes only when
 *     what is there differs from what is written below. Asked twice, the
 *     second time writes nothing.
 *   - When everything is in place the whole answer is one read: a mark kept
 *     beside the store, carrying a fingerprint of this file's contents. A
 *     new deployment that changes anything below — a price, a sentence, the
 *     file a buyer gets — has another fingerprint, and the store is brought
 *     in line the next time anybody asks.
 *   - A step that could not be finished (the two photographs are fetched
 *     from where they are published, and a fetch can fail) is named in what
 *     comes back and tried again later, not on every request.
 *
 * Asked by the address everybody already has for the demo, /demo, which then
 * sends the visitor to the store itself, and once a day by the scheduled job,
 * so the store is put right even on a day nobody opens it.
 *
 *   nl:house:seed        the mark: fingerprint, what is still missing, when
 *   nl:house:seed:lock   held while it runs, so two requests never both do
 */
import { createHash } from "node:crypto";
import { del as blobDel, put as blobPut } from "@/lib/blob";
import { readListings, productIds } from "@/lib/catalog";
import { isDemoCheckoutConfigured } from "@/lib/demo-store";
import { DEMO_CONNECTED_ACCOUNT } from "@/lib/demo-account";
import { type DemoFileName, getDemoFile } from "@/lib/demo-file";
import { rememberFolderOwner } from "@/lib/delivery";
import { timed } from "@/lib/fetch-timeout";
import { HOUSE_HANDLE, HOUSE_OWNER } from "@/lib/house-store";
import { readAbout, writeAbout } from "@/lib/product-about";
import { type ProductFile, fileFolder } from "@/lib/product-file";
import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES, SMALL_LONG_SIDE, type ProductImage, imagePath, imagePaths } from "@/lib/product-image";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { SITE_URL } from "@/lib/site-url";
import {
  type Listing,
  type Store,
  addOption,
  addProduct,
  addStoreLink,
  claimHandle,
  editOption,
  editProduct,
  editStoreLink,
  imageFolder,
  setPhotoId,
  setProductAbout,
  setProductDisplay,
  setProductFile,
  setAnswers,
  setProductImage,
  setStripeAccount,
  setSubscription,
  storeFolder,
  storeForEmail,
  updateDetails,
  updateLook,
} from "@/lib/store";
import { canSellProduct } from "@/lib/store-checkout";
import { type StoreLook } from "@/lib/store-look";
import { MAX_PHOTO_BYTES, deletePhoto, sniffPhotoType, writePhoto } from "@/lib/store-photo";

// ---- What the demo store is --------------------------------------------------

/** Where the two photographs are published. Fetched once, then kept as a store's own. */
const PHOTOS = "https://images.unsplash.com/";
/** How long one of them is waited for. */
const PHOTO_TIMEOUT_MS = 15_000;

/**
 * The fictional creator's store. Jenny is invented, and the store says so in
 * the one sentence every visitor reads: its own description.
 */
export const DEMO_STORE = {
  name: "Harbor Kitchen",
  bio: "Simple family meals by Jenny, a fictional cook. This is Marktmorgen's demo store: you pay with Stripe's test card, and the file you get is real.",
  look: { theme: "sand", accent: "#e5533d", badge: true, sold: false } satisfies StoreLook,
  photo: {
    id: "photo-1543871595-e11129e271cc",
    query: "fm=webp&fit=crop&crop=faces&w=480&h=480&q=75",
  },
  link: { title: "Open a store like this one", url: `${SITE_URL}/` },
  /**
   * Visitors' questions about the product are answered from its page
   * (lib/answers.ts), so anybody looking at the demo can try the box a
   * creator would switch on. What it is told beyond the page is only this.
   */
  answers: {
    on: true,
    facts:
      "This is a demo store made by Marktmorgen. Jenny is a fictional cook. The checkout runs in Stripe's test mode: no real money moves and no real card is charged. Pay with the test card 4242 4242 4242 4242, any future date and any CVC. The file you get is a real PDF. Because nothing is charged, there is nothing to refund.",
  },
} as const;

/** One product, with two prices, each handing over its own file. */
export const DEMO_PRODUCT = {
  title: "Weekly Meal Planner",
  summary: "Simple family meal plans with breakfasts, lunches, dinners and a grocery list for each week.",
  price: "27",
  about: `A printable plan for the week's meals, with the grocery list that goes with it.

What is inside:
- Breakfast, lunch and dinner for every day of the week
- One grocery list for the whole week
- One page for each week, ready to print

Choose one week, or five weeks at a lower price per week. Each is a PDF you download the moment you pay.`,
  image: {
    id: "photo-1535473895227-bdecb20fb157",
    query: "fm=webp&fit=crop&w=1200&h=675&q=70",
    /** The same photograph at the width of the smaller copy made for phones (SMALL_LONG_SIDE). */
    small: `fm=webp&fit=crop&w=${SMALL_LONG_SIDE}&h=450&q=70`,
    alt: "A table seen from above, covered with prepared dishes and vegetables",
  },
  options: [
    { label: "1 week", price: "27", file: "weekly-meal-planner.pdf" },
    { label: "5 weeks", price: "39", file: "meal-planner-5-weeks.pdf" },
  ] satisfies { label: string; price: string; file: DemoFileName }[],
} as const;

// ---- The mark ----------------------------------------------------------------

const MARK = "nl:house:seed";
const LOCK = "nl:house:seed:lock";
const LOCK_SECONDS = 120;
/** How long a step that failed is left before it is tried again. */
export const RETRY_SECONDS = 10 * 60;

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Everything above, and the files themselves, as one short word. */
export function seedFingerprint(): string {
  const files = DEMO_PRODUCT.options.map((option) => sha(getDemoFile(option.file)));
  return sha(JSON.stringify([HOUSE_HANDLE, DEMO_STORE, DEMO_PRODUCT, files, DEMO_CONNECTED_ACCOUNT])).slice(0, 24);
}

type Mark = {
  /** The fingerprint the store was last brought in line with. */
  v: string;
  /** What could not be finished then; empty when everything is in place. */
  pending: string[];
  /** When, in seconds. */
  at: number;
  /** Whether the store was there at all. */
  store: boolean;
  /** The photographs kept on the store, by where each came from. */
  photo: string;
  image: string;
};

function parseMark(raw: unknown): Mark | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<Mark>;
    if (typeof value.v !== "string" || typeof value.at !== "number") return null;
    return {
      v: value.v,
      pending: Array.isArray(value.pending) ? value.pending.filter((p): p is string => typeof p === "string").slice(0, 20) : [],
      at: value.at,
      store: value.store === true,
      photo: typeof value.photo === "string" ? value.photo : "",
      image: typeof value.image === "string" ? value.image : "",
    };
  } catch {
    return null;
  }
}

export type SeedResult = {
  /** Whether the demo store is there to be opened. */
  ok: boolean;
  /** What is still missing, in a word each. Empty when it is all in place. */
  pending: string[];
  /** Whether this call did any work, or only read the mark. */
  ran: boolean;
};

// ---- What it needs from outside ----------------------------------------------

/**
 * The two things that are not Redis: the file store, and the place the
 * photographs are fetched from. Handed in so a test can stand in for both.
 */
export type SeedDeps = {
  putFile: (pathname: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  removeFile: (pathname: string) => Promise<void>;
  fetchBytes: (url: string) => Promise<Uint8Array>;
};

const REAL: SeedDeps = {
  putFile: async (pathname, bytes, contentType) => {
    await blobPut(pathname, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  },
  removeFile: async (pathname) => {
    await blobDel(pathname);
  },
  fetchBytes: (url) =>
    timed(PHOTO_TIMEOUT_MS, async (signal) => {
      const response = await fetch(url, { signal, cache: "no-store" });
      if (!response.ok) throw new Error(`fetch_${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    }),
};

/**
 * How wide and tall a WebP or a JPEG is, read from its own first bytes, or
 * null. A creator's browser measures the picture it uploads; here nothing
 * drew it, so the file is asked.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const text = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    const kind = text(12, 4);
    if (kind === "VP8X") {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height };
    }
    if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    }
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const length = (bytes[at + 2] << 8) | bytes[at + 3];
      // A start-of-frame marker: every C0–CF but the three that are tables.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: (bytes[at + 7] << 8) | bytes[at + 8], height: (bytes[at + 5] << 8) | bytes[at + 6] };
      }
      if (length < 2) return null;
      at += 2 + length;
    }
  }
  return null;
}

// ---- The steps ---------------------------------------------------------------

const REF = HOUSE_OWNER;

const refused = (step: string, reason: string) => `${step}:${reason}`;
const why = (error: unknown) => (error instanceof Error ? error.message : "failed").replace(/[^a-z0-9_]+/gi, "_").slice(0, 40);

/** The store itself: its address, its name and words, its look, its account, its plan. */
async function ensureStore(pending: string[]): Promise<Store | null> {
  let store = await storeForEmail(REF);
  if (!store) {
    const claimed = await claimHandle(REF, HOUSE_HANDLE, DEMO_STORE.name, DEMO_STORE.bio);
    if (!claimed.ok) {
      pending.push(refused("handle", claimed.reason));
      return null;
    }
    store = claimed.store;
  }
  if (store.name !== DEMO_STORE.name || store.bio !== DEMO_STORE.bio) {
    const done = await updateDetails(REF, DEMO_STORE.name, DEMO_STORE.bio);
    if (done.ok) store = done.store;
    else pending.push(refused("details", done.reason));
  }
  const look = store.look;
  if (look.theme !== DEMO_STORE.look.theme || look.accent !== DEMO_STORE.look.accent || look.badge !== DEMO_STORE.look.badge) {
    const done = await updateLook(REF, { ...DEMO_STORE.look });
    if (done.ok) store = done.store;
    else pending.push(refused("look", done.reason));
  }
  // The fictional creator's own account, in Stripe's test mode, charged
  // directly as a creator's is. It can take a payment for as long as the
  // demo's key is there to ask with (lib/demo-account.ts).
  const charges = isDemoCheckoutConfigured();
  if (store.stripeAccountId !== DEMO_CONNECTED_ACCOUNT || store.stripeChargesEnabled !== charges) {
    const done = await setStripeAccount(REF, DEMO_CONNECTED_ACCOUNT, charges);
    if (done.ok) store = done.store;
    else pending.push(refused("account", done.reason));
  }
  if (!charges) pending.push(refused("account", "no_key"));
  // The $29 plan, which is ours to give to our own store. No subscription is
  // written down for it, because there is none: the daily check of
  // subscriptions and the studio both ask Stripe only about a store that
  // names one (lib/billing-sync.ts), so neither ever takes this back.
  if (!store.subscriptionActive || store.tier !== "creator" || store.subscriptionId !== null) {
    const done = await setSubscription(REF, { active: true, tier: "creator", cycle: "month", subscriptionId: null, customerId: null, trialEnds: 0 });
    if (done) store = done;
    else pending.push(refused("plan", "refused"));
  }
  if (store.answers.on !== DEMO_STORE.answers.on || store.answers.facts !== DEMO_STORE.answers.facts) {
    const done = await setAnswers(REF, { ...DEMO_STORE.answers });
    if (done) store = done;
    else pending.push(refused("answers", "refused"));
  }
  if (!store.links.some((link) => link.url === DEMO_STORE.link.url && link.title === DEMO_STORE.link.title)) {
    const same = store.links.find((link) => link.url === DEMO_STORE.link.url);
    const done = same
      ? await editStoreLink(REF, same.id, DEMO_STORE.link.title, DEMO_STORE.link.url)
      : await addStoreLink(REF, DEMO_STORE.link.title, DEMO_STORE.link.url);
    if (done.ok) store = done.store;
    else pending.push(refused("link", done.reason));
  }
  return store;
}

/** The product and its two prices. Found by what they are called, so asking again adds nothing. */
async function ensureProduct(store: Store, pending: string[]): Promise<{ store: Store; product: Listing } | null> {
  const find = async (from: Store) => (await readListings(from, productIds(from))).find((p) => p.title === DEMO_PRODUCT.title) ?? null;
  let product = await find(store);
  if (!product) {
    const made = await addProduct(REF, DEMO_PRODUCT.title, DEMO_PRODUCT.summary, DEMO_PRODUCT.price);
    if (!made.ok) {
      pending.push(refused("product", made.reason));
      return null;
    }
    store = made.store;
  } else if (product.summary !== DEMO_PRODUCT.summary || product.priceCents !== Number(DEMO_PRODUCT.price) * 100) {
    const done = await editProduct(REF, product.id, DEMO_PRODUCT.title, DEMO_PRODUCT.summary, DEMO_PRODUCT.price);
    if (done.ok) store = done.store;
    else pending.push(refused("product", done.reason));
  }
  product = await find(store);
  if (!product) return null;

  for (const want of DEMO_PRODUCT.options) {
    const have = product.options.find((option) => option.label === want.label);
    const cents = Number(want.price) * 100;
    if (have && have.priceCents === cents) continue;
    const done = have ? await editOption(REF, have.id, want.label, want.price) : await addOption(REF, product.id, want.label, want.price);
    if (done.ok) store = done.store;
    else pending.push(refused(`option_${want.file}`, done.reason));
  }
  product = await find(store);
  return product ? { store, product } : null;
}

/** Each price's own file, in the store's own folder, attached the way an upload is. */
async function ensureFiles(store: Store, product: Listing, deps: SeedDeps, pending: string[]): Promise<Store> {
  const folder = await storeFolder(REF);
  // Whose folder it is, as an upload from the studio notes it (lib/delivery.ts).
  await rememberFolderOwner(folder, REF);
  for (const want of DEMO_PRODUCT.options) {
    const option = product.options.find((o) => o.label === want.label);
    if (!option) continue;
    const bytes = getDemoFile(want.file);
    // Named by what is in it: another file is another path, and the same
    // file put twice is the same path.
    const pathname = `${fileFolder(folder, option.id)}${sha(bytes).slice(0, 20)}.pdf`;
    if (option.file?.pathname === pathname && option.file.name === want.file) continue;
    try {
      await deps.putFile(pathname, bytes, "application/pdf");
      const file: ProductFile = { pathname, name: want.file, bytes: bytes.byteLength, contentType: "application/pdf", addedAt: new Date().toISOString() };
      const done = await setProductFile(REF, option.id, file);
      if (!done.ok) {
        pending.push(refused(`file_${want.file}`, done.reason));
        continue;
      }
      store = done.store;
      // After the record that replaced it is written, as the studio does.
      if (done.removed && done.removed.pathname !== pathname) await deps.removeFile(done.removed.pathname).catch(() => {});
    } catch (error) {
      pending.push(refused(`file_${want.file}`, why(error)));
    }
  }
  return store;
}

/**
 * The product's picture and its smaller copy for phones, kept in the store's
 * own picture folder: the two files a creator's browser makes and sends when
 * a picture is added in the studio (components/product-image-editor.tsx).
 */
async function ensureImage(store: Store, product: Listing, was: string, deps: SeedDeps, pending: string[]): Promise<{ store: Store; source: string }> {
  const want = DEMO_PRODUCT.image;
  // Where the two files came from. Another photograph, or another size of
  // this one, is another source, and is fetched again.
  const source = `${want.id}?${want.query}|${want.small}`;
  const have = product.image && was === source ? product.image : null;
  if (have && have.alt === want.alt && product.display === "preview") return { store, source };
  try {
    let image: ProductImage | null = have ? { ...have, alt: want.alt } : null;
    if (!image) {
      const folder = await imageFolder(REF);
      const fetched = async (query: string) => {
        const bytes = await deps.fetchBytes(`${PHOTOS}${want.id}?${query}`);
        const type = sniffPhotoType(bytes);
        const size = imageSize(bytes);
        if (!type || !(IMAGE_CONTENT_TYPES as readonly string[]).includes(type) || !size) throw new Error("type");
        if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("too_big");
        const path = imagePath(folder, sha(bytes).slice(0, 32), type);
        await deps.putFile(path, bytes, type);
        return { path, width: size.width, height: size.height, bytes: bytes.byteLength };
      };
      const full = await fetched(want.query);
      const copy = await fetched(want.small);
      if (copy.width >= full.width || copy.path === full.path) throw new Error("small");
      image = { ...full, alt: want.alt, small: { path: copy.path, width: copy.width, bytes: copy.bytes } };
    }
    const attached = image;
    const done = await setProductImage(REF, product.id, attached);
    if (!done.ok) {
      pending.push(refused("image", done.reason));
      return { store, source: was };
    }
    store = done.store;
    // The picture it replaced, and that picture's own copy, once nothing points at them.
    const kept = new Set(imagePaths(attached));
    for (const gone of imagePaths(done.removed)) {
      if (!kept.has(gone)) await deps.removeFile(gone).catch(() => {});
    }
    // Across the whole card: the one product is what the page is for.
    const shown = await setProductDisplay(REF, product.id, "preview");
    if (shown.ok) store = shown.store;
    return { store, source };
  } catch (error) {
    pending.push(refused("image", why(error)));
    return { store, source: was };
  }
}

/** The store's photo, kept where every store's is. */
async function ensurePhoto(store: Store, was: string, deps: SeedDeps, pending: string[]): Promise<{ store: Store; source: string }> {
  const want = DEMO_STORE.photo;
  if (store.photoId && was === want.id) return { store, source: was };
  try {
    const bytes = await deps.fetchBytes(`${PHOTOS}${want.id}?${want.query}`);
    const type = sniffPhotoType(bytes);
    if (!type) throw new Error("type");
    if (bytes.byteLength > MAX_PHOTO_BYTES) throw new Error("too_big");
    const id = await writePhoto(bytes, type);
    const done = await setPhotoId(REF, id);
    if (!done.ok) {
      await deletePhoto(id);
      pending.push(refused("photo", done.reason));
      return { store, source: was };
    }
    await deletePhoto(done.was);
    return { store: done.store, source: want.id };
  } catch (error) {
    pending.push(refused("photo", why(error)));
    return { store, source: was };
  }
}

/** The long description on the product's own page. */
async function ensureAbout(store: Store, product: Listing, pending: string[]): Promise<Store> {
  if (!store.statsId) {
    pending.push(refused("about", "no_stats"));
    return store;
  }
  const have = product.about ? await readAbout(store.statsId, product.id) : "";
  if (have === DEMO_PRODUCT.about) return store;
  const marked = await setProductAbout(REF, product.id, true);
  if (!marked.ok || !marked.store.statsId) {
    pending.push(refused("about", marked.ok ? "no_stats" : marked.reason));
    return store;
  }
  await writeAbout(marked.store.statsId, product.id, DEMO_PRODUCT.about);
  return marked.store;
}

/** Brings the demo store in line with this file, one step at a time. */
async function build(before: Mark | null, deps: SeedDeps): Promise<Mark> {
  const pending: string[] = [];
  const mark: Mark = { v: seedFingerprint(), pending, at: Math.floor(Date.now() / 1000), store: false, photo: before?.photo ?? "", image: before?.image ?? "" };
  let store = await ensureStore(pending);
  if (!store) return mark;
  mark.store = true;

  const photo = await ensurePhoto(store, mark.photo, deps, pending);
  store = photo.store;
  mark.photo = photo.source;

  const made = await ensureProduct(store, pending);
  if (!made) {
    if (!pending.some((p) => p.startsWith("product"))) pending.push(refused("product", "missing"));
    return mark;
  }
  store = await ensureFiles(made.store, made.product, deps, pending);
  const picture = await ensureImage(store, made.product, mark.image, deps, pending);
  store = picture.store;
  mark.image = picture.source;
  store = await ensureAbout(store, made.product, pending);

  // The one thing all of it is for: the product can be bought.
  const fresh = await storeForEmail(REF);
  const product = fresh ? (await readListings(fresh, productIds(fresh))).find((p) => p.title === DEMO_PRODUCT.title) : null;
  if (!fresh || !product || !canSellProduct(fresh, product)) {
    if (!pending.length) pending.push(refused("selling", "off"));
  }
  return mark;
}

/**
 * Makes sure the demo store is there and is what this file says. One read
 * when it is; the work, under a lock, when it is not.
 */
export async function ensureDemoStore(deps: SeedDeps = REAL): Promise<SeedResult> {
  if (!isRedisConfigured()) return { ok: false, pending: ["storage"], ran: false };
  const [raw] = await redisPipeline([["GET", MARK]]);
  const mark = parseMark(raw);
  const now = Math.floor(Date.now() / 1000);
  const current = mark !== null && mark.v === seedFingerprint();
  if (current && mark.pending.length === 0) return { ok: true, pending: [], ran: false };
  // Something failed a moment ago: left alone for a while, not tried on every visit.
  if (current && now - mark.at < RETRY_SECONDS) return { ok: mark.store, pending: mark.pending, ran: false };

  const [got] = await redisPipeline([["SET", LOCK, "1", "NX", "EX", LOCK_SECONDS]]);
  // Somebody else is doing it right now. The store, if there was one, is still there.
  if (got === null) return { ok: mark?.store ?? false, pending: mark?.pending ?? ["busy"], ran: false };
  try {
    const next = await build(mark, deps);
    await redisPipeline([["SET", MARK, JSON.stringify(next)]]);
    return { ok: next.store, pending: next.pending, ran: true };
  } catch (error) {
    console.error("making the demo store failed", error);
    // Written down, so the next few visits do not each try again.
    const failed: Mark = { v: seedFingerprint(), pending: [refused("run", why(error))], at: now, store: mark?.store ?? false, photo: mark?.photo ?? "", image: mark?.image ?? "" };
    await redisPipeline([["SET", MARK, JSON.stringify(failed)]]).catch(() => {});
    return { ok: failed.store, pending: failed.pending, ran: true };
  } finally {
    await redisPipeline([["DEL", LOCK]]).catch(() => {});
  }
}
