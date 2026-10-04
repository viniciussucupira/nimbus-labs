/**
 * What a store sells, each product in a record of its own.
 *
 * Until now every product lived inside the store's one record, and that
 * record is read on every visit to every page of the store. It capped a store
 * at two hundred products, and it made every visitor carry every product's
 * checkout questions and funnel whether they looked at them or not. Now the
 * store record keeps only an ordered index and the first page of cards, and
 * each product is kept in two records of its own:
 *
 *   nl:catalog:<id>:l:<product>  the listing: everything its card, its own
 *                                page, a checkout and a download need to know
 *   nl:catalog:<id>:x:<product>  the heavy rest, the checkout questions and
 *                                the funnel, only when there is any
 *
 * The <id> is the catalog's own, written in the store record, so a new
 * address or a new sign-in email moves nothing here.
 *
 * The store record carries, for every product in the creator's order, its id,
 * a few bits saying what kind of thing it is (paid, a call, a course, a
 * membership, limited…) and the ids of its price options. That is enough to
 * answer "does this store sell any memberships?" or "which product holds this
 * option?" without reading a single product. It also carries the head: the
 * listings of the first page of the store, and of whatever those offer in a
 * box at checkout, so the store page most people see is drawn from the one
 * record it already reads, in the same two round trips as before, however
 * many products the store has.
 *
 * Stores written before this layout still carry their products inline. They
 * keep working as they are: everything here reads the inline list for them
 * (`inline`), and lib/store.ts moves such a store to its own records the
 * first time anything about it is written, and the daily job moves the rest.
 * The move is one step that cannot half-happen: the product records are
 * written first, under an id derived from the store, and only then is the
 * store record replaced, in one write. Until that write lands the old record
 * is the store, complete, and doing it again writes the same records.
 */
import { type CallPackage, parseCallPackage } from "@/lib/call-package-rules";
import { type PodcastRef, parsePodcastRef } from "@/lib/podcast-rules";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { type ProductFile, parseProductFile } from "@/lib/product-file";
import { type ProductOption, parseOptions } from "@/lib/product-option";
import { MAX_LINK_LENGTH } from "@/lib/product-link";
import { type Recurring, parseRecurring } from "@/lib/product-recurring";
import { type CallSetup, parseSetup } from "@/lib/call-setup";
import { COURSE_ID_PATTERN } from "@/lib/course";
import { type Bump, type Plan, canBeBumped, isOneOff, parseBump, parsePlan, parseStock } from "@/lib/product-extras";
import { type Funnel, funnelFromUpsell, parseFunnel } from "@/lib/funnel";
import { type PayWhatYouWant, parsePwyw } from "@/lib/pay-what-you-want";
import { type CheckoutField, parseFields } from "@/lib/checkout-fields";
import { type KeySetup, activeKeys, parseKeySetup } from "@/lib/key-setup";
import { type DisplayStyle, type ProductImage, parseDisplay, parseProductImage } from "@/lib/product-image";
import { deliveredIds, parseBundleItems } from "@/lib/bundle-rules";
import { type ExtraNotes, allExtraNotes } from "@/lib/extras-notes";
import type { Store } from "@/lib/store";

/**
 * How many things one store may list: two thousand.
 *
 * Stan says unlimited. Two thousand is a number we can stand behind: the
 * index of that many products is a few tens of kilobytes of the store record,
 * the store page shows them a page at a time, and the studio finds any one of
 * them by name. It is a ceiling nobody selling to their own audience meets,
 * and we say it as a number rather than a word we could not keep.
 */
export const MAX_PRODUCTS = 2_000;
export const MAX_TITLE_LENGTH = 80;
export const MAX_SUMMARY_LENGTH = 300;

/** Products on one page of the store; the first page lives in the store record. */
export const STORE_PAGE_SIZE = 24;

/** Products on one page of the studio's list, each one open to edit. */
export const STUDIO_PAGE_SIZE = 50;

/**
 * The most products offered at once as something to put in a box at checkout.
 *
 * A list to pick from stops being one well before this; the number is here so
 * that building it costs a bounded number of reads on a store of any size,
 * rather than one read per product in the catalogue.
 */
export const BUMP_CHOICES = 500;

/**
 * The most the head may weigh. A page of ordinary cards is a fraction of
 * this; a page of calls each with fifty dated sessions is not, and then the
 * cards that do not fit are read from their own records instead.
 */
