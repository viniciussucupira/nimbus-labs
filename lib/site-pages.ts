// Content for every page behind a menu item. One entry per page, so that
// each menu item opens something different and real.

export type Block =
  | { kind: "lead"; text: string }
  | { kind: "cards"; title: string; items: { emoji: string; title: string; body: string; tint: string }[] }
  | { kind: "steps"; title: string; items: { title: string; body: string }[] }
  | { kind: "facts"; title: string; items: { value: string; label: string; tone: string }[] }
  | { kind: "table"; title: string; note?: string; head: [string, string, string]; rows: [string, string, string][] }
  | { kind: "quote"; text: string; source: string }
  | { kind: "note"; title: string; body: string }
  | { kind: "storecard"; title: string; creator: string; tagline: string; photo: string; alt: string; items: { label: string; detail: string; price: string }[] };

export type TopicPage = {
  slug: string;
  section: "platform" | "for" | "proof";
  eyebrow: string;
  title: string;
  highlight: string;
  intro: string;
  badge: { label: string; tone: "live" | "building" | "proof" };
  accent: string;
  blocks: Block[];
};

const LIVE = { label: "Live in the demo store today", tone: "live" as const };
const BUILDING = { label: "Being built — not available yet", tone: "building" as const };
const PROOF = { label: "Checked and dated", tone: "proof" as const };

