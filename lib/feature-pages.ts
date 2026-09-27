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
          { title: "Put up what you sell", body: "Its name, what is inside, the price and a picture. Files, courses, memberships, calls and live sessions, free things for an email, and plain links. A community for your buyers sits beside them." },
          { title: "Make it look like you", body: "Your photo, one of four themes, and one of ten colours or your own. The studio shows the page before you save." },
        ],
      },
      {
        kind: "features",
        title: "What the page carries",
        items: [
          { icon: "user", title: "You, at the top", body: "Your photo, your name and a line about you, on every theme — not locked behind one." },
          { icon: "file", title: "Up to 200 products", body: "Each with its price, what the buyer gets and the button that buys it, in the order you choose, and up to 100 links beside them." },
          { icon: "camera", title: "A picture on each product", body: "Shown three ways, product by product: small beside the title, beside the title and the summary, or across the top of the card." },
          { icon: "eye", title: "A page for each product", body: "At /@you/p/<product>: the picture, a long description of up to 5,000 characters, and a title and preview card of its own for search engines and shared links." },
          { icon: "gift", title: "Free things, for an email", body: "Price something at 0 and it is handed out for a confirmed email address that joins your list." },
          { icon: "link", title: "Links with no price", body: "Your channel, your podcast, your booking page — with the site each one leads to printed under it." },
          { icon: "palette", title: "Colours that stay readable", body: "Every colour is checked for contrast before your page uses it, so your words never disappear into it." },
          { icon: "phone", title: "Your store, as an app", body: "On iPhone and Android, straight from the browser, your store installs to the home screen as an app of its own, with its name, its icon and its colour. No app store." },
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
          "200 products and 100 links per store. There are no categories or search for a big catalogue.",
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
          "A product with options has fixed prices: pay what you want is for products with one price.",
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
    related: ["quizzes-and-certificates", "community", "memberships", "checkout"],
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
          { icon: "cap", title: "Quizzes and certificates", body: "Up to 20 questions after any lesson, a pass mark, and a certificate with a page anyone can open to check it.", href: "/platform/quizzes-and-certificates" },
          { icon: "chat", title: "A community for students", body: "Your store's community can open to the buyers of a course, for questions and work shared where everyone can learn from it.", href: "/platform/community" },
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
          "No comments under a lesson. Conversation happens in your store's community, which a course can open.",
          "Certificates are pages printed or saved as a PDF from the student's browser; no PDF file is made.",
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
          { q: "What if I refund a student?", a: "Refunds are made in your own Stripe dashboard. A refund in full closes the course for that student within ten minutes; a partial refund keeps it open. A refund on a payment plan is not detected, so take that student off the course in your studio." },
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
    related: ["courses", "community", "your-stripe", "email"],
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
          { icon: "gift", title: "A free trial, said plainly", body: "1 to 90 days. The card is taken at the start and nothing is charged until the trial ends. The page and the button say so, and the confirmation email gives the date of the first payment." },
          { icon: "calendar", title: "Or a set number of payments", body: "2 to 36 payments, and then it ends by itself. The member can still cancel before that." },
          { icon: "lock", title: "Access that ends with it", body: "When a membership ends, its files, its course and your community close, and the member is shown how to join again." },
          { icon: "chat", title: "A community for members", body: "Open your store's community to a membership. A member who stops paying loses the door within five minutes.", href: "/platform/community" },
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
          "A free trial is a number of free days, the same for every member of that product. There is no first month at a lower price.",
          "A membership is charged at its set price: it cannot be pay what you want.",
          "Files, courses and the community close when a membership ends: cancelled, or unpaid once Stripe stops retrying. A link you sell stays wherever you keep it, so remove the member there.",
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
      "One person at a time, a group of up to 50, or live sessions on dates you set. Buyers see the free times in their own time zone, pick one and pay on your Stripe account, and you both get the invitation.",
    badge: WORKING,
    accent: "from-mint-brand to-sky-brand",
    visual: "calls",
    plan: "creator",
    group: "sell",
    menu: { label: "Paid calls", description: "Your hours, their time zone, paid before it is booked.", icon: "calendar" },
    related: ["calendar-sync", "checkout", "your-stripe", "webhooks"],
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
          { icon: "shield", title: "Never booked twice", body: "A time being paid for is held, so two people can never pay for the same hour, or the last seat." },
          { icon: "users", title: "Group calls", body: "Up to 50 people at each time. Buyers see how many seats are left." },
          { icon: "video", title: "Live sessions on dates", body: "Up to 50 dates per product, each with 1 to 500 seats, its own length and its own link. Sales close when you say, up to 72 hours before." },
          { icon: "mail", title: "Reminders", body: "A day and an hour before, to every buyer in their time zone, with the link to join. You get one per time, listing everyone booked." },
          { icon: "refresh", title: "Buyers move their own booking", body: "Up to twice, from the link in their email, until the notice you set before the call. Nothing is charged or refunded." },
          { icon: "calendar", title: "Your calendar's busy times", body: "Up to three Google, Outlook or iCloud calendars, read by their private address: when you are busy there, that time is not offered.", href: "/platform/calendar-sync" },
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
          "Your calendars are read for busy times, not written to. Bookings reach your calendar as a feed you subscribe to, and a new busy time can take about ten minutes to close a slot.",
          "Buyers move a booking themselves, but cancelling is a reply to their confirmation email, which reaches you; a refund is made from your Stripe dashboard.",
          "The call or the session itself happens on the service whose link you give. Nothing is streamed or recorded here.",
          "No reminder is sent to a buyer who left the checkout of a call without paying.",
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
      "Discount codes, a product added at checkout, one-click offers after paying, payment plans, pay what you want, questions at checkout, limited quantities and sales tax. On Stan the first four are on the $99 plan.",
    badge: WORKING,
    accent: "from-amber-brand to-pink-brand",
    visual: "checkout",
    plan: "creator",
    group: "paid",
    menu: { label: "Checkout tools", description: "Codes, add-ons, one-click offers, instalments and tax.", icon: "percent" },
    related: ["funnels", "price-options", "your-stripe", "insights"],
    blocks: [
      {
        kind: "features",
        title: "Every tool on your own account",
        intro: "Stan's pricing page, read on 20 September 2026, puts discount codes, order bumps, upsells and payment plans on its $99 plan.",
        items: [
          { icon: "percent", title: "Discount codes", body: "A word you choose, a percentage or an amount off, and a cap on uses if you want one. Up to twenty codes, kept as coupons on your own Stripe." },
          { icon: "plus", title: "Add it at checkout", body: "A box under the buy button offers another of your products at a price of your own. Never ticked for the buyer." },
          { icon: "bolt", title: "One click after paying", body: "The thanks page offers one more product, or up to five in a row as a funnel, charged to the card just used. Only in that browser, for an hour.", href: "/platform/funnels" },
          { icon: "calendar", title: "Payment plans", body: "Two to twelve weekly or monthly payments. The buyer gets it after the first, and it ends by itself after the last." },
          { icon: "list", title: "Limited quantity", body: "Sell fifty and stop. The count shown is the real one, and a unit being paid for is held so the last one is never sold twice." },
          { icon: "receipt", title: "Sales tax and VAT", body: "Stripe Tax works it out from each buyer's address, on your account, once your Stripe tax setup is complete." },
          { icon: "tag", title: "Pay what you want", body: "Your price becomes the minimum, at least $1, with a suggested price already in the box. Stripe refuses anything under the minimum." },
          { icon: "type", title: "Questions at checkout", body: "Up to three, on Stripe's page before paying: a short answer, a number or a list to choose from. The answers are in your list of sales." },
          { icon: "mail", title: "One reminder after a checkout left unpaid", body: "Only to a buyer who agreed on Stripe's page, about an hour later, once. Off until you switch it on." },
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
          "One product can be offered in the box under each product, and up to five after paying.",
          "While sales tax is on, offers after paying are paused, because tax cannot be added to a one-click charge.",
          "A payment plan cannot be cancelled from your page; a buyer who needs to change something replies to their receipt, which reaches you.",
          "Pay what you want is for a product with one price, sold once: not with memberships, price options, payment plans, the box at checkout, calls or discount codes.",
          "Questions are short answers, numbers or lists: no phone-number or checkbox question, and none on free products.",
          "The reminder after an unpaid checkout needs a Stripe account in the United States, because Stripe asks buyers for that consent only on checkouts of US businesses. It is not sent for calls or live sessions.",
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
          "You need a Stripe account in one of the 43 countries the studio offers — the United States, Canada, the United Kingdom, Australia, Japan, Singapore, Mexico and most of Europe among them, but not everywhere.",
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
    related: ["licence-keys", "pdf-stamping", "price-options", "courses"],
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
          { icon: "mail", title: "A confirmation email", body: "Every buyer gets one from your store's name: what they bought, what they paid and the way back to it. Replies reach you." },
          { icon: "key", title: "A licence key with each sale", body: "One key per buyer, never given twice, on the thanks page, in the email and in their list of purchases.", href: "/platform/licence-keys" },
          { icon: "file", title: "The buyer's email on their PDF", body: "Switch on stamping and every page of the PDF they download carries their email, the date and their order.", href: "/platform/pdf-stamping" },
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
          "Stamping a PDF discourages sharing; it does not stop it, and it covers PDFs up to 50 MB.",
          "Getting a purchase back needs the address the buyer paid with. If they typed it wrong, you see the sale in Stripe and can send the file yourself.",
          "A link you sell stays wherever you keep it: we cannot take it back from someone who has it.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about delivery",
        items: [
          { q: "How does a buyer get a file again after three days?", a: "At the foot of your store page, “Bought something here? Get it again”. They type the address they paid with and receive a link to a page with everything that address bought from you, read from your Stripe account. No account and no password." },
          { q: "Can a buyer pass the download around?", a: "The download is tied to their order and to a short window, and the file is fetched through a link that expires in minutes. A leaked link does not become a free copy for everyone. With stamping on, a PDF also carries the buyer's email on every page." },
          { q: "What if a buyer was refunded?", a: "A sale you refunded in full stops downloading at once and no longer appears when they ask to get their purchases again, because both read your Stripe account each time. A partial refund keeps both. A file already saved cannot be taken back." },
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
          { icon: "chat", title: "Announcements to your community", body: "A post in your community can also go by email to the members who asked for it, counted in the same monthly emails.", href: "/platform/community" },
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
      "Visitors, checkouts, sales and conversion for the last 7, 30 or 90 days or all time, where each visit came from, every product and link on its own line, and the lot as CSV files. Counted without cookies.",
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
          { title: "Sources, even from apps", body: "Instagram and TikTok hide where a visit came from, so we read the app's name. Add utm_source, utm_medium and utm_campaign to a link to count it under your own words." },
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
        kind: "features",
        title: "Your numbers, to keep",
        items: [
          { icon: "download", title: "Sales as a file", body: "Every paid sale for the last 30 or 90 days or all time, read from your Stripe account, as a CSV. Up to 5,000 sales in one file, and it says so when there are more." },
          { icon: "chart", title: "Visits and sources as files", body: "Your visits day by day, and where visitors came from, as CSV files." },
          { icon: "target", title: "Every product on its own line", body: "Each product's checkouts started, sales and revenue, side by side, for each window." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "Renewals are not in the revenue figure; they are in your Stripe dashboard.",
          "All time starts at the first visit still on record; daily visits are kept for about thirteen months.",
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
  {
    slug: "community",
    section: "platform",
    eyebrow: "Community",
    title: "A community for the people",
    highlight: "who bought from you",
    intro:
      "One members' area on your store, with spaces, posts, comments and likes, open only to the buyers of the products you choose. Members come in with a link sent to their email: no account, no password.",
    badge: WORKING,
    accent: "from-violet-brand to-mint-brand",
    plan: "creator",
    group: "sell",
    menu: { label: "Community", description: "Posts and comments, open only to your buyers.", icon: "chat" },
    related: ["memberships", "courses", "email", "calls"],
    blocks: [
      {
        kind: "how",
        title: "How people get in",
        items: [
          { title: "Choose what opens it", body: "Any paid product can: a course, a file, a call, or a membership while it is being paid for. Free products too, if you want them to." },
          { title: "They come in by email", body: "A member types the address they paid with and opens the link we send. That browser stays in for 90 days." },
          { title: "Checked on every visit", body: "Who bought what is read from your own Stripe account. A membership that ends loses the door within five minutes, and a member you take out loses it at once." },
        ],
      },
      {
        kind: "features",
        title: "What the community holds",
        items: [
          { icon: "list", title: "Up to 20 spaces", body: "Each with its own name and a line about what it is for. A space can be yours alone to post in, with members still commenting." },
          { icon: "type", title: "Posts with a picture", body: "A title of up to 120 characters, up to 5,000 characters of text and one picture." },
          { icon: "chat", title: "Comments, replies and likes", body: "Comments of up to 2,000 characters, one level of replies, up to 300 under a post, and one like per member on each post." },
          { icon: "pin", title: "Pinned posts and Start here", body: "Up to three posts held at the top, and one post every member sees first." },
          { icon: "mail", title: "Announcements", body: "Posts labelled as yours. On Pro they can also go by email to the members who ticked the box for it, with a one-click unsubscribe." },
          { icon: "users", title: "A member directory they opt into", body: "Members choose the name they are seen by and whether to be listed. Their email address is never shown to other members." },
          { icon: "shield", title: "Reports and moderation", body: "Members report a post or a comment and it lands in your queue. You hide it, delete it, mute a member or take them out." },
          { icon: "clock", title: "Limits that stop a spammer", body: "Each member can write 5 posts an hour and 20 a day, 30 comments an hour and 10 pictures an hour. You are never limited." },
          { icon: "phone", title: "In your store's look", body: "Your theme and colour, and part of your store's installable app. Nothing in it is kept offline on a device." },
        ],
      },
      {
        kind: "uses",
        title: "What creators use it for",
        items: [
          { icon: "cap", who: "A course with a cohort", what: "Students of the course post their work and questions, and you answer where everyone can learn from it." },
          { icon: "repeat", who: "A paid monthly club", what: "Open it to a membership, and whoever stops paying stops seeing it, without you lifting a finger." },
          { icon: "users", who: "Coaching clients", what: "A space for wins, a space for questions, and your announcements pinned at the top." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        intro: "Said here so nobody signs up expecting it.",
        items: [
          "No live chat, private messages, or video inside it. Posts and comments appear when a page is opened, not as they are written.",
          "No webinars inside the community: sell those as live sessions, held on the meeting service whose link you give.",
          "No search, mentions, polls, or emails about replies. Posts cannot be edited once written.",
          "One community per store, and every space is open to every member: a space cannot be kept for the buyers of one product.",
          "Up to 10,000 posts and 50,000 members in one community.",
          "No app-store app. It opens in the browser, and in your store's app on the home screen.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about the community",
        items: [
          { q: "Who can see what is posted?", a: "Only the people let in, and you. Community pages and their pictures are shown only to a browser that is let in, and they are kept out of search engines." },
          { q: "Can members see each other's email addresses?", a: "No. Other members see only the name someone chose, and the directory lists only those who asked to be listed. You see members' addresses in your studio, because they are your buyers." },
          { q: "What happens after a refund?", a: "A payment you refund in full on your Stripe account stops opening the community, within five minutes." },
          { q: "Does Stan have this?", a: "Yes. Stan has a community, and its help centre, read on 26 September 2026, lists webinars inside it, which ours cannot hold. Ours is on the $29 plan; emailing announcements needs Pro." },
        ],
      },
    ],
  },
  {
    slug: "funnels",
    section: "platform",
    eyebrow: "Funnels",
    title: "After the sale,",
    highlight: "the next best offer",
    intro:
      "Up to five offers after someone pays, shown one at a time, each charged in one click to the card they just used. A yes and a no can lead to different next offers, so a no can meet something smaller.",
    badge: WORKING,
    accent: "from-amber-brand to-violet-brand",
    plan: "creator",
    group: "paid",
    menu: { label: "Funnels", description: "Up to five one-click offers after paying.", icon: "ladder" },
    related: ["checkout", "your-stripe", "price-options", "insights"],
    blocks: [
      {
        kind: "how",
        title: "How a funnel works",
        items: [
          { title: "Pick what it follows", body: "Any one-off product can have a funnel after it. Each offer is another of your products, at a price you set for the offer." },
          { title: "Draw the two paths", body: "For every offer, where yes leads and where no thanks leads: a later offer, or the end. A path only ever moves forward, so nobody sees an offer twice." },
          { title: "One click, same card", body: "The thanks page shows the first offer. Taking it charges the card just used, on your own Stripe account, once." },
        ],
      },
      {
        kind: "lead",
        text: "On Stan, funnels are on the $99 plan. Here, offers after paying are on the $29 plan. The difference in shape is real too: ours start after the checkout, and Stan's can include pages before it.",
      },
      {
        kind: "features",
        title: "What each offer carries",
        items: [
          { icon: "type", title: "Its own words", body: "A headline of up to 90 characters, a few sentences of up to 400, and the picture of one of your products." },
          { icon: "tag", title: "Its own price", body: "Never more than the product costs on its own, so the offer is always a real one." },
          { icon: "ladder", title: "Downsells", body: "A no can lead to the same product for less, or to something else entirely." },
          { icon: "check", title: "Nothing sold twice", body: "The product just bought is never offered again, and anything already in the order is passed over." },
          { icon: "lock", title: "Only for the buyer who paid", body: "The offers show only in the browser that paid, within an hour of paying." },
          { icon: "mail", title: "A receipt for each", body: "Every offer taken is delivered on the thanks page and gets its own confirmation email." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "No landing or opt-in pages before the checkout. A funnel starts after someone pays.",
          "Up to five offers after each product.",
          "Offers are one-off products with one price: not memberships, payment plans or calls.",
          "While sales tax is on, offers after paying are paused, because tax cannot be added to a one-click charge.",
          "A buyer who closes the page, or comes back after the hour, is not shown the offers again.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about funnels",
        items: [
          { q: "Can a buyer be charged without meaning to?", a: "No. An offer is charged only when the buyer presses to take it, in the browser that paid, within the hour, and once. If the bank asks them to confirm, they confirm it." },
          { q: "Where do I see what was taken?", a: "In your numbers and your sales export, marked as taken after paying, and in your own Stripe dashboard." },
          { q: "Does Nimbus take anything from an offer?", a: "No. 0%, as on every other sale. Stripe charges its own card fee on your account." },
        ],
      },
    ],
  },
  {
    slug: "affiliates",
    section: "platform",
    eyebrow: "Affiliates",
    title: "Let the people who love it",
    highlight: "sell it for you",
    intro:
      "People apply, you approve, and each affiliate gets a link and a page of their own with their clicks, sales and what they are owed. You pay them yourself: every sale lands in full in your own Stripe account.",
    badge: WORKING,
    accent: "from-mint-brand to-sky-brand",
    plan: "creator",
    group: "grow",
    menu: { label: "Affiliates", description: "A link and a page for each. You pay them.", icon: "handshake" },
    related: ["your-stripe", "insights", "funnels", "webhooks"],
    blocks: [
      {
        kind: "how",
        title: "How your programme runs",
        items: [
          { title: "Set the terms", body: "A share of 1% to 90%, for the whole store or product by product, and a window of 1 to 90 days after a click." },
          { title: "Approve who you want", body: "People apply on your store's affiliate page with an email address they confirm. Nobody is in until you say so." },
          { title: "Pay what is owed", body: "Your studio shows what each affiliate earned and what you have paid. Pay them however you agree, then mark it paid." },
        ],
      },
      {
        kind: "note",
        title: "We do not pay your affiliates, and we say so first",
        body: "Stan pays its affiliates automatically, on its $99 plan. We never hold your money, so there is nothing for us to pay out from: you pay affiliates yourself, by bank transfer, PayPal or however you agree. What you get from us is the record of who sent which sale and what it earned, on the $29 plan.",
      },
      {
        kind: "features",
        title: "What the programme keeps track of",
        items: [
          { icon: "user", title: "A page for each affiliate", body: "Their link, their clicks, their sales, what they earned and what you paid them. They never see who the buyers were." },
          { icon: "link", title: "Last click wins", body: "The most recent affiliate link a buyer followed, inside your window, gets the sale." },
          { icon: "scale", title: "Worked out fairly", body: "The share is taken of what was paid before tax. A refund on your Stripe account cancels it, and a partial refund reduces it." },
          { icon: "shield", title: "Hard to game", body: "No commission on an affiliate's own purchase, a click counted once per visitor per day, and your own clicks not counted." },
          { icon: "download", title: "The book, as a file", body: "Download who is owed what as a CSV, and note each payment with its date and reference." },
          { icon: "users", title: "Up to 1,000 people", body: "Applications included, each approved or declined by you." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do",
        items: [
          "No automatic payouts. You pay affiliates yourself and mark each payment in your studio.",
          "Memberships and payment plans earn no commission; one-off sales and booked calls do.",
          "A dispute on your Stripe account does not cancel a commission by itself: check your dashboard before you pay.",
          "Contracts, tax forms and payments between you and your affiliates are yours to arrange.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about affiliates",
        items: [
          { q: "Does Nimbus take a cut of affiliate sales?", a: "No. 0% of every sale, as on any other. The full amount lands in your Stripe account, and the affiliate's share is yours to pay." },
          { q: "How is a sale tied to an affiliate?", a: "Their link is your store's address with their code on the end. Following it leaves a cookie on your store's own address with the code and the time of the click, and a purchase inside your window is credited to them." },
          { q: "What does someone need to join?", a: "An email address they can open. They apply on your store's affiliate page, confirm with the link we email, and you approve them in your studio." },
        ],
      },
    ],
  },
  {
    slug: "calendar-sync",
    section: "platform",
    eyebrow: "Calendar sync",
    title: "Busy in your calendar,",
    highlight: "not bookable on your store",
    intro:
      "Paste the private address of up to three calendars, from Google, Outlook or iCloud, and the times you are busy there stop being offered as call times. Your bookings come back the other way, as a calendar you subscribe to.",
    badge: WORKING,
    accent: "from-sky-brand to-violet-brand",
    plan: "creator",
    group: "sell",
    menu: { label: "Calendar sync", description: "Your busy times hide call slots.", icon: "refresh" },
    related: ["calls", "webhooks", "checkout", "store-page"],
    blocks: [
      {
        kind: "how",
        title: "Three steps, no account to connect",
        items: [
          { title: "Copy your calendar's private address", body: "Google calls it the secret address in iCal format; Outlook, a published calendar; iCloud, a public calendar. No sign-in and no password." },
          { title: "Paste it in your studio", body: "Up to three. The studio shows which service each one is and when you added it, never the address." },
          { title: "Busy means not offered", body: "Times you are busy there, up to 120 days ahead, drop out of your call times, usually within about ten minutes." },
        ],
      },
      {
        kind: "features",
        title: "Both directions",
        items: [
          { icon: "eye", title: "Only busy times are kept", body: "Never a title, a guest or a place from your calendar: only when you are busy." },
          { icon: "calendar", title: "Your bookings, in your calendar", body: "A private address of your own lists every upcoming call and session with who booked it, for Google, Outlook or Apple Calendar to subscribe to." },
          { icon: "door", title: "Stopped whenever you like", body: "Remove an address in your studio, or reset it in your calendar app, and it stops working. Your own feed's address can be replaced the same way." },
          { icon: "alert", title: "When a calendar stops answering", body: "Its last good reading is used for up to six hours, and your studio says what went wrong." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do",
        items: [
          "It is not a two-way sync. Nothing is written into your calendar: bookings reach it through the feed you subscribe to, which your calendar app refreshes on its own schedule.",
          "A new busy time can take about ten minutes to close a slot.",
          "Up to three calendars, read 120 days ahead.",
          "No sign-in with Google or Microsoft. A calendar that cannot give a private iCal address cannot be read.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about calendar sync",
        items: [
          { q: "Does Stan do this?", a: "Stan's help centre, read on 26 September 2026, lists Google Calendar for its calls. Ours reads Google, Outlook and iCloud calendars by their private address, and does not write events into any of them." },
          { q: "What happens to my calendar's address?", a: "It is stored with your store and used only to read your busy times. Once saved it is never shown again, not even to you. If you are ever unsure, reset it in your calendar app and the old one stops working." },
          { q: "Does it block group calls and live sessions too?", a: "It hides call times you are busy for. Live sessions are on the dates you set yourself, so they are yours to place around your calendar." },
        ],
      },
    ],
  },
  {
    slug: "webhooks",
    section: "platform",
    eyebrow: "Webhooks",
    title: "Tell your other tools",
    highlight: "what just happened",
    intro:
      "Up to five addresses of your own, such as a Zapier Catch Hook, a Make scenario or your own server, told about sales, members, leads, bookings and refunds as they happen, in signed JSON.",
    badge: WORKING,
    accent: "from-violet-brand to-sky-brand",
    plan: "creator",
    group: "grow",
    menu: { label: "Webhooks", description: "Sales, leads and bookings, sent to Zapier or Make.", icon: "plug" },
    related: ["insights", "calls", "affiliates", "email"],
    blocks: [
      {
        kind: "how",
        title: "How to connect a tool",
        items: [
          { title: "Add an address", body: "An https address, and the events it should hear. Its signing secret is shown to you once." },
          { title: "Send a test", body: "One press sends a test message, and the delivery log shows what the address answered." },
          { title: "Let it run", body: "Each event is sent when it happens. Those read from your Stripe account can take up to about five minutes." },
        ],
      },
      {
        kind: "features",
        title: "Seven events, and how they arrive",
        items: [
          { icon: "receipt", title: "sale.completed and refund.issued", body: "A paid checkout of any product, each one-click offer taken after it, and a refund, even one made in your Stripe dashboard." },
          { icon: "repeat", title: "membership.started and membership.canceled", body: "A membership bought, and a membership set to end or ended." },
          { icon: "gift", title: "lead.captured", body: "Someone confirmed their address for a free product." },
          { icon: "calendar", title: "call.booked and call.moved", body: "A call or a seat in a session booked and paid, and a booking the buyer moved." },
          { icon: "lock", title: "Signed", body: "Every message carries a Nimbus-Signature header: an HMAC-SHA256 of its time and body under that address's secret." },
          { icon: "refresh", title: "Tried again", body: "When an address does not answer, the message is tried six more times over about forty hours, then marked failed." },
          { icon: "list", title: "A log you can read", body: "Your studio keeps the last 50 deliveries, each for up to seven days, with what the address answered." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do",
        items: [
          "There is no Nimbus app in Zapier's directory. In Zapier, use its Webhooks by Zapier trigger, Catch Hook.",
          "Webhooks only send. There is no public API to read or change your store; the one public address is the licence key check.",
          "Up to five addresses per store, https only, and redirects are not followed.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about webhooks",
        items: [
          { q: "How do I know a message came from you?", a: "Check its Nimbus-Signature header against the secret you were shown when you added the address, and check that its time is recent." },
          { q: "What if the same event arrives twice?", a: "Every event has an id made from what it is about, and it is sent once however often it is noticed. Keep the ids you have seen and ignore a repeat, in case a retry crosses a slow answer." },
          { q: "Does Stan have webhooks?", a: "Not that its help centre publishes, read on 17 September 2026." },
        ],
      },
    ],
  },
  {
    slug: "quizzes-and-certificates",
    section: "platform",
    eyebrow: "Quizzes and certificates",
    title: "Quizzes that teach,",
    highlight: "a certificate that proves it",
    intro:
      "A quiz after any lesson, marked on our side, and a certificate of completion with a page of its own that anyone can open to check it.",
    badge: WORKING,
    accent: "from-pink-brand to-violet-brand",
    plan: "creator",
    group: "deliver",
    menu: { label: "Quizzes and certificates", description: "Questions after a lesson, a certificate at the end.", icon: "cap" },
    related: ["courses", "memberships", "community", "email"],
    blocks: [
      {
        kind: "how",
        title: "From a lesson to a certificate",
        items: [
          { title: "Add a quiz to a lesson", body: "Up to 20 questions, each with one right answer or several, and a line of explanation for after." },
          { title: "Set the rules", body: "The pass mark, how many tries (up to 10, or as many as they like), and whether later lessons stay shut until it is passed." },
          { title: "Switch certificates on", body: "A student who finishes every lesson and passes every quiz that has to be passed types their name and gets a certificate." },
        ],
      },
      {
        kind: "features",
        title: "What makes it worth having",
        items: [
          { icon: "lock", title: "Marked on the server", body: "The right answers are not sent to the page before the student answers, so they cannot be read from it." },
          { icon: "eye", title: "Answers shown fairly", body: "After a try the student sees what they got right. The rest are shown once they pass or run out of tries." },
          { icon: "type", title: "The name as they typed it", body: "The certificate carries the student's name exactly as typed, with the course title and your name as they were that day." },
          { icon: "globe", title: "A page that proves it", body: "Each certificate has its own address on your store that anyone can open to check it. It is kept out of search engines." },
          { icon: "ban", title: "Withdrawn when it has to be", body: "Issued to the wrong name, or to someone you refunded? Withdraw it, and its page says it was withdrawn." },
          { icon: "list", title: "Your list of certificates", body: "Your studio lists the certificates of each course, who earned them and when." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do yet",
        items: [
          "The certificate is a page that the student prints or saves as a PDF from their browser. No PDF file is made for them.",
          "Questions are multiple choice, with one right answer or several. No written answers.",
          "One quiz per lesson, up to 20 questions.",
          "A student who used all their tries asks you for more by replying to their purchase email.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about quizzes and certificates",
        items: [
          { q: "Can a certificate be faked by editing a link?", a: "No. Its page is read from our record of it, never from anything in the address. Anyone checking one should open its page on your store." },
          { q: "Does passing a quiz count as finishing the lesson?", a: "Yes. Passing marks the lesson done, which is what a certificate counts." },
          { q: "Does Stan have quizzes and certificates?", a: "Not by its help centre, read on 17 September 2026." },
        ],
      },
    ],
  },
  {
    slug: "licence-keys",
    section: "platform",
    eyebrow: "Licence keys",
    title: "A unique key",
    highlight: "with every sale",
    intro:
      "For software, plugins and anything that unlocks with a code. Upload the keys your own system made, or have them made here, and each buyer gets one nobody else has.",
    badge: WORKING,
    accent: "from-amber-brand to-mint-brand",
    plan: "creator",
    group: "deliver",
    menu: { label: "Licence keys", description: "One unique key per sale, and a check for your app.", icon: "key" },
    related: ["instant-delivery", "pdf-stamping", "webhooks", "checkout"],
    blocks: [
      {
        kind: "how",
        title: "How keys reach a buyer",
        items: [
          { title: "Choose where they come from", body: "A text or CSV file of up to 10,000 keys, handed out in the order you uploaded them, or keys made here in a shape you set, like STUDIO-7K2Q-9XFD-M3PL." },
          { title: "A buyer pays", body: "They see their key on the thanks page, in their confirmation email and in their list of purchases." },
          { title: "Your software asks", body: "A public address answers whether a key is valid, revoked or unknown, and nothing about who bought it." },
        ],
      },
      {
        kind: "features",
        title: "What it takes care of",
        items: [
          { icon: "check", title: "Never given twice", body: "Two buyers paying in the same moment get two different keys, and a key uploaded twice is handed out once." },
          { icon: "type", title: "Keys people can type", body: "Made keys leave out the characters people confuse, like 0 and O, and are long enough that nobody guesses one." },
          { icon: "alert", title: "A warning before you run out", body: "An email when the pool runs low, at 20 keys unless you choose another number. When it is empty, the product shows as sold out." },
          { icon: "ban", title: "Revoke and restore", body: "A key given for a payment refunded in full is revoked by itself within about five minutes, and you can revoke any key by hand. Restore it if you change your mind." },
          { icon: "list", title: "Who has which key", body: "Your studio shows every key given, to whom and for which sale." },
          { icon: "mail", title: "Nobody left without one", body: "A buyer who paid in the moment the last key went is not left with nothing: the next keys you upload go to them first, by email." },
        ],
      },
      {
        kind: "limits",
        title: "What it does not do",
        items: [
          "Paid one-off products only: not memberships, calls or courses.",
          "No activation or seat counting. The check says whether a key is good; your software decides the rest.",
          "Revoking is a record your software has to ask about. Nothing here can switch off a copy that never checks.",
          "Up to 10,000 keys waiting in one product's pool.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about licence keys",
        items: [
          { q: "How does my software check a key?", a: "It asks /api/store/licence with your store's address, the product and the key, and gets back valid, revoked or unknown. It can be called from a website or an app, up to 120 times a minute from one connection." },
          { q: "Can I use keys my own system already made?", a: "Yes. Upload them as a text or CSV file. A key that was already uploaded is skipped, so it can never go to two buyers." },
        ],
      },
    ],
  },
  {
    slug: "pdf-stamping",
    section: "platform",
    eyebrow: "PDF stamping",
    title: "Every page says",
    highlight: "whose copy it is",
    intro:
      "Switch it on for an ebook or a workbook, and each page of the PDF a buyer downloads carries their email, the date and their order along its foot.",
    badge: WORKING,
    accent: "from-pink-brand to-amber-brand",
    plan: "creator",
    group: "deliver",
    menu: { label: "PDF stamping", description: "The buyer's email on every page of their PDF.", icon: "file" },
    related: ["instant-delivery", "licence-keys", "price-options", "courses"],
    blocks: [
      {
        kind: "how",
        title: "How it works",
        items: [
          { title: "Switch it on per product", body: "One box on the product, for the PDF it delivers." },
          { title: "The buyer downloads", body: "One quiet line along the foot of every page: “Sold to maya@example.com on Sep 26, 2026 · order …E54F2A · for personal use”." },
          { title: "Made once per sale", body: "The stamped copy is kept beside your original, so downloading again gives the buyer the same file." },
        ],
      },
      {
        kind: "note",
        title: "What it is, and what it is not",
        body: "It discourages sharing: a copy that turns up somewhere else says whose it was, and that makes a buyer think twice. It is not copy protection. It does not stop anyone from sharing the file, and someone determined can remove the line.",
      },
      {
        kind: "limits",
        title: "What it does not do",
        items: [
          "PDFs up to 50 MB. A bigger one, or one locked with a password or damaged, is handed over as you uploaded it, and your studio tells you.",
          "PDFs only. Images, ZIP files and everything else are handed over as uploaded.",
          "A product sold as a link is not stamped: the file is wherever you keep it.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about PDF stamping",
        items: [
          { q: "Does it change my original file?", a: "No. Your upload stays as it is. Each buyer's copy is made from it, kept beside it, and deleted with it." },
          { q: "Is the file sent to another company to be stamped?", a: "No. It is stamped by our own code on the servers that run Nimbus, and not sent anywhere else." },
          { q: "Should I tell buyers?", a: "Yes. Their email is printed on the file they receive, so say so on the product." },
        ],
      },
    ],
  },
  {
    slug: "security",
    section: "platform",
    eyebrow: "Security",
    title: "How your store",
    highlight: "and your buyers are protected",
    intro:
      "What we do, written so you can check it: payments on your own Stripe account, sign-in without passwords, strict rules on what your pages may run, and a refund that closes what it paid for. And, at the end, what none of it does.",
    badge: WORKING,
    accent: "from-violet-brand to-mint-brand",
    plan: "creator",
    group: "paid",
    menu: { label: "Security", description: "Sign-in, checkout, files and refunds, in plain words.", icon: "shield" },
    related: ["your-stripe", "instant-delivery", "webhooks", "licence-keys"],
    blocks: [
      {
        kind: "features",
        title: "Your money and your account",
        items: [
          { icon: "bank", title: "Sales on your own Stripe", body: "The buyer pays on Stripe's own checkout, on your account. We never see a card number and never hold a balance of yours." },
          { icon: "tag", title: "Prices worked out on our side", body: "What a buyer is charged is read on our server from what you saved, never from anything the page sends." },
          { icon: "key", title: "No password to steal", body: "You sign in with a link sent to your email. It works once, stops working after 15 minutes, and how often links can be asked for is limited." },
          { icon: "refresh", title: "A fresh session every time", body: "Each sign-in starts a new session, and a session the browser held before is closed." },
          { icon: "door", title: "Log out of all devices", body: "One button at the foot of your studio closes every session you have open, everywhere." },
          { icon: "mail", title: "An email when something important changes", body: "Whenever your Stripe account, your domain or your webhooks change, we write to your sign-in address saying what changed and when." },
        ],
      },
      {
        kind: "features",
        title: "Your pages",
        items: [
          { icon: "lock", title: "A strict policy on what runs", body: "Store pages, on nimbuslabsai.com and on your own domain, the studio and signing in carry a Content-Security-Policy with a new nonce on every response, so text somebody typed cannot run as a script." },
          { icon: "target", title: "Pixels only where allowed", body: "Your Meta, Google, TikTok and Pinterest pixels load only after the visitor agrees, where the law says they must be asked." },
          { icon: "shield", title: "Forged requests refused", body: "Every request that changes something must come from this site, and our cookies are HttpOnly and SameSite." },
          { icon: "globe", title: "The usual browser protections", body: "HSTS, nosniff, a referrer policy, Cross-Origin-Opener-Policy, a Permissions-Policy that switches off camera, microphone and location, and no framing by other sites." },
          { icon: "link", title: "Emailed links go to us or to you", body: "Every link we email points at nimbuslabsai.com or at your store's own domain, never at an address a request made up." },
        ],
      },
      {
        kind: "features",
        title: "Files, refunds and bots",
        items: [
          { icon: "download", title: "Downloads that expire", body: "The download on the thanks page works for 3 days; after that the buyer gets it again by email. Where a file is stored is never shown, and large files go through signed links that expire in minutes." },
          { icon: "file", title: "Files that cannot run", body: "Every file is handed over as a download, with headers that stop a browser running anything inside it." },
          { icon: "ban", title: "A full refund closes the door", body: "Refund a payment in full on your Stripe account and its download stops at once, its course closes within 10 minutes, the community within 5, and its licence key is revoked within about 5. A partial refund keeps access." },
          { icon: "clock", title: "Limits that stop bots", body: "Checkouts are limited to 20 per 10 minutes per connection per store, and bookings and every form that sends an email have limits of their own, so a script cannot sit on your limited stock or your call times." },
          { icon: "plug", title: "Signed webhooks, guarded addresses", body: "Webhooks are signed with HMAC-SHA256, and a calendar or webhook address that points into a private network is refused." },
        ],
      },
      {
        kind: "limits",
        title: "What this does not do",
        intro: "Said here so nobody trusts it for more than it is.",
        items: [
          "There is no two-factor sign-in, because there are no passwords. Your account is as safe as your email inbox: protect that one.",
          "A refund on a payment plan is not detected: take the buyer off the course, or remove their access, yourself. A refunded membership closes when its subscription is cancelled in Stripe.",
          "A refund cannot take back a file already saved, or a product delivered as a link to somewhere else.",
          "The limits on checkouts, bookings and forms are counted in our database. If it cannot be reached, they let requests through rather than stop a buyer from paying.",
          "Pages built ahead of time, such as the home page, the help and the blog, carry a policy without a nonce. Nothing on them comes from a creator or a visitor.",
        ],
      },
      {
        kind: "faq",
        title: "Questions about security",
        items: [
          { q: "What if I get an email about a change I did not make?", a: "Log in, choose “Log out of all devices” at the foot of your studio, put the setting back, and reply to that email so we can help." },
          { q: "Who handles a refund?", a: "You do, in your own Stripe dashboard. What a full refund closes here happens by itself, read from Stripe." },
          { q: "Can I sign in with a password?", a: "No. There is no password to set, and none kept here to be stolen. Each link we email works once, for 15 minutes." },
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
    photo: { id: "photo-1758599880979-f6a64947b541", alt: "A woman sitting on the floor of her living room, talking through a lesson to a camera" },
    blocks: [
      {
        kind: "storecard",
        title: "What a coaching store looks like",
        creator: "Marcus Reid",
        tagline: "Career coaching for first-time managers",
        photo: "photo-1775196610640-5e70ef38f846",
        alt: "A man with a short beard, photographed outdoors",
        items: [
          { label: "The first-week checklist", detail: "Free, for an email address", price: "Free" },
          { label: "Interview workbook", detail: "PDF, 18 pages", price: "$19" },
          { label: "Six-week programme", detail: "A course, one module a week, or 3 payments of $30", price: "$89" },
          { label: "One hour with Marcus", detail: "A call, booked in your time zone", price: "$180" },
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
          "Calls read your calendar's busy times but do not write bookings into it: you subscribe to a feed of them instead.",
          "Clients move their own booking up to twice, but cancelling is a reply to the confirmation email, and a refund is yours to make in Stripe.",
          "Group calls and live sessions happen on the meeting service whose link you give. Your community holds posts and comments, not live video.",
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
    photo: { id: "photo-1780277993159-b4ca60e8922d", alt: "A cook in an apron plating a dish in a bright kitchen" },
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
    photo: { id: "photo-1787647090008-4b88ffc977b7", alt: "A movement teacher showing a stretch to someone in a light studio" },
    blocks: [
      {
        kind: "storecard",
        title: "What a fitness store looks like",
        creator: "Dani Cole",
        tagline: "Strength for people with desk jobs",
        photo: "photo-1770393391946-7d9b658deec3",
        alt: "A woman with natural hair, photographed against a dark green wall",
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
          "No live group chat for a challenge: your community holds posts, comments and likes, updated when the page is opened.",
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
    photo: { id: "photo-1765429158141-b283bbe7d0e4", alt: "A photographer holding a camera among tall trees" },
    blocks: [
      {
        kind: "storecard",
        title: "What a design store looks like",
        creator: "Theo Lang",
        tagline: "Film-look presets and Lightroom recipes",
        photo: "photo-1780585328302-747a6eee7694",
        alt: "A man in a dark shirt, photographed against a plain wall",
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
          { icon: "key", title: "Licence keys", body: "A unique key with each sale, for plugins and apps, checked by your software through a public address.", href: "/platform/licence-keys" },
          { icon: "file", title: "Stamped PDFs", body: "The buyer's email on every page of a guide or a colour book, to make sharing it a second thought.", href: "/platform/pdf-stamping" },
        ],
      },
      {
        kind: "limits",
        title: "Where it falls short for designers today",
        items: [
          "Stamping works on PDFs only: presets, brushes and images are handed over as uploaded.",
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
