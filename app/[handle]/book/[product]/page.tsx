import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { type Store, normaliseHandle, storeForPage } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { canSellProduct } from "@/lib/store-checkout";
import { type CallListing, canMove, catchUpBookings, icsLink, isCallProduct, slotsForMove, slotsForProduct, whyNotMove } from "@/lib/calls";
import { type CallSetup, MAX_MOVES, movableUntil, readableTime, zoneName } from "@/lib/call-setup";
import { VIDEO_ROOM_NOTE, isVideoRoom, roomLabel, roomOf } from "@/lib/call-rooms";
import { readOrder } from "@/lib/store-checkout";
import { SITE_URL } from "@/lib/site-url";
import { imageUrl } from "@/lib/product-image";
import { SlotPicker } from "@/components/slot-picker";
import { SessionPicker } from "@/components/session-picker";
import { StoreTracking } from "@/components/store-tracking";
import { readListing } from "@/lib/catalog";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Named after what is booked, so a tab or a history entry says which. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, product: productId } = await params;
  const decoded = decodeURIComponent(handle);
  const store = decoded.startsWith("@") ? await storeForPage(normaliseHandle(decoded)).catch(() => null) : null;
  const product = (store ? await readListing(store, productId) : null);
  const title =
    store && product?.call
      ? `${product.call.kind === "live" ? "Pick a session" : "Pick a time"}: ${product.title} — ${store.name}`
      : "Book a call — Nimbus Labs";
  return { title, robots: { index: false, follow: true } };
}

const NOTICES: Record<string, { title: string; body: string }> = {
  taken: {
    title: "That time was just taken",
    body: "Somebody booked it a moment before you, or it is being paid for right now. Pick another; nothing was charged.",
  },
  invalid: {
    title: "Pick a time first",
    body: "Choose one of the times below, then continue.",
  },
  error: {
    title: "Something went wrong on our side",
    body: "Nothing was charged. Try again in a moment.",
  },
  unavailable: {
    title: "This call cannot be booked right now",
    body: "Nothing was charged.",
  },
  slow: {
    title: "That was a lot of tries in a few minutes",
    body: "Nothing was charged. Wait a few minutes, then pick a time again.",
  },
};

/** What a buyer moving their booking may be told. */
const MOVE_NOTICES: Record<string, { title: string; body: string }> = {
  taken: {
    title: "That time was just taken",
    body: "Somebody booked it a moment before you. Your booking has not changed; pick another.",
  },
  invalid: { title: "Pick a time first", body: "Choose one of the times below, then continue." },
  same: { title: "That is the time you already have", body: "Pick a different one to move to." },
  late: {
    title: "It is too close to the start to move",
    body: "Your booking has not changed. To ask the creator about it, reply to your confirmation email.",
  },
  limit: {
    title: "This booking has been moved as often as it can be",
    body: "Your booking has not changed. To ask the creator about it, reply to your confirmation email.",
  },
  error: { title: "Something went wrong on our side", body: "Your booking has not changed. Try again in a moment." },
  unavailable: { title: "Bookings cannot be moved right now", body: "Your booking has not changed." },
  slow: { title: "That was a lot of tries in a few minutes", body: "Your booking has not changed. Wait a few minutes, then try again." },
};

