/**
 * A creator's store: the handle, and the few facts the public page shows.
 *
 * Two records in Redis, both plain and both small:
 *
 *   nl:store:handle:<handle>  -> the owner's email, written with NX so a
 *                                handle can never be taken twice
 *   nl:store:owner:<hash>     -> the store itself, as JSON
 *
 * The handle record is the lock. It is written first and only if free, so two
 * people asking for the same name at the same moment cannot both win.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { type ProductFile, parseProductFile } from "@/lib/product-file";
import {
  MAX_OPTIONS,
  MAX_OPTION_LABEL_LENGTH,
  type ProductOption,
  parseOptions,
} from "@/lib/product-option";
import { MAX_LINK_LENGTH } from "@/lib/product-link";
import { type Recurring, parseRecurring } from "@/lib/product-recurring";
import { type StoreLook, DEFAULT_LOOK, parseLook } from "@/lib/store-look";
import { PHOTO_ID_PATTERN } from "@/lib/photo-limits";
import { type CallSetup, parseSetup } from "@/lib/call-setup";
import { type Pixels, NO_PIXELS, parsePixels } from "@/lib/pixels";
import { type TaxSetting, NO_TAX, parseTax } from "@/lib/tax";
import { type RecoverySetting, NO_RECOVERY, parseRecovery } from "@/lib/recovery-setting";
import { type Cycle, type Tier, parseCycle, parseTier } from "@/lib/plan";
import { COURSE_ID_PATTERN } from "@/lib/course";
import { COMMUNITY_ID } from "@/lib/community-text";
import { type Bump, type Plan, canBeBumped, isOneOff, parseBump, parsePlan, parseStock } from "@/lib/product-extras";
import { type Funnel, type FunnelProblem, funnelFromUpsell, funnelProblem, parseFunnel } from "@/lib/funnel";
import { type AffiliateSetting, parseAffiliateSetting } from "@/lib/affiliate-setting";
import { type PayWhatYouWant, type PwywProblem, parsePwyw, pwywProblem } from "@/lib/pay-what-you-want";
import { type CheckoutField, parseFields } from "@/lib/checkout-fields";
import { type KeySetup, canHaveKeys, parseKeySetup } from "@/lib/licence-keys";
import {
  type DisplayStyle,
  type ProductImage,
  parseDisplay,
  parseProductImage,
} from "@/lib/product-image";
import {
  MAX_LINK_TITLE_LENGTH,
  MAX_STORE_LINKS,
  type StoreLink,
  parseStoreLinks,
} from "@/lib/store-link";

/**
 * What an address may look like: 3 to 24 characters, starting and ending with
 * a letter or a number, with dots, hyphens and underscores allowed in between.
 *
 * Those three are there on purpose. A creator whose name everywhere else is
 * maria.souza or maria_souza should be able to keep it here instead of
 * inventing a different one for this store alone.
 */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,22}[a-z0-9])$/;
export const MAX_NAME_LENGTH = 60;
export const MAX_BIO_LENGTH = 160;

/** Names the site itself uses, or may use, so a store can never shadow one. */
const RESERVED = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "blog",
  "contact",
  "creators",
  "demo",
  "docs",
  "for",
  "help",
  "home",
  "legal",
  "login",
  "mission",
  "new",
  "nimbus",
  "nimbuslabs",
  "platform",
  "pricing",
  "privacy",
  "proof",
  "refunds",
  "root",
  "settings",
  "signin",
  "signup",
  "store",
  "studio",
  "support",
  "terms",
  "www",
]);

/**
 * How many addresses one store may ever hold, counting the one it uses now.
 *
 * There is no waiting between changes: a creator who mistypes a name fixes it
 * a second later. The only limit is this one, and it exists because an old
 * address stays held by the store so its published links keep working —
 * without a ceiling, a single account could sit on every good name and leave
 * nothing for anyone else. It is a ceiling on what one store holds at once:
 * letting an address go frees the slot and hands the name back.
 */
export const MAX_ADDRESSES = 10;

/**
 * How long a released address stays dark before anyone may take it.
 *
 * Letting go of an address frees the slot at once, but the name does not go
 * straight back on the shelf. For a month it answers nothing at all, so a link
 * still printed somewhere leads to a dead end rather than to the store of a
 * stranger. The creator waits for nothing; only the next taker does.
 */
export const RELEASE_QUARANTINE_DAYS = 30;

/** Marks a name that was let go and is not owned by anyone yet. */
const RELEASED_PREFIX = "released:";

/**
 * How many things one store may list.
 *
 * Two hundred, which no creator selling to their own audience comes near —
 * Stan says unlimited, and in practice this is the same promise — while the
 * store stays one small record. That record is read whole on every visit to
 * the page, so its size is a cost every visitor pays. A product with a
 * picture, three prices, three questions and every offer switched on is
 * about three kilobytes, so two hundred of them are well under the ceiling
 * below; the long descriptions live in records of their own
 * (lib/product-about.ts) for the same reason.
 */
export const MAX_PRODUCTS = 200;
export const MAX_TITLE_LENGTH = 80;
export const MAX_SUMMARY_LENGTH = 300;

/**
 * The price, in cents, and the two ends of what may be typed.
 *
 * Prices are held as whole cents so no amount is ever a rounded float, and
 * every store here charges in US dollars. A store that needs another currency
 * cannot be served honestly yet, and the studio says so rather than pretending
 * the field is neutral.
 */
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 500_000;

/**
 * A price of exactly nothing is the one amount below the minimum that is
 * allowed, and it means something different: the product is not sold, it is
 * given away for an email address. Nothing about it ever reaches Stripe.
 */
export function isFree(product: Pick<Product, "priceCents">): boolean {
  return product.priceCents === 0;
}

/** What a list id looks like: 32 hex characters, and nothing else. */
export const LIST_ID_PATTERN = /^[0-9a-f]{32}$/;

/** A fresh, unguessable id for a store's list of addresses. */
export function newListId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * The most one store's record may weigh, in bytes.
 *
 * Every limit above keeps a store far under this, but they multiply: two
 * hundred products, each with the longest lists of choices Stripe allows in
 * its questions, would not be. This is the backstop for that one case. A
 * change that would take the record past it, and make it bigger than it was,
 * is refused with a sentence the creator can act on; a change that makes it
 * smaller is never refused, so a full store can always be tidied.
 */
export const MAX_STORE_BYTES = 1_000_000;

/** Thrown by a write that would take a store past MAX_STORE_BYTES. */
export class StoreFullError extends Error {
  constructor() {
    super("store_full");
  }
}

/** One thing a store offers. */
export type Product = {
  id: string;
  title: string;
  summary: string;
  priceCents: number;
  createdAt: string;
  /** The file the buyer gets, once the creator has put one there. */
  file: ProductFile | null;
  /**
   * Where the buyer is sent instead, when the product lives somewhere else.
   *
   * A product delivers one or the other, never both: a buyer who has paid
   * should be shown one thing to open, not asked to choose. Setting a link
   * clears the file and setting a file clears the link, and that rule lives
   * in the two setters below rather than in whatever screen calls them.
   */
  link: string | null;
  /**
   * The schedule this is charged on, when it is a membership rather than a
   * one-off. Null is a single sale, which is what most products are.
   */
  recurring: Recurring | null;
  /**
   * Several prices under one product card, each delivering its own thing.
   *
   * Empty is the ordinary case: the product has the one price and the one
   * delivery above. When this is not empty those two are not charged and not
   * handed over — the option the buyer picked is.
   */
  options: ProductOption[];
  /**
   * When this is a paid call rather than a thing: how long it lasts and when
   * it can be booked. A call delivers a time in the creator's calendar, so it
   * carries no file, no link, no options and no schedule of payments.
   */
  call: CallSetup | null;
  /** How many can ever be sold, when the creator limits it. Null is no limit. */
  stock: number | null;
  /** Another product offered in a box at checkout, at a price of its own. */
  bump: Bump | null;
  /**
   * What is offered after paying, one offer at a time, each added in one
   * click (lib/funnel.ts). A product saved when there was a single upsell
   * reads back as a funnel of that one offer.
   */
  funnel: Funnel | null;
  /** Paying in a fixed number of payments instead of at once. */
  plan: Plan | null;
  /**
   * When this is a course: which course record holds its lessons, and how
   * many lessons it has, kept here so a store page knows without reading it.
   */
  course: CourseRef | null;
  /** The product's picture, shown on the store page and its own page. */
  image: ProductImage | null;
  /** How its card is drawn on the store page. */
  display: DisplayStyle;
  /** Questions asked on Stripe's checkout, answered before paying. */
  fields: CheckoutField[];
  /**
   * The buyer chooses the price, from the product's own price up. Null is the
   * ordinary case: the price is the price.
   */
  pwyw: PayWhatYouWant | null;
  /** Whether it has a long description, kept in a record of its own. */
  about: boolean;
  /**
   * Whether each sale hands the buyer a unique licence key, and where the
   * keys come from (lib/licence-keys.ts). Null is no keys.
   */
  keys: KeySetup | null;
  /**
   * Whether a PDF it delivers is stamped with the buyer's email on every
   * page when it is downloaded (lib/pdf-stamp.ts).
   */
  stamp: boolean;
};

