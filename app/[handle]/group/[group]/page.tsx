import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readListing } from "@/lib/catalog";
import { GROUP_ID, PLACE_TOKEN, placesWords } from "@/lib/group-rules";
import { type Taken, placesTaken, readGroup, takePlace } from "@/lib/group-buy";
import { ordersLinkFor } from "@/lib/buyer-orders";
import { recordEnrollment } from "@/lib/learn";
import { storeBase } from "@/lib/purchase-email";

export const metadata: Metadata = {
  title: "Take your place — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string; group: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Check your inbox",
    body: "We sent a link to the address you typed. Open it and the place is yours. It works for 24 hours; if nothing arrives in a few minutes, look in spam, then type the address again below.",
  },
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. The link goes to the address you type, so it has to be one you can open.",
  },
  full: {
    title: "Every place has been taken",
    body: "Whoever bought this paid for a set number of people, and each place is now on somebody's address. Ask them whether they can buy one more.",
  },
  slow: {
    title: "Too many links asked for just now",
    body: "To keep this page from being used to fill somebody's inbox, it sends a limited number a day. Try again later; no place was taken or lost.",
  },
  unavailable: {
    title: "We could not send that just now",
    body: "No place was taken or lost. Try again in a moment.",
  },
};

/**
 * The page the link of a purchase for several people opens (lib/group-buy.ts).
 * Anybody holding the link can ask for a place: they type their own address
 * and are emailed a link, and the place is taken when that link is opened
 * (?take=…, the same page), so a mistyped address takes nothing. Who else
 * took a place is never shown here, only how many are left.
 */
export default async function GroupPage({ params, searchParams }: Params) {
  const { handle: raw, group: id } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@") || !GROUP_ID.test(id)) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const group = await readGroup(id);
  // Not this store's, or never paid for: there is nothing here to describe.
  if (!group || !store.statsId || group.s !== store.statsId || !group.paid) notFound();
  const product = await readListing(store, group.p);
  if (!product) notFound();

  const query = await searchParams;
  const read = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const status = read("status");
  const token = read("take");
  const base = storeBase(store);
  const shell = (body: React.ReactNode) => (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          {body}
          <div className="mt-8">
            <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
              {`See ${store.name}`}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );

  if (group.revoked) {
    return shell(
      <>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">This purchase was refunded</h1>
        <p className="st-muted mt-4 text-lg">{`${product.title} was bought for ${group.people} people and the payment was later refunded in full, so its places are closed.`}</p>
      </>,
    );
  }

  // The link from a place's email: the place is taken now, once.
  let taken: Taken | null = null;
  if (PLACE_TOKEN.test(token)) {
    taken = await takePlace({
      store,
      token,
      recordStart: async (email, productId, start) => {
        const course = productId === product.id ? product : await readListing(store, productId);
        if (course?.course) await recordEnrollment(store, email, productId, start);
      },
    }).catch((error) => {
      console.error("taking a place failed", error);
      return null;
    });
    if (taken && taken.outcome !== "gone" && taken.outcome !== "full") {
      const link = (await ordersLinkFor(store, taken.email, base).catch(() => null)) ?? `${base}/orders`;
      return shell(
        <>
          <p className="st-price text-sm">{taken.outcome === "has" ? "Already yours" : "Done"}</p>
          <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
            {taken.outcome === "has" ? "This address already has it" : "The place is yours"}
          </h1>
          <p className="st-muted mt-4 text-lg">
            <strong style={{ color: "var(--st-text)" }}>{product.title}</strong>
            {taken.outcome === "has"
              ? ` was already on ${taken.email}, so no place was used.`
              : ` is now on ${taken.email}, as if you had bought it. Nothing was charged to you.`}
          </p>
          <div className="mt-7">
            <a href={link} className="btn st-btn btn-lg">Open it</a>
          </div>
          <p className="st-muted mt-5 text-sm">{`Later, go to ${base.replace(/^https?:\/\//, "")}/orders and type this address: a link to everything on it comes right away.`}</p>
        </>,
      );
    }
  }

  const count = await placesTaken(group.id).catch(() => 0);
  const left = Math.max(0, group.people - count);
  const notice =
    taken?.outcome === "full"
      ? NOTICES.full
      : taken?.outcome === "gone" || (token && !taken)
        ? { title: "That link has expired", body: "It works for 24 hours. Type your address again below and a new one comes right away." }
        : NOTICES[status] ?? null;

  return shell(
    <>
      {notice ? (
        <div className="st-note mb-7 text-sm" role="status">
          <p className="font-semibold">{notice.title}</p>
          <p className="mt-1">{notice.body}</p>
        </div>
      ) : null}
      <p className="st-price text-sm">Paid for you</p>
      <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{product.title}</h1>
      <p className="st-muted mt-4 text-lg">
        {`Somebody bought this from ${store.name} for ${group.people} people and passed this link on. ${placesWords(group.people, count)}`}
      </p>
      {left > 0 ? (
        <form action="/api/store/group" method="post" className="mt-8 space-y-3">
          <input type="hidden" name="handle" value={store.handle} />
          <input type="hidden" name="group" value={group.id} />
          {/* Left empty by a person; filled in by something that fills in every field. */}
          <div aria-hidden="true" className="hidden">
            <label>
              Leave this empty
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label htmlFor="place-email" className="st-label">
            Your email
          </label>
          <input id="place-email" type="email" name="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" className="st-field" />
          <button type="submit" className="btn st-btn btn-block">Send me the link to my place</button>
          <p className="st-muted text-xs">
            {`A link goes to that address, and opening it takes one place and puts ${product.title} on it. Nothing is charged to you. Your address is used to hand this over and to open it again later, and it is not added to any list.`}
          </p>
        </form>
      ) : null}
      <p className="st-muted mt-6 text-sm">
        {"Already took yours? "}
        <Link href={`/@${store.handle}/orders`} className="st-footer-link font-semibold">
          Open it again
        </Link>
      </p>
    </>,
  );
}
