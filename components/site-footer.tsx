import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 mt-12">
      <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-gray-600 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Nimbus Labs. Built with AI.</p>
        <nav className="flex gap-6">
          <Link href="/terms" className="hover:text-black">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-black">
            Privacy
          </Link>
          <Link href="/refunds" className="hover:text-black">
            Refunds
          </Link>
        </nav>
      </div>
    </footer>
  );
}