/** What every email to a creator's list carries, as the law asks. */
export type MailSettings = {
  /** The name the email is from. */
  fromName: string;
  /** A postal address where the creator can be reached. */
  address: string;
};

export const MAX_MAIL_NAME = 60;
export const MAX_MAIL_ADDRESS = 200;

function parseMail(raw: unknown): MailSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const fromName = typeof value.fromName === "string" ? value.fromName.trim().slice(0, MAX_MAIL_NAME) : "";
  const address = typeof value.address === "string" ? value.address.trim().slice(0, MAX_MAIL_ADDRESS) : "";
  return fromName && address ? { fromName, address } : null;
}

/** The creator's own domain, on Pro. */
export type StoreDomain = {
  /** The bare host name, like shop.theirname.com. */
  name: string;
  addedAt: string;
  /** When we last saw it serving the store; empty until then. */
  liveAt: string;
};

function parseDomain(raw: unknown): StoreDomain | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.name !== "string" || !/^[a-z0-9.-]{4,253}$/.test(value.name)) return null;
  return {
    name: value.name,
    addedAt: typeof value.addedAt === "string" ? value.addedAt : "",
    liveAt: typeof value.liveAt === "string" ? value.liveAt : "",
  };
}

/** The part of a course a store record carries. */
export type CourseRef = { id: string; lessons: number };

/**
 * The part of a store's community its record carries: where the community
 * is kept (lib/community.ts) and whether it is open. Everything else about it
 * lives in its own records, so the store page learns whether to show the way
 * in without reading any of them.
 */
export type CommunityRef = { id: string; on: boolean };

function parseCommunityRef(raw: unknown): CommunityRef | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !COMMUNITY_ID.test(value.id)) return null;
  return { id: value.id, on: value.on === true };
}

function parseCourseRef(raw: unknown): CourseRef | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !COURSE_ID_PATTERN.test(value.id)) return null;
  const lessons = Number(value.lessons);
  return { id: value.id, lessons: Number.isInteger(lessons) && lessons >= 0 ? lessons : 0 };
}

export type Store = {
  handle: string;
  name: string;
  bio: string;
  email: string;
  createdAt: string;
  /** Addresses this store used before. They lead here until it lets them go. */
  previousHandles: string[];
  renamedAt: string;
  /**
   * The creator's own Stripe account, once they have connected it.
   *
   * We keep the identifier and nothing else. The account belongs to them, the
   * money lands in it, and disconnecting is theirs to do at any time.
   */
  stripeAccountId: string | null;
  /**
   * Whether Stripe last told us that account can take a payment, and when we
   * asked. Kept as a snapshot so the studio does not have to call Stripe on
   * every page load, and shown with its date so it is never read as a promise
   * about this exact moment.
   */
  stripeChargesEnabled: boolean;
  stripeCheckedAt: string;
  /**
   * What the creator pays us, on our own Stripe account — the other side of
   * the two above, which are about their account.
   *
   * The identifiers are kept so the studio can ask Stripe the current state,
   * and `subscriptionActive` is the snapshot of that answer, so a buyer
   * opening a store page never waits on a call to Stripe.
   */
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionActive: boolean;
  subscriptionCheckedAt: string;
  /**
   * Which plan, and how often it is billed, as Stripe last said. A snapshot
   * like the one above, so a Pro feature can be switched on or off without a
   * call to Stripe.
   */
  tier: Tier;
  cycle: Cycle;
  /** When the free trial ends, in seconds; 0 when not in one. A snapshot too. */
  trialEnds: number;
  /** How the creator's emails to their list are signed. Null until set up. */
  mail: MailSettings | null;
  /** The creator's own domain for the store, when they added one. */
  domain: StoreDomain | null;
  /** What the store lists, in the order the creator put them in. */
  products: Product[];
  /**
   * Links that are not for sale: the rest of the creator's life, in the order
   * they chose. Shown under what is for sale, because somebody who came to
   * buy should reach the thing they came for first.
   */
  links: StoreLink[];
  /**
   * Whether this store had a live discount code the last time we looked.
   *
   * The codes themselves live on the creator's Stripe account and are read
   * from there; this is only the answer to "should the checkout show a box to
   * type one into". It is a snapshot so that a buyer clicking buy never waits
   * on a call to Stripe, and being wrong costs nothing worse than an empty
   * box or a hidden one — never a wrong price, because the discount itself
   * is Stripe's arithmetic and not ours.
   */
  hasDiscounts: boolean;
  /**
   * Where the addresses collected by free products are kept.
   *
   * An id of its own rather than anything derived from the sign-in address,
   * because that address can move and the list has to move with the store
   * without being copied. Null until the store first gives something away.
   */
  listId: string | null;
  /**
   * The theme and the colour of the public page. Stores written before either
   * existed read back as the default look, which is the page they had.
   */
  look: StoreLook;
  /**
   * The creator's photo, when there is one. The picture itself is kept under
   * this id and served from an address that never changes for it, so a
   * browser may keep it for good; a new photo gets a new id.
   */
  photoId: string | null;
  /**
   * Where this store's booked and held call times are kept. An id of its own,
   * made the first time a call is set up, so neither a new address nor a new
   * sign-in email moves anybody's booking.
   */
  callsId: string | null;
  /**
   * Where the counts of this store's visits are kept: an id of its own, so a
   * new address or a new sign-in email carries the history along.
   */
  statsId: string | null;
  /** The creator's own ad pixels, each null until they add it. */
  pixels: Pixels;
  /** Whether Stripe Tax adds sales tax at checkout, and whether prices include it. */
  tax: TaxSetting;
  /**
   * Whether a buyer who agreed at checkout to hear from the creator, and then
   * left without paying, gets one reminder (lib/checkout-recovery.ts). Off
   * for every store until its creator switches it on.
   */
  recovery: RecoverySetting;
  /** The store's community, once the creator has made one (lib/community.ts). */
  community: CommunityRef | null;
  /**
   * The store's affiliate programme: whether it is on, what it pays and for
   * how long a click counts (lib/affiliates.ts). Off until the creator
   * switches it on. The money itself never passes through here.
   */
  affiliates: AffiliateSetting;
};

/** The shape Stripe gives a connected account: acct_ and then base62. */
export const STRIPE_ACCOUNT_PATTERN = /^acct_[A-Za-z0-9]{8,64}$/;

/** The same, for the customer and subscription that pay us. */
export const CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;
export const SUBSCRIPTION_PATTERN = /^sub_[A-Za-z0-9]{6,64}$/;

export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export type HandleProblem = "shape" | "reserved" | null;

