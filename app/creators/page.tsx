import type { Metadata } from "next";
import Link from "next/link";
import { CreatorResearchForm } from "@/components/creator-research-form";
import { SiteFooter } from "@/components/site-footer";
import { SUPPORT_EMAIL } from "@/lib/creator-research";

export const metadata: Metadata = {
  title: "Selling digital products? Tell me what's broken — Nimbus Labs",
  description:
    "Nimbus Labs is talking to creators who sell guides, courses, templates and paid calls before building its next tool. Share what's hard about selling online.",
};

export default function CreatorsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Nimbus
          </Link>
          <nav className="flex gap-8 text-sm">
            <Link href="/#products" className="text-gray-600 hover:text-black">
              Products
            </Link>
            <Link href="/creators" className="text-black font-medium">
              For creators
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-16 sm:py-20">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
          Creator research
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          Selling digital products? Tell me what&apos;s broken.
        </h1>
        <div className="space-y-4 text-lg leading-8 text-gray-700 mb-12">
          <p>
            I&apos;m Vinicius, the founder of Nimbus Labs. Before we build our
            next tool, I&apos;m talking to creators who sell guides, courses,
            templates and paid calls from their link in bio.
          </p>
          <p>
            This is not a sales page. There is nothing to buy. I want to know
            what is hard about selling online today, in your own words.
          </p>
        </div>

        <CreatorResearchForm />

        <section className="mt-16 border-t border-gray-200 pt-10">
          <h2 className="text-xl font-bold mb-4">What happens with your answers</h2>
          <ul className="list-disc pl-6 space-y-2 text-[17px] leading-7 text-gray-700">
            <li>They are used only to decide what Nimbus Labs builds next.</li>
            <li>They are never sold or shared for anyone else&apos;s marketing.</li>
            <li>
              We email you only if you ticked one of the optional boxes, and
              only about what that box says.
            </li>
            <li>
              To have them deleted, email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-black underline underline-offset-2 hover:no-underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </li>
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
