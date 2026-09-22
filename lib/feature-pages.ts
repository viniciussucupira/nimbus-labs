// The feature pages and the pages for each kind of creator.
//
// Every sentence here describes something a creator can open and use today,
// or says plainly that it cannot be done. When a feature changes, its page
// changes the same day: the help centre and these pages are read against the
// code, not against a plan.
import { isDomainsConfigured } from "@/lib/domains";
import type { TopicPage } from "@/lib/site-pages";

/** Whether stores can be put on their own domain on this deployment. */
const DOMAINS = isDomainsConfigured();

const WORKING = { label: "Working today", tone: "live" as const };

/* ------------------------------------------------------------ features ---- */

export const FEATURE_PAGES: TopicPage[] = [
  {
    slug: "store-page",
    section: "platform",
    eyebrow: "Store page",
    title: "A store page that looks like",
    highlight: "you, not like a template",
    intro:
      "One address with your name, your photo, a line about you, your links and everything you sell. Built to be read on a phone in a few seconds, because that is where your buyer opens it.",
    badge: WORKING,
    accent: "from-violet-brand to-sky-brand",
    visual: "store",
    plan: "creator",
    group: "sell",
    menu: { label: "Store page", description: "Your photo, your links and everything you sell, at one address.", icon: "store" },
    related: ["price-options", "insights", "domain", "your-stripe"],
    blocks: [
      {
        kind: "how",
        title: "Live in three steps",
        items: [
          { title: "Take your address", body: "nimbuslabsai.com/@yourname is yours the moment you take it, and the page is up straight away." },
          { title: "Put up what you sell", body: "Its name, what is inside and the price. Files, courses, memberships, calls, free things for an email, and plain links." },
          { title: "Make it look like you", body: "Your photo, one of four themes, and one of ten colours or your own. The studio shows the page before you save." },
        ],
      },
      {
        kind: "features",
        title: "What the page carries",
        items: [
          { icon: "user", title: "You, at the top", body: "Your photo, your name and a line about you, on every theme — not locked behind one." },
          { icon: "file", title: "Up to twenty products", body: "Each with its price, what the buyer gets and the button that buys it, in the order you choose." },
          { icon: "gift", title: "Free things, for an email", body: "Price something at 0 and it is handed out for a confirmed email address that joins your list." },
          { icon: "link", title: "Links with no price", body: "Your channel, your podcast, your booking page — with the site each one leads to printed under it." },
          { icon: "palette", title: "Colours that stay readable", body: "Every colour is checked for contrast before your page uses it, so your words never disappear into it." },
          { icon: "phone", title: "Installs to the home screen", body: "On iPhone and Android, straight from the browser, for you and for your buyers. No app to download." },
          { icon: "refresh", title: "Change your address freely", body: "Every address your store has used keeps working and leads to the new one, so the link in your bio never breaks." },
          { icon: "gauge", title: "Fast on a phone", body: "The demo store scored 97 to 100 for performance on Google PageSpeed, on a simulated phone, on 17 September 2026." },
        ],
      },
      {
        kind: "uses",
        title: "Made for the link in your bio",
        items: [
          { icon: "camera", who: "You post on Instagram or TikTok", what: "One link that holds the free guide, the paid plan and the call, instead of a different link every week." },
          { icon: "video", who: "You teach on YouTube", what: "The course, the templates from the video and the channel itself, on one page people can find again." },
          { icon: "mic", who: "You run a podcast or a newsletter", what: "The episode links next to the things you sell, with no price on the links and nothing to check out." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        intro: "Said here so nobody signs up expecting it.",
        items: [
          "There is one layout: you choose the theme, the colour and the order, not the arrangement of blocks on the page.",
          "Twenty products and twenty links per store. There are no categories or search for a big catalogue.",
          "No custom code on the page, and the store cannot be embedded in another website.",
          "Buyers pay by card through Stripe. PayPal is not offered.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about the store page",
        items: [
          { q: "Can I change my store address later?", a: "Yes, from your studio, whenever you want. Every address the store has ever used keeps working and sends people to the current one. A store holds up to ten addresses." },
          { q: "Is the page up before I connect Stripe?", a: "Yes. The page, the editor and your address are free and stay free. Taking a card needs two things: Stripe has cleared your account, and your plan or its 14-day trial is running. Until then the page says plainly that it cannot take a payment." },
          { q: "Can I use my own domain?", a: DOMAINS ? "Yes, on the $99 Pro plan. You add one record where you bought the domain, and the certificate is made for you. Your nimbuslabsai.com address keeps working as well." : "Not yet. It is planned for the Pro plan, and this page will say so on the day it works." },
          { q: "How do I see what the page looks like before I save?", a: "The studio shows the page with your photo, theme and colour as you change them, before anything is saved." },
        ],
      },
    ],
  },
  {
    slug: "price-options",
    section: "platform",
    eyebrow: "Price options",
    title: "One product,",
    highlight: "several prices",
    intro:
      "A one-week plan for $27 and a five-week plan for $39, from the same product card. The buyer picks, and each option hands over its own file or its own link.",
    badge: WORKING,
    accent: "from-pink-brand to-amber-brand",
    visual: "options",
    plan: "creator",
    group: "sell",
    menu: { label: "Price options", description: "Up to three prices on one product. The buyer picks.", icon: "tag" },
    related: ["checkout", "instant-delivery", "store-page", "courses"],
    blocks: [
      {
        kind: "how",
        title: "How it works",
        items: [
          { title: "Add up to three options", body: "A name the buyer reads — “1 week”, “Commercial licence” — and a price for each." },
          { title: "Give each one its thing", body: "Its own file, up to 5 GB, or its own link. The buyer of the small size never receives the big one." },
          { title: "The buyer picks on the card", body: "One product, one card, no extra page. What is charged is read from what you saved, never from the page." },
        ],
      },
      {
        kind: "lead",
        text: "Stan's own help centre lists pricing tiers among its most requested features and says there is no native way to offer them under one product — read on 18 September 2026. Here they are on the $29 plan.",
      },
      {
        kind: "uses",
        title: "Where a second price earns its keep",
        items: [
          { icon: "calendar", who: "Sizes of the same plan", what: "One week to try, five weeks for the person who already trusts you, the whole season for the fan." },
          { icon: "key", who: "Licences", what: "Personal use, commercial use and a team licence, each delivering its own file and terms." },
          { icon: "video", who: "Plain and complete", what: "The PDF on its own, or the PDF with the videos, at a price that tells the buyer the difference." },
        ],
      },
      {
        kind: "facts",
        title: "Measured on 17 September 2026",
        items: [
          { value: "$39", label: "Test purchase of the five-week option, in production", tone: "" },
          { value: "8,929", label: "Bytes delivered — identical to the original file", tone: "" },
          { value: "54", label: "Automated checks passing on the store that day", tone: "" },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "Three options per product at most.",
          "A payment plan is offered on products with one price, so a product with options is paid at once — or as a membership.",
          "Pay-what-you-want is not offered.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about price options",
        items: [
          { q: "Can I change a price after people have bought?", a: "Yes. What changes is what the next buyer pays. Whoever already bought keeps what they paid for, and the file of the option they chose." },
          { q: "Do discount codes and the box at checkout work with options?", a: "Yes. A code comes off the option the buyer picked, and the box at checkout adds its product to whichever option they chose." },
          { q: "Can an option be a membership?", a: "Yes. A membership can have options too — monthly members choosing between two levels, for example — each charged on your own Stripe account." },
        ],
      },
    ],
  },
  {
    slug: "courses",
    section: "platform",
    eyebrow: "Courses",
    title: "Courses your students",
    highlight: "open without a password",
    intro:
      "Modules and lessons with video, text and downloads, free preview lessons on your store, and modules that open on the day you choose. Students get in with the email they paid with.",
    badge: WORKING,
    accent: "from-sky-brand to-violet-brand",
    visual: "course",
    plan: "creator",
    group: "sell",
    menu: { label: "Courses", description: "Video lessons, free previews and modules that open over time.", icon: "book" },
    related: ["memberships", "checkout", "email", "instant-delivery"],
    blocks: [
      {
        kind: "how",
        title: "From a product to a course",
        items: [
          { title: "Turn a product into a course", body: "Any paid product becomes a course from your studio. Add modules, then lessons inside them." },
          { title: "Fill the lessons", body: "A video of up to 5 GB, your text, up to five downloads and a link on each. Mark any lesson as a free preview." },
          { title: "Sell it your way", body: "Paid once, in a payment plan, or as a membership that stays open while the member pays." },
        ],
      },
      {
        kind: "features",
        title: "What a course holds",
        items: [
          { icon: "video", title: "Video that stays upright", body: "Up to 5 GB a lesson. A video filmed upright on a phone plays upright." },
          { icon: "eye", title: "Free preview lessons", body: "Any lesson can be watched from your store before buying, so the buyer knows what they are paying for." },
          { icon: "calendar", title: "Modules that open over time", body: "A module can open a set number of days after each student joins, and the student gets an email the day it does." },
          { icon: "key", title: "No password to make", body: "The course opens straight away in the browser that paid. On any other device, a link goes to the address they paid with." },
          { icon: "chart", title: "Each student's progress", body: "Your studio shows who opened the course and how many lessons each one marked done." },
          { icon: "users", title: "Your list of students", body: "See every student, and take one off the course if you need to." },
        ],
      },
      {
        kind: "uses",
        title: "Who sells courses here",
        items: [
          { icon: "cap", who: "A coach with a method", what: "Six weeks of lessons that open one module a week, with the worksheets inside each lesson." },
          { icon: "utensils", who: "A cook with a system", what: "Batch cooking, filmed in your own kitchen, with a free first lesson on the store." },
          { icon: "palette", who: "A designer who teaches", what: "The techniques on video, and the source files as downloads beside each lesson." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "No quizzes and no certificates.",
          "No comments or community inside the course.",
          "No live lessons. A live session can go in a lesson as a link to where you hold it.",
          "Videos watched count towards your store's 200 GB a month, the same as downloads. Going over never cuts a student off; we write to you instead.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about courses",
        items: [
          { q: "How does a student come back next week?", a: "On the device they paid on, the course simply opens. On any other, they ask for a link on the course page and it goes to the address they paid with. No account, no password." },
          { q: "Can I sell a course monthly?", a: "Yes. Sold as a membership, the course stays open while the member pays and closes when the membership ends." },
          { q: "Can students pay in instalments?", a: "Yes. A course with one price can be offered in two to twelve weekly or monthly payments. The student gets in after the first." },
          { q: "What if I refund a student?", a: "Refunds are made in your own Stripe dashboard. For a course paid once, take the student off the course in your studio as well." },
        ],
      },
    ],
  },
  {
    slug: "memberships",
    section: "platform",
    eyebrow: "Memberships",
    title: "Get paid every month,",
    highlight: "on your own account",
    intro:
      "Any product can charge daily, weekly, monthly or yearly instead of once. The member is your customer, in your Stripe dashboard, and cancels on their own in one click.",
    badge: WORKING,
    accent: "from-violet-brand to-pink-brand",
    visual: "membership",
    plan: "creator",
    group: "sell",
    menu: { label: "Memberships", description: "Daily, weekly, monthly or yearly, on your own Stripe.", icon: "repeat" },
    related: ["courses", "your-stripe", "email", "checkout"],
    blocks: [
      {
        kind: "how",
        title: "How it works",
        items: [
          { title: "Choose how often", body: "Daily, weekly, monthly or yearly, on any product. It can deliver a file, a link or a course." },
          { title: "The member subscribes", body: "The subscription is made on your own Stripe account, like every charge here, with 0% to us on every renewal." },
          { title: "They leave on their own", body: "Under every membership: “Already a member? Manage or cancel”. An emailed link opens Stripe's own page for their membership." },
        ],
      },
      {
        kind: "features",
        title: "What makes it fair to both sides",
        items: [
          { icon: "bank", title: "Your customer, not ours", body: "Members sit in your Stripe dashboard. If you ever leave Nimbus, the paying members stay with you." },
          { icon: "door", title: "Cancelling is one click", body: "On Stripe's page, at the end of the period already paid for. Nobody has to write to you and wait." },
          { icon: "card", title: "Card changes without you", body: "The member changes their card and sees their receipts on the same page." },
          { icon: "book", title: "A course that stays open", body: "A course sold as a membership is open while the member pays, and closes when it ends." },
        ],
      },
      {
        kind: "uses",
        title: "What people sell as a membership",
        items: [
          { icon: "utensils", who: "A monthly meal plan", what: "A new plan every month, delivered as a link to where you keep it." },
          { icon: "dumbbell", who: "A training club", what: "The programme as a course that stays open while the member pays." },
          { icon: "users", who: "A group session", what: "A monthly class, with the meeting link as what the membership hands over." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "A membership runs until the member cancels. You cannot set it to stop after six payments.",
          "No free trial period for members.",
          "When somebody stops paying, a link they were given keeps working: remove them wherever you keep the thing itself. Courses close by themselves.",
          "No community space for members.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about memberships",
        items: [
          { q: "What does Nimbus take from a renewal?", a: "Nothing. 0% of every payment, the first and every one after it. Stripe charges its own card fee on your account." },
          { q: "What happens if my own Nimbus plan lapses?", a: "Your page stops selling, but members can still cancel on their own. Nobody is ever trapped in a charge they want to stop." },
          { q: "Do discount codes work on memberships?", a: "Yes, on the first charge. A code comes off the payment it is typed into, not every renewal after it." },
        ],
      },
    ],
  },
  {
    slug: "calls",
    section: "platform",
    eyebrow: "Paid calls",
    title: "Sell your time,",
    highlight: "booked and paid in one go",
    intro:
      "Set your hours once, in your time zone. Buyers see the free times in theirs, pick one and pay on your Stripe account, and you both get the invitation.",
    badge: WORKING,
    accent: "from-mint-brand to-sky-brand",
    visual: "calls",
    plan: "creator",
    group: "sell",
    menu: { label: "Paid calls", description: "Your hours, their time zone, paid before it is booked.", icon: "calendar" },
    related: ["checkout", "your-stripe", "insights", "store-page"],
    blocks: [
      {
        kind: "how",
        title: "How it works",
        items: [
          { title: "Set your hours once", body: "How long a call lasts, your time zone, and the hours you take calls each day — up to two stretches a day." },
          { title: "The buyer picks a time", body: "Free times are shown in the buyer's own time zone. The time is kept for them for 30 minutes while they pay." },
          { title: "Paid, then booked", body: "You both get an email with a calendar file and your meeting link. The call appears in your studio under Upcoming calls." },
        ],
      },
      {
        kind: "features",
        title: "The rules are yours",
        items: [
          { icon: "clock", title: "Length", body: "15, 20, 30, 45, 60, 90 or 120 minutes." },
          { icon: "alert", title: "Notice", body: "From 1 hour to 72 hours before a call, so nobody books you for the next ten minutes." },
          { icon: "calendar", title: "How far ahead", body: "From a week to three months of free times on show." },
          { icon: "minus", title: "A gap between calls", body: "Up to an hour between one call and the next." },
          { icon: "video", title: "Your meeting link", body: "Zoom, Google Meet, Whereby — the link you already use goes into every invitation." },
          { icon: "shield", title: "Never booked twice", body: "A time being paid for is held, so two people can never pay for the same hour." },
        ],
      },
      {
        kind: "uses",
        title: "Who sells calls",
        items: [
          { icon: "cap", who: "Coaches", what: "The hour of your time, next to the workbook and the programme, as the top step of the ladder." },
          { icon: "dumbbell", who: "Trainers", what: "A 20-minute form check that is booked and paid, not a free message that eats your evening." },
          { icon: "palette", who: "Designers", what: "A portfolio review or a consultation before a commission." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "It does not read your Google or Outlook calendar. The hours you set are the hours offered: to take a day off, change them.",
          "There is no reschedule button. To move or cancel, the buyer replies to their confirmation email, which reaches you; a refund is made from your Stripe dashboard.",
          "One person per call. Group calls and webinars are not built.",
          "The video call itself happens on the service whose link you give.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about paid calls",
        items: [
          { q: "What if two people try to book the same time?", a: "The first to reach payment holds it for 30 minutes. The second no longer sees it. If the first does not pay, the time comes back." },
          { q: "Can a call be paid in instalments?", a: "No. A call is paid in full when it is booked. Instalments are for products with one price." },
          { q: "Is sales tax added to calls?", a: "When you switch Stripe Tax on, it is added to calls as it is to everything else, on your own account." },
        ],
      },
    ],
  },
  {
    slug: "checkout",
    section: "platform",
    eyebrow: "Checkout tools",
    title: "Earn more from every buyer,",
    highlight: "on the $29 plan",
    intro:
      "Discount codes, a product added at checkout, a one-click offer after paying, payment plans, limited quantities and sales tax. On Stan the first four are on the $99 plan.",
    badge: WORKING,
    accent: "from-amber-brand to-pink-brand",
    visual: "checkout",
    plan: "creator",
    group: "paid",
    menu: { label: "Checkout tools", description: "Codes, add-ons, one-click offers, instalments and tax.", icon: "percent" },
    related: ["price-options", "your-stripe", "insights", "memberships"],
    blocks: [
      {
        kind: "features",
        title: "Six tools, all charged on your own account",
        intro: "Stan's pricing page, read on 20 September 2026, puts discount codes, order bumps, upsells and payment plans on its $99 plan.",
        items: [
          { icon: "percent", title: "Discount codes", body: "A word you choose, a percentage or an amount off, and a cap on uses if you want one. Up to twenty codes, kept as coupons on your own Stripe." },
          { icon: "plus", title: "Add it at checkout", body: "A box under the buy button offers another of your products at a price of your own. Never ticked for the buyer." },
          { icon: "bolt", title: "One click after paying", body: "The thanks page offers one more product, charged to the card just used. Only in that browser, for an hour, once." },
          { icon: "calendar", title: "Payment plans", body: "Two to twelve weekly or monthly payments. The buyer gets it after the first, and it ends by itself after the last." },
          { icon: "list", title: "Limited quantity", body: "Sell fifty and stop. The count shown is the real one, and a unit being paid for is held so the last one is never sold twice." },
          { icon: "receipt", title: "Sales tax and VAT", body: "Stripe Tax works it out from each buyer's address, on your account, once your Stripe tax setup is complete." },
        ],
      },
      {
        kind: "how",
        title: "What keeps it honest",
        items: [
          { title: "Nothing ticked for them", body: "An extra charge the buyer did not choose is not a sale, and in Europe it is not allowed either." },
          { title: "The button says the total", body: "Tick the box or pick the plan, and the buy button changes to what is charged today." },
          { title: "Scarcity that is true", body: "The number left is counted from real payments. No invented countdowns, no fake stock." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "A discount code comes off the payment it is typed into. On a membership, that is the first charge.",
          "One product can be offered in the box, and one after paying, per product.",
          "While sales tax is on, the one-click offer after paying is paused, because tax cannot be added to a one-click charge.",
          "A payment plan cannot be cancelled from your page; a buyer who needs to change something replies to their receipt, which reaches you.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about the checkout tools",
        items: [
          { q: "Is the one-click offer safe for the buyer?", a: "The card is kept only for payments made while the buyer is there, never to charge them later. The offer works only in the browser that paid, for an hour, and once; if the bank asks the buyer to confirm, they confirm it." },
          { q: "Who files the tax that Stripe collects?", a: "You do, because you are the seller. Stripe Tax works it out and collects it on your account, and gives you reports of what was collected. Stripe charges for Stripe Tax at its own published price." },
          { q: "Can a buyer who chose a payment plan also take the box at checkout?", a: "Yes. The added product is charged with the first payment, and the button says the total due today." },
        ],
      },
    ],
  },
  {
    slug: "your-stripe",
    section: "platform",
    eyebrow: "Your own Stripe",
    title: "The money goes to",
    highlight: "your own Stripe account",
    intro:
      "Every sale is charged on your account, in your name. We never hold your sales, so there is no balance of yours for us to freeze, delay or set a minimum on.",
    badge: WORKING,
    accent: "from-violet-brand to-pink-brand",
    visual: "stripe",
    plan: "creator",
    group: "paid",
    menu: { label: "Your own Stripe", description: "The money lands in your account, not in ours.", icon: "bank" },
    related: ["checkout", "memberships", "instant-delivery", "insights"],
    blocks: [
      {
        kind: "how",
        title: "How it works",
        items: [
          { title: "Connect Stripe from your studio", body: "You get a full Stripe account in your name, with your own login and dashboard at stripe.com." },
          { title: "Buyers pay you directly", body: "The charge, the receipt and the line on your buyer's card statement carry your business name, not ours." },
          { title: "Stripe pays you out", body: "On the payout schedule you set in your own Stripe dashboard. There is nothing for us to release." },
        ],
      },
      {
        kind: "table",
        title: "Where the money sits",
        note: "Stan's structure checked on its own help centre and terms in September 2026.",
        head: ["", "Platform-held model", "Nimbus Labs"],
        rows: [
          ["Whose Stripe account", "One the platform manages for you, with no Stripe login of your own", "Yours: a full Stripe account in your name, with your own login"],
          ["Who can pause the money", "The platform, by policy", "Your bank and Stripe's own rules"],
          ["Getting paid", "Manual cash-out, minimums, payout fees", "Your Stripe payout schedule"],
          ["If you leave", "You migrate customers and payouts", "Nothing to migrate — the account was always yours"],
        ],
      },
      {
        kind: "features",
        title: "What that means in practice",
        items: [
          { icon: "percent", title: "0% of your sales", body: "Our only income is your plan. Stripe charges its own card fee on your account, line by line." },
          { icon: "receipt", title: "You are the seller", body: "The sale is yours, in your name. Refunds and disputes are handled in your own Stripe dashboard." },
          { icon: "door", title: "Nothing to take with you", body: "Customers, members and payouts were always on your account. Leaving costs you nothing to move." },
        ],
      },
      {
        kind: "limits",
        title: "The honest limits",
        items: [
          "Stripe only. PayPal is not offered: Stripe does not make it available to platforms like ours, and a second, separate integration means a second checkout to keep working.",
          "You need a Stripe account in a country Stripe operates in — the United States, Canada, the United Kingdom and the European Union among them, but not everywhere.",
          "Because we never touch your money, we cannot advance it, split it with an affiliate automatically, or refund a buyer for you.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about your Stripe account",
        items: [
          { q: "What do I pay Nimbus?", a: "Your plan — $29 a month, or $99 on Pro — and nothing from your sales. The first 14 days are free, and you cancel in one click from your studio." },
          { q: "Who handles refunds and disputes?", a: "You do, in your own Stripe dashboard, with the same tools any business has. A refund is a refund you issue, not a request you file with us." },
          { q: "What happens to my money if Nimbus closes?", a: "Nothing. It was never here. Your Stripe account, your customers and your payouts carry on without us." },
        ],
      },
    ],
  },
  {
    slug: "instant-delivery",
    section: "platform",
    eyebrow: "Instant delivery",
    title: "The file lands",
    highlight: "the second the payment clears",
    intro:
      "No manual sending and no waiting for an email. Stripe confirms, and the download is on the buyer's screen — and if they lose it a month later, they get it back themselves.",
    badge: WORKING,
    accent: "from-mint-brand to-sky-brand",
    visual: "delivery",
    plan: "creator",
    group: "deliver",
    menu: { label: "Instant delivery", description: "On screen when paid, and back by email whenever it is lost.", icon: "bolt" },
    related: ["price-options", "courses", "your-stripe", "checkout"],
    blocks: [
      {
        kind: "how",
        title: "From paid to delivered",
        items: [
          { title: "Stripe confirms the payment", body: "Nothing is released before Stripe says it is paid. An unpaid or unfinished checkout gets a clear refusal, not a file." },
          { title: "The download is on screen", body: "Tied to that order, and working for three days. The file itself is never at a public address." },
          { title: "Lost later? Back by email", body: "“Bought something here? Get it again” on every store: the address they paid with receives everything it bought, any time." },
        ],
      },
      {
        kind: "features",
        title: "What you can hand over",
        items: [
          { icon: "file", title: "Files up to 5 GB", body: "PDF, ePub, ZIP, images, audio, video, text, and Word, Excel and PowerPoint. Large files upload in parts, so a dropped connection costs one part." },
          { icon: "link", title: "Or a link", body: "Too big, or not a file at all — a Drive folder, a Notion page, a private video — and the buyer is sent there the moment they pay." },
          { icon: "download", title: "200 GB of downloads a month", body: "Published, and shown in your studio as it is used. Going over never cuts a buyer off; we write to you instead." },
          { icon: "shield", title: "Nothing that runs", body: "Programs, installers and scripts are refused, so a taken-over account cannot hand out malware." },
        ],
      },
      {
        kind: "facts",
        title: "What the tests cover",
        items: [
          { value: "402", label: "Refused when the payment is not confirmed", tone: "" },
          { value: "410", label: "Refused after the three-day window, which is when getting it again by email takes over", tone: "" },
          { value: "502", label: "Honest error when Stripe is unreachable", tone: "" },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "No licence keys, and no stamping of the buyer's name on a PDF.",
          "Getting a purchase back needs the address the buyer paid with. If they typed it wrong, you see the sale in Stripe and can send the file yourself.",
          "A link you sell stays wherever you keep it: we cannot take it back from someone who has it.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about delivery",
        items: [
          { q: "How does a buyer get a file again after three days?", a: "At the foot of your store page, “Bought something here? Get it again”. They type the address they paid with and receive a link to a page with everything that address bought from you, read from your Stripe account. No account and no password." },
          { q: "Can a buyer pass the download around?", a: "The download is tied to their order and to a short window, and the file is fetched through a link that expires in minutes. A leaked link does not become a free copy for everyone." },
          { q: "What if a buyer was refunded?", a: "A sale you refunded in full no longer appears when they ask to get their purchases again, because that list is read from your Stripe account each time it opens." },
        ],
      },
    ],
  },
  {
    slug: "email",
    section: "platform",
    eyebrow: "Email to your list",
    title: "Write to the people",
    highlight: "who asked to hear from you",
    intro:
      "One-off emails, emails for later and sequences that send themselves, under your name, to everyone who agreed. Up to 50,000 a month on Pro.",
    badge: { label: "Working today, on Pro", tone: "live" as const },
    accent: "from-violet-brand to-sky-brand",
    visual: "email",
    plan: "pro",
    group: "grow",
    menu: { label: "Email to your list", description: "Broadcasts and sequences, only to people who agreed. Pro.", icon: "mail" },
    related: ["store-page", "courses", "memberships", "domain"],
    blocks: [
      {
        kind: "how",
        title: "How your list grows and hears from you",
        items: [
          { title: "People join", body: "A free product for an email, or a box ticked at checkout. Every free-product address is confirmed from its own inbox." },
          { title: "Sequences welcome them", body: "A welcome when someone joins, a few emails in the days after someone buys. Each person goes through a sequence once." },
          { title: "You write when you have news", body: "To everyone who agreed, or only to the buyers of one product. Now, or at the time you choose." },
        ],
      },
      {
        kind: "features",
        title: "What every email carries",
        items: [
          { icon: "user", title: "Your name, your replies", body: "Emails go out under your name, and replies come to you." },
          { icon: "ban", title: "One-click unsubscribe", body: "In every email, and in the header mail apps use. Whoever leaves is never written to again, whatever a later import says." },
          { icon: "pin", title: "Your postal address", body: "And why the reader is getting it — what the law in the United States asks of every commercial email." },
          { icon: "download", title: "Your list is yours", body: "Download it as a CSV any time, from any plan. Bring one in, confirming each time that those people agreed." },
        ],
      },
      {
        kind: "uses",
        title: "What creators send",
        items: [
          { icon: "gift", who: "After the free guide", what: "Three emails over a week that end with the product the guide was the first step of." },
          { icon: "book", who: "After a purchase", what: "How to get the most from it, and a word about the next thing when they are ready." },
          { icon: "mail", who: "When something is new", what: "A launch, a new season of the plan, a date for the next cohort." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "Emails are written, not designed: text with links and lists, no images or templates.",
          "No A/B tests and no open or click counts.",
          "During the free trial a store sends up to 1,000; the full 50,000 opens with the first payment.",
          "Ten sequences of up to ten emails each.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about email",
        items: [
          { q: "Why is email on Pro and not on $29?", a: "Because it costs us money for every email sent, and the $29 plan is priced to cover a store, not a mailing list. Stan puts email on its $99 plan as well — read on its pricing page on 20 September 2026." },
          { q: "Can I import the list I already have?", a: "Yes, as long as those people agreed to hear from you. You confirm that each time you import, and anyone who unsubscribed here stays unsubscribed." },
          { q: "Can I email people on the $29 plan at all?", a: "Your list downloads as a CSV on every plan, and every email tool imports it. Writing to it from Nimbus is what Pro adds." },
        ],
      },
    ],
  },
  {
    slug: "domain",
    section: "platform",
    eyebrow: "Your own domain",
    title: "Your store,",
    highlight: "on your own domain",
    intro: DOMAINS
      ? "shop.yourname.com or yourname.com, with the certificate made and renewed for you. Your nimbuslabsai.com address keeps working as well."
      : "shop.yourname.com or yourname.com, on the Pro plan. It is not switched on here yet, and this page says so rather than pretending.",
    badge: DOMAINS ? { label: "Working today, on Pro", tone: "live" as const } : { label: "Coming to Pro", tone: "building" as const },
    accent: "from-sky-brand to-mint-brand",
    visual: "domain",
    plan: "pro",
    group: "grow",
    menu: { label: "Your own domain", description: "shop.yourname.com, with the certificate handled. Pro.", icon: "globe" },
    related: ["store-page", "email", "insights", "your-stripe"],
    blocks: [
      {
        kind: "how",
        title: "Three steps, most of them waiting",
        items: [
          { title: "Type the domain you own", body: "In your studio, on Pro. A domain you already have, bought wherever you like." },
          { title: "Add one record", body: "The studio shows exactly what to add where you bought it — usually one record, sometimes a second to prove it is yours." },
          { title: "Press Check again", body: "When the record shows up, usually within minutes, your store opens on the domain with its own certificate." },
        ],
      },
      {
        kind: "features",
        title: "What changes, and what does not",
        items: [
          { icon: "globe", title: "The whole store moves with it", body: "Its pages keep their short paths on your domain: the thanks page, courses, bookings and getting a purchase again." },
          { icon: "link", title: "Old links keep working", body: "nimbuslabsai.com/@yourname stays up, so nothing you shared before breaks." },
          { icon: "lock", title: "The certificate is handled", body: "Made for you when the record shows up, and renewed for you." },
          { icon: "door", title: "If Pro ends", body: "Visitors to the domain are sent to your nimbuslabsai.com address, so no buyer meets a dead page." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do",
        items: [
          "We do not sell domains. You buy one wherever you like and keep it there.",
          "One domain per store.",
          "Email addresses on your domain are set up where you bought it, not here.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about your own domain",
        items: [
          { q: "Does Stan offer this?", a: "No. Our comparison with Stan, checked against their own help centre and pricing in September 2026, lists a custom domain as not available." },
          { q: "Who owns the domain?", a: "You do, and you keep access to its settings. If you ever leave, remove the record and point it wherever you like." },
          { q: "How long does it take?", a: "Adding it takes a minute. The record usually shows up within minutes, and at most within a day, depending on where you bought the domain." },
        ],
      },
    ],
  },
  {
    slug: "insights",
    section: "platform",
    eyebrow: "Your numbers",
    title: "See what sells,",
    highlight: "and where buyers come from",
    intro:
      "Visitors, checkouts, sales and conversion for the last 7 or 30 days, where each visit came from, and every product and link on its own line. Counted without cookies.",
    badge: WORKING,
    accent: "from-mint-brand to-violet-brand",
    visual: "insights",
    plan: "creator",
    group: "grow",
    menu: { label: "Numbers and pixels", description: "Visits, sources, sales, and your ad pixels.", icon: "chart" },
    related: ["checkout", "store-page", "email", "your-stripe"],
    blocks: [
      {
        kind: "how",
        title: "How it is counted",
        items: [
          { title: "Visits, without cookies", body: "A visitor is one person on one device on one day, told apart by a one-way fingerprint that is never stored. Your own visits are not counted." },
          { title: "Sources, even from apps", body: "Instagram and TikTok hide where a visit came from, so we read the app's name. Add ?utm_source= to a link to count it under your own word." },
          { title: "Sales, from Stripe", body: "New purchases and new members are read from your own Stripe account, not counted by us." },
        ],
      },
      {
        kind: "features",
        title: "Your ad pixels, on the $29 plan",
        intro: "Stan puts advertising pixels on its $99 plan, by its pricing page read on 20 September 2026.",
        items: [
          { icon: "target", title: "Meta, Google, TikTok and Pinterest", body: "Paste the pixel's id. Your pages report every view, every checkout started, every lead and every purchase with its amount." },
          { icon: "shield", title: "Asked first, where the law says so", body: "Visitors in the EU, the UK, Switzerland and Brazil are asked in plain words, and nothing loads unless they say yes." },
          { icon: "eye", title: "Global Privacy Control respected", body: "Everywhere else, a browser that sends it gets no pixels." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "Renewals are not in the revenue figure; they are in your Stripe dashboard.",
          "The last 30 days at most, with no export.",
          "No A/B tests of the page.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about your numbers",
        items: [
          { q: "Do the visit counts set cookies?", a: "No. They set no cookie and keep no personal data, so there is nothing about them to ask a visitor. The ad pixels are different, which is why visitors are asked first where the law says so." },
          { q: "Why do my numbers differ from Stripe's?", a: "Sales here are new purchases and new members before Stripe's fee and any refund. Renewals and refunds are in your Stripe dashboard." },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------- for creators ---- */

export const CREATOR_PAGES: TopicPage[] = [
  {
    slug: "coaches",
    section: "for",
    eyebrow: "For coaches and teachers",
    title: "A store for coaches",
    highlight: "from free worksheet to paid hour",
    intro:
      "The worksheet that starts the conversation, the programme that does the work and the hour of your time — on one page, each at its own price, paid into your own Stripe account.",
    badge: WORKING,
    accent: "from-sky-brand to-violet-brand",
    related: ["calls", "courses", "checkout", "email"],
    blocks: [
      {
        kind: "storecard",
        title: "What a coaching store looks like",
        creator: "Maya Ruiz",
        tagline: "Career coaching for first-time managers",
        photo: "photo-1616065298043-67646192dcb5",
        alt: "A woman with blonde hair and red lipstick, smiling",
        items: [
          { label: "The first-week checklist", detail: "Free, for an email address", price: "Free" },
          { label: "Interview workbook", detail: "PDF, 18 pages", price: "$19" },
          { label: "Six-week programme", detail: "A course, one module a week, or 3 payments of $30", price: "$89" },
          { label: "One hour with Maya", detail: "A call, booked in your time zone", price: "$180" },
        ],
      },
      {
        kind: "ladder",
        title: "The path from follower to client",
        intro: "Each step is a real product type here, and each one leads to the next.",
        items: [
          { step: "1", icon: "gift", title: "A free worksheet", price: "Free", body: "Given for a confirmed email, so the people who want more are on your list.", href: "/platform/store-page" },
          { step: "2", icon: "file", title: "A workbook", price: "$19", body: "The first thing they pay for, delivered the second the payment clears.", href: "/platform/instant-delivery" },
          { step: "3", icon: "book", title: "A programme", price: "$89", body: "A course whose modules open week by week, in one payment or in instalments.", href: "/platform/courses" },
          { step: "4", icon: "calendar", title: "Your time", price: "$180", body: "A call booked into your hours, paid before it is on your calendar.", href: "/platform/calls" },
        ],
      },
      {
        kind: "features",
        title: "What coaches use most",
        items: [
          { icon: "calendar", title: "Calls in their time zone", body: "Your hours once, in your zone; each client sees the free times in theirs, and both of you get the invitation.", href: "/platform/calls" },
          { icon: "calendar", title: "Programmes in instalments", body: "Two to twelve payments, the programme opened after the first, ending by itself after the last.", href: "/platform/checkout" },
          { icon: "refresh", title: "A sequence after each sale", body: "On Pro, a few emails in the days after someone buys: what to do first, and when to book the call.", href: "/platform/email" },
          { icon: "users", title: "A monthly group", body: "A membership that hands over the meeting link, cancelled by the member in one click.", href: "/platform/memberships" },
        ],
      },
      {
        kind: "limits",
        title: "Where it falls short for coaches today",
        items: [
          "Calls do not read your Google or Outlook calendar: to block a day, change your hours.",
          "No reschedule button: a client who needs to move replies to the confirmation email.",
          "No group calls, webinars or community space.",
        ],
      },
      {
        kind: "faq",
        title: "Questions coaches ask",
        items: [
          { q: "Can I sell a package of several calls?", a: "Not as one booking. Each call is booked and paid on its own. A programme with a set of calls can be sold as a course or a file, with your booking arrangement inside it." },
          { q: "Where does the video call happen?", a: "On the service whose link you give — Zoom, Google Meet or any other. The link goes into every invitation." },
          { q: "Can I see who finished the programme?", a: "Yes. Your studio shows each student and how many lessons they marked done." },
        ],
      },
    ],
  },
  {
    slug: "cooks",
    section: "for",
    eyebrow: "For cooks and nutritionists",
    title: "A store for cooks",
    highlight: "that sells the week, then the season",
    intro:
      "Meal plans in sizes, a free recipe that brings people to your list, and a monthly plan for the ones who want every week. It is the demo store you can buy from right now.",
    badge: WORKING,
    accent: "from-mint-brand to-amber-brand",
    related: ["price-options", "memberships", "checkout", "email"],
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
        kind: "ladder",
        title: "The path from recipe to regular",
        intro: "Built only from what works here today.",
        items: [
          { step: "1", icon: "gift", title: "The free recipe", price: "Free", body: "For a confirmed email. The part people share is the part that brings the next buyer.", href: "/platform/store-page" },
          { step: "2", icon: "tag", title: "A plan in sizes", price: "$27 or $39", body: "One week to try, five for the person who already trusts you — one product, two prices.", href: "/platform/price-options" },
          { step: "3", icon: "plus", title: "The shopping list, added at checkout", price: "+$4", body: "A box under the buy button, never ticked for the buyer.", href: "/platform/checkout" },
          { step: "4", icon: "repeat", title: "Every month", price: "$12 a month", body: "A membership for the regulars, cancelled by them in one click.", href: "/platform/memberships" },
        ],
      },
      {
        kind: "features",
        title: "What food creators use most",
        items: [
          { icon: "phone", title: "Opened in a kitchen, on a phone", body: "The demo store scored 97 to 100 on Google PageSpeed on a simulated phone, on 17 September 2026.", href: "/proof/speed" },
          { icon: "book", title: "A cooking course", body: "Batch cooking on video, a free first lesson on your store, a module that opens each week.", href: "/platform/courses" },
          { icon: "download", title: "Lost the plan? Back by email", body: "A buyer who changes phone gets everything they bought again, with the address they paid with.", href: "/platform/instant-delivery" },
          { icon: "chart", title: "Which post sold the plan", body: "Visits from Instagram, TikTok and Pinterest counted apart, next to the sales from your Stripe.", href: "/platform/insights" },
        ],
      },
      {
        kind: "limits",
        title: "Where it falls short for cooks today",
        items: [
          "No physical products: a cookbook in print is sold elsewhere.",
          "No printed-on-demand plans or personal plans generated for each buyer.",
          "A monthly plan sold as a link keeps working if a member stops paying: change the link each month, or sell it as a course.",
        ],
      },
      {
        kind: "faq",
        title: "Questions cooks ask",
        items: [
          { q: "Can I try buying from a cook's store before signing up?", a: "Yes. Open the demo store, pick a size and pay with the Stripe test card 4242 4242 4242 4242. The PDF of the size you chose arrives on screen." },
          { q: "Can I give the recipe away without an email?", a: "Yes: put it on your page as a link with no price. A free product is the one that asks for an email." },
          { q: "Is sales tax added to a meal plan?", a: "When you switch Stripe Tax on in your studio, once your Stripe tax setup is done." },
        ],
      },
    ],
  },
  {
    slug: "fitness",
    section: "for",
    eyebrow: "For fitness creators",
    title: "A store for trainers",
    highlight: "from starter block to programme",
    intro:
      "A short block to start, a full programme as a course with video, a form check booked and paid, and a monthly club — on one page, charged on your own Stripe.",
    badge: WORKING,
    accent: "from-pink-brand to-violet-brand",
    related: ["courses", "calls", "memberships", "checkout"],
    blocks: [
      {
        kind: "storecard",
        title: "What a fitness store looks like",
        creator: "Dani Cole",
        tagline: "Strength for people with desk jobs",
        photo: "photo-1617748142090-06eeb8fd1119",
        alt: "A woman in a yellow dress, smiling outdoors",
        items: [
          { label: "4-week starter block", detail: "PDF with video links", price: "$29" },
          { label: "12-week programme", detail: "A course, a module a week, or 3 payments of $27", price: "$79" },
          { label: "Form check", detail: "A 20-minute call", price: "$45" },
          { label: "The club", detail: "Membership, cancel any time", price: "$15 a month" },
        ],
      },
      {
        kind: "ladder",
        title: "The path from first workout to regular",
        items: [
          { step: "1", icon: "file", title: "A starter block", price: "$29", body: "The sample: four weeks that show how you coach.", href: "/platform/instant-delivery" },
          { step: "2", icon: "book", title: "The programme", price: "$79", body: "Twelve weeks as a course, each week's module opening on its day, with an email.", href: "/platform/courses" },
          { step: "3", icon: "video", title: "A form check", price: "$45", body: "A short call, booked into your hours and paid first.", href: "/platform/calls" },
          { step: "4", icon: "repeat", title: "The club", price: "$15 a month", body: "A course that stays open while the member pays.", href: "/platform/memberships" },
        ],
      },
      {
        kind: "features",
        title: "What trainers use most",
        items: [
          { icon: "video", title: "Workout videos in the course", body: "Up to 5 GB a lesson, and videos filmed upright on a phone play upright.", href: "/platform/courses" },
          { icon: "calendar", title: "Weekly unlocks", body: "A module opens a set number of days after each person joins, so nobody skips to week twelve.", href: "/platform/courses" },
          { icon: "calendar", title: "Programmes in instalments", body: "Three monthly payments for a twelve-week programme, ending by itself.", href: "/platform/checkout" },
          { icon: "list", title: "Challenges with a real limit", body: "Fifty places, counted from real payments, with no invented countdown.", href: "/platform/checkout" },
        ],
      },
      {
        kind: "limits",
        title: "Where it falls short for trainers today",
        items: [
          "No workout-tracking app and no progress photos: students mark lessons done, and that is what you see.",
          "No community or group chat for a challenge.",
          "Videos watched count towards the store's 200 GB a month; going over never cuts anyone off, and we write to you.",
        ],
      },
      {
        kind: "faq",
        title: "Questions trainers ask",
        items: [
          { q: "Can my programme have videos I already host on YouTube?", a: "Yes. A lesson can hold a link as well as a video, so unlisted videos can stay where they are." },
          { q: "Can a form check be a video they send me?", a: "Sell it as a call, booked and paid. A product that asks the buyer to upload a video is not built." },
        ],
      },
    ],
  },
  {
    slug: "designers",
    section: "for",
    eyebrow: "For designers and photographers",
    title: "A store for designers",
    highlight: "that sells while you work",
    intro:
      "Presets, templates and brush packs in personal, full and studio sizes, files up to 5 GB, launch codes and a limited edition — delivered the second the payment clears.",
    badge: WORKING,
    accent: "from-amber-brand to-pink-brand",
    related: ["price-options", "instant-delivery", "checkout", "insights"],
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
          { label: "Full collection", detail: "Personal, commercial or studio licence", price: "from $49" },
          { label: "Launch edition", detail: "50 copies, with the colour guide as a PDF", price: "$79" },
        ],
      },
      {
        kind: "ladder",
        title: "The path from free sample to studio licence",
        items: [
          { step: "1", icon: "gift", title: "A free preset", price: "Free", body: "For a confirmed email, so launch day has someone to tell.", href: "/platform/store-page" },
          { step: "2", icon: "tag", title: "The collection, three licences", price: "$49 / $99 / $149", body: "Personal, commercial and studio — one product, each delivering its own file.", href: "/platform/price-options" },
          { step: "3", icon: "bolt", title: "One click after paying", price: "+$19", body: "The matching brushes, charged to the same card on the thanks page.", href: "/platform/checkout" },
          { step: "4", icon: "percent", title: "A launch code", price: "20% off", body: "A code you choose, capped at a number of uses, kept on your own Stripe.", href: "/platform/checkout" },
        ],
      },
      {
        kind: "features",
        title: "What designers use most",
        items: [
          { icon: "file", title: "Files up to 5 GB", body: "ZIP, PNG, SVG, video and more. Anything heavier is sold as a link to where you keep it.", href: "/platform/instant-delivery" },
          { icon: "list", title: "Limited editions that are true", body: "The count left is the real one, and the last copy is never sold twice.", href: "/platform/checkout" },
          { icon: "target", title: "Pixels for your ads", body: "Meta, Google, TikTok and Pinterest, with each purchase and its amount, on the $29 plan.", href: "/platform/insights" },
          { icon: "globe", title: "Your own domain", body: "shop.yourstudio.com on Pro, with the certificate made for you.", href: "/platform/domain" },
        ],
      },
      {
        kind: "limits",
        title: "Where it falls short for designers today",
        items: [
          "No licence keys, and no stamping of the buyer's name into files.",
          "No marketplace that sends you buyers: people arrive from your own links.",
          "No reviews or ratings on products.",
        ],
      },
      {
        kind: "faq",
        title: "Questions designers ask",
        items: [
          { q: "Can each licence deliver different files?", a: "Yes. Each price option carries its own file or link, and the buyer receives only the one they paid for." },
          { q: "What if my pack is bigger than 5 GB?", a: "Sell it as a link to where you keep it — a Drive or Dropbox folder — and the buyer is sent there the moment they pay." },
        ],
      },
    ],
  },
];