export function handleProblem(handle: string): HandleProblem {
  if (!HANDLE_PATTERN.test(handle)) return "shape";
  if (RESERVED.has(handle)) return "reserved";
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const ownerKey = async (email: string) =>
  `nl:store:owner:${(await sha256Hex(`nimbus-store:${email.toLowerCase()}`)).slice(0, 40)}`;

const handleKey = (handle: string) => `nl:store:handle:${handle}`;

/**
 * The folder in the file store that belongs to one account.
 *
 * Derived from the email, so it cannot be guessed from a store address, and
 * salted differently from the Redis key so that seeing one never gives the
 * other.
 */
export async function storeFolder(email: string): Promise<string> {
  return (await sha256Hex(`nimbus-files:${email.toLowerCase()}`)).slice(0, 32);
}

/**
 * The folder a store's product pictures live in.
 *
 * Salted differently again from the folder its paid files live in, because a
 * picture's address is public and must say nothing about where the files
 * that are paid for are kept.
 */
export async function imageFolder(email: string): Promise<string> {
  return (await sha256Hex(`nimbus-images:${email.toLowerCase()}`)).slice(0, 24);
}

function parseProducts(raw: unknown): Product[] {
  if (!Array.isArray(raw)) return [];
  const products: Product[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Partial<Product>;
    if (typeof value.id !== "string" || !value.id) continue;
    if (typeof value.title !== "string" || !value.title) continue;
    if (typeof value.priceCents !== "number") continue;
    if (!Number.isInteger(value.priceCents) || value.priceCents < 0) continue;
    products.push({
      id: value.id,
      title: value.title.slice(0, MAX_TITLE_LENGTH),
      summary:
        typeof value.summary === "string"
          ? value.summary.slice(0, MAX_SUMMARY_LENGTH)
          : "",
      priceCents: value.priceCents,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
      file: parseProductFile(value.file),
      // Records written before links existed simply have no link, which is
      // the same as not having one now.
      link:
        typeof value.link === "string" && value.link
          ? value.link.slice(0, MAX_LINK_LENGTH)
          : null,
      recurring: parseRecurring(value.recurring),
      options: parseOptions(value.options),
      call: parseSetup(value.call),
      stock: parseStock(value.stock),
      bump: parseBump(value.bump),
      funnel: parseFunnel((value as { funnel?: unknown }).funnel) ?? funnelFromUpsell(parseBump((value as { upsell?: unknown }).upsell)),
      plan: parsePlan(value.plan),
      course: parseCourseRef(value.course),
      image: parseProductImage(value.image),
      display: parseDisplay(value.display),
      fields: parseFields(value.fields),
      pwyw: parsePwyw(value.pwyw),
      about: value.about === true,
      // Products written before keys and stamping existed have neither.
      keys: parseKeySetup(value.keys),
      stamp: value.stamp === true,
    });
    if (products.length >= MAX_PRODUCTS) break;
  }
  return products;
}

function parseStore(raw: unknown): Store | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Store>;
    if (!value.handle || !value.name || !value.email) return null;
    return {
      handle: value.handle,
      name: value.name,
      bio: value.bio ?? "",
      email: value.email,
      createdAt: value.createdAt ?? "",
      previousHandles: Array.isArray(value.previousHandles)
        ? value.previousHandles.filter((h) => typeof h === "string")
        : [],
      renamedAt: value.renamedAt ?? "",
      stripeAccountId:
        typeof value.stripeAccountId === "string" &&
        STRIPE_ACCOUNT_PATTERN.test(value.stripeAccountId)
          ? value.stripeAccountId
          : null,
      stripeChargesEnabled: value.stripeChargesEnabled === true,
      stripeCheckedAt: value.stripeCheckedAt ?? "",
      stripeCustomerId:
        typeof value.stripeCustomerId === "string" &&
        CUSTOMER_PATTERN.test(value.stripeCustomerId)
          ? value.stripeCustomerId
          : null,
      subscriptionId:
        typeof value.subscriptionId === "string" &&
        SUBSCRIPTION_PATTERN.test(value.subscriptionId)
          ? value.subscriptionId
          : null,
      subscriptionActive: value.subscriptionActive === true,
      subscriptionCheckedAt: value.subscriptionCheckedAt ?? "",
      // Every store from before there were two plans is on the one there was.
      tier: parseTier(value.tier) ?? "creator",
      cycle: parseCycle(value.cycle) ?? "month",
      trialEnds: typeof value.trialEnds === "number" && value.trialEnds > 0 ? value.trialEnds : 0,
      mail: parseMail(value.mail),
      domain: parseDomain(value.domain),
      products: parseProducts(value.products),
      // Stores written before links existed simply have none, which is the
      // same as a store nobody has added one to yet.
      links: parseStoreLinks(value.links),
      hasDiscounts: value.hasDiscounts === true,
      listId:
        typeof value.listId === "string" && LIST_ID_PATTERN.test(value.listId)
          ? value.listId
          : null,
      look: parseLook(value.look),
      photoId:
        typeof value.photoId === "string" && PHOTO_ID_PATTERN.test(value.photoId)
          ? value.photoId
          : null,
      callsId:
        typeof value.callsId === "string" && LIST_ID_PATTERN.test(value.callsId)
          ? value.callsId
          : null,
      statsId:
        typeof value.statsId === "string" && LIST_ID_PATTERN.test(value.statsId)
          ? value.statsId
          : null,
      pixels: parsePixels(value.pixels),
      tax: parseTax(value.tax),
      // Stores written before reminders existed have them off, as every
      // store does until its creator says otherwise.
      recovery: parseRecovery(value.recovery),
      // Stores written before communities existed simply have none.
      community: parseCommunityRef(value.community),
      affiliates: parseAffiliateSetting(value.affiliates),
    };
  } catch {
    return null;
  }
}

/**
 * Reads a typed price into whole cents.
 *
 * Only a plain amount is accepted — 27, 27.5, 27.50 — with no currency sign,
 * no thousands separator and no more than two decimals, because every one of
 * those is a way for what the creator meant and what the page charges to drift
 * apart. Returns null when the text is not one unambiguous amount.
 */