/** Where a buyer picks a time for a paid call. */
export default async function BookPage({ params, searchParams }: Params) {
  const { handle: raw, product: productId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const product = await readListing(store, productId);
  if (!product || !isCallProduct(product)) redirect(`/@${store.handle}`);

  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "";
  const moving = typeof query.move === "string" ? query.move : "";
  if (moving) return <MovePage store={store} product={product} session={moving} status={status} />;

  const notice = NOTICES[status] ?? null;
  const open = canSellProduct(store, product);
  const read = open ? await slotsForProduct(store, product) : null;
  const days = read ? read.days : null;
  const starts = days ? days.flatMap((day) => day.starts) : [];
  // Paid calls whose buyer never came back from Stripe get their emails now,
  // after the page is sent, so the buyer here never waits for it.
  if (read && read.paid.length) after(() => catchUpBookings(store, read.paid, SITE_URL));
  const setup = product.call;
  const live = setup.kind === "live";

  return (
    <Shell store={store}>
        <div className="st-card mt-6 overflow-hidden">
          {product.image ? (
            <div className="px-4 pt-4 sm:px-6 sm:pt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(product.image)}
                alt={product.image.alt}
                width={product.image.width}
                height={product.image.height}
                fetchPriority="high"
                className="st-hero-img"
                // A banner of one shape on every booking page, so the times
                // stay near the top: the picture is cropped, never squeezed.
                style={{ aspectRatio: "2 / 1", objectFit: "cover" }}
              />
            </div>
          ) : null}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="font-display min-w-0 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">
                {product.title}
              </h1>
              <p className="st-price text-base">{formatMoney(product.priceCents, store.currency)}</p>
            </div>
            <p className="st-muted mt-2 text-sm font-semibold">{callLine(setup)}</p>
            {product.summary ? <p className="st-muted mt-3 leading-relaxed">{product.summary}</p> : null}

            {notice ? (
              <div className="st-note mt-6" role="alert">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
                <p className="mt-1 text-sm">{notice.body}</p>
              </div>
            ) : null}

            {!open ? (
              <div className="st-note mt-6">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>This call cannot be booked right now</p>
                <p className="mt-1 text-sm">{`${store.name}'s store is not taking payments at the moment. Nothing here can charge a card.`}</p>
              </div>
            ) : read === null ? (
              <div className="st-note mt-6">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>The times could not be read just now</p>
                <p className="mt-1 text-sm">Nothing was charged. Refresh the page in a moment.</p>
              </div>
            ) : live ? (
              <SessionPicker
                sessions={read.sessions}
                creatorTz={setup.tz}
                handle={store.handle}
                productId={product.id}
                price={formatMoney(product.priceCents, store.currency)}
              />
            ) : (
              <SlotPicker
                starts={starts}
                creatorTz={setup.tz}
                handle={store.handle}
                productId={product.id}
                minutes={setup.minutes}
                price={formatMoney(product.priceCents, store.currency)}
                left={setup.seats > 1 ? read.left : undefined}
              />
            )}
          </div>
        </div>

        <p className="st-muted mt-6 text-center text-sm">
          {`Payment is taken by Stripe on ${store.name}'s own account. Nimbus never holds the money and takes none of it.`}
        </p>
    </Shell>
  );
}

/** The store's colours, its name and picture on top, and the way back below. */
function Shell({ store, children }: { store: Store; children: React.ReactNode }) {
  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-12 sm:py-16">
        <div className="flex items-center justify-center gap-3">
          {store.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(store.photoId)} alt="" width={48} height={48} className="st-avatar !mx-0" style={{ width: 48, height: 48 }} />
          ) : (
            <span aria-hidden="true" className="st-avatar st-avatar-initial !mx-0" style={{ width: 48, height: 48, fontSize: "1.25rem" }}>
              {store.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-semibold">{store.name}</span>
        </div>
        {children}
        <div className="mt-6 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Back to ${store.name}`}
          </Link>
          <StoreTracking store={store} />
        </div>
      </main>
    </div>
  );
}

/** The line under a call's title: how long, how many, and where. */
function callLine(setup: CallSetup): string {
  if (setup.kind === "live") {
    return setup.video
      ? "Live session \u00b7 online, in a private video room sent when you book"
      : "Live session \u00b7 online, the link is sent when you book";
  }
  const who = setup.seats > 1 ? `Group call, up to ${setup.seats} people` : `${setup.minutes}-minute call`;
  const length = setup.seats > 1 ? ` \u00b7 ${setup.minutes} minutes` : "";
  const where = setup.video
    ? " \u00b7 online, in a private video room sent when you book"
    : setup.room
      ? " \u00b7 online, the link is sent when you book"
      : " \u00b7 online";
  return `${who}${length}${where}`;
}

/**
 * Where a buyer moves their booking, from the link in their email.
 *
 * The checkout session in the address is the key, as on the thanks page: it
 * is read from Stripe, and has to be a paid booking of this product. The
 * buyer sees their booking, whether and until when it can move, and the open
 * times, in their own zone, counted as if their seat were already free.
 */
async function MovePage({
  store,
  product,
  session,
  status,
}: {
  store: Store;
  product: CallListing;
  session: string;
  status: string;
}) {
  const order = await readOrder(store, session);
  const setup = product.call;
  const booking = order.state === "paid" && order.call && order.product.id === product.id ? order.call : null;

  if (!booking) {
    const trouble = order.state === "error" || order.state === "unavailable";
    return (
      <Shell store={store}>
        <div className="st-card mt-6 p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">
            {trouble ? "Your booking could not be read just now" : "We could not find this booking"}
          </h1>
          <p className="st-muted mt-3">
            {trouble
              ? "Nothing has changed. Try the link again in a moment."
              : "Check the link in your confirmation email. A booking whose time has passed cannot be moved."}
          </p>
        </div>
      </Shell>
    );
  }

  const tz = booking.buyerTz;
  const room = await roomOf(store.callsId, { product: product.id, setup, session, start: booking.start, end: booking.end });
  const moved = status === "moved";
  const notice = moved ? null : MOVE_NOTICES[status] ?? null;
  const blocked = whyNotMove(setup, booking.start, booking.moves);
  const movable = blocked === null;
  const offer = movable && !moved ? await slotsForMove(store, product, session, booking.start) : null;
  const leftMoves = MAX_MOVES - booking.moves;
  const until = movableUntil(setup, booking.start);

  return (
    <Shell store={store}>
      <div className="st-card mt-6 p-6 sm:p-8">
        <p className="st-label">{moved ? "Moved" : "Your booking"}</p>
        <h1 className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">
          {moved ? "Your booking has moved" : `Move ${product.title}`}
        </h1>

        <div className="mt-5 rounded-2xl px-5 py-4" style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}>
          <p className="text-sm font-semibold">{moved ? "Your new time" : "Booked for"}</p>
          <p className="mt-1 text-lg font-semibold">{readableTime(booking.start, tz)}</p>
          <p className="mt-0.5 text-sm">
            {`${zoneName(booking.start, tz)} \u00b7 ${Math.round((booking.end - booking.start) / 60_000)} minutes \u00b7 ${product.title}`}
          </p>
        </div>

        {moved ? (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {room ? (
                <a href={room} rel="noopener noreferrer nofollow" target="_blank" className="btn st-btn">
                  {roomLabel(room)}
                </a>
              ) : null}
              <a href={icsLink("", store, session)} className="btn btn-secondary">
                Add the new time to your calendar
              </a>
            </div>
            <p className="st-muted mt-5 text-sm">
              {`${store.name} has been told, and an email with the new time and a calendar file is on its way to you. The old time is free again for somebody else.`}
              {isVideoRoom(room) ? ` ${VIDEO_ROOM_NOTE}` : ""}
              {canMove(setup, booking.start, booking.moves)
                ? ` You can move it ${leftMoves === 1 ? "once more" : `${leftMoves} more times`} from this page.`
                : ""}
            </p>
          </>
        ) : !movable ? (
          <div className="st-note mt-6" role="status">
            <p className="font-bold" style={{ color: "var(--st-text)" }}>
              {blocked === "limit"
                ? "This booking has been moved as often as it can be"
                : blocked === "late"
                  ? "It is too close to the start to move"
                  : "There is no other session to move to"}
            </p>
            <p className="mt-1 text-sm">{`Your booking stays as it is. To ask ${store.name} about it, reply to your confirmation email.`}</p>
          </div>
        ) : (
          <>
            <p className="st-muted mt-4 text-sm">
              {`You can move it ${leftMoves === 1 ? "once more" : `${leftMoves} times`}, until ${readableTime(until, tz)} (${zoneName(until, tz)}). Nothing is charged or refunded.`}
            </p>
            {notice ? (
              <div className="st-note mt-6" role="alert">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
                <p className="mt-1 text-sm">{notice.body}</p>
              </div>
            ) : null}
            {offer === null ? (
              <div className="st-note mt-6">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>The times could not be read just now</p>
                <p className="mt-1 text-sm">Your booking has not changed. Refresh the page in a moment.</p>
              </div>
            ) : setup.kind === "live" ? (
              <SessionPicker
                sessions={offer.sessions}
                creatorTz={setup.tz}
                handle={store.handle}
                productId={product.id}
                price={formatMoney(product.priceCents, store.currency)}
                move={session}
              />
            ) : (
              <SlotPicker
                starts={offer.days.flatMap((day) => day.starts)}
                creatorTz={setup.tz}
                handle={store.handle}
                productId={product.id}
                minutes={setup.minutes}
                price={formatMoney(product.priceCents, store.currency)}
                left={setup.seats > 1 ? offer.left : undefined}
                move={session}
              />
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