export const HEAD_BYTES = 120_000;

/** The most one product's two records may weigh together. */
export const MAX_PRODUCT_BYTES = 256_000;

/** Thrown by a write that would take a record past its ceiling. */
export class StoreFullError extends Error {
  constructor() {
    super("store_full");
  }
}

/** The part of a course a product carries. */
export type CourseRef = { id: string; lessons: number };

/** One thing a store offers. */
export type Product = {
  id: string;
  title: string;
  summary: string;
  /** In the smallest unit of the store's currency (Store.currency, lib/money.ts). */
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
   * in the setters in lib/store.ts rather than in whatever screen calls them.
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
  /**
   * When this is a private podcast (lib/podcast-rules.ts): which record holds
   * its episodes, and how many it has. Absent or null for anything else.
   */
  podcast?: PodcastRef | null;
  /**
   * For a weekly call: several sessions sold at once, booked one at a time
   * (lib/call-package-rules.ts). Absent or null when it offers none.
   */
  callPackage?: CallPackage | null;
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
  /**
   * Whether its own page is built from blocks (lib/sales-page.ts), kept in a
   * record of its own. False is the page it has always had.
   */
  page: boolean;
  /**
   * When this is a bundle: the ids of the store's own products it hands over,
   * in the creator's order (lib/bundles.ts). A bundle delivers nothing of its
   * own; each product in it is delivered as if it had been bought on its own.
   * Null is an ordinary product.
   */
  bundle: string[] | null;
  /**
   * A draft: kept in the studio and left off the store, its own page and its
   * checkout until the creator publishes it. What an import makes starts
   * here. A hidden product can still be part of a bundle.
   */
  hidden: boolean;
};

/**
 * A product without its checkout questions and its funnel: what its card,
 * its own page, a download and most of the site need. Anything that takes a
 * Listing also takes a full Product.
 */
export type Listing = Omit<Product, "fields" | "funnel">;

/**
 * One product as the store record lists it: its id, what kind of thing it is
 * (the KIND bits) and the ids of its price options, so an option can be
 * traced to its product without reading anything.
 */
export type Item = { id: string; kind: number; options: string[] };

/** A store's products, as its record knows them. */
export type Catalog = {
  /** Where the products are kept. Null for a record that still carries them itself. */
  id: string | null;
  /** Every product, in the creator's order. */
  items: Item[];
  /** The listings of the first page, and of what those offer at checkout. */
  head: Listing[];
  /** A record from before this layout: its products, read in full. Null otherwise. */
  inline: Product[] | null;
};

/** What a product is, in bits a store record can carry for thousands of them. */
export const KIND = {
  paid: 1,
  free: 2,
  call: 4,
  weekly: 8,
  course: 16,
  recurring: 32,
  keys: 64,
  limited: 128,
  pool: 256,
  /** Offers follow its purchase (lib/funnel.ts). Known only from a product read in full. */
  funnel: 512,
  /** A bundle of other products (lib/bundles.ts). */
  bundle: 1024,
  /** A draft, left off the store until it is published. */
  hidden: 2048,
} as const;

export type Kind = keyof typeof KIND;

export const CATALOG_ID_PATTERN = /^[0-9a-f]{32}$/;
/** What may stand in a key: every id this site has ever made fits. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const listingKey = (catalog: string, product: string) => `nl:catalog:${catalog}:l:${product}`;
/**
 * Every product's title, in one hash.
 *
 * The index in the store record already answers what kind of thing each
 * product is — paid or free, a call, a course, a membership, limited, hidden —
 * without reading a single product record. The one thing it does not carry is
 * the name, and a name is what most screens in the studio actually want: a
 * list to pick from, a label beside a sale, a row in a table.
 *
 * So those screens were reading every product in the store to learn two
 * thousand strings. Upstash bills by the command, not by the round trip, so a
 * store at the ceiling cost two thousand commands every time its creator
 * opened the email page — per view, per creator, with no ceiling of its own.
 * That is the cost-without-a-limit this whole product is supposed not to have.
 *
 * A hash rather than one JSON blob on purpose: a title changes with HSET and a
 * product goes with HDEL, each one command under the lock the store is already
 * holding, with nothing to read first and nothing to re-serialise. Reading all
 * of them is one HGETALL.
 */
const titlesKey = (catalog: string) => `nl:catalog:${catalog}:t`;
const extrasKey = (catalog: string, product: string) => `nl:catalog:${catalog}:x:${product}`;