export function priceToCents(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * The price as a person reads it: 2700 becomes "27" and 2750 becomes "27.50".
 *
 * The round amount loses its two zeros because that is how a price is written
 * on a page, and feeding this back into priceToCents gives the same cents, so
 * the editor can show it in the field the creator typed it into.
 */
export function centsToPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

/** The store belonging to a signed-in creator, or null if they have none. */
export async function storeForEmail(
  email: string | null,
): Promise<Store | null> {
  if (!email || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", await ownerKey(email)]]);
  return parseStore(raw);
}

/** The store behind a public address, or null if that handle is free. */
export async function storeForHandle(handle: string): Promise<Store | null> {
  if (!isRedisConfigured()) return null;
  if (handleProblem(handle)) return null;
  const [email] = await redisPipeline([["GET", handleKey(handle)]]);
  if (typeof email !== "string" || !email) return null;
  // A name that was let go is held, not owned: it leads nowhere on purpose.
  if (email.startsWith(RELEASED_PREFIX)) return null;
  const [raw] = await redisPipeline([["GET", await ownerKey(email)]]);
  return parseStore(raw);
}

/**
 * One step through every store, for a scheduled job that has to look at all
 * of them. `cursor` is Redis's own: "0" to begin, and "0" comes back once the
 * last store has been read. A store can be seen twice while it moves between
 * addresses, so whatever is done with each one has to be safe to repeat.
 */
export async function storesAfter(cursor: string): Promise<{ stores: Store[]; next: string }> {
  if (!isRedisConfigured()) return { stores: [], next: "0" };
  const [reply] = await redisPipeline([["SCAN", cursor, "MATCH", "nl:store:owner:*", "COUNT", 200]]);
  if (!Array.isArray(reply) || reply.length < 2) return { stores: [], next: "0" };
  const next = String(reply[0]);
  const keys = Array.isArray(reply[1]) ? (reply[1] as unknown[]).map(String) : [];
  if (keys.length === 0) return { stores: [], next };
  const values = await redisPipeline(keys.map((key) => ["GET", key]));
  const stores = values.map(parseStore).filter((store): store is Store => store !== null);
  return { stores, next };
}

export type ClaimResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "taken" | "reserved" | "shape" | "already" };

/**
 * Reserves a handle for a creator and creates their store.
 *
 * One store per account, and the handle is the address other people will
 * bookmark, so neither is handed out twice.
 */
export async function claimHandle(
  email: string,
  rawHandle: string,
  rawName: string,
  rawBio: string,
): Promise<ClaimResult> {
  const handle = normaliseHandle(rawHandle);
  const problem = handleProblem(handle);
  if (problem) return { ok: false, reason: problem };

  const existing = await storeForEmail(email);
  if (existing) return { ok: false, reason: "already" };

  const [taken] = await redisPipeline([
    ["SET", handleKey(handle), email.toLowerCase(), "NX"],
  ]);
  if (taken === null) return { ok: false, reason: "taken" };

  const store: Store = {
    handle,
    name: rawName.trim().slice(0, MAX_NAME_LENGTH) || handle,
    bio: rawBio.trim().slice(0, MAX_BIO_LENGTH),
    email: email.toLowerCase(),
    createdAt: new Date().toISOString(),
    previousHandles: [],
    renamedAt: "",
    stripeAccountId: null,
    stripeChargesEnabled: false,
    stripeCheckedAt: "",
    stripeCustomerId: null,
    subscriptionId: null,
    subscriptionActive: false,
    subscriptionCheckedAt: "",
    tier: "creator",
    cycle: "month",
    trialEnds: 0,
    mail: null,
    domain: null,
    products: [],
    links: [],
    hasDiscounts: false,
    listId: newListId(),
    look: { ...DEFAULT_LOOK },
    photoId: null,
    callsId: null,
    statsId: newListId(),
    pixels: { ...NO_PIXELS },
    tax: { ...NO_TAX },
    recovery: { ...NO_RECOVERY },
    community: null,
    affiliates: parseAffiliateSetting(null),
  };

  try {
    await redisPipeline([
      ["SET", await ownerKey(email), JSON.stringify(store)],
    ]);
  } catch (error) {
    // Give the name back rather than leaving it locked to a store that does
    // not exist.
    await redisPipeline([["DEL", handleKey(handle)]]).catch(() => {});
    throw error;
  }

  return { ok: true, store };
}

export type RenameResult =
  | { ok: true; store: Store }
  | {
      ok: false;
      reason: "taken" | "reserved" | "shape" | "none" | "same" | "too_many";
      limit?: number;
    };

/**
 * Moves a store to a new address without breaking the old one.
 *
 * The first address a creator picks is usually picked in a hurry, and by then
 * it is already in their bio, in old posts and in messages other people sent.
 * So the old address is never handed to anyone else and never stops working:
 * it keeps pointing at this store, and the page sends visitors on to the new
 * address by itself. Nothing published has to be redone.
 *
 * Nobody has to be asked, and nothing has to be waited for. The creator does
 * it alone, and it takes effect on the spot.
 */
export async function renameHandle(
  email: string,
  rawHandle: string,
): Promise<RenameResult> {
  const handle = normaliseHandle(rawHandle);
  const problem = handleProblem(handle);
  if (problem) return { ok: false, reason: problem };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.handle === handle) return { ok: false, reason: "same" };

  // Going back to an address this store already owns costs nothing: no new
  // lock, and no room on the shelf, because it never stopped being theirs.
  if (!store.previousHandles.includes(handle)) {
    if (store.previousHandles.length + 2 > MAX_ADDRESSES) {
      return { ok: false, reason: "too_many", limit: MAX_ADDRESSES };
    }
    const [taken] = await redisPipeline([
      ["SET", handleKey(handle), email.toLowerCase(), "NX"],
    ]);
    if (taken === null) return { ok: false, reason: "taken" };
  }

  const next: Store = {
    ...store,
    handle,
    previousHandles: [
      ...store.previousHandles.filter((old) => old !== handle),
      store.handle,
    ].slice(-20),
    renamedAt: new Date().toISOString(),
  };

  await redisPipeline([
    ["SET", await ownerKey(email), JSON.stringify(next)],
    // The store's own domain follows it to the new address.
    ...(next.domain ? [["SET", `nl:domain:${next.domain.name}`, handle]] : []),
  ]);
  return { ok: true, store: next };
}

export type StripeAccountResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "shape" };

/**
 * Writes down which Stripe account a creator connected.
 *
 * Only the identifier is kept. Nimbus never holds a key to that account and
 * never holds the money that lands in it.
 */
export async function setStripeAccount(
  email: string,
  accountId: string,
  chargesEnabled = false,
): Promise<StripeAccountResult> {
  if (!STRIPE_ACCOUNT_PATTERN.test(accountId)) {
    return { ok: false, reason: "shape" };
  }
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const next: Store = {
    ...store,
    stripeAccountId: accountId,
    stripeChargesEnabled: chargesEnabled,
    stripeCheckedAt: new Date().toISOString(),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

/**
 * Writes down who is paying us, and whether that payment is in good standing.
 *
 * Called on the way back from checkout and every time the studio is opened,
 * so the snapshot the public store page trusts is refreshed at the moment the
 * creator would notice it being wrong.
 */
export async function setSubscription(
  email: string,
  fields: {
    customerId?: string | null;
    subscriptionId?: string | null;
    active: boolean;
    tier?: Tier;
    cycle?: Cycle;
    trialEnds?: number;
  },
): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store) return null;

  const customerId =
    fields.customerId === undefined ? store.stripeCustomerId : fields.customerId;
  const subscriptionId =
    fields.subscriptionId === undefined
      ? store.subscriptionId
      : fields.subscriptionId;

  // A malformed id is refused rather than written down, for the same reason a
  // malformed account id is: a bad id here means every later question about
  // this store's subscription asks Stripe about something that is not it.
  if (customerId !== null && !CUSTOMER_PATTERN.test(customerId)) return null;
  if (subscriptionId !== null && !SUBSCRIPTION_PATTERN.test(subscriptionId)) {
    return null;
  }

  const next: Store = {
    ...store,
    stripeCustomerId: customerId,
    subscriptionId,
    subscriptionActive: fields.active,
    subscriptionCheckedAt: new Date().toISOString(),
    tier: fields.tier ?? store.tier,
    cycle: fields.cycle ?? store.cycle,
    trialEnds: fields.trialEnds ?? store.trialEnds,
  };
  await saveStore(next);
  return next;
}

/** Forgets the connection here. Returns the account that was let go. */
export async function clearStripeAccount(
  email: string,
): Promise<{ store: Store; was: string | null } | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  const was = store.stripeAccountId;
  const next: Store = {
    ...store,
    stripeAccountId: null,
    stripeChargesEnabled: false,
    stripeCheckedAt: "",
  };
  await saveStore(next);
  return { store: next, was };
}

export type MoveResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "same" | "taken" };

/**
 * Moves a store from one sign-in address to another.
 *
 * The address is the key to everything here, which is kind right up until the
 * day a creator loses that inbox. This is the door out, and it only opens from
 * the inside: they move the store while they can still sign in.
 *
 * The new record is written before the old one is deleted, so an interrupted
 * move leaves the store findable rather than gone.
 *
 * Files already attached keep working. Their paths were written down when they
 * were uploaded and are read back as written, so they stay reachable in the
 * folder of the old address; only new uploads land in the new one.
 */
export async function moveAccount(
  fromEmail: string,
  toEmail: string,
): Promise<MoveResult> {
  const from = fromEmail.toLowerCase();
  const to = toEmail.toLowerCase();
  if (from === to) return { ok: false, reason: "same" };
  if (!isRedisConfigured()) return { ok: false, reason: "none" };

  const store = await storeForEmail(from);
  if (!store) return { ok: false, reason: "none" };

  // The address it is moving to must not already own a store of its own.
  const [existing] = await redisPipeline([["GET", await ownerKey(to)]]);
  if (typeof existing === "string" && existing) {
    return { ok: false, reason: "taken" };
  }

  const next: Store = { ...store, email: to };
  const handles = [store.handle, ...store.previousHandles];
  await redisPipeline([
    ["SET", await ownerKey(to), JSON.stringify(next)],
    ...handles.map((handle) => ["SET", handleKey(handle), to]),
    ["DEL", await ownerKey(from)],
  ]);
  return { ok: true, store: next };
}

export type ReleaseResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "current" | "unknown" };

/**
 * Lets go of an address the store used before.
 *
 * This is the one destructive thing a creator can do to their own audience,
 * so it is never automatic and never implied: a link still printed under that
 * name stops working the moment it is released, and a month later the name
 * may belong to somebody else. It exists because the opposite is worse. An
 * address mistyped and abandoned a minute later, never published anywhere,
 * would otherwise sit on a slot for good.
 *
 * Freeing the slot costs the name: it goes back on the shelf rather than
 * staying quietly in this account. That is what keeps the ceiling honest —
 * nobody can pile up names by releasing them.
 */
