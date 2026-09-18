/**
 * The whole blog lives here: categories, posts and the blocks each post is
 * built from. Nothing is fetched at run time, so a post page is a static file.
 *
 * House rule for everything written here: no invented customer, no invented
 * number, no claim about another company that we have not read on their own
 * site. Where a post states a fact about someone else, it names where it came
 * from so a reader can check it.
 */

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "note"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  date: string;
  readMinutes: number;
  excerpt: string;
  kicker: string;
  from: string;
  to: string;
  body: BlogBlock[];
};

export const BLOG_CATEGORIES = [
  "Getting started",
  "Selling digital files",
  "Money and payouts",
  "Marketing and audience",
  "Comparisons",
  "Behind the build",
] as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "sell-a-digital-file-from-your-bio",
    title: "How to sell a digital file from the link in your bio",
    category: "Getting started",
    date: "2026-09-18",
    readMinutes: 6,
    excerpt:
      "The whole path, from the file on your laptop to the money in your bank: what to make, what to charge, what the page needs to say, and what has to happen the second someone pays.",
    kicker: "Start here",
    from: "#6c3bff",
    to: "#ff3d8a",
    body: [
      {
        type: "p",
        text: "Selling a file is the shortest path from an audience to an income, because there is nothing to ship, nothing to restock and no call to schedule. It is also where most people stall, because the path has five steps and the internet usually explains two of them.",
      },
      { type: "h2", text: "1. Sell the thing you already answer" },
      {
        type: "p",
        text: "The product you can finish this week is the answer you keep repeating in your replies. A meal planner, a set of presets, a checklist, a template, a workbook, a swipe file of your own messages. If three people have asked you the same question, that question is the product. You are not writing a book; you are packaging an answer.",
      },
      {
        type: "p",
        text: "Keep the first one small on purpose. A five-page PDF that solves one problem sells better than a forty-page one that covers a subject, because the buyer can see the end of it before they pay.",
      },
      { type: "h2", text: "2. Price it where the decision is easy" },
      {
        type: "p",
        text: "For a first digital file, the price that moves is usually somewhere between the price of a coffee and the price of a dinner. Below that, people wonder what is wrong with it. Above it, they start comparing you with a course.",
      },
      {
        type: "p",
        text: "Better than guessing a single number: give the same product two or three sizes. One week of meals for $27, five weeks for $39, the whole season for $79. The buyer stops deciding whether to buy and starts deciding which one — and a good share of them pick the middle.",
      },
      { type: "h2", text: "3. Write the page as an answer, not a pitch" },
      {
        type: "ul",
        items: [
          "Say what the buyer gets, in nouns: 'A 12-page PDF with 5 weeks of dinners and the shopping list for each week.'",
          "Say who it is for and who it is not for. Turning the wrong buyer away is what makes the right one trust you.",
          "Say what happens after payment, in one sentence, before they pay.",
          "Show one page of the thing. A single honest screenshot beats a paragraph of adjectives.",
          "Do not invent reviews. A new product with no reviews and a clear description outsells a new product with reviews nobody believes.",
        ],
      },
      { type: "h2", text: "4. Make the checkout boring" },
      {
        type: "p",
        text: "Every extra field loses buyers. On a phone, the whole purchase should be: tap the price, type an email, pay with the card already in the phone's wallet. No account to create, no password to invent, no app to install.",
      },
      {
        type: "p",
        text: "Whatever you use to collect the money, check two things before you launch: that Apple Pay and Google Pay appear on a phone, and that the price shown on the product is the price charged at the end. A surprise fee at the last screen is the most expensive kind of surprise.",
      },
      { type: "h2", text: "5. Deliver in the same second" },
      {
        type: "p",
        text: "The moment after payment is the whole relationship. If the file appears immediately, you are a business. If it arrives in an email twenty minutes later, you are a person who might have forgotten.",
      },
      {
        type: "note",
        text: "Test your own checkout with a real card before you send a single person to it. Buy your own product. Read the confirmation. Download the file on a phone, on mobile data, not on your home wifi. Most broken stores were never bought from by their owner.",
      },
      { type: "h2", text: "What to do this week" },
      {
        type: "steps",
        items: [
          {
            title: "Monday",
            text: "Write down the question you answer most. That is the product.",
          },
          {
            title: "Tuesday and Wednesday",
            text: "Make the file. Stop when it solves the one problem. Export it as a PDF.",
          },
          {
            title: "Thursday",
            text: "Write the page: what it is, who it is for, what happens after payment. Three prices if the product has sizes.",
          },
          {
            title: "Friday",
            text: "Buy it yourself. Fix whatever annoyed you. Then put the link in your bio and tell people what you made.",
          },
        ],
      },
    ],
  },
  {
    slug: "what-it-costs-to-sell-a-27-dollar-file",
    title: "What it really costs to sell a $27 file",
    category: "Money and payouts",
    date: "2026-09-18",
    readMinutes: 5,
    excerpt:
      "Card fees, platform fees, subscriptions and payout fees, added up on one sale and on a hundred — so you can see which cost is worth paying and which one quietly eats the month.",
    kicker: "The maths",
    from: "#12d6a4",
    to: "#37b6ff",
    body: [
      {
        type: "p",
        text: "Every platform advertises one number and charges you three. Here is the whole stack, in the order it comes out of a sale.",
      },
      { type: "h2", text: "The card fee" },
      {
        type: "p",
        text: "Someone has to move the money. Card networks and payment processors take a percentage plus a fixed amount per transaction — Stripe publishes its own rates, and in the United States the standard online card rate has been 2.9% plus 30 cents for years. On a $27 sale that is about $1.08, so roughly $25.92 reaches you.",
      },
      {
        type: "p",
        text: "Nobody escapes this one. Any service that says it takes nothing is either paying the card fee out of the subscription you pay them, or taking it before you see the number.",
      },
      { type: "h2", text: "The platform fee" },
      {
        type: "p",
        text: "This is the cut the store takes on top of the card fee. It is the one number worth reading carefully, because a percentage grows with you and a fixed price does not.",
      },
      {
        type: "ul",
        items: [
          "A 5% platform fee on a $27 file is $1.35 — more than a dollar per sale, forever, on every sale.",
          "At 100 sales a month, that is $135 a month. At 500, it is $675 a month.",
          "A fixed monthly price does the opposite: it hurts at 3 sales and disappears at 300.",
        ],
      },
      { type: "h2", text: "The subscription" },
      {
        type: "p",
        text: "Most creator stores charge a monthly fee. Compare it against your real volume, not your hoped-for volume: a $29 monthly plan on 3 sales of $27 is eating more than a third of the money; on 100 sales it is barely 1%.",
      },
      {
        type: "note",
        text: "The honest way to compare two stores is to write your own number of sales into both. A platform that is cheaper for someone selling 500 files a month can be the expensive one for you, and the reverse is just as true.",
      },
      { type: "h2", text: "The payout" },
      {
        type: "p",
        text: "Then there is getting the money out. Two questions decide how much this costs you: how long the money sits before it is released, and whether it is converted into another currency on the way. Currency conversion is where the quiet fee lives — a percentage on top of the exchange rate, charged on every payout, often invisible on the dashboard.",
      },
      {
        type: "p",
        text: "If the money lands directly in your own payment account, in your own currency, on your own schedule, that cost is zero and the timing is yours.",
      },
      { type: "h2", text: "One sale, added up" },
      {
        type: "ul",
        items: [
          "Sale price: $27.00",
          "Card fee at 2.9% + $0.30: about $1.08",
          "Platform fee at 5%: $1.35 — or $0 if the store does not take a cut",
          "Left before the monthly plan: $24.57 with a 5% cut, $25.92 without",
        ],
      },
      {
        type: "p",
        text: "The gap looks small on one sale. It is $135 a month at a hundred sales, and it is the difference between a hobby paying for itself and a hobby paying you.",
      },
    ],
  },
  {
    slug: "your-own-stripe-account",
    title: "Why the money should land in your own Stripe account",
    category: "Money and payouts",
    date: "2026-09-18",
    readMinutes: 5,
    excerpt:
      "There are two ways a creator store can handle your money, and they are not close. One gives you a balance on someone else's dashboard; the other gives you a payment account that is yours.",
    kicker: "How the money moves",
    from: "#ffb020",
    to: "#ff3d8a",
    body: [
      {
        type: "p",
        text: "When a buyer pays for your file, the money goes somewhere before it reaches you. Where exactly is the single most important thing to understand about any platform you sell on, and almost nobody explains it.",
      },
      { type: "h2", text: "The first way: the platform holds it" },
      {
        type: "p",
        text: "The buyer pays the platform. The platform records that you are owed the money and shows you a balance. Later, on the platform's schedule and under the platform's rules, it sends you a payout.",
      },
      {
        type: "p",
        text: "Everything about that arrangement is a decision someone else makes: when the balance is released, what the minimum payout is, which countries can receive it, what happens if a buyer disputes a charge, and what happens to the balance if your account is closed. You are a line in someone's ledger.",
      },
      { type: "h2", text: "The second way: the money never stops at the platform" },
      {
        type: "p",
        text: "You connect your own payment account — your own Stripe account, in your own name, with your own bank details. The buyer's card is charged on your account. The money lands in your balance, on the payout schedule you set, in your currency.",
      },
      {
        type: "ul",
        items: [
          "The customer's receipt carries your business name, not the platform's.",
          "Refunds and disputes are handled by you, with the tools of a real payment account, not a support ticket.",
          "Your payout schedule is a setting you control.",
          "If you leave the platform tomorrow, your payment account, your customer records and your money stay where they are.",
        ],
      },
      {
        type: "note",
        text: "There is one honest trade-off: connecting your own account means you go through the payment processor's verification — your identity, your business details, your bank account. It takes longer on day one than typing a username. It is also the difference between having a business and having an account on a website.",
      },
      { type: "h2", text: "How to check which one you are on" },
      {
        type: "p",
        text: "You do not have to read the terms of service. Look at two screens.",
      },
      {
        type: "steps",
        items: [
          {
            title: "The receipt",
            text: "Buy something from your own store. Whose name is on the receipt and the card statement line — yours, or the platform's?",
          },
          {
            title: "The payout page",
            text: "Does it show a balance the platform will send you later, or does it link to a payment account in your own name with its own dashboard?",
          },
        ],
      },
      {
        type: "p",
        text: "If the receipt says your name and the payout page is your own account, the money is yours from the first second. If not, you are holding a promise, and promises have terms.",
      },
    ],
  },
  {
    slug: "three-prices-for-one-product",
    title: "One product, three prices: the simplest way to earn more per buyer",
    category: "Selling digital files",
    date: "2026-09-18",
    readMinutes: 4,
    excerpt:
      "Most creators sell one file at one price. Giving the same work three sizes changes the question in the buyer's head from 'should I?' to 'which one?', and that question is far easier to answer yes to.",
    kicker: "Pricing",
    from: "#6c3bff",
    to: "#12d6a4",
    body: [
      {
        type: "p",
        text: "A single price makes the buyer decide between your product and nothing. Three prices make them decide between three versions of your product. The second decision is the one you want them making.",
      },
      { type: "h2", text: "How to cut one product into three" },
      {
        type: "p",
        text: "You do not need three products. You need three honest sizes of the same work.",
      },
      {
        type: "ul",
        items: [
          "By amount: one week of meal plans, five weeks, the whole season.",
          "By format: the PDF; the PDF plus the editable file; the PDF, the editable file and the video walkthrough.",
          "By use: for yourself; for your clients (a licence to use it in your own work).",
        ],
      },
      {
        type: "p",
        text: "What matters is that each tier is genuinely more of something, and that the description says exactly what the extra is. A tier that is the same product with a nicer name is the kind of thing buyers notice and remember.",
      },
      { type: "h2", text: "Where to put the price you want people to pick" },
      {
        type: "p",
        text: "Put it in the middle and make it obviously the best value — the one where the price per week, per template or per page is lowest. Say that out loud on the page. 'Five weeks for $39' next to 'one week for $27' does the arithmetic for the buyer.",
      },
      {
        type: "note",
        text: "One thing to never do: fake the top tier. A price nobody is meant to buy, invented to make the middle look good, is a trick. Sell three things you would be happy to deliver, and let the buyer pick freely.",
      },
      { type: "h2", text: "What changes on the page" },
      {
        type: "p",
        text: "The product page stops being a wall of copy with a button at the bottom. It becomes a short description and three rows the buyer taps. Show the 'from' price at the top of the store so the cheapest tier is what catches the eye, and let the choice happen on the product, one tap before the card.",
      },
      {
        type: "p",
        text: "Then deliver the right file for the tier that was paid for. That sounds obvious and it is the part that breaks most often: the buyer pays for five weeks and receives the one-week file, because the two were never really separate products in the system. Test each tier the way a buyer would, with a real payment, before you publish.",
      },
    ],
  },
  {
    slug: "product-page-that-sells-a-file",
    title: "How to write a product page that sells a file",
    category: "Marketing and audience",
    date: "2026-09-18",
    readMinutes: 5,
    excerpt:
      "Six lines, in order, and what each one has to do. Written for people selling a PDF from a phone screen, not for people writing sales letters.",
    kicker: "Copy",
    from: "#37b6ff",
    to: "#6c3bff",
    body: [
      {
        type: "p",
        text: "A digital product page has one job: make someone who has never met you confident enough to type their card number. On a phone, you have about six lines of attention to do it in. Here is what each line should carry.",
      },
      { type: "h2", text: "Line 1 — the name, said plainly" },
      {
        type: "p",
        text: "'Weekly Meal Planner' beats 'The Nourish Method'. A clever name asks the reader to learn something before they can want it. Save the clever name for when people already know you.",
      },
      { type: "h2", text: "Line 2 — what it physically is" },
      {
        type: "p",
        text: "A 12-page PDF. A set of 30 presets. A spreadsheet with four tabs. Buyers relax when they know the shape of the thing they are getting. Vagueness reads as risk.",
      },
      { type: "h2", text: "Line 3 — the one problem it removes" },
      {
        type: "p",
        text: "Not the transformation. The problem, in the reader's own words: 'You stop deciding what to cook at 6pm.' If you cannot write this line, the product is not finished yet.",
      },
      { type: "h2", text: "Line 4 — who it is for, and who it is not" },
      {
        type: "p",
        text: "'For two people who cook three or four nights a week. Not for meal-prep in bulk.' Saying who should not buy it is the strongest trust signal a new seller has, and it cuts refunds.",
      },
      { type: "h2", text: "Line 5 — what happens after payment" },
      {
        type: "p",
        text: "'You get the download on the next screen, and a copy by email.' Say this before the price, not after. The fear of paying and being left waiting is the last thing standing between a reader and a sale.",
      },
      { type: "h2", text: "Line 6 — the price, with the options visible" },
      {
        type: "p",
        text: "Show the choices as rows the buyer can tap, with what each one includes. No maths for them to do, no 'contact for pricing', no discount timer that resets when they reload the page.",
      },
      { type: "h2", text: "What to leave out" },
      {
        type: "ul",
        items: [
          "Testimonials you do not have. An empty review section is better than an invented one, and inventing them is fraud in most places you would want to sell.",
          "Countdown timers that are not real deadlines.",
          "'Normally $197, today $27.' If it was never $197, that sentence is a lie with a number in it.",
          "Long autobiography. One line about why you are the person to make this is plenty on a product page.",
        ],
      },
      {
        type: "note",
        text: "Read your finished page out loud on your phone. Anything you stumble over, a buyer skipped.",
      },
    ],
  },
  {
    slug: "link-in-bio-is-not-the-product",
    title: "The link in your bio is not the product. The offer is.",
    category: "Marketing and audience",
    date: "2026-09-18",
    readMinutes: 4,
    excerpt:
      "People change their store page fonts for a week and wonder why nothing sold. The page is a wrapper. What sells is one clear offer that the audience already asked for.",
    kicker: "Strategy",
    from: "#ff3d8a",
    to: "#ffb020",
    body: [
      {
        type: "p",
        text: "Every creator store on the market can hold a photo, a few links and a product. The differences between them matter — fees, delivery, where the money lands — but none of them will sell anything if the offer on the page is not one the audience wanted.",
      },
      { type: "h2", text: "The order almost everyone gets wrong" },
      {
        type: "p",
        text: "The common order is: pick a platform, design the page, then wonder what to sell. The order that works is the reverse.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Find the repeated question",
            text: "Go through your replies, comments and messages from the last month. Write down every question that appeared more than twice.",
          },
          {
            title: "Answer one of them completely",
            text: "Make the file that ends that question for good. One question, one file.",
          },
          {
            title: "Say it in one sentence",
            text: "'Five weeks of dinners for two people, with the shopping list.' That sentence is the offer; everything else is decoration.",
          },
          {
            title: "Then build the page",
            text: "Now the page has a job, and building it takes an afternoon.",
          },
        ],
      },
      { type: "h2", text: "Why one offer beats five" },
      {
        type: "p",
        text: "A store with five products asks a visitor to choose before they trust you. A store with one product and three sizes asks them to choose how much of a thing they already want. The second store converts better and is far easier to talk about in a post.",
      },
      {
        type: "p",
        text: "Add the second product when the first one is selling without you thinking about it. Not before.",
      },
      { type: "h2", text: "Talk about the offer, not the store" },
      {
        type: "p",
        text: "Nobody follows you for your store page. Post the thing itself: a page of the planner, the before and after, the mistake the guide fixes. Then say where it is. A post about the product with the link at the end beats a post about the link every time.",
      },
    ],
  },
  {
    slug: "how-nimbus-compares-with-stan",
    title: "How Nimbus compares with Stan, written by the people building Nimbus",
    category: "Comparisons",
    date: "2026-09-18",
    readMinutes: 6,
    excerpt:
      "We are not a neutral source and we are not going to pretend otherwise. Here is what each one does, what Stan does better today, and the one thing we do differently on purpose.",
    kicker: "Comparison",
    from: "#140f3d",
    to: "#6c3bff",
    body: [
      {
        type: "note",
        text: "Disclosure: we build Nimbus. Everything below about Stan comes from Stan's own website and help centre, which anyone can read. Where we are worse, we say so.",
      },
      { type: "h2", text: "What Stan is" },
      {
        type: "p",
        text: "Stan is a creator store that has been running for years and sells a wide product range from one dashboard. Their own help centre lists what a creator can sell there: digital downloads, e-courses, coaching calls, webinars, memberships, communities, lead magnets, external links and custom products, plus order bumps and funnels, an affiliate share programme, email marketing and their AutoDM tool.",
      },
      {
        type: "p",
        text: "That is a large product. If you want courses, a community and recurring memberships in one place today, they have all of it and we do not.",
      },
      { type: "h2", text: "What Nimbus is" },
      {
        type: "p",
        text: "Nimbus is a store page for selling files, plans and calls, and it is early. It does one job: a colourful page, price options on a product, and the file in the buyer's hands the second the payment clears.",
      },
      { type: "h2", text: "The one thing we do differently" },
      {
        type: "p",
        text: "The money. On Nimbus, the buyer pays into your own Stripe account. We never hold your balance and we take 0% of your sales — not 0% with an asterisk that points at a cut somewhere else. What we charge is the subscription, and that is the whole of what we charge.",
      },
      {
        type: "p",
        text: "Stan also advertises 0% transaction fees on their home page, and charges a subscription. On that point we are the same, and we would rather say so than pretend otherwise. Where we differ is whose payment account the sale lands in, which decides who controls payouts, receipts and refunds.",
      },
      { type: "h2", text: "Where Stan is ahead of us today" },
      {
        type: "ul",
        items: [
          "Range: courses, memberships, communities and webinars. We have none of those yet.",
          "Years of running: their support library is deep, and ours is a few pages.",
          "An installable creator app: their help centre states their creator app is currently available on iPhone and iPad. We do not have a native app at all — our store installs to the home screen from the browser, on both iPhone and Android, which is a different trade-off, not a better one in every case.",
          "Integrations with third-party tools, which they list on their site and we are still building.",
        ],
      },
      { type: "h2", text: "Where we think we are ahead" },
      {
        type: "ul",
        items: [
          "The money lands in your own Stripe account, so payouts, receipts and refunds are yours.",
          "Price options on a single product, with the right file delivered for the tier that was paid for.",
          "A live demo store anyone can buy from with a test card, before signing up for anything.",
          "Prices and terms published as pages on the site, not as PDFs you have to download.",
        ],
      },
      { type: "h2", text: "How to decide without trusting either of us" },
      {
        type: "steps",
        items: [
          {
            title: "Write down your own numbers",
            text: "Your price, your sales per month. Run them through both fee structures. The cheaper platform is different at 5 sales and at 500.",
          },
          {
            title: "Buy something from both",
            text: "Go through a real checkout on each. Whose name is on the receipt? How fast did the file arrive? Could you do it on a phone in one hand?",
          },
          {
            title: "Read the payout page",
            text: "A balance the platform sends you later, or a payment account in your name? That answer outlives every other feature on the list.",
          },
        ],
      },
    ],
  },
  {
    slug: "why-we-skipped-the-app-stores",
    title: "Why your store installs from the browser instead of an app store",
    category: "Behind the build",
    date: "2026-09-18",
    readMinutes: 4,
    excerpt:
      "Your buyer should never have to download anything to buy a file. Here is the reasoning behind that decision, and the honest cost of it.",
    kicker: "How we built it",
    from: "#04624a",
    to: "#12d6a4",
    body: [
      {
        type: "p",
        text: "A Nimbus store is a web page that can be installed to a phone's home screen, with its own icon, from the browser. There is no app to download — for you or for your buyers. That was a decision, and it has a cost worth explaining.",
      },
      { type: "h2", text: "The buyer's side is not a close call" },
      {
        type: "p",
        text: "Someone taps a link in a bio because they are curious. Every step you add between that tap and the file loses people, and 'install an app first' is the largest step there is. A store that sells to strangers has to work in the browser they already have open.",
      },
      { type: "h2", text: "The creator's side is where it gets interesting" },
      {
        type: "p",
        text: "For running a store on the move — checking sales, answering a buyer — an app on the home screen is genuinely nice. The question is how you get the icon there.",
      },
      {
        type: "ul",
        items: [
          "Through an app store: a native app, a review process for every update, a share of in-app purchases in some cases, and a separate build per platform.",
          "Through the browser: the page declares itself installable, and the phone offers to add it to the home screen. One build, works on iPhone and Android, updates the moment we publish.",
        ],
      },
      {
        type: "p",
        text: "We took the second route because it reaches both phones with one thing to maintain, which for a small team is the difference between shipping and not shipping. Stan's own help centre says their creator app is currently available on iPhone and iPad; our installable store runs on both iPhone and Android. That is the concrete difference the choice makes.",
      },
      { type: "h2", text: "The honest cost" },
      {
        type: "p",
        text: "Installing from a browser is less discoverable than a store listing: on iPhone it lives behind the share menu, and on Android behind the browser menu. A native app can also do things a web page cannot, such as rich notifications on every platform.",
      },
      {
        type: "note",
        text: "If we ever put a real app in the app stores, this page will say so on the day it is true, and not before. Until then, what you get is a store that installs in two taps and a buyer who never has to install anything at all.",
      },
    ],
  },
];

/** The one we point new readers at first. */
export const FEATURED_SLUG = "sell-a-digital-file-from-your-bio";

/**
 * Newest first. Posts published on the same day keep the order they are
 * written in above, so the list never shuffles between builds.
 */
export function postsSorted(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function featuredPost(): BlogPost {
  return postBySlug(FEATURED_SLUG) ?? BLOG_POSTS[0];
}

export function postBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function formatPostDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