type Command = (string | number)[];

/** Reads one product from what was stored, or null when it is not one. */
export function parseProduct(entry: unknown): Product | null {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Partial<Product> & { upsell?: unknown };
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.title !== "string" || !value.title) return null;
  if (typeof value.priceCents !== "number") return null;
  if (!Number.isInteger(value.priceCents) || value.priceCents < 0) return null;
  return {
    id: value.id,
    title: value.title.slice(0, MAX_TITLE_LENGTH),
    summary: typeof value.summary === "string" ? value.summary.slice(0, MAX_SUMMARY_LENGTH) : "",
    priceCents: value.priceCents,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    file: parseProductFile(value.file),
    // Records written before links existed simply have no link, which is
    // the same as not having one now.
    link: typeof value.link === "string" && value.link ? value.link.slice(0, MAX_LINK_LENGTH) : null,
    recurring: parseRecurring(value.recurring),
    options: parseOptions(value.options),
    call: parseSetup(value.call),
    stock: parseStock(value.stock),
    bump: parseBump(value.bump),
    funnel: parseFunnel(value.funnel) ?? funnelFromUpsell(parseBump(value.upsell)),
    plan: parsePlan(value.plan),
    course: parseCourseRef(value.course),
    podcast: parsePodcastRef(value.podcast),
    callPackage: parseCallPackage(value.callPackage),
    image: parseProductImage(value.image),
    display: parseDisplay(value.display),
    fields: parseFields(value.fields),
    pwyw: parsePwyw(value.pwyw),
    about: value.about === true,
    // Products written before keys and stamping existed have neither.
    keys: parseKeySetup(value.keys),
    stamp: value.stamp === true,
    // Products written before pages of blocks existed have the plain page.
    page: value.page === true,
    // Products written before bundles and drafts existed are neither.
    bundle: parseBundleItems(value.bundle),
    hidden: value.hidden === true,
  };
}

function parseCourseRef(raw: unknown): CourseRef | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !COURSE_ID_PATTERN.test(value.id)) return null;
  const lessons = Number(value.lessons);
  return { id: value.id, lessons: Number.isInteger(lessons) && lessons >= 0 ? lessons : 0 };
}

/** The listing of a product: the product without its heavy parts. */
export function listingOf(product: Listing): Listing {
  // Built field by field, so a full product passed in leaves nothing behind.
  return {
    id: product.id,
    title: product.title,
    summary: product.summary,
    priceCents: product.priceCents,
    createdAt: product.createdAt,
    file: product.file,
    link: product.link,
    recurring: product.recurring,
    options: product.options,
    call: product.call,
    stock: product.stock,
    bump: product.bump,
    plan: product.plan,
    course: product.course,
    podcast: product.podcast ?? null,
    callPackage: product.callPackage ?? null,
    image: product.image,
    display: product.display,
    pwyw: product.pwyw,
    about: product.about,
    keys: product.keys,
    stamp: product.stamp,
    page: product.page,
    bundle: product.bundle,
    hidden: product.hidden,
  };
}

function parseListing(entry: unknown): Listing | null {
  const product = parseProduct(entry);
  return product ? listingOf(product) : null;
}

/** The kind bits of a product. */
export function kindOf(product: Listing & { funnel?: Product["funnel"] }): number {
  let bits = product.priceCents > 0 ? KIND.paid : KIND.free;
  if (product.call) bits |= KIND.call;
  if (product.call?.kind === "weekly") bits |= KIND.weekly;
  if (product.course) bits |= KIND.course;
  if (product.recurring) bits |= KIND.recurring;
  const keys = activeKeys(product);
  if (keys) bits |= KIND.keys;
  if (keys?.source === "pool") bits |= KIND.pool;
  if (product.stock !== null && isOneOff(product)) bits |= KIND.limited;
  if (product.funnel) bits |= KIND.funnel;
  if (product.bundle) bits |= KIND.bundle;
  if (product.hidden) bits |= KIND.hidden;
  return bits;
}

export function itemOf(product: Product): Item {
  return { id: product.id, kind: kindOf(product), options: product.options.map((option) => option.id) };
}

function parseItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || !SAFE_ID.test(entry[0])) continue;
    if (seen.has(entry[0])) continue;
    seen.add(entry[0]);
    const kind = Number(entry[1]);
    items.push({
      id: entry[0],
      kind: Number.isInteger(kind) && kind >= 0 ? kind : 0,
      options: entry.slice(2).filter((id): id is string => typeof id === "string" && SAFE_ID.test(id)),
    });
    if (items.length >= MAX_PRODUCTS) break;
  }
  return items;
}

/**
 * The catalog a store record describes. `raw` is its `catalog`, `legacy` its
 * old `products`; a record with a catalog is read from that alone.
 */
export function parseCatalog(raw: unknown, legacy: unknown): Catalog {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (value && typeof value.id === "string" && CATALOG_ID_PATTERN.test(value.id)) {
    const items = parseItems(value.items);
    const known = new Set(items.map((item) => item.id));
    const head = Array.isArray(value.head)
      ? value.head.map(parseListing).filter((listing): listing is Listing => listing !== null && known.has(listing.id))
      : [];
    return { id: value.id, items, head, inline: null };
  }
  const inline: Product[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(legacy) ? legacy : []) {
    const product = parseProduct(entry);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    inline.push(product);
    if (inline.length >= MAX_PRODUCTS) break;
  }
  const items = inline.map(itemOf);
  return { id: null, items, head: headFrom(items, new Map(inline.map((p) => [p.id, listingOf(p)]))), inline };
}

/** How a catalog is written into the store record. */
export function catalogRecord(catalog: Catalog): { id: string; items: (string | number)[][]; head: Listing[] } {
  if (!catalog.id) throw new Error("a store is written only once its products have records of their own");
  return {
    id: catalog.id,
    items: catalog.items.map((item) => [item.id, item.kind, ...item.options]),
    head: catalog.head,
  };
}

/** An empty catalog under a new id, for a new store. */
export function emptyCatalog(id: string): Catalog {
  return { id, items: [], head: [], inline: null };
}

// ---- Asking about the products without reading them ----------------------

export function productCount(store: Store): number {
  return store.catalog.items.length;
}

export function productIds(store: Store): string[] {
  return store.catalog.items.map((item) => item.id);
}

/**
 * What the public store lists, in the creator's order: every product but the
 * drafts. Answered from the index, so a store page learns it without reading.
 */
export function visibleIds(store: Store): string[] {
  return store.catalog.items.filter((item) => (item.kind & KIND.hidden) === 0).map((item) => item.id);
}

/** How many products the public store lists. */
export function visibleCount(store: Store): number {
  return store.catalog.items.reduce((n, item) => n + ((item.kind & KIND.hidden) === 0 ? 1 : 0), 0);
}

export function hasProduct(store: Store, id: string): boolean {
  return store.catalog.items.some((item) => item.id === id);
}

/** Where a product stands in the creator's order, or -1. */
export function positionOf(store: Store, id: string): number {
  return store.catalog.items.findIndex((item) => item.id === id);
}

/** Whether any product is of that kind. */
export function sellsAny(store: Store, kind: Kind): boolean {
  return store.catalog.items.some((item) => (item.kind & KIND[kind]) !== 0);
}

/** Whether the store sells something paid that is not a call: a thing a buyer can come back for. */
export function sellsThings(store: Store): boolean {
  return store.catalog.items.some((item) => (item.kind & KIND.paid) !== 0 && (item.kind & KIND.call) === 0);
}

/** What the store record says about one product, or null when it has no such product. */
export function itemFor(store: Store, id: string): Item | null {
  return store.catalog.items.find((item) => item.id === id) ?? null;
}

/** The ids of every product of that kind, in the creator's order. */
export function idsOfKind(store: Store, kind: Kind): string[] {
  return store.catalog.items.filter((item) => (item.kind & KIND[kind]) !== 0).map((item) => item.id);
}

/** The product an id names: itself, or the product one of whose options it is. */
export function productIdFor(store: Store, id: string): string | null {
  for (const item of store.catalog.items) {
    if (item.id === id || item.options.includes(id)) return item.id;
  }
  return null;
}

/** Every id in use: products and their options. */
export function usedIds(store: Store): Set<string> {
  return new Set(store.catalog.items.flatMap((item) => [item.id, ...item.options]));
}

/**
 * The listings the store record itself holds: every product of a store from
 * before, the first page (and what it offers at checkout) otherwise — so
 * every product of a store of up to STORE_PAGE_SIZE. Only a fallback for
 * code that is handed nothing better; anything that may meet a bigger store
 * reads what it needs with readListings.
 */