export async function releaseHandle(
  email: string,
  rawHandle: string,
): Promise<ReleaseResult> {
  const handle = normaliseHandle(rawHandle);

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.handle === handle) return { ok: false, reason: "current" };
  if (!store.previousHandles.includes(handle)) {
    return { ok: false, reason: "unknown" };
  }

  await redisPipeline([
    [
      "SET",
      handleKey(handle),
      `${RELEASED_PREFIX}${new Date().toISOString()}`,
      "EX",
      RELEASE_QUARANTINE_DAYS * 24 * 60 * 60,
    ],
  ]);

  const next: Store = {
    ...store,
    previousHandles: store.previousHandles.filter((old) => old !== handle),
  };
  await redisPipeline([["SET", await ownerKey(email), JSON.stringify(next)]]);

  return { ok: true, store: next };
}

/**
 * Writes a store back under its owner.
 *
 * Everything below reads the store, changes one thing and writes the whole
 * record back. Two edits fired at the very same instant from two open tabs
 * would leave only the second one, which is the honest cost of keeping the
 * store in a single small record. One person editing their own store does not
 * meet that case; if stores ever gain collaborators, this is the line that has
 * to change first.
 */
async function saveStore(store: Store, before?: Store): Promise<void> {
  const json = JSON.stringify(store);
  // Only a write that makes the record bigger is weighed, so a store at the
  // ceiling can always remove, shorten and reorder.
  if (before && byteLength(json) > MAX_STORE_BYTES && byteLength(json) > byteLength(JSON.stringify(before))) {
    throw new StoreFullError();
  }
  await redisPipeline([["SET", await ownerKey(store.email), json]]);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export type DetailsResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "name" };

/**
 * Changes the name and the description the public page shows.
 *
 * The address is deliberately not touched here: it is the part other people
 * have written down, so it has a door of its own with its own warnings.
 */
export async function updateDetails(
  email: string,
  rawName: string,
  rawBio: string,
): Promise<DetailsResult> {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) return { ok: false, reason: "name" };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };

  const next: Store = {
    ...store,
    name,
    bio: rawBio.trim().slice(0, MAX_BIO_LENGTH),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

export type CallResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "unknown" | "free" | "recurring" | "options" | "delivery" | "course" | "pwyw" };

/**
 * Makes a product a paid call, changes when it can be booked, or turns it
 * back into an ordinary product.
 *
 * A product can become a call only when nothing else is attached to it: no
 * file, no link, no price options and no schedule of payments. Those would
 * all be things the buyer is promised and never sent.
 */
export async function setProductCall(
  email: string,
  id: string,
  setup: CallSetup | null,
): Promise<CallResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };
  const product = store.products[at];
  if (setup) {
    if (isFree(product)) return { ok: false, reason: "free" };
    if (product.recurring) return { ok: false, reason: "recurring" };
    if (product.options.length > 0) return { ok: false, reason: "options" };
    if (product.file || product.link) return { ok: false, reason: "delivery" };
    if (product.course) return { ok: false, reason: "course" };
    if (product.pwyw) return { ok: false, reason: "pwyw" };
  }
  const products = [...store.products];
  products[at] = { ...product, call: setup };
  const next: Store = {
    ...store,
    products,
    callsId: store.callsId ?? (setup ? newListId() : null),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

export type CourseResult =
  | { ok: true; store: Store; product: Product }
  | { ok: false; reason: "none" | "unknown" | "free" | "options" | "delivery" | "call" | "not_empty" };

/**
 * Makes a product a course, or turns an empty course back into an ordinary
 * product.
 *
 * Like a call, a course can only be made from a product with nothing else
 * attached, because it delivers its own lessons. It can only be turned back
 * once its lessons are gone, so a course full of work is never lost to one
 * press; the course record itself is the caller's to create and drop.
 */
export async function setProductCourse(
  email: string,
  id: string,
  course: CourseRef | null,
): Promise<CourseResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };
  const product = store.products[at];
  if (course) {
    if (isFree(product)) return { ok: false, reason: "free" };
    if (product.options.length > 0) return { ok: false, reason: "options" };
    if (product.file || product.link) return { ok: false, reason: "delivery" };
    if (product.call) return { ok: false, reason: "call" };
  } else if (product.course && product.course.lessons > 0) {
    return { ok: false, reason: "not_empty" };
  }
  const products = [...store.products];
  products[at] = { ...product, course };
  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next, product: products[at] };
}

/** Keeps the lesson count a store record carries in step with its course. */
export async function setCourseLessons(email: string, id: string, lessons: number): Promise<void> {
  const store = await storeForEmail(email);
  if (!store) return;
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0 || !store.products[at].course) return;
  if (store.products[at].course?.lessons === lessons) return;
  const products = [...store.products];
  products[at] = { ...products[at], course: { id: products[at].course!.id, lessons } };
  await saveStore({ ...store, products });
}

/**
 * Gives the store its community, or switches it on or off. The id is made
 * once and kept, so switching off and on again finds every post where it was.
 */
export async function setCommunity(email: string, on: boolean): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  const id = store.community?.id ?? crypto.randomUUID().replace(/-/g, "");
  const next: Store = { ...store, community: { id, on } };
  await saveStore(next);
  return next;
}

/** Saves how the creator's emails are signed. */
export async function setMailSettings(email: string, mail: MailSettings): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  const next: Store = { ...store, mail, listId: store.listId ?? newListId() };
  await saveStore(next);
  return next;
}

/** Gives a store its list, the first time something needs one. */
/** Records the store's own domain, or takes it off (null). */
export async function setDomain(email: string, domain: StoreDomain | null): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  const next: Store = { ...store, domain };
  await saveStore(next);
  return next;
}

export async function ensureListId(email: string): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store || store.listId) return store;
  const next: Store = { ...store, listId: newListId() };
  await saveStore(next);
  return next;
}

export type ExtrasResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "unknown" | "kind" | "target" | "price" };

/**
 * Sets or clears a product's limited quantity and its order bump.
 *
 * Both apply to one-off paid products only. The product offered in the box
 * must be another one-off of the same store with one price and one delivery,
 * and it can never cost more that way than on its own.
 */
export async function setProductExtras(
  email: string,
  id: string,
  change: { stock?: number | null; bump?: Bump | null; plan?: Plan | null },
): Promise<ExtrasResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };
  const product = store.products[at];
  const next: Product = { ...product };

  if (change.stock !== undefined) {
    if (change.stock !== null && !isOneOff(product)) return { ok: false, reason: "kind" };
    next.stock = change.stock;
  }
  if (change.bump !== undefined) {
    if (change.bump !== null) {
      // The amount a buyer chooses has to be the checkout's only line.
      if (!isOneOff(product) || product.pwyw) return { ok: false, reason: "kind" };
      const target = store.products.find((p) => p.id === change.bump!.productId);
      if (!target || target.id === product.id || !canBeBumped(target)) return { ok: false, reason: "target" };
      if (change.bump.priceCents > target.priceCents) return { ok: false, reason: "price" };
    }
    next.bump = change.bump;
  }
  if (change.plan !== undefined) {
    if (change.plan !== null) {
      if (!isOneOff(product) || product.options.length > 0 || product.pwyw) return { ok: false, reason: "kind" };
      if (change.plan.payments * change.plan.amountCents < product.priceCents) return { ok: false, reason: "price" };
    }
    next.plan = change.plan;
  }

  const products = [...store.products];
  products[at] = next;
  const saved: Store = { ...store, products, statsId: store.statsId ?? newListId() };
  await saveStore(saved, store);
  return { ok: true, store: saved };
}

/** Switches sales tax on or off for the store's checkouts. */
export async function setTax(
  email: string,
  tax: TaxSetting,
): Promise<{ ok: true; store: Store } | { ok: false; reason: "none" }> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const next: Store = { ...store, tax: parseTax(tax) };
  await saveStore(next);
  return { ok: true, store: next };
}

/**
 * Switches the abandoned-checkout reminder on or off. The store is also given
 * the id its reminders are counted and stopped under, if it has none yet.
 */
