import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeForEmail, storeFolder } from "@/lib/store";
import { HandleForm } from "@/components/handle-form";
import { RenameForm } from "@/components/rename-form";
import { OldAddresses } from "@/components/old-addresses";
import { DetailsForm } from "@/components/details-form";
import { ProductEditor } from "@/components/product-editor";

export const metadata: Metadata = {
  title: "Your account — Nimbus Labs",
  robots: { index: false, follow: false },
};

const NEXT = [
  "Connecting your own Stripe account",
  "The list of your orders",
];

export default async function StudioPage() {
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");

  const store = await storeForEmail(email);
  const folder = store ? await storeFolder(email) : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 top-0 h-64 w-64 bg-violet-brand/20 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-2xl px-4 py-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft shadow-sm">
          <span aria-hidden="true">☁️</span> Nimbus Labs
        </p>

        <h1 className="font-display mt-5 text-4xl font-black leading-tight sm:text-5xl">
          {store ? "Your store" : "You are signed in"}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          As <strong className="text-ink">{email}</strong>. No password was
          created, and none is stored.
        </p>

        {store ? (
          <>
            <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
              <p className="font-display text-xl font-black text-ink">
                {store.name}
              </p>
              {store.bio ? (
                <p className="mt-2 text-ink-soft">{store.bio}</p>
              ) : null}
              <div className="mt-3">
                <DetailsForm name={store.name} bio={store.bio} />
              </div>

              <p className="mt-5 text-sm font-bold text-ink">Your address</p>
              <p className="mt-1 break-all font-mono text-lg text-violet-deep">
                nimbuslabsai.com/@{store.handle}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link
                  href={`/@${store.handle}`}
                  className="inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
                >
                  Open my store
                </Link>
                <RenameForm current={store.handle} />
              </div>

              <OldAddresses handles={store.previousHandles} />
            </div>

            <ProductEditor products={store.products} folder={folder} />
          </>
        ) : (
          <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
            <p className="font-display text-xl font-black text-ink">
              Take your address
            </p>
            <p className="mt-2 mb-6 text-ink-soft">
              This is the link you put in your bio. Pick one now without
              agonising over it: you can change it later, and the old address
              keeps working and sends people to the new one.
            </p>
            <HandleForm />
          </div>
        )}

        <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
          <p className="font-display text-xl font-black text-ink">
            What is not here yet
          </p>
          <p className="mt-2 text-ink-soft">
            Being honest about it, these are the pieces still being built, in
            this order:
          </p>
          <ol className="mt-5 space-y-3">
            {NEXT.map((item, index) => (
              <li key={item} className="flex gap-3 text-ink-soft">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lilac text-xs font-black text-violet-deep"
                >
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-ink-soft">
            Until selling works, the working proof is the demo store, and it is
            open to anyone.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          >
            Open the demo store
          </Link>
          <Link
            href="/mission"
            className="rounded-full border-2 border-ink/15 px-6 py-3 text-sm font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep"
          >
            What is built so far
          </Link>
          <form action="/api/auth/signout" method="post" className="ml-auto">
            <button
              type="submit"
              className="rounded-full px-5 py-3 text-sm font-bold text-ink-soft underline underline-offset-2 transition hover:text-violet-deep"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