export function recordListings(store: Store): Listing[] {
  return store.catalog.inline ? store.catalog.inline.map(listingOf) : store.catalog.head;
}

/**
 * The listings a checkout's metadata names, read at once: the product, what
 * was added, and every product of a bundle among them (lib/bundles.ts).
 */
export async function listingsNamed(store: Store, meta: Record<string, string | undefined> | null | undefined): Promise<Listing[]> {
  const ids = deliveredIds(meta);
  return ids.length ? readListings(store, ids) : [];
}

// ---- Reading ----------------------------------------------------------------

/** Many GETs, in pipelines of a few hundred sent side by side. */
async function getMany(keys: string[]): Promise<unknown[]> {
  if (keys.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 400) chunks.push(keys.slice(i, i + 400));
  const answers = await Promise.all(chunks.map((chunk) => redisPipeline(chunk.map((key) => ["GET", key]))));
  return answers.flat();
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The ids asked for that this store has, each once, in the order asked. */
function wanted(store: Store, ids: Iterable<string> | undefined): string[] {
  if (ids === undefined) return productIds(store);
  const known = new Set(productIds(store));
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === "string" && known.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Listings, in the order asked (every product in the creator's order when no
 * ids are given). Ids the store does not have are left out. Whatever the head
 * holds is not read again.
 */
export async function readListings(store: Store, ids?: Iterable<string>): Promise<Listing[]> {
  const asked = wanted(store, ids);
  const catalog = store.catalog;
  if (catalog.inline) {
    const byId = new Map(catalog.inline.map((p) => [p.id, p]));
    return asked.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p)).map(listingOf);
  }
  if (asked.length === 0) return [];
  const found = new Map(catalog.head.map((listing) => [listing.id, listing]));
  const missing = asked.filter((id) => !found.has(id));
  if (missing.length && catalog.id && isRedisConfigured()) {
    const raws = await getMany(missing.map((id) => listingKey(catalog.id!, id)));
    missing.forEach((id, i) => {
      const listing = parseListing(parseJson(raws[i]));
      if (listing && listing.id === id) found.set(id, listing);
    });
  }
  return asked.map((id) => found.get(id)).filter((l): l is Listing => Boolean(l));
}

/** One listing, or null when the store has no such product (or no id was given). */
export async function readListing(store: Store, id: string | null | undefined): Promise<Listing | null> {
  if (typeof id !== "string" || !id) return null;
  return (await readListings(store, [id]))[0] ?? null;
}

/** One listing when it is a course, or null; a store of null answers null. */
export async function readCourseListing(store: Store | null, id: string | null | undefined): Promise<Listing | null> {
  const found = store ? await readListing(store, id) : null;
  return found?.course ? found : null;
}

/** Products in full, in the order asked (all of them when no ids are given). */
export async function readProducts(store: Store, ids?: Iterable<string>): Promise<Product[]> {
  const asked = wanted(store, ids);
  const catalog = store.catalog;
  if (catalog.inline) {
    const byId = new Map(catalog.inline.map((p) => [p.id, p]));
    return asked.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  }
  if (asked.length === 0 || !catalog.id || !isRedisConfigured()) return [];
  const raws = await getMany(asked.flatMap((id) => [listingKey(catalog.id!, id), extrasKey(catalog.id!, id)]));
  const out: Product[] = [];
  asked.forEach((id, i) => {
    const listing = parseJson(raws[i * 2]);
    if (!listing || typeof listing !== "object") return;
    const extras = parseJson(raws[i * 2 + 1]);
    const product = parseProduct({ ...(listing as object), ...(extras && typeof extras === "object" ? extras : {}) });
    if (product && product.id === id) out.push(product);
  });
  return out;
}

/** One product in full, or null when the store has no such product (or no id was given). */
export async function readProduct(store: Store, id: string | null | undefined): Promise<Product | null> {
  if (typeof id !== "string" || !id) return null;
  return (await readProducts(store, [id]))[0] ?? null;
}

/**
 * Looks products up by id, one at a time, for a walk through checkouts or
 * sales that each name one: every product is read once, however many name it.
 */
export function listingFinder(store: Store): (id: string | undefined) => Promise<Listing | null> {
  const seen = new Map<string, Promise<Listing | null>>();
  return (id) => {
    if (!id) return Promise.resolve(null);
    let found = seen.get(id);
    if (!found) {
      found = readListing(store, id);
      seen.set(id, found);
    }
    return found;
  };
}