export async function setRecovery(
  email: string,
  recovery: RecoverySetting,
): Promise<{ ok: true; store: Store } | { ok: false; reason: "none" }> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const next: Store = { ...store, recovery: parseRecovery(recovery), statsId: store.statsId ?? newListId() };
  await saveStore(next);
  return { ok: true, store: next };
}

export type FunnelResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "unknown" | FunnelProblem };

/**
 * Sets or clears what is offered after paying for one product. Checked
 * against the store as it is now (lib/funnel.ts), so a funnel that could not
 * be shown to a buyer is refused here rather than skipped on the thanks page.
 */
export async function setProductFunnel(email: string, id: string, funnel: Funnel | null): Promise<FunnelResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };
  const product = store.products[at];
  if (funnel) {
    const problem = funnelProblem(funnel, store.products, product);
    if (problem) return { ok: false, reason: problem };
  }
  const products = [...store.products];
  products[at] = { ...product, funnel };
  const saved: Store = { ...store, products };
  await saveStore(saved, store);
  return { ok: true, store: saved };
}

/**
 * Saves the affiliate programme's terms. The store is also given the id its
 * affiliates, clicks and sales are kept under, if it has none yet.
 */
export async function setAffiliateSetting(
  email: string,
  setting: AffiliateSetting,
): Promise<{ ok: true; store: Store } | { ok: false; reason: "none" }> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const known = new Set(store.products.map((p) => p.id));
  const parsed = parseAffiliateSetting(setting);
  const rates = Object.fromEntries(Object.entries(parsed.rates).filter(([id]) => known.has(id)));
  const next: Store = { ...store, affiliates: { ...parsed, rates }, statsId: store.statsId ?? newListId() };
  await saveStore(next, store);
  return { ok: true, store: next };
}

/** Saves the creator's ad pixels. */
export async function setPixels(
  email: string,
  pixels: Pixels,
): Promise<{ ok: true; store: Store } | { ok: false; reason: "none" }> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const next: Store = { ...store, pixels: parsePixels(pixels) };
  await saveStore(next);
  return { ok: true, store: next };
}

/**
 * Gives a store written before visits were counted the id they are counted
 * under. Called from the owner's own studio, so it never races a visitor.
 */
export async function ensureStatsId(email: string): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  if (store.statsId) return store;
  const next: Store = { ...store, statsId: newListId() };
  await saveStore(next);
  return next;
}

/** Changes the theme and the colour of the public page. */
export async function updateLook(
  email: string,
  look: StoreLook,
): Promise<{ ok: true; store: Store } | { ok: false; reason: "none" }> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const next: Store = { ...store, look: parseLook(look) };
  await saveStore(next);
  return { ok: true, store: next };
}

/**
 * Points the store at a photo, or at none, and says which one it replaced so
 * the caller can delete the old picture once nothing refers to it.
 */
export async function setPhotoId(
  email: string,
  photoId: string | null,
): Promise<{ ok: true; store: Store; was: string | null } | { ok: false; reason: "none" }> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const next: Store = { ...store, photoId };
  await saveStore(next);
  return { ok: true, store: next, was: store.photoId };
}

export type ProductResult =
  | { ok: true; store: Store }
  | {
      ok: false;
      reason: "none" | "title" | "price" | "free" | "too_many" | "unknown" | "call" | "course" | "pwyw";
      limit?: number;
      /** When the choose-your-price setting was refused: why. */
      pwyw?: PwywProblem;
    };

/** An id nothing else in this store is using. */
function freshId(store: Store): string {
  // Products and links are separate lists, but an id is read from a form and
  // an id shared between the two is an accident waiting to be found by
  // somebody else. Both lists are counted.
  const taken = new Set([
    ...store.products.map((product) => product.id),
    ...store.products.flatMap((product) =>
      product.options.map((option) => option.id),
    ),
    ...store.links.map((link) => link.id),
  ]);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    if (!taken.has(id)) return id;
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Checks a title and a typed price, and returns the price in cents. */
function readFields(
  rawTitle: string,
  rawPrice: string,
): { title: string; priceCents: number } | "title" | "price" {
  const title = rawTitle.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) return "title";
  const priceCents = priceToCents(rawPrice);
  if (priceCents === null) return "price";
  // Zero is allowed and means free. Anything between zero and the minimum is
  // not: Stripe will not charge it, and a buyer would meet a card form that
  // cannot work.
  if (priceCents === 0) return { title, priceCents };
  if (priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS) {
    return "price";
  }
  return { title, priceCents };
}

/** Adds something to the store, at the end of the list. */
export async function addProduct(
  email: string,
  rawTitle: string,
  rawSummary: string,
  rawPrice: string,
  recurring: Recurring | null = null,
  /** The suggested price, when the buyer chooses what to pay. */
  pwywCents: number | null = null,
): Promise<ProductResult> {
  const fields = readFields(rawTitle, rawPrice);
  if (typeof fields === "string") return { ok: false, reason: fields };
  // Something given away is given once. A membership that charges nothing
  // would be a subscription to nothing, so the two cannot be combined.
  if (fields.priceCents === 0 && recurring) return { ok: false, reason: "free" };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.products.length >= MAX_PRODUCTS) {
    return { ok: false, reason: "too_many", limit: MAX_PRODUCTS };
  }

  const product: Product = {
    id: freshId(store),
    title: fields.title,
    summary: rawSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
    priceCents: fields.priceCents,
    createdAt: new Date().toISOString(),
    file: null,
    link: null,
    recurring,
    options: [],
    call: null,
    stock: null,
    bump: null,
    funnel: null,
    plan: null,
    course: null,
    image: null,
    display: "button",
    fields: [],
    pwyw: null,
    about: false,
    keys: null,
    stamp: false,
  };
  if (pwywCents !== null) {
    const problem = pwywProblem(product, pwywCents);
    if (problem) return { ok: false, reason: "pwyw", pwyw: problem };
    product.pwyw = { suggestedCents: pwywCents };
  }

  const next: Store = {
    ...store,
    products: [...store.products, product],
    // Stores opened before free products existed get their list the first
    // time they give something away, in the creator's own write, so no
    // visitor's request ever has to write the store record.
    listId: store.listId ?? (fields.priceCents === 0 ? newListId() : null),
  };
  await saveStore(next, store);
  return { ok: true, store: next };
}

/** Changes something already on the store, keeping its place in the list. */
export async function editProduct(
  email: string,
  id: string,
  rawTitle: string,
  rawSummary: string,
  rawPrice: string,
  recurring: Recurring | null = null,
  pwywCents: number | null = null,
): Promise<ProductResult> {
  const fields = readFields(rawTitle, rawPrice);
  if (typeof fields === "string") return { ok: false, reason: fields };
  if (fields.priceCents === 0 && recurring) return { ok: false, reason: "free" };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };
  // A product with several prices cannot become free: the buyer would be
  // shown prices for a thing the page says costs nothing. Take the options
  // off first, and the choice is the creator's rather than ours.
  if (fields.priceCents === 0 && store.products[at].options.length > 0) {
    return { ok: false, reason: "free" };
  }
  // A call is one paid booking. It cannot be given away or charged monthly.
  if (store.products[at].call && (fields.priceCents === 0 || recurring)) {
    return { ok: false, reason: "call" };
  }
  // A course is sold. Giving lessons away for an email address is not built.
  if (store.products[at].course && fields.priceCents === 0) {
    return { ok: false, reason: "course" };
  }

  const products = [...store.products];
  products[at] = {
    ...products[at],
    title: fields.title,
    summary: rawSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
    priceCents: fields.priceCents,
    recurring,
    pwyw: null,
  };
  if (pwywCents !== null) {
    const problem = pwywProblem(products[at], pwywCents);
    if (problem) return { ok: false, reason: "pwyw", pwyw: problem };
    products[at].pwyw = { suggestedCents: pwywCents };
  }

  const next: Store = {
    ...store,
    products,
    listId: store.listId ?? (fields.priceCents === 0 ? newListId() : null),
  };
  await saveStore(next, store);
  return { ok: true, store: next };
}