export const PAGES: TopicPage[] = [
  /* ------------------------------------------------ platform ---------- */
  {
    slug: "store-page",
    section: "platform",
    eyebrow: "Platform",
    title: "A store page that looks like",
    highlight: "you, not like a template",
    intro:
      "One address with your face, your colours, your links and your products. The page is built to be read on a phone in a few seconds, because that is where your buyer opens it.",
    badge: LIVE,
    accent: "from-violet-brand to-sky-brand",
    blocks: [
      {
        kind: "lead",
        text: "The most common thing creators say about the big link-in-bio platforms is that every store ends up looking the same. That is a design decision, not a technical limit, and it is one we are not copying.",
      },
      {
        kind: "cards",
        title: "What the store page carries",
        items: [
          { emoji: "🖼️", title: "Your cover and your photo", body: "A cover image and a portrait, not initials in a grey circle.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "🔗", title: "Link buttons", body: "Free resources, social profiles, a booking link — each with its own icon.", tint: "bg-sky-brand/15 text-sky-brand" },
          { emoji: "🛍️", title: "Product cards", body: "Cover art, description, what is inside, and the price options.", tint: "bg-pink-brand/10 text-pink-brand" },
          { emoji: "🙋", title: "An About me section", body: "On every store, not only on one theme.", tint: "bg-amber-brand/15 text-amber-brand" },
        ],
      },
      {
        kind: "note",
        title: "What is not there yet",
        body: "Categories and search for a store with dozens of products, and your own domain. Both are on the list, and neither is described here as if it already worked.",
      },
      {
        kind: "quote",
        text: "The store page you can open right now is the Harbor Kitchen demo. It is a fictional cook, but the page, the checkout and the file delivery are real.",
        source: "Open /demo and try it with a Stripe test card",
      },
    ],
  },
  {
    slug: "price-options",
    section: "platform",
    eyebrow: "Platform",
    title: "One product,",
    highlight: "several prices",
    intro:
      "A one-week plan for $27 and a five-week plan for $39, from the same product card. The buyer picks, and each option delivers its own file.",
    badge: LIVE,
    accent: "from-pink-brand to-amber-brand",
    blocks: [
      {
        kind: "lead",
        text: "Stan's own help centre lists pricing tiers among its most requested features and states plainly that there is no native way to offer them under one product. On Nimbus Labs this is already working, tested and in production.",
      },
      {
        kind: "steps",
        title: "How it works",
        items: [
          { title: "You define the options", body: "A label, a short detail, a price and the file that option delivers." },
          { title: "The buyer chooses one", body: "Radio cards on the product, no extra page, no JavaScript needed to see the prices." },
          { title: "The server sets the price", body: "The price comes from the option identifier, never from the form, so nobody can send their own price." },
          { title: "The right file is delivered", body: "The chosen option is stored with the payment and decides which file the download gives back." },
        ],
      },
      {
        kind: "facts",
        title: "Measured on 17 September 2026",
        items: [
          { value: "$39", label: "Test purchase of the five-week option, in production", tone: "bg-violet-brand text-white" },
          { value: "8,929", label: "Bytes delivered — identical to the original file", tone: "bg-mint-brand text-ink" },
          { value: "54", label: "Automated checks passing on the store", tone: "bg-amber-brand text-ink" },
        ],
      },
      {
        kind: "note",
        title: "Why it matters for your money",
        body: "A second price is the cheapest upsell there is: the same product, a bigger version, no new sales page and no new file to market.",
      },
    ],
  },
  {
    slug: "instant-delivery",
    section: "platform",
    eyebrow: "Platform",
    title: "The file lands",
    highlight: "the second the payment clears",
    intro:
      "No manual sending, no “check your e-mail in a few minutes”, no support ticket at midnight. Stripe confirms, and the download link appears.",
    badge: LIVE,
    accent: "from-mint-brand to-sky-brand",
    blocks: [
      {
        kind: "lead",
        text: "Delivery breaking silently is one of the worst complaints a creator can get, because the buyer blames the creator, not the platform. It is documented at more than one competitor: files that stopped being attached, and buyers who received empty downloads after paying.",
      },
      {
        kind: "steps",
        title: "How the delivery is protected",
        items: [
          { title: "Nothing is released before Stripe says paid", body: "An unpaid or unfinished session gets a clear refusal, not a file." },
          { title: "The file travels with the code", body: "It is not a public address someone can guess or share by accident." },
          { title: "The link expires in three days", body: "Long enough for a real buyer, short enough to limit passing it around." },
          { title: "Every case is tested", body: "Invalid link, expired link, someone else's order, live-mode key, Stripe down — all covered by automated checks." },
        ],
      },
      {
        kind: "facts",
        title: "What the tests cover",
        items: [
          { value: "402", label: "Refused when the payment is not confirmed", tone: "bg-pink-brand text-white" },
          { value: "410", label: "Refused after the three-day window", tone: "bg-amber-brand text-ink" },
          { value: "502", label: "Honest error when Stripe is unreachable", tone: "bg-sky-brand text-ink" },
        ],
      },
    ],
  },
  {
    slug: "your-stripe",
    section: "platform",
    eyebrow: "Platform",
    title: "The money goes to",
    highlight: "your own Stripe account",
    intro:
      "Direct charges on your account. We never hold your sales, so there is no balance for us to freeze, delay or lose.",
    badge: LIVE,
    accent: "from-violet-brand to-pink-brand",
    blocks: [
      {
        kind: "lead",
        text: "Held money is the loudest complaint in this whole market. Creators write about payout buttons that stay grey for weeks, balances marked “available soon” for months, minimum payout thresholds changed without notice, and accounts suspended the day before a payout. The structure we chose makes most of that impossible for us to do to you.",
      },
      {
        kind: "table",
        title: "Where the money sits",
        note: "Stan's structure checked on its own help centre and terms in September 2026.",
        head: ["", "Platform-held model", "Nimbus Labs"],
        rows: [
          ["Whose Stripe account", "One the platform manages for you", "Yours, the one you already own"],
          ["Who can pause the money", "The platform, by policy", "Your bank and Stripe's own rules"],
          ["Getting paid", "Manual cash-out, minimums, payout fees", "Your Stripe payout schedule"],
          ["If you leave", "You migrate customers and payouts", "Nothing to migrate — the account was always yours"],
        ],
      },
      {
        kind: "note",
        title: "What we charge",
        body: "A monthly subscription, and 0% of your sales. Stripe's own fees are charged by Stripe on your account, where you can read them line by line.",
      },
      {
        kind: "note",
        title: "The honest limit",
        body: "Because we never touch your money, we also cannot advance it, split it with an affiliate automatically, or refund a buyer on your behalf. Those happen in your Stripe dashboard.",
      },
    ],
  },

  /* ------------------------------------------------ for creators ------ */
  {
    slug: "coaches",
    section: "for",
    eyebrow: "For creators",
    title: "For coaches",
    highlight: "and teachers",
    intro:
      "Sell the worksheet, the programme and the hour of your time from the same page, with a price for each level of commitment.",
    badge: LIVE,
    accent: "from-sky-brand to-violet-brand",
    blocks: [
      {
        kind: "storecard",
        title: "What a coaching store looks like",
        creator: "Maya Ruiz",
        tagline: "Career coaching for first-time managers",
        photo: "photo-1595085610896-fb31cfd5d4b7",
        alt: "A woman smiling in a red shirt",
        items: [
          { label: "Interview workbook", detail: "PDF, 18 pages", price: "$19" },
          { label: "Six-week programme", detail: "PDF plus weekly checklists", price: "$89" },
          { label: "One hour with Maya", detail: "Video call, booked after payment", price: "$180" },
        ],
      },
      {
        kind: "cards",
        title: "What this solves",
        items: [
          { emoji: "🪜", title: "A price ladder, not one price", body: "The same subject at $19, $89 and $180 lets the buyer choose the level.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "⏱️", title: "No manual sending", body: "The workbook is delivered while you are asleep, in the middle of a session or on a plane.", tint: "bg-mint-brand/15 text-mint-deep" },
          { emoji: "🧾", title: "Receipts your buyer can keep", body: "Stripe sends the receipt from your own account.", tint: "bg-amber-brand/15 text-amber-brand" },
        ],
      },
      {
        kind: "note",
        title: "Being built for this audience",
        body: "Booking a call directly on the page. Today a paid call is delivered as a scheduling link inside the file, which works but is not elegant.",
      },
    ],
  },
  {
    slug: "cooks",
    section: "for",
    eyebrow: "For creators",
    title: "For cooks and",
    highlight: "nutritionists",
    intro:
      "Meal plans, grocery lists and recipe packs, sold by the week. This is exactly the store you can open and buy from right now.",
    badge: LIVE,
    accent: "from-mint-brand to-amber-brand",
    blocks: [
      {
        kind: "storecard",
        title: "The live demo store",
        creator: "Harbor Kitchen",
        tagline: "Simple family meals by Jenny",
        photo: "photo-1662850886700-4ec19bd30d11",
        alt: "A woman with curly hair, smiling",
        items: [
          { label: "Weekly meal planner, 1 week", detail: "PDF, 1 page", price: "$27" },
          { label: "Weekly meal planner, 5 weeks", detail: "PDF, 5 pages", price: "$39" },
          { label: "Free recipe of the week", detail: "On the page, no payment", price: "Free" },
        ],
      },
      {
        kind: "cards",
        title: "Why this shape works for food creators",
        items: [
          { emoji: "🗓️", title: "Sell the week, then the season", body: "One week to try, five weeks for the person who already trusts you.", tint: "bg-mint-brand/15 text-mint-deep" },
          { emoji: "🧺", title: "The grocery list is the hook", body: "The part people share is the part that brings the next buyer.", tint: "bg-amber-brand/15 text-amber-brand" },
          { emoji: "📱", title: "Opened on a phone, in a kitchen", body: "The page is built to load fast on a slow connection.", tint: "bg-sky-brand/15 text-sky-brand" },
        ],
      },
    ],
  },
  {
    slug: "fitness",
    section: "for",
    eyebrow: "For creators",
    title: "For fitness",
    highlight: "creators",
    intro:
      "Programmes, challenges and form checks, with a plan for the beginner and a plan for the person who has already done it twice.",
    badge: LIVE,
    accent: "from-pink-brand to-violet-brand",
    blocks: [
      {
        kind: "storecard",
        title: "What a fitness store looks like",
        creator: "Dani Cole",
        tagline: "Strength for people with desk jobs",
        photo: "photo-1623717217554-72ca676de535",
        alt: "A woman laughing",
        items: [
          { label: "4-week starter block", detail: "PDF plus video links", price: "$29" },
          { label: "12-week programme", detail: "PDF plus weekly tracker", price: "$79" },
          { label: "Form check", detail: "You send a video, Dani replies", price: "$45" },
        ],
      },
      {
        kind: "cards",
        title: "What this solves",
        items: [
          { emoji: "🔁", title: "The repeat buyer", body: "The 4-week block is the sample; the 12-week programme is the sale.", tint: "bg-pink-brand/10 text-pink-brand" },
          { emoji: "📹", title: "Video without a video platform", body: "Your programme links to where your videos already live.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "💬", title: "Selling your attention", body: "A form check is a product with a price, not a free DM that eats your evening.", tint: "bg-sky-brand/15 text-sky-brand" },
        ],
      },
    ],
  },
  {
    slug: "designers",
    section: "for",
    eyebrow: "For creators",
    title: "For designers and",
    highlight: "photographers",
    intro:
      "Presets, templates and brush packs — files that sell while you work on something else, delivered the second the payment clears.",
    badge: LIVE,
    accent: "from-amber-brand to-pink-brand",
    blocks: [
      {
        kind: "storecard",
        title: "What a design store looks like",
        creator: "Theo Lang",
        tagline: "Film-look presets and Lightroom recipes",
        photo: "photo-1553640662-9ab20b8fa2ea",
        alt: "A man in a leather jacket, smiling",
        items: [
          { label: "Starter pack", detail: "6 presets, ZIP", price: "$15" },
          { label: "Full collection", detail: "28 presets plus a guide", price: "$49" },
          { label: "Studio licence", detail: "Team use, invoice on request", price: "$149" },
        ],
      },
      {
        kind: "cards",
        title: "What this solves",
        items: [
          { emoji: "⚡", title: "Delivery that does not fail", body: "The most damaging bug in this market is the file that silently stops being sent.", tint: "bg-amber-brand/15 text-amber-brand" },
          { emoji: "🧮", title: "Three prices, one product", body: "Personal, full and studio, from the same card.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "🎨", title: "A page that does not fight your work", body: "Your covers and colours, not a template everybody recognises.", tint: "bg-pink-brand/10 text-pink-brand" },
        ],
      },
      {
        kind: "note",
        title: "Honest about file size",
        body: "Very large packs are not supported yet. If your collection is heavy, tell us the size before you sign up and we will say plainly whether it works today.",
      },
    ],
  },

  /* ------------------------------------------------ proof ------------- */
  {
    slug: "compare",
    section: "proof",
    eyebrow: "Proof",
    title: "Side by side",
    highlight: "with Stan",
    intro:
      "Checked on Stan's own pricing, terms and help centre in September 2026. When it changes, this page changes.",
    badge: PROOF,
    accent: "from-violet-brand to-pink-brand",
    blocks: [
      {
        kind: "table",
        title: "The part that decides",
        note: "Sources: Stan's help centre articles on transaction fees, custom domains and common feature requests, read in September 2026.",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["Monthly price", "$29 and $99", "$29 and $99, planned"],
          ["Cut of each sale", "0% platform fee", "0% platform fee"],
          ["Whose Stripe account", "One managed by the platform", "Your own"],
          ["Getting paid", "Manual cash-out, $10 minimum", "Your Stripe payout schedule"],
          ["Several prices for one product", "Listed as a top feature request, not available", "Working today"],
          ["An About me section", "Only on one theme", "On every store"],
          ["Your own domain", "Not available", "Being built"],
          ["Customer area for all purchases", "Courses only", "Being built"],
          ["Several stores in one account", "Not available", "Being built"],
        ],
      },
      {
        kind: "note",
        title: "Where Stan is ahead, and we say so",
        body: "Stan has years of features we do not have: automated Instagram replies, courses with a proper student area, communities, affiliates paid automatically, and a support team with a track record. If you depend on those today, Stan is the better tool today.",
      },
    ],
  },
  {
    slug: "speed",
    section: "proof",
    eyebrow: "Proof",
    title: "A slow store is",
    highlight: "a store people leave",
    intro:
      "Measured with Google PageSpeed Insights on a simulated phone, on 17 September 2026, and with Lighthouse on the same build. You can run the same test yourself on any store.",
    badge: PROOF,
    accent: "from-sky-brand to-mint-brand",
    blocks: [
      {
        kind: "facts",
        title: "Performance score on mobile",
        items: [
          { value: "97–100", label: "Nimbus Labs demo store", tone: "bg-mint-brand text-ink" },
          { value: "57", label: "A Stan store, measured the same day", tone: "bg-ink text-white" },
          { value: "58", label: "Another Stan store, same test", tone: "bg-ink text-white" },
        ],
      },
      {
        kind: "steps",
        title: "How the test was run",
        items: [
          { title: "Same tool for everyone", body: "Google PageSpeed Insights, mobile, simulated slow 4G, Lighthouse 13.4.1." },
          { title: "Three Stan stores picked at random", body: "Public stores, measured on the same day, one run each." },
          { title: "Our store measured twice", body: "Because the score moves a few points between runs." },
          { title: "Nothing hidden", body: "Our demo store has no photos. A store with a portrait and covers will score lower, and we will publish that number too." },
        ],
      },
      {
        kind: "note",
        title: "Why it is money, not vanity",
        body: "The buyer opens your link inside Instagram, on a phone, on mobile data. Every second of loading is a share of that traffic that never sees the price.",
      },
    ],
  },
  {
    slug: "promises",
    section: "proof",
    eyebrow: "Proof",
    title: "What we will",
    highlight: "never do to you",
    intro:
      "Every line here answers a complaint creators have published about platforms in this market. They are commitments, written before we have customers, so you can hold us to them.",
    badge: PROOF,
    accent: "from-amber-brand to-pink-brand",
    blocks: [
      {
        kind: "lead",
        text: "We read hundreds of public reviews and complaints from creators about the platforms they use to sell. The same failures come back again and again. This is our answer to each one.",
      },
      {
        kind: "cards",
        title: "The commitments",
        items: [
          { emoji: "🏦", title: "We never hold your sales", body: "Your money is charged on your own Stripe account, so there is no Nimbus balance to freeze, delay or set a minimum on.", tint: "bg-mint-brand/15 text-mint-deep" },
          { emoji: "🙋", title: "A person answers you", body: "Support is a human writing, with a published response time. No chatbot standing between you and your money.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "🚪", title: "You can always leave", body: "Export your products, your customers and your sales history whenever you want, free, without asking us.", tint: "bg-sky-brand/15 text-sky-brand" },
          { emoji: "🌐", title: "Your domain stays yours", body: "If you bring a domain, you remain the owner of it and keep access to its settings. No exit fee.", tint: "bg-pink-brand/10 text-pink-brand" },
          { emoji: "✉️", title: "Your list is yours", body: "Your buyers' e-mail addresses are exportable at any time, and we do not count them against a quota.", tint: "bg-amber-brand/15 text-amber-brand" },
          { emoji: "📜", title: "No silent changes", body: "Price and rule changes are announced in advance, in writing, and never applied retroactively to money already earned.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "🔌", title: "No surprise shutdown", body: "If your account ever has to be paused, you get the reason in writing and a way to answer, before the store goes dark.", tint: "bg-mint-brand/15 text-mint-deep" },
          { emoji: "🧾", title: "One line for the real cost", body: "The subscription, plus Stripe's own fees shown as Stripe charges them. No fee that only appears on the statement.", tint: "bg-pink-brand/10 text-pink-brand" },
        ],
      },
      {
        kind: "note",
        title: "Where these came from",
        body: "Public reviews and complaints from creators on Trustpilot, G2, Capterra, the Better Business Bureau, app stores and creator blogs, about Stan, Beacons, Linktree, Gumroad, Payhip, Kajabi and Podia, read in September 2026. We are not repeating the accusations here — we are answering the pattern.",
      },
      {
        kind: "note",
        title: "What we cannot promise yet",
        body: "We cannot promise a support team that answers at three in the morning, or a feature list as long as a platform with years of work behind it. We can promise the response time we publish, and that everything listed as working really works.",
      },
    ],
  },
  {
    slug: "questions",
    section: "proof",
    eyebrow: "Proof",
    title: "Questions,",
    highlight: "including the awkward ones",
    intro:
      "If a question is missing, write it to us and the answer goes on this page, whether it flatters us or not.",
    badge: PROOF,
    accent: "from-violet-brand to-amber-brand",
    blocks: [
      {
        kind: "steps",
        title: "The short answers",
        items: [
          { title: "Can I sign up and sell today?", body: "No. What exists today is the demo store you can buy from with a Stripe test card. Early access opens with the first creators we talk to." },
          { title: "Who holds the money from my sales?", body: "You do, in your own Stripe account. We take 0% of your sales and charge only a monthly subscription." },
          { title: "What happens if Nimbus Labs closes?", body: "Your Stripe account, your customers and your files were never ours. Anything we host is exportable, and a shutdown comes with notice in writing." },
          { title: "Who is behind this?", body: "Vinicius Sucupira, an independent builder in Brazil, building in public. Support is in English, in writing." },
          { title: "Why is the demo store so plain?", body: "It is a working proof, not a portfolio piece. Your own store is designed with you." },
          { title: "What do I do if something breaks?", body: "You write to support and get a human answer within the published time. If a sale is affected, you have the Stripe dashboard as the source of truth, independently of us." },
        ],
      },
    ],
  },
];

export function findPage(section: TopicPage["section"], slug: string) {
  return PAGES.find((p) => p.section === section && p.slug === slug);
}

export function slugsFor(section: TopicPage["section"]) {
  return PAGES.filter((p) => p.section === section).map((p) => ({ slug: p.slug }));
}