/** Listings of every product of one kind, in the creator's order. */
export async function readKind(store: Store, kind: Kind): Promise<Listing[]> {
  return readListings(store, idsOfKind(store, kind));
}

/** The product a delivery id names, and the option when it is one. */
export async function readDelivery(
  store: Store,
  id: string,
): Promise<{ product: Listing; option: ProductOption | null } | null> {
  const owner = productIdFor(store, id);
  if (!owner) return null;
  const product = await readListing(store, owner);
  if (!product) return null;
  if (product.id === id) return { product, option: null };
  const option = product.options.find((entry) => entry.id === id);
  return option ? { product, option } : null;
}

/**
 * One page of the store: its listings, and the listings of what they offer
 * in a box at checkout, which may sit on another page. The first page is
 * answered from the store record alone.
 */
export async function readPage(
  store: Store,
  page: number,
): Promise<{ listings: Listing[]; related: Listing[]; page: number; pages: number }> {
  // Drafts are left out before the page is cut, so every page is full.
  const visible = visibleIds(store);
  const total = visible.length;
  const pages = Math.max(1, Math.ceil(total / STORE_PAGE_SIZE));
  const at = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const ids = visible.slice((at - 1) * STORE_PAGE_SIZE, at * STORE_PAGE_SIZE);
  const listings = await readListings(store, ids);
  const onPage = new Set(ids);
  const targets = listings.flatMap((l) => (l.bump && !onPage.has(l.bump.productId) ? [l.bump.productId] : []));
  const related = targets.length ? await readListings(store, targets) : [];
  return { listings, related, page: at, pages };
}

/**
 * Every card, for a list the creator searches (the studio). One pipeline per
 * few hundred products, sent side by side.
 */
export async function readAllListings(store: Store): Promise<Listing[]> {
  return readListings(store);
}

/**
 * Every product's name, by id, in one command.
 *
 * For the screens that want a list to pick from and nothing else. A store
 * still on the old inline layout has its products in its own record, so those
 * cost no read at all.
 *
 * It heals itself. A store written before the hash existed has none, so the
 * first read falls back to the listings once — the old cost, once — and leaves
 * the hash behind for every read after it. The write is best-effort: a store
 * whose cache could not be filled gets the right answer slowly rather than the
 * wrong answer quickly.
 */
export async function readTitles(store: Store): Promise<Map<string, string>> {
  const catalog = store.catalog;
  if (catalog.inline) return new Map(catalog.inline.map((p) => [p.id, p.title]));
  const ids = productIds(store);
  if (!ids.length || !catalog.id || !isRedisConfigured()) return new Map();

  const [reply] = await redisPipeline([["HGETALL", titlesKey(catalog.id)]]);
  const found = new Map<string, string>();
  if (Array.isArray(reply)) {
    const flat = reply.map(String);
    for (let i = 0; i + 1 < flat.length; i += 2) found.set(flat[i], flat[i + 1]);
  } else if (reply && typeof reply === "object") {
    for (const [id, title] of Object.entries(reply as Record<string, unknown>)) found.set(id, String(title));
  }
  // Only ids the index still lists: a hash entry left by a product removed
  // before this existed is not a product.
  const known = new Set(ids);
  for (const id of [...found.keys()]) if (!known.has(id)) found.delete(id);
  if (found.size >= ids.length) return found;

  // Missing, so this store predates the hash: pay the old cost once.
  const listings = await readListings(store, ids.filter((id) => !found.has(id)));
  if (!listings.length) return found;
  for (const listing of listings) found.set(listing.id, listing.title);
  await redisPipeline([
    ["HSET", titlesKey(catalog.id), ...listings.flatMap((l) => [l.id, l.title])],
  ]).catch((error) => console.error("filling the product titles failed", error));
  return found;
}

/** When the studio's list is one page of a longer one, as the studio page read it. */
export type ProductPaging = {
  page: number;
  pages: number;
  /** What was searched for, or "". */
  query: string;
  /** How many products the search found, or the whole count without one. */
  matches: number;
  /** Where the first product shown stands among the matches, from 0. */
  from: number;
  /** Products on a page. */
  size: number;
};

/** A product that can be offered in the box at checkout, as the studio lists it. */
export type BumpChoice = { id: string; title: string; priceCents: number };

