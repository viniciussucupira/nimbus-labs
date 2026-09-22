import type { Metadata } from "next";
import { readUnsubToken } from "@/lib/contacts";
import { storeForHandle } from "@/lib/store";

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
