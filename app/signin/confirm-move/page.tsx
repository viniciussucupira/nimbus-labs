import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Confirm the move — Nimbus Labs",
  description: "One tap to move your Nimbus Labs account to this address.",
  robots: { index: false, follow: false },
};

/** The last step of moving the sign-in address. Landing here spends nothing. */
export default async function ConfirmMovePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/signin?status=expired");

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-violet-brand/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-mint-brand/25 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft shadow-sm">
          <span aria-hidden="true">☁️</span> Nimbus Labs
        </p>

        <h1 className="font-display mt-5 text-4xl font-black leading-tight sm:text-5xl">
          Move your account here
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Your store, your address and your products come with you. From then
          on, this is the inbox that signs you in.
        </p>

        <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
          <form method="post" action="/api/auth/move">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-6 py-4 text-base font-bold text-white transition hover:-translate-y-0.5"
            >
              Move my account here
            </button>
          </form>
          <p className="mt-4 text-sm text-ink-soft">
            Every session your old address had open is closed the moment this
            finishes, on every device. Files already attached to your products
            keep working.
          </p>
        </div>
      </main>
    </div>
  );
}
