import Link from "next/link";
import { Logo } from "@/components/logo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Confirm login — Nimbus Labs",
  description: "One tap to finish logging in to Nimbus Labs.",
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
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <Link href="/" className="inline-block w-fit rounded-[10px]" aria-label="Nimbus Labs, home">
          <Logo />
        </Link>

        <h1 className="t-h1 mt-6">
          One tap and you are in
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Your link is good. Tap the button and the session opens.
        </p>

        <div className="card mt-8 p-6 sm:p-8">
          <form method="post" action="/api/auth/callback">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
            >
              Log me in
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
