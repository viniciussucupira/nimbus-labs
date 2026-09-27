import type { Metadata } from "next";
import { readUnsubToken } from "@/lib/contacts";
import { STOP_TOKEN, readStopToken } from "@/lib/checkout-recovery";
import { COMMUNITY_UNSUB, readCommunityUnsub } from "@/lib/community-mail";
import { readConfig } from "@/lib/community";
import { storeForHandle } from "@/lib/store";
import { REVIEW_STOP, readReviewStop } from "@/lib/review-requests";

export const metadata: Metadata = {
  title: "Unsubscribe — Nimbus Labs",
  robots: { index: false, follow: false },
};

/** The store behind a list, for the name on the page. */
async function storeName(handle: string, listId: string): Promise<string> {
  const store = handle ? await storeForHandle(handle) : null;
  return store && store.listId === listId ? store.mail?.fromName || store.name : "";
}

/** One button, and the answer. Nobody is asked why. */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const reminder = typeof query.r === "string" ? query.r.slice(0, 60) : "";
  if (reminder) return <StopReminders token={reminder} done={query.done === "1"} />;
  const review = typeof query.v === "string" ? query.v.slice(0, 60) : "";
  if (review) return <StopReviewRequests token={review} done={query.done === "1"} />;
  const community = typeof query.c === "string" ? query.c.slice(0, 60) : "";
  if (community) return <StopAnnouncements token={community} done={query.done === "1"} />;
  const token = typeof query.t === "string" ? query.t.slice(0, 60) : "";
  const done = query.done === "1";
  const found = token ? await readUnsubToken(token) : null;
  const name = found ? await storeName(found.handle, found.listId) : "";
  const who = name || "this creator";

  return (
    <main id="content" className="min-h-screen bg-paper px-4 py-20 text-ink">
      <div className="card mx-auto max-w-md p-7 sm:p-9">
        {!found ? (
          <>
            <h1 className="t-h3">This link is not one we know</h1>
            <p className="mt-3 text-ink-soft">
              Open the unsubscribe link from the email itself, or use your mail app&apos;s own unsubscribe button.
            </p>
          </>
        ) : done || found.contact.unsub ? (
          <>
            <h1 className="t-h3">You are unsubscribed</h1>
            <p className="mt-3 text-ink-soft">
              {`${found.email} will not get emails from ${who} again. Nothing else is needed.`}
            </p>
          </>
        ) : (
          <>
            <h1 className="t-h3">{`Stop emails from ${who}?`}</h1>
            <p className="mt-3 text-ink-soft">{`For ${found.email}. One press, and it is kept for good.`}</p>
            <form action={`/api/mail/unsubscribe?t=${token}`} method="post" className="mt-6">
              <input type="hidden" name="from" value="page" />
              <button type="submit" className="btn btn-primary btn-block">Unsubscribe</button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-ink-mute">Emails sent with Nimbus Labs, on behalf of the creator who wrote them.</p>
      </div>
    </main>
  );
}

/** The same one button, for a community's emails: announcements and live event reminders. */
async function StopAnnouncements({ token, done }: { token: string; done: boolean }) {
  const found = COMMUNITY_UNSUB.test(token) ? await readCommunityUnsub(token) : null;
  const store = found ? await storeForHandle(found.handle) : null;
  const config = found && store?.community?.id === found.community ? await readConfig(found.community) : null;
  const who = store ? store.mail?.fromName || store.name : "this creator";
  const where = config?.name ?? "the community";
  return (
    <main id="content" className="min-h-screen bg-paper px-4 py-20 text-ink">
      <div className="card mx-auto max-w-md p-7 sm:p-9">
        {!found ? (
          <>
            <h1 className="t-h3">This link is not one we know</h1>
            <p className="mt-3 text-ink-soft">
              Open the link from the email itself, or use your mail app&apos;s own unsubscribe button.
            </p>
          </>
        ) : done || !found.member.mail ? (
          <>
            <h1 className="t-h3">No more emails from the community</h1>
            <p className="mt-3 text-ink-soft">
              {`${found.member.e} will not be emailed ${who}'s announcements or live event reminders again. You are still in ${where}, and can read them there. If an event you RSVP'd to is moved or cancelled, you are still told, once.`}
            </p>
          </>
        ) : (
          <>
            <h1 className="t-h3">{`Stop ${who}'s community emails?`}</h1>
            <p className="mt-3 text-ink-soft">{`Announcements and live event reminders, for ${found.member.e}. You stay in ${where}, and keep your RSVPs; only the emails stop.`}</p>
            <form action={`/api/mail/unsubscribe?c=${token}`} method="post" className="mt-6">
              <input type="hidden" name="from" value="page" />
              <button type="submit" className="btn btn-primary btn-block">Stop the emails</button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-ink-mute">Emails sent with Nimbus Labs, on behalf of the creator who wrote them.</p>
      </div>
    </main>
  );
}

/** The same one button, for a store's abandoned-checkout reminders. */
async function StopReminders({ token, done }: { token: string; done: boolean }) {
  const found = STOP_TOKEN.test(token) ? await readStopToken(token) : null;
  const who = found?.storeName || "this store";
  return (
    <main id="content" className="min-h-screen bg-paper px-4 py-20 text-ink">
      <div className="card mx-auto max-w-md p-7 sm:p-9">
        {!found ? (
          <>
            <h1 className="t-h3">This link is not one we know</h1>
            <p className="mt-3 text-ink-soft">
              Open the link from the email itself, or use your mail app&apos;s own unsubscribe button.
            </p>
          </>
        ) : done || found.stopped ? (
          <>
            <h1 className="t-h3">No more reminders</h1>
            <p className="mt-3 text-ink-soft">
              {`${found.email} will not get checkout reminders from ${who} again. Nothing else is needed.`}
            </p>
          </>
        ) : (
          <>
            <h1 className="t-h3">{`Stop checkout reminders from ${who}?`}</h1>
            <p className="mt-3 text-ink-soft">{`For ${found.email}. One press, and it is kept for good.`}</p>
            <form action={`/api/mail/unsubscribe?r=${token}`} method="post" className="mt-6">
              <input type="hidden" name="from" value="page" />
              <button type="submit" className="btn btn-primary btn-block">Stop reminders</button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-ink-mute">Emails sent with Nimbus Labs, on behalf of the store that sent them.</p>
      </div>
    </main>
  );
}

/** The same one button, for a store's emails asking for a review. */
async function StopReviewRequests({ token, done }: { token: string; done: boolean }) {
  const found = REVIEW_STOP.test(token) ? await readReviewStop(token) : null;
  const who = found?.storeName || "this store";
  return (
    <main id="content" className="min-h-screen bg-paper px-4 py-20 text-ink">
      <div className="card mx-auto max-w-md p-7 sm:p-9">
        {!found ? (
          <>
            <h1 className="t-h3">This link is not one we know</h1>
            <p className="mt-3 text-ink-soft">
              Open the link from the email itself, or use your mail app&apos;s own unsubscribe button.
            </p>
          </>
        ) : done || found.stopped ? (
          <>
            <h1 className="t-h3">No more review requests</h1>
            <p className="mt-3 text-ink-soft">
              {`${found.email} will not be asked for a review by ${who} again. Nothing else is needed.`}
            </p>
          </>
        ) : (
          <>
            <h1 className="t-h3">{`Stop review requests from ${who}?`}</h1>
            <p className="mt-3 text-ink-soft">{`For ${found.email}. One press, and it is kept for good. A review you already wrote stays as it is.`}</p>
            <form action={`/api/mail/unsubscribe?v=${token}`} method="post" className="mt-6">
              <input type="hidden" name="from" value="page" />
              <button type="submit" className="btn btn-primary btn-block">Stop review requests</button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-ink-mute">Emails sent with Nimbus Labs, on behalf of the store that sent them.</p>
      </div>
    </main>
  );
}