/**
 * The studio's list of products. A store of up to STUDIO_PAGE_SIZE products
 * is read whole, in full, as it always was. A longer one is shown a page at a
 * time: every listing is read once (for the search over names, and for the
 * products that can be offered at checkout), and only the page shown is read
 * in full. `q` searches, `pp` is the page.
 */
export async function studioShelf(
  store: Store,
  params: { [key: string]: string | string[] | undefined },
): Promise<{
  products: Product[];
  positions: Record<string, number>;
  paging: ProductPaging | null;
  choices: BumpChoice[];
  named: Record<string, string>;
  /**
   * Which products have an extra set up that buyers are not being shown, and
   * why (lib/extras-notes.ts). Worked out here because it needs the whole
   * store: the product a checkout box offers is often not on this page, and a
   * product that stopped qualifying to be offered is not in `choices` at all.
   */
  notes: Record<string, ExtraNotes>;
}> {
  const ids = productIds(store);
  const positions = Object.fromEntries(ids.map((id, i) => [id, i]));
  const choose = (list: Listing[]) =>
    list.filter((p) => canBeBumped(p)).map((p) => ({ id: p.id, title: p.title, priceCents: p.priceCents }));
  const namesOf = (products: Product[], titles: Map<string, string>) =>
    Object.fromEntries(
      products.flatMap((p) => (p.bump && titles.has(p.bump.productId) ? [[p.bump.productId, titles.get(p.bump.productId)!]] : [])),
    );
  if (ids.length <= STUDIO_PAGE_SIZE) {
    const products = await readProducts(store);
    return {
      products,
      positions,
      paging: null,
      choices: choose(products),
      named: namesOf(products, new Map(products.map((p) => [p.id, p.title]))),
      notes: allExtraNotes(products, products, store.currency),
    };
  }
  const query = typeof params.q === "string" ? params.q.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const asked = typeof params.pp === "string" && /^\d{1,4}$/.test(params.pp) ? Number(params.pp) : 1;
  // Searching and paging are both questions about names, and names are one
  // command (readTitles). Only the fifty products actually shown are read.
  // This used to read every product in the store to find fifty.
  const titles = await readTitles(store);
  const needle = query.toLowerCase();
  const ordered = productIds(store).filter((id) => titles.has(id));
  const matches = needle ? ordered.filter((id) => (titles.get(id) ?? "").toLowerCase().includes(needle)) : ordered;
  const pages = Math.max(1, Math.ceil(matches.length / STUDIO_PAGE_SIZE));
  const page = Math.min(Math.max(1, asked), pages);
  const from = (page - 1) * STUDIO_PAGE_SIZE;
  const products = await readProducts(store, matches.slice(from, from + STUDIO_PAGE_SIZE));

  /*
   * The list of products that could be offered in a box at checkout.
   *
   * It cannot be answered from the index alone — whether a product has a file
   * and whether the buyer names the price are not in there — but the index can
   * rule most of a catalogue OUT without a single read: a membership, a call,
   * a free product, one with limited stock and one with price options can
   * never be a bump. Only what survives that is read, and at most
   * BUMP_CHOICES of it, which is already far more than a list to pick from can
   * usefully hold. Before this, every product in the store was read to build it.
   */
  const ruledOut = new Set([
    ...idsOfKind(store, "recurring"),
    ...idsOfKind(store, "call"),
    ...idsOfKind(store, "free"),
    ...idsOfKind(store, "limited"),
  ]);
  const withOptions = new Set(store.catalog.items.filter((item) => item.options.length > 0).map((item) => item.id));
  const candidates = ordered.filter((id) => !ruledOut.has(id) && !withOptions.has(id)).slice(0, BUMP_CHOICES);
  const bumpable = await readListings(store, candidates);
  return {
    products,
    positions,
    paging: { page, pages, query, matches: matches.length, from, size: STUDIO_PAGE_SIZE },
    choices: choose(bumpable),
    named: namesOf(products, titles),
    // Only the products on this page are asked about, and only against the
    // ones they could possibly refer to rather than against the whole store.
    notes: allExtraNotes(products, bumpable, store.currency),
  };
}

