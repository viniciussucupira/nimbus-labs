import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="text-2xl font-bold">Nimbus</div>
          <nav className="flex gap-8 text-sm">
            <a href="#retone" className="text-gray-600 hover:text-black">Retone</a>
            <a href="#" className="text-gray-600 hover:text-black">Docs</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="text-5xl font-bold mb-6">AI-powered products for creators</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl">
          Simple, focused tools built with AI. No bloat, just results.
        </p>
        <a href="#retone" className="inline-block px-6 py-3 bg-black text-white rounded hover:bg-gray-900">
          Explore Products
        </a>
      </section>

      {/* Products */}
      <section id="retone" className="max-w-4xl mx-auto px-6 py-24 border-t border-gray-200">
        <h2 className="text-3xl font-bold mb-12">Products</h2>
        
        <div className="space-y-12">
          <div className="pb-12 border-b border-gray-200">
            <h3 className="text-2xl font-bold mb-3">Retone</h3>
            <p className="text-gray-600 mb-4 max-w-2xl">
              Rewrite any text in seconds. Change tone, style, or length with AI precision.
            </p>
            <a href="https://retoneai.net" target="_blank" rel="noopener noreferrer" className="text-black font-medium hover:underline">
              Visit Retone →
            </a>
          </div>
          <div className="pb-12 border-b border-gray-200">
          
            <h3 className="text-2xl font-bold mb-3">NativeApply</h3>
            <p className="text-gray-600 mb-4 max-w-2xl">Sound like a native English speaker in your job application. AI rewriting for cover letters and outreach messages.</p>
            <a href="https://nativeapply.net" target="_blank" rel="noopener noreferrer" className="text-black font-medium hover:underline">Visit NativeApply →</a>
            </div>
            <div>
            <h3 className="text-2xl font-bold mb-3">NativeReply</h3>
              <p className="text-gray-600 mb-4 max-w-2xl">Native-sounding customer support and sales replies, written and checked with AI.</p>
              <a href="https://nativereply.net" target="_blank" rel="noopener noreferrer" className="text-black font-medium hover:underline">Visit NativeReply →</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
