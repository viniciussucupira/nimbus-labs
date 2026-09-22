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
      "One address with your name, your line, your links and your products. The page is built to be read on a phone in a few seconds, because that is where your buyer opens it.",
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
          { emoji: "🔤", title: "Your name at the top", body: "Your name, your address and one line about you. A photo of your own is not built yet, so today the page draws your initial.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "🔗", title: "Link buttons", body: "The channel, the profile, the booking page — with the site each one leads to printed under it. None of them charges anything.", tint: "bg-sky-brand/15 text-sky-brand" },
          { emoji: "🛍️", title: "Product cards", body: "The title, what is inside, the price, and the button that buys it.", tint: "bg-pink-brand/10 text-pink-brand" },
          { emoji: "🙋", title: "A line about you", body: "Under your name, on every store — not locked behind one theme.", tint: "bg-amber-brand/15 text-amber-brand" },
        ],
      },
      {
        kind: "note",
        title: "What is not there yet",
        body: "A photo of your own and colours of your own: every store draws your initial and wears the same palette today. Categories and search for a store with dozens of products, and your own domain. None of those exists, and none is described above as if it did.",
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
    badge: { label: "Live in your own store today", tone: "live" as const },
    accent: "from-pink-brand to-amber-brand",
    blocks: [
      {
        kind: "lead",
        text: "Stan's own help centre lists pricing tiers among its most requested features and states plainly that there is no native way to offer them under one product. Here it is in your own editor: put up to three prices on any product, give each one its own file or its own link, and the buyer picks on the card. The amount charged is read from what you saved, never from the page.",
      },
      {
        kind: "steps",
        title: "How it works",
        items: [
          { title: "You define the options", body: "A name the buyer reads, a price, and the file or the link that option hands over." },
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
        photo: "photo-1616065298043-67646192dcb5",
        alt: "A woman with blonde hair and red lipstick, smiling",
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
        title: "How a paid call works here today",
        body: "There is no calendar on the page. You sell the call like any other product and put your own scheduling link inside the file the buyer receives. It works, it is not elegant, and it is the honest state of it.",
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
        photo: "photo-1543871595-e11129e271cc",
        alt: "A woman with long dark hair, smiling",
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
        photo: "photo-1617748142090-06eeb8fd1119",
        alt: "A woman in a yellow dress, smiling outdoors",
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
        creator: "Tess Lang",
        tagline: "Film-look presets and Lightroom recipes",
        photo: "photo-1746790335260-4577f9953b11",
        alt: "A woman in a green dress, smiling",
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
        body: "We host up to 5 GB per file, which is what Stan says it supports, so this is not a reason to choose between us. Heavier than that, or not a file at all \u2014 a workspace, a private feed, a folder that keeps growing \u2014 and you sell it as a link instead: it stays where you already keep it and the buyer is sent straight there the moment they pay.",
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
        note: "Sources: Stan's help centre articles 'Creator vs. Creator Pro', 'How to Connect Stan with Stripe', 'How to Cash Out Inside Stan', 'Experiment: How to Connect an Existing Stripe Account' and 'How to Subscribe on the Stan Mobile App', read on 18 September 2026; 'Can I Create More Than One Stan Store?' and 'How to Change Your Stan Username or Email', read on 19 September 2026.",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["Monthly price", "$29 and $99", "$29, free for the first 14 days"],
          ["Cut of each sale", "0% platform fee", "0% platform fee"],
          ["Signing in", "An account with a password. Their own signup asks for name, email and password", "A link sent to your email. No password to invent, and none kept here to be stolen"],
          ["Ways to be paid", "Stripe or PayPal", "Stripe only — we are behind them here"],
          ["Whose Stripe account", "One they manage. Their own help centre: you cannot connect an existing Stripe account", "Your own. You connect it from your account page and it stays yours"],
          ["Getting paid", "Cash out inside Stan, $10 minimum, whole balance only", "Your own Stripe payout schedule"],
          ["Where you see your money", "Their Income tab. A Stripe Custom account has no Stripe login", "stripe.com, like any other business of yours"],
          ["Phone app", "iPhone and iPad, for running your store. Not on Android", "None. The site installs to the home screen on both"],
          ["Several prices for one product", "Listed as a top feature request, not available", "Up to three on any product, each with its own file or link"],
          ["A line about you on the page", "Their About me, on one theme only", "On every store, under your name"],
          ["Your own domain", "Not available", "Not available"],
          ["Changing your store address", "Any time. Their help centre says old links are forwarded on a best effort, cannot be guaranteed, and advises resending them", "Any time. Every address the store ever used keeps working, for good"],
          ["Customer area for all purchases", "Courses only", "Not available. A buyer who loses the link gets it sent again, with no account"],
          ["Several stores in one account", "Not in one account. Several accounts, each with its own email and its own subscription", "Not available. One store per account, the same as theirs"],
        ],
      },
      {
        kind: "quote",
        text: "In order to use Stripe with Stan, you will be prompted to create a new Custom Stripe account that is managed by Stan. You will not be able to connect an existing Stripe account.",
        source: "Stan help centre, 'How to Connect Stan with Stripe', read 18 September 2026",
      },
      {
        kind: "note",
        title: "One correction to that, from their own help centre",
        body: "Stan is running an experiment that does let some creators connect a Stripe account they already own. Their article says it is open only to a share of new creators who signed up after 1 May 2025 and go through onboarding on a phone browser, and it warns that if you use it, Stan's own Income tab may not show your earnings correctly. So it exists, it is not the normal path, and it costs you part of their product.",
      },
      {
        kind: "note",
        title: "Where Stan is ahead, and we say so",
        body: "Stan has years of features we do not have: payment plans, order bumps and upsells, funnels, affiliates paid automatically, email broadcasts and flows, pixel tracking, automated Instagram replies, courses with a proper student area, communities, an app for iPhone and iPad, and a support team with a track record. If you depend on those today, Stan is the better tool today.",
      },
    ],
  },
  {
    slug: "gumroad",
    section: "proof",
    eyebrow: "Proof",
    title: "Side by side",
    highlight: "with Gumroad",
    intro:
      "Every number here was read on Gumroad's own pricing page and help centre in September 2026, and the page says where each one came from. When they change it, this page changes.",
    badge: PROOF,
    accent: "from-mint-brand to-violet-brand",
    blocks: [
      {
        kind: "lead",
        text: "Gumroad is the oldest, simplest way to sell a file on the internet, and for a first sale it is hard to beat: nothing to pay until you sell something. The difference between the two of us is not the store page. It is what happens to the money.",
      },
      {
        kind: "facts",
        title: "Gumroad's own numbers",
        items: [
          { value: "10% + $0.50", label: "Gumroad's fee on a direct sale", tone: "bg-pink-brand/10 text-pink-brand" },
          { value: "30%", label: "On a sale that comes through Discover", tone: "bg-amber-brand/15 text-amber-brand" },
          { value: "$100", label: "Minimum balance before they pay you", tone: "bg-violet-brand/10 text-violet-deep" },
          { value: "7 days", label: "A sale waits in their balance before it can be paid", tone: "bg-sky-brand/15 text-sky-brand" },
        ],
      },
      {
        kind: "table",
        title: "The part that decides",
        note: "Sources: Gumroad's pricing page and their help centre articles 'Gumroad's fees', 'Getting paid by Gumroad', 'Connect your Stripe account to Gumroad' and 'Sales tax on Gumroad', all re-read on 20 September 2026.",
        head: ["", "Gumroad", "Nimbus Labs"],
        rows: [
          ["Cut of each sale", "10% + $0.50 direct, 30% via Discover", "0%"],
          ["Card fee on top of that", "Stripe's 2.9% + $0.30. Their own fees page says the 10% + $0.50 does not include credit card processing", "Stripe's 2.9% + $0.30, and nothing else"],
          ["Monthly price", "None", "$29, free for the first 14 days"],
          ["Whose payment account", "Theirs. New sellers can no longer connect their own Stripe", "Your own Stripe, from the first sale"],
          ["When the money reaches you", "Into their balance, 7-day hold, then a weekly payout", "At the moment of sale"],
          ["Minimum to be paid", "$100, higher in some countries", "Whatever your own Stripe is set to"],
          ["Instant payout", "United States only, 3% fee, after 60 days", "Not needed — the account is already yours"],
          ["Disputes", "They handle them for you", "Yours, in your own dashboard"],
          ["Who is the seller of record", "Gumroad. They are the merchant of record on every sale", "You are. The charge is on your account, in your name"],
          ["Sales tax, VAT and GST", "They collect and remit it worldwide, by their own help centre", "Not handled. Being the seller means the tax is yours"],
          ["A marketplace that sends buyers", "Discover, at 30% of the sale", "None"],
          ["Several prices for one product", "Versions and pay-what-you-want", "Price options, working today"],
        ],
      },
      {
        kind: "quote",
        text: "We no longer support new user-connected Stripe accounts except for users from Brazil.",
        source: "Gumroad help centre, 'Connect your Stripe account to Gumroad', read 18 September 2026",
      },
      {
        kind: "steps",
        title: "The same $27 file, on both",
        items: [
          { title: "On Gumroad", body: "10% of $27 is $2.70, plus $0.50, so $3.20 goes to Gumroad. Their own fees page says that figure does not include credit card processing, so Stripe's 2.9% + $0.30 — about $1.08 — comes out as well. You keep $22.72." },
          { title: "On Nimbus", body: "We take nothing. Stripe charges you its own published rate on your own account — about $1.08 on $27 — so you keep $25.92, and you pay us a fixed monthly price." },
          { title: "The honest break-even", body: "The difference is $3.20 a sale, which is exactly Gumroad's cut, because the card fee is paid either way. At $29 a month the two cost you the same at about nine sales of $27. Below that, Gumroad is cheaper for you. Above it, the gap grows every month and never stops." },
          { title: "At a hundred sales", body: "Gumroad's cut is $320 that month. Ours is $29, whether you sell a hundred files or a thousand." },
        ],
      },
      {
        kind: "note",
        title: "If you sell less than that, use Gumroad",
        body: "We are not going to pretend otherwise. Under about nine $27 sales a month, a percentage of almost nothing is cheaper than a monthly price, and Gumroad is also the merchant of record and collects and remits sales tax worldwide, which is real work and real risk taken off you. Come back when the cut starts to hurt.",
      },
      {
        kind: "note",
        title: "Where Gumroad is ahead of us today",
        body: "A marketplace that can send you buyers; affiliates; automated email workflows and a newsletter; licence keys; PDF stamping; upsells; installment plans; ratings and reviews; your own domain; Zapier and a public API; purchasing power parity pricing; and a mobile app. We have none of those. They have been doing this since 2011 and it shows.",
      },
    ],
  },
  {
    slug: "beacons",
    section: "proof",
    eyebrow: "Proof",
    title: "Side by side",
    highlight: "with Beacons",
    intro:
      "Every number here was read on Beacons' own pricing page and help centre on 18 September 2026, and the page says where each one came from. When they change it, this page changes.",
    badge: PROOF,
    accent: "from-sky-brand to-violet-brand",
    blocks: [
      {
        kind: "lead",
        text: "Beacons is the closest competitor to us on the one thing we care most about: the money goes straight into the seller's own Stripe or PayPal account, at the moment of the sale. Their help centre is explicit about it. So the argument between us is not custody. It is the 9%, and what it costs to make it stop.",
      },
      {
        kind: "facts",
        title: "Beacons' own numbers",
        items: [
          { value: "9%", label: "Their cut on the free plan and the $10 plan", tone: "bg-pink-brand/10 text-pink-brand" },
          { value: "$30", label: "The monthly plan where their cut becomes 0%", tone: "bg-violet-brand/10 text-violet-deep" },
          { value: "2.9% + $0.30", label: "Stripe's own fee, charged on top of theirs", tone: "bg-amber-brand/15 text-amber-brand" },
          { value: "$0", label: "Their free plan really is free to start", tone: "bg-mint-brand/15 text-mint-deep" },
        ],
      },
      {
        kind: "table",
        title: "The part that decides",
        note: "Sources: Beacons' pricing page and their help centre articles 'Beacons Products Transaction Fees' and 'When will I receive my payout from Product/Store Sales?', read on 18 September 2026.",
        head: ["", "Beacons", "Nimbus Labs"],
        rows: [
          ["Cut of each sale", "9% on the free and $10 plans. 0% from the $30 plan up", "0%, on every plan"],
          ["Monthly price", "$0, $10, $30 and $100", "$29, free for the first 14 days"],
          ["Whose payment account", "Your own Stripe or PayPal", "Your own Stripe"],
          ["Ways to be paid", "Stripe or PayPal", "Stripe only — we are behind them here"],
          ["When the money reaches you", "At the moment of sale, into your own account", "At the moment of sale, into your own account"],
          ["Card fee", "Stripe's 2.9% + $0.30, on top of their 9%", "Stripe's 2.9% + $0.30, and nothing else"],
          ["What you are buying", "A whole suite: link in bio, websites, media kit, email, an affiliate network, AI tools", "One store page, built to sell a file"],
          ["A free plan", "Yes, and you can sell on it", "None"],
          ["Order bumps and upsells", "Yes", "Not built yet"],
          ["Memberships and courses", "Yes, from the $30 plan", "Memberships yes. Courses not built yet"],
        ],
      },
      {
        kind: "quote",
        text: "The 9% fee applies to users on the free plan or the $10/month Creator plan.",
        source: "Beacons help centre, 'Beacons Products Transaction Fees', read 18 September 2026",
      },
      {
        kind: "steps",
        title: "The same $27 file, on both",
        items: [
          { title: "On their free or $10 plan", body: "9% of $27 is $2.43, and Stripe takes about $1.08 on top. You keep $23.49." },
          { title: "On their $30 plan", body: "Their cut is 0%, Stripe still takes about $1.08, so you keep $25.92 — and you pay $30 that month." },
          { title: "On Nimbus", body: "Our cut is 0%, Stripe takes about $1.08, so you keep $25.92 — and you pay $29 that month." },
          { title: "The honest break-even", body: "The 9% costs $2.43 a sale, so their free plan and our $29 cost you the same at about 12 sales of $27 a month. At a hundred sales, their 9% is $243 that month and ours is $29. Against their $30 plan there is no money in it at all: one dollar." },
        ],
      },
      {
        kind: "note",
        title: "Where Beacons is ahead of us, and it is not close",
        body: "For $30 they give you 0% and, with it, websites, a media kit that updates itself, email marketing, an affiliate network of 12,000 brands, order bumps, memberships, courses and a pile of AI tools. We give you one store page. A dollar a month is not a reason to choose us, and we are not going to pretend it is.",
      },
      {
        kind: "note",
        title: "So when should you not use us",
        body: "If you are selling a handful of files a month, take their free plan: 9% of almost nothing is cheaper than any monthly price, ours included. And if you want the whole suite in one login, buy their $30 plan. Come to us when what you want is a fast, plain store page that pays into your own account, and you would rather not run a suite to get it.",
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
          { emoji: "🙋", title: "A person answers you", body: "Support is a human writing back. No chatbot standing between you and your money.", tint: "bg-violet-brand/10 text-violet-deep" },
          { emoji: "🚪", title: "You can always leave", body: "Export your products, your customers and your sales history whenever you want, free, without asking us.", tint: "bg-sky-brand/15 text-sky-brand" },
          { emoji: "🌐", title: "Your domain stays yours", body: "If you bring a domain, you remain the owner of it and keep access to its settings. No exit fee.", tint: "bg-pink-brand/10 text-pink-brand" },
          { emoji: "✉️", title: "Your list is yours", body: "Your buyers are on your own Stripe account, and the addresses your free products collect download as a CSV from your studio whenever you like. The price does not go up as the list grows.", tint: "bg-amber-brand/15 text-amber-brand" },
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
        body: "We cannot promise a support team that answers at three in the morning, or a feature list as long as a platform with years of work behind it. We can promise that a person answers, and that everything listed as working really works.",
      },
    ],
  },
  {
    slug: "everything",
    section: "proof",
    eyebrow: "Proof",
    title: "Feature by feature,",
    highlight: "against Stan",
    intro:
      "Everything Stan publicly offers, read from its own help centre, app store listings and blog on 17 September 2026 — and exactly where Nimbus Labs stands on each line. Green means it works today, and nothing else pretends to.",
    badge: PROOF,
    accent: "from-violet-brand to-mint-brand",
    blocks: [
      {
        kind: "lead",
        text: "The goal is to offer everything Stan offers and more. This page is the scoreboard for that goal, and it is deliberately uncomfortable: most lines still say that we do not have it.",
      },
      {
        kind: "table",
        title: "Apps and devices",
        note: "Stan's help centre, article 406, read 17 September 2026: the Stan app is \u201ccurrently only available on iPhone and iPad through the iOS App Store\u201d.",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["iPhone app", "Yes \u2014 creator app, 4.9 stars, 12,000 ratings", "Not available. The site installs to the home screen instead"],
          ["Android app", "No \u2014 none, by their own documentation", "Not available. The site installs to the home screen instead"],
          ["Buyer app", "Yes, on iPhone only (last updated June 2024)", "Not available. The store itself installs to the home screen on both phones"],
          ["Annual plan inside the app", "Not possible \u2014 browser only", "Same price on every device"],
          ["Add to home screen", "Not advertised", "Yes, on Android and iPhone"],
        ],
      },
      {
        kind: "table",
        title: "The store",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["Store page on a phone", "Yes", "Yes, and faster (97\u2013100 against 57\u201358 on PageSpeed)"],
          ["Themes and colours", "Yes, limited", "Yes \u2014 four themes, ten colours or any colour of your own, and your photo. Every colour is checked for contrast before your page uses it"],
          ["A line about you on the page", "About me, one theme only", "Every store, under your name"],
          ["Several prices in one product", "Not available", "Up to three, each delivering its own thing"],
          ["Custom domain", "Not available", "Not available"],
          ["Custom code on the page", "Explicitly not supported", "Not available"],
          ["Embed the store on your own site", "Not available", "Not available"],
          ["Several stores in one account", "Not in one account. Several accounts, each with its own email and its own subscription", "Not available. One store per account, the same as theirs"],
        ],
      },
      {
        kind: "table",
        title: "What you can sell",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["Digital downloads", "Yes, up to 5 GB", "Yes, up to 5 GB"],
          ["Selling something bigger", "Their help centre: host it on Google Drive or Dropbox and use Redirect to URL", "Sell it as a link. Same escape hatch, and we say so on the product itself"],
          ["How much your buyers may download", "No figure in their help centre", "200 GB a month, published, and shown in your account as it is used"],
          ["Courses with drip and analytics", "Yes", "Not available"],
          ["Memberships and subscriptions", "Yes \u2014 daily, weekly, monthly, annually, and can end after a set number of payments", "Yes \u2014 daily, weekly, monthly, yearly, on your own Stripe, and members cancel on their own in one click. No fixed-term option yet"],
          ["Coaching calls with a calendar", "Yes", "Not available"],
          ["Live webinars", "Yes", "Not available"],
          ["Lead magnets", "Yes", "Yes \u2014 anything priced at 0 is given for an email address, each address confirmed by its owner, and the list downloads as a CSV at any time"],
          ["Community", "Yes, one per account", "Not available"],
          ["External links on your page", "Yes, as one of their product types", "Yes, as their own list — no price on them and nothing to check out"],
          ["Physical products", "Not supported", "Not available"],
          ["Course quizzes and certificates", "Not available", "Not available"],
        ],
      },
      {
        kind: "table",
        title: "Checkout and money",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["Cut of each sale", "0%", "0%"],
          ["Whose Stripe account", "One managed by the platform", "Yours"],
          ["Getting paid", "Manual cash-out, $10 minimum", "Your Stripe payout schedule"],
          ["Klarna and Afterpay", "Yes, on the $99 plan", "Whatever your own Stripe account accepts"],
          ["Discount codes", "Yes, on the $99 plan", "Yes, in the one price \u2014 kept on your own Stripe account"],
          ["Order bumps and upsells", "Yes, on the $99 plan", "Not available"],
          ["Payment plans", "Yes, on the $99 plan", "Not available"],
          ["Sales tax collection", "Yes", "Not available"],
        ],
      },
      {
        kind: "table",
        title: "Marketing",
        head: ["", "Stan", "Nimbus Labs"],
        rows: [
          ["E-mail broadcasts and flows", "Yes, on the $99 plan only", "Not available"],
          ["Instagram auto-DM", "Yes, on the $29 plan", "Not available"],
          ["Funnels up to 20 pages", "Yes, on the $99 plan, since June 2026", "Not available"],
          ["Affiliates paid automatically", "Yes, on the $99 plan", "Needs a United States company \u2014 planned, with the cost published"],
          ["Advertising pixels", "Yes, on the $99 plan", "Not available"],
          ["Public API and webhooks", "None published", "Not available"],
        ],
      },
      {
        kind: "note",
        title: "Read this line before anything else",
        body: "Today you can sign in without a password, take a store address that is yours, write what you sell with its price, upload the file each one delivers, connect your own Stripe account, and be paid on it — the buyer's card is charged on your account, with nothing taken on top, and the file goes out the second Stripe confirms. The demo store is still there to try first, with a test card. Our own charge is switched on: $29 a month, free for the first 14 days, and it is what turns your page's till on. Everything marked as not available is exactly that — not promised, not dated. A line only turns green when you can open it and try it.",
      },
      {
        kind: "note",
        title: "About the app stores",
        body: "A real App Store and Google Play app is not a design job, it is a compliance job: Apple charges 99 dollars a year and takes its cut of subscriptions bought inside the app, which is why Stan charges $29.99 in the app and cannot sell annual plans there at all. Google Play charges 25 dollars once. The installable web app has none of that, works on both systems, and is what we ship first.",
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
          { title: "Can I sign up and sell today?", body: "Yes. You take your store address, put what you sell on the page, connect your own Stripe account, and a buyer can pay for it — on your account, with nothing taken on top. Until Stripe clears your account, your page says plainly that it cannot take a payment, so nobody's time is wasted." },
          { title: "Who holds the money from my sales?", body: "You do, in your own Stripe account. We take 0% of your sales and charge only a monthly subscription." },
          { title: "What happens if Nimbus Labs closes?", body: "Your Stripe account, your customers and your files were never ours. Your list downloads from your studio at any time, and a shutdown comes with notice in writing." },
          { title: "Who is behind this?", body: "Vinicius Sucupira, an independent builder working in public. Support is in English, in writing." },
          { title: "Can my store look like mine?", body: "Yes. Put up your photo, pick one of four themes and a colour \u2014 one of ten, or your own \u2014 and the studio shows the page before you save it. Every colour is checked so the words on your page stay easy to read." },
          { title: "What do I do if something breaks?", body: "You write to support and a person answers. If a sale is affected, you have the Stripe dashboard as the source of truth, independently of us." },
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