// ---- Writing (called by lib/store.ts, under the store's lock) --------------

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** The writes that put one product in its records. Refuses one past the ceiling. */
export function productWrites(catalog: string, product: Product): Command[] {
  if (!SAFE_ID.test(product.id)) throw new Error("product id");
  const listing = JSON.stringify(listingOf(product));
  const heavy = product.fields.length > 0 || product.funnel !== null;
  const extras = heavy ? JSON.stringify({ fields: product.fields, funnel: product.funnel }) : "";
  if (byteLength(listing) + byteLength(extras) > MAX_PRODUCT_BYTES) throw new StoreFullError();
  return [
    ["SET", listingKey(catalog, product.id), listing],
    heavy ? ["SET", extrasKey(catalog, product.id), extras] : ["DEL", extrasKey(catalog, product.id)],
    ["HSET", titlesKey(catalog), product.id, product.title],
  ];
}

/** The writes that forget one product's records. */
export function productDrops(catalog: string, id: string): Command[] {
  if (!SAFE_ID.test(id)) return [];
  return [["DEL", listingKey(catalog, id), extrasKey(catalog, id)], ["HDEL", titlesKey(catalog), id]];
}

/**
 * The mark a catalog is given the moment its store is moved to product
 * records, holding how many products its index lists, brought up to date by
 * every write. It is never removed, so a store record that later turns up
 * without its catalog — written back by code from before this layout, as a
 * rollback would — is recognised as a store that was moved, and moving it
 * again is refused when that record lists fewer products than the index
 * did (lib/store.ts, moveToRecords): never an empty index over a full one.
 */
const movedKey = (catalog: string) => `nl:catalog:${catalog}:moved`;

export function movedMark(catalog: string, count: number): Command {
  return ["SET", movedKey(catalog), String(Math.max(0, Math.floor(count)))];
}

/** How many products the index listed when this catalog was last written, or null when it was never moved. */
export async function movedCount(catalog: string): Promise<number | null> {
  if (!CATALOG_ID_PATTERN.test(catalog) || !isRedisConfigured()) return null;
  const [found] = await redisPipeline([["GET", movedKey(catalog)]]);
  if (typeof found !== "string") return null;
  return /^\d{1,6}$/.test(found) ? Number(found) : 0;
}

/** Sends writes in pipelines of a few hundred. */
export async function runWrites(commands: Command[]): Promise<void> {
  for (let i = 0; i < commands.length; i += 400) {
    await redisPipeline(commands.slice(i, i + 400));
  }
}

/**
 * The products on the store's first page: the first STORE_PAGE_SIZE that are
 * not drafts, which is what readPage shows as page one.
 */
function firstPage(items: Item[]): Item[] {
  return items.filter((item) => (item.kind & KIND.hidden) === 0).slice(0, STORE_PAGE_SIZE);
}

/** The head, from listings already at hand; nothing is read. */
export function headFrom(items: Item[], known: Map<string, Listing>): Listing[] {
  const first = firstPage(items).map((item) => known.get(item.id)).filter((l): l is Listing => Boolean(l));
  const present = new Set(items.map((item) => item.id));
  const onPage = new Set(first.map((l) => l.id));
  const targets: Listing[] = [];
  for (const listing of first) {
    const target = listing.bump ? known.get(listing.bump.productId) : undefined;
    if (target && present.has(target.id) && !onPage.has(target.id) && !targets.includes(target)) targets.push(target);
  }
  const head: Listing[] = [];
  let bytes = 0;
  for (const listing of [...first, ...targets]) {
    const size = byteLength(JSON.stringify(listing));
    if (bytes + size > HEAD_BYTES) continue;
    bytes += size;
    head.push(listing);
  }
  return head;
}

/**
 * The head for a catalog after a change. `known` holds the listings at hand
 * — the old head and whatever was just written — and anything else the first
 * page needs is read from its record.
 */
export async function buildHead(catalog: string, items: Item[], known: Map<string, Listing>): Promise<Listing[]> {
  const fill = async (ids: string[]) => {
    const missing = ids.filter((id) => !known.has(id));
    if (!missing.length) return;
    const raws = await getMany(missing.map((id) => listingKey(catalog, id)));
    missing.forEach((id, i) => {
      const listing = parseListing(parseJson(raws[i]));
      if (listing && listing.id === id) known.set(id, listing);
    });
  };
  const present = new Set(items.map((item) => item.id));
  const first = firstPage(items).map((item) => item.id);
  await fill(first);
  await fill(
    first.flatMap((id) => {
      const target = known.get(id)?.bump?.productId;
      return target && present.has(target) ? [target] : [];
    }),
  );
  return headFrom(items, known);
}
