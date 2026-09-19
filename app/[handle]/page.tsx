import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { normaliseHandle, storeForHandle } from "@/lib/store";

type Params = { params: Promise<{ handle: string }> };

/**
 * A creator's public store.
 *
 * Only addresses that start with "@" reach this page, so a store can never
 * collide with a page of the site itself.
 *
 * An address the store used before still lands here, and the visitor is sent
 * on to the address it uses now. Links already printed in a bio keep working.
 */
async function load(raw: string) {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  const asked = normaliseHandle(decoded);
  const store = await storeForHandle(asked);
  return store ? { store, asked } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) return { title: "Not found — Nimbus Labs" };
  const { store } = found;

  return {
    title: `${store.name} — Nimbus Labs`,
    description: store.bio || `The store of ${store.name} on Nimbus Labs.`,
    // An empty store has nothing to offer a search engine yet.
    robots: { index: false, follow: true },
  };
}

export default async function StorePage({ params }: Params) {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) notFound();
  const { store, asked } = found;

  // An old address of this same store: send the visitor to the current one.
  if (asked !== store.handle) permanentRedirect(`/@${store.handle}`);

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-violet-brand/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-mint-brand/20 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="rounded-[2rem] border-2 border-ink/5 bg-white p-7 text-center shadow-xl shadow-ink/5 sm:p-10">
          <p
            aria-hidden="true"
            className="font-display mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-brand to-pink-brand text-3xl font-black text-white"
          >
            {store.name.slice(0, 1).toUpperCase()}
          </p>

          <h1 className="font-display mt-5 text-3xl font-black leading-tight sm:text-4xl">
            {store.name}
          </h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            @{store.handle}
          </p>

          {store.bio ? (
            <p className="mt-4 text-lg text-ink-soft">{store.bio}</p>
          ) : null}

          <div className="mt-8 rounded-3xl border-2 border-dashed border-ink/15 p-6">
            <p className="font-bold text-ink">Nothing for sale yet</p>
            <p className="mt-2 text-sm text-ink-soft">
              This store is open but empty. When {store.name} adds something,
              it shows up here.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
          >
            Made with Nimbus Labs
          </Link>
        </div>
      </main>
    </div>
  );
}