/** Takes something off the store. */
export async function removeProduct(
  email: string,
  id: string,
): Promise<ProductResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (!store.products.some((product) => product.id === id)) {
    return { ok: false, reason: "unknown" };
  }

  const next: Store = {
    ...store,
    products: store.products.filter((product) => product.id !== id),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

/**
 * Moves something one place up or down, or straight to the top or the end.
 *
 * The order is the creator's, not ours: the first thing on the page is the
 * thing they want read first, so nothing here sorts by price or by date.
 */
export async function moveProduct(
  email: string,
  id: string,
  direction: "up" | "down" | "top" | "bottom",
): Promise<ProductResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };

  // With a long list, one place at a time is a lot of presses to reach the
  // top, so the two ends are one press each.
  const to =
    direction === "top" ? 0 : direction === "bottom" ? store.products.length - 1 : direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= store.products.length || to === at) return { ok: true, store };

  const products = [...store.products];
  const [moving] = products.splice(at, 1);
  products.splice(to, 0, moving);

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next };
}

export type FileResult =
  | { ok: true; store: Store; removed: ProductFile | null }
  | { ok: false; reason: "none" | "unknown" | "invalid" | "call" | "course" };

/** What is handed over when something is paid for. One or the other. */
export type Delivery = { file: ProductFile | null; link: string | null };

/**
 * The delivery an id names: a product's own, or one of its options'.
 *
 * Option ids are unique across the whole store, so one id is enough to find
 * either, and the screens above never have to say which kind they mean. That
 * is also what lets an option's file live under the same folder rule a
 * product's does, with no second path shape to get wrong.
 */
export function deliveryAt(
  store: Store,
  id: string,
): { product: Product; option: ProductOption | null } | null {
  for (const product of store.products) {
    if (product.id === id) return { product, option: null };
    const option = product.options.find((entry) => entry.id === id);
    if (option) return { product, option };
  }
  return null;
}

/** Whether this store owns that id, asked before any upload is signed. */
export function ownsDeliveryId(store: Store, id: string): boolean {
  return deliveryAt(store, id) !== null;
}

/**
 * Rewrites the delivery an id names, wherever it hangs.
 *
 * Returns the new product list and what was there before, so the caller can
 * release the storage the old file used once the record that replaced it is
 * safely written.
 */
function rewriteDelivery(
  products: Product[],
  id: string,
  change: (current: Delivery) => Delivery,
): { products: Product[]; previous: Delivery } | null {
  for (let i = 0; i < products.length; i += 1) {
    const product = products[i];

    if (product.id === id) {
      const previous: Delivery = { file: product.file, link: product.link };
      const copy = [...products];
      copy[i] = { ...product, ...change(previous) };
      return { products: copy, previous };
    }

    const at = product.options.findIndex((option) => option.id === id);
    if (at >= 0) {
      const option = product.options[at];
      const previous: Delivery = { file: option.file, link: option.link };
      const options = [...product.options];
      options[at] = { ...option, ...change(previous) };
      const copy = [...products];
      copy[i] = { ...product, options };
      return { products: copy, previous };
    }
  }
  return null;
}

/**
 * Puts a file on a product or on one of its price options, or takes it off.
 *
 * The blob itself is written and deleted by the route, because that talks to
 * the file store over the network and this does not. What comes back is the
 * file that was displaced, so the caller can delete it once the record that
 * pointed at it is safely written. Deleting it first would risk a product
 * pointing at nothing if the write then failed.
 */
export async function setProductFile(
  email: string,
  id: string,
  file: ProductFile | null,
): Promise<FileResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  // A call delivers a booking, not a file.
  if (file && store.products.some((product) => product.id === id && product.call)) {
    return { ok: false, reason: "call" };
  }
  // A course delivers its lessons, each with files of its own.
  if (file && store.products.some((product) => product.id === id && product.course)) {
    return { ok: false, reason: "course" };
  }
  // A file replaces a link. One thing is delivered, never two.
  const done = rewriteDelivery(store.products, id, (current) => ({
    file,
    link: file ? null : current.link,
  }));
  if (!done) return { ok: false, reason: "unknown" };

  const next: Store = { ...store, products: done.products };
  await saveStore(next);
  return { ok: true, store: next, removed: done.previous.file };
}

/**
 * Points a product or option at a link instead of a file, or takes it away.
 *
 * Mirrors setProductFile, including the part that matters: setting one clears
 * the other. It returns the file that was displaced so the caller can release
 * the storage it used, once the record that pointed at it is safely written.
 */
export async function setProductLink(
  email: string,
  id: string,
  link: string | null,
): Promise<FileResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (link && store.products.some((product) => product.id === id && product.call)) {
    return { ok: false, reason: "call" };
  }
  if (link && store.products.some((product) => product.id === id && product.course)) {
    return { ok: false, reason: "course" };
  }
  const done = rewriteDelivery(store.products, id, (current) => ({
    link,
    file: link ? null : current.file,
  }));
  if (!done) return { ok: false, reason: "unknown" };

  const next: Store = { ...store, products: done.products };
  await saveStore(next);
  // Taking a link off displaces nothing; putting one on displaces the file.
  return { ok: true, store: next, removed: link ? done.previous.file : null };
}

/**
 * The file an id names, or null. Used before serving a download.
 *
 * Reaches an option's file as readily as a product's, so a creator can open
 * each price option and check that the right thing is behind it.
 */
export async function productFile(
  email: string,
  id: string,
): Promise<{ product: Product; file: ProductFile } | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  const found = deliveryAt(store, id);
  if (!found) return null;
  const file = found.option ? found.option.file : found.product.file;
  return file ? { product: found.product, file } : null;
}

/** Every file a product holds, its options included. Read before removing it. */
export function filesOnProduct(product: Product): ProductFile[] {
  const files = product.file ? [product.file] : [];
  for (const option of product.options) {
    if (option.file) files.push(option.file);
  }
  return files;
}

export type LinkResult =
  | { ok: true; store: Store }
  | {
      ok: false;
      reason: "none" | "title" | "too_many" | "unknown";
      limit?: number;
    };

/**
 * Adds a link to the page, at the end of the list.
 *
 * The address arrives already checked and normalised by readLink, because the
 * route that took it from the creator is the place that knows how to tell them
 * which way it was wrong. What is left to check here is the title, which is
 * the only thing a visitor reads before deciding to follow it.
 */
export async function addStoreLink(
  email: string,
  rawTitle: string,
  url: string,
): Promise<LinkResult> {
  const title = rawTitle.trim().slice(0, MAX_LINK_TITLE_LENGTH);
  if (!title) return { ok: false, reason: "title" };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.links.length >= MAX_STORE_LINKS) {
    return { ok: false, reason: "too_many", limit: MAX_STORE_LINKS };
  }

  const link: StoreLink = {
    id: freshId(store),
    title,
    url,
    addedAt: new Date().toISOString(),
  };

  const next: Store = { ...store, links: [...store.links, link] };
  await saveStore(next, store);
  return { ok: true, store: next };
}

/** Changes a link already on the page, keeping its place in the list. */
export async function editStoreLink(
  email: string,
  id: string,
  rawTitle: string,
  url: string,
): Promise<LinkResult> {
  const title = rawTitle.trim().slice(0, MAX_LINK_TITLE_LENGTH);
  if (!title) return { ok: false, reason: "title" };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.links.findIndex((link) => link.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };

  const links = [...store.links];
  links[at] = { ...links[at], title, url };

  const next: Store = { ...store, links };
  await saveStore(next, store);
  return { ok: true, store: next };
}

/** Takes a link off the page. Nothing else changes. */
export async function removeStoreLink(
  email: string,
  id: string,
): Promise<LinkResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (!store.links.some((link) => link.id === id)) {
    return { ok: false, reason: "unknown" };
  }

  const next: Store = {
    ...store,
    links: store.links.filter((link) => link.id !== id),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

/** Moves a link one place up or down, the way a product moves. */
export async function moveStoreLink(
  email: string,
  id: string,
  direction: "up" | "down",
): Promise<LinkResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.links.findIndex((link) => link.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };

  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= store.links.length) return { ok: true, store };

  const links = [...store.links];
  [links[at], links[to]] = [links[to], links[at]];

  const next: Store = { ...store, links };
  await saveStore(next);
  return { ok: true, store: next };
}

