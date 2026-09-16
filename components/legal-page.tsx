import Link from "next/link";
import { SiteFooter } from "./site-footer";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Nimbus
          </Link>
          <nav className="flex gap-8 text-sm">
            <Link href="/" className="text-gray-600 hover:text-black">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-3">{title}</h1>
        <p className="text-sm text-gray-500 mb-12">
          Effective date: August 15, 2026
          {lastUpdated ? ` · Last updated: ${lastUpdated}` : ""}
        </p>
        <div className="space-y-10 text-[17px] leading-8 text-gray-700">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-black">{title}</h2>
      {children}
    </section>
  );
}
