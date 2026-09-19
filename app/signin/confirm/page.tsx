import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Confirm sign-in — Nimbus Labs",
  description: "One tap to finish signing in to Nimbus Labs.",
  robots: { index: false, follow: false },
};

/**
 * The last step of the emailed link.
 *
 * The link in the email lands here, and landing here spends nothing. Mail
 * filters open every link in a message to inspect it, and a sign-in link that
 * a filter could spend would be gone before the creator ever tapped it. So the
 * page asks for one tap, and only that tap — a POST, which no filter makes —
 * opens the session.
 */
export default async function ConfirmPage({
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
          One tap and you are in
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Your link is good. Tap the button and the session opens.
        </p>

        <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
          <form method="post" action="/api/auth/callback">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-6 py-4 text-base font-bold text-white transition hover:-translate-y-0.5"
            >
              Sign me in
            </button>
          </form>
          <p className="mt-4 text-sm text-ink-soft">
            We ask for this tap because mail filters open the links in a message
            to check them. Your link works once, and we would rather a filter
            never spent it for you.
          </p>
        </div>
      </main>
    </div>
  );
}