export type OptionResult =
  | { ok: true; store: Store; removed: ProductFile[] }
  | {
      ok: false;
      reason: "none" | "label" | "price" | "free" | "too_many" | "unknown" | "call" | "course" | "pwyw";
      limit?: number;
    };

/** Checks a label and a typed price for one option. */
function readOption(
  rawLabel: string,
  rawPrice: string,
): { label: string; priceCents: number } | "label" | "price" {
  const label = rawLabel.trim().slice(0, MAX_OPTION_LABEL_LENGTH);
  if (!label) return "label";
  const priceCents = priceToCents(rawPrice);
  if (priceCents === null) return "price";
  if (priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS) {
    return "price";
  }
  return { label, priceCents };
}

/** Adds a price option to a product, at the end of its list. */
export async function addOption(
  email: string,
  productId: string,
  rawLabel: string,
  rawPrice: string,
): Promise<OptionResult> {
  const fields = readOption(rawLabel, rawPrice);
  if (typeof fields === "string") return { ok: false, reason: fields };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === productId);
  if (at < 0) return { ok: false, reason: "unknown" };
  // Several prices on something given away would put a price on it.
  if (isFree(store.products[at])) return { ok: false, reason: "free" };
  if (store.products[at].call) return { ok: false, reason: "call" };
  if (store.products[at].course) return { ok: false, reason: "course" };
  // The buyer would be choosing a price twice.
  if (store.products[at].pwyw) return { ok: false, reason: "pwyw" };
  if (store.products[at].options.length >= MAX_OPTIONS) {
    return { ok: false, reason: "too_many", limit: MAX_OPTIONS };
  }

  const option: ProductOption = {
    id: freshId(store),
    label: fields.label,
    priceCents: fields.priceCents,
    file: null,
    link: null,
  };

  const products = [...store.products];
  products[at] = {
    ...products[at],
    options: [...products[at].options, option],
  };

  const next: Store = { ...store, products };
  await saveStore(next, store);
  return { ok: true, store: next, removed: [] };
}

/** Changes an option's label or price, keeping its place and its delivery. */
export async function editOption(
  email: string,
  id: string,
  rawLabel: string,
  rawPrice: string,
): Promise<OptionResult> {
  const fields = readOption(rawLabel, rawPrice);
  if (typeof fields === "string") return { ok: false, reason: fields };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const found = deliveryAt(store, id);
  if (!found || !found.option) return { ok: false, reason: "unknown" };

  const products = store.products.map((product) => {
    if (product.id !== found.product.id) return product;
    return {
      ...product,
      options: product.options.map((option) =>
        option.id === id
          ? { ...option, label: fields.label, priceCents: fields.priceCents }
          : option,
      ),
    };
  });

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next, removed: [] };
}

/**
 * Takes an option off a product.
 *
 * The file it held is handed back rather than deleted here, for the same
 * reason every other delivery change works that way: the record stops
 * pointing at it first, and only then is the storage released.
 */
export async function removeOption(
  email: string,
  id: string,
): Promise<OptionResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const found = deliveryAt(store, id);
  if (!found || !found.option) return { ok: false, reason: "unknown" };

  const removed = found.option.file ? [found.option.file] : [];
  const products = store.products.map((product) =>
    product.id === found.product.id
      ? {
          ...product,
          options: product.options.filter((option) => option.id !== id),
        }
      : product,
  );

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next, removed };
}

/** Moves an option one place up or down within its own product. */
export async function moveOption(
  email: string,
  id: string,
  direction: "up" | "down",
): Promise<OptionResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const found = deliveryAt(store, id);
  if (!found || !found.option) return { ok: false, reason: "unknown" };

  const current = found.product.options;
  const at = current.findIndex((option) => option.id === id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= current.length) return { ok: true, store, removed: [] };

  const options = [...current];
  [options[at], options[to]] = [options[to], options[at]];

  const products = store.products.map((product) =>
    product.id === found.product.id ? { ...product, options } : product,
  );

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next, removed: [] };
}

/**
 * Records whether this store has a live discount code.
 *
 * Only a snapshot of an answer that lives on the creator's Stripe account, so
 * the buyer's checkout does not have to ask Stripe on every click. It is
 * written whenever the creator's own screen has just read the real list.
 */
export async function setHasDiscounts(
  email: string,
  hasDiscounts: boolean,
): Promise<Store | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  if (store.hasDiscounts === hasDiscounts) return store;

  const next: Store = { ...store, hasDiscounts };
  await saveStore(next);
  return next;
}

export type ProductPartResult =
  | { ok: true; store: Store; product: Product }
  | { ok: false; reason: "none" | "unknown" };

/** Changes one product in place with `change`, and saves the store. */
async function changeProduct(
  email: string,
  id: string,
  change: (product: Product) => Product,
  extra: (store: Store) => Partial<Store> = () => ({}),
): Promise<ProductPartResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };
  const products = [...store.products];
  products[at] = change(products[at]);
  const next: Store = { ...store, ...extra(store), products };
  await saveStore(next, store);
  return { ok: true, store: next, product: products[at] };
}

/**
 * Puts a picture on a product, or takes it off. Returns the picture it
 * replaced, so the caller can delete it from the file store once the record
 * that pointed at it is safely written.
 */
export async function setProductImage(
  email: string,
  id: string,
  image: ProductImage | null,
): Promise<{ ok: true; store: Store; removed: ProductImage | null } | { ok: false; reason: "none" | "unknown" }> {
  let removed: ProductImage | null = null;
  const done = await changeProduct(email, id, (product) => {
    removed = product.image;
    return {
      ...product,
      image,
      // A picture added to a product still drawn as a plain card shows as a
      // callout, which is where a picture earns its place. Taking the picture
      // off puts the plain card back.
      display: image && !product.image && product.display === "button" ? "callout" : image ? product.display : "button",
    };
  });
  if (!done.ok) return done;
  return { ok: true, store: done.store, removed };
}

/** Changes the words a screen reader says instead of the picture. */
export async function setImageAlt(email: string, id: string, alt: string): Promise<ProductPartResult> {
  return changeProduct(email, id, (product) =>
    product.image ? { ...product, image: { ...product.image, alt } } : product,
  );
}

/** Changes how the product's card is drawn on the store page. */
export async function setProductDisplay(email: string, id: string, display: DisplayStyle): Promise<ProductPartResult> {
  return changeProduct(email, id, (product) => ({ ...product, display }));
}

/** Replaces the questions asked at checkout. An empty list asks none. */
export async function setProductFields(email: string, id: string, fields: CheckoutField[]): Promise<ProductPartResult> {
  return changeProduct(email, id, (product) => ({ ...product, fields }));
}

/**
 * Marks whether a product has a long description. The text itself is written
 * by lib/product-about.ts under the store's statsId, which is made here for a
 * store written before it had one.
 */
export async function setProductAbout(email: string, id: string, has: boolean): Promise<ProductPartResult> {
  return changeProduct(
    email,
    id,
    (product) => ({ ...product, about: has }),
    (store) => ({ statsId: store.statsId ?? newListId() }),
  );
}

export type KeysResult =
  | { ok: true; store: Store; product: Product }
  | { ok: false; reason: "none" | "unknown" | "kind" };

/**
 * Switches licence keys on for a product, changes how they are made, or
 * switches them off (null). Only a paid product sold once can have them. The
 * store is given the id its keys are kept under, if it has none yet.
 */
export async function setProductKeys(email: string, id: string, keys: KeySetup | null): Promise<KeysResult> {
  const store = await storeForEmail(email);
  const product = store?.products.find((p) => p.id === id);
  if (store && product && keys && !canHaveKeys(product)) return { ok: false, reason: "kind" };
  return changeProduct(
    email,
    id,
    (current) => ({ ...current, keys }),
    (current) => ({ statsId: current.statsId ?? newListId() }),
  );
}

/** Switches stamping the buyer's email into a product's PDFs on or off. */
export async function setProductStamp(email: string, id: string, on: boolean): Promise<ProductPartResult> {
  return changeProduct(email, id, (product) => ({ ...product, stamp: on }));
}
