import type { Metadata } from "next";
import Link from "next/link";
import { Icon, iconFor } from "@/components/icons";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { isDomainsConfigured } from "@/lib/domains";
import { HelpSearch } from "@/components/help-search";
import { CopyLink } from "@/components/copy-link";
import { formatMoney } from "@/lib/money";
import { INVITE_BONUS_CENTS, INVITE_HOLD_DAYS, INVITE_SHARE_PERCENT } from "@/lib/creator-invite-rules";

/** An anchor for one answer, from its question. */
function answerId(q: string): string {
  return q.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const metadata: Metadata = {
  title: "Help center — Nimbus Labs",
  description:
    "Straight answers about the store, the money, the files and what the subscription buys. If an answer is “not yet,” it says not yet.",
};

type Section = {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  tone: string;
  items: { q: string; a: string[] }[];
};

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    emoji: "🚀",
    title: "Getting started",
    blurb: "What Nimbus is right now, and what it costs to start.",
    tone: "bg-lilac",
    items: [
      {
        q: "What is Nimbus today?",
        a: [
          "You sign up, take your own store address and build the page: its name, its description, and what you sell with its price. You connect your own Stripe account, and once Stripe has cleared it and your plan or free trial is running, your page can take a card. The money is charged on your account, not ours.",
          "You can see the whole path before signing up. The demo store has price options on a product, a Stripe checkout made on the creator's own account, and the file delivered the second the payment clears. You can buy from it with a test card.",
          "The mission page lists everything that is built and everything that is not, in two columns, so nobody signs up expecting the wrong thing.",
        ],
      },
      {
        q: "Can I put my own products on my store?",
        a: [
          "Yes. In your studio you write the name of the store, the line under it, and each thing you sell with what the buyer gets and the price. It is on your page the moment you save it, and you can reorder or remove any of it.",
          "A store holds up to 2,000 products and up to 100 links. Products are priced in your store's currency — one of 15, US dollars unless you choose another — with one price each, up to three if you want the buyer to choose, or a price the buyer chooses, at or above your minimum. You can also put the file itself on each one, and open it again to check it is the right one. A long store shows 24 products a page, and your studio finds any product by name.",
          "Each product can have a picture, shown on its card in one of three ways, and a page of its own at your store address followed by /p/ and the product, with a long description of up to 5,000 characters. That page has its own title and preview card, so a link to one product shared anywhere unfolds into that product. You can also build it as a sales page, from blocks.",
          "Your page can take a card as soon as two things are true: Stripe has cleared your connected account, and your subscription is running — the trial counts. Until then the page says so plainly, to you and to anyone who opens it.",
        ],
      },
      {
        q: "What file can I sell, and how big?",
        a: [
          "Up to 5 GB, in any of these: PDF, ePub, ZIP, PNG, JPG, GIF, WebP, SVG, MP3, WAV, M4A, MP4, MOV, WebM, TXT, CSV, Markdown, Word, Excel and PowerPoint. Anything over about 20 MB is uploaded in parts, so a dropped connection costs you one part rather than the whole thing.",
          "Bigger than that, or not a file at all? Sell it as a link. You paste an https address \u2014 a Google Drive folder, a private video page, a Notion page \u2014 and the buyer is sent there the moment they pay, with the address shown on the page and kept in their receipt. There is no size limit on that, because the files stay where you already keep them.",
          "A product carries one or the other, never both, so a buyer who has paid is shown one thing to open rather than a choice.",
          "Anything that runs — a program, an installer, a script — is refused. A store that hands out software is a store that hands out malware the day an account is taken over.",
          "The file goes straight from your browser to storage that needs a key to read. It is never named or linked on your public page, and the only way it comes out is through us, after we have checked who is asking. You can open it yourself from your studio to be sure it is the right one.",
        ],
      },
      {
        q: "What does it cost to start?",
        a: [
          "Nothing to sign up. Your store address, your page, the editor and connecting Stripe are free and stay free.",
          `What the subscription switches on is your checkout: your page taking a card, and handing out what you give away for an email address. It is $29 a month, or $300 a year, which is $48 less than paying monthly. Pro, which adds email to your list${isDomainsConfigured() ? " and your own domain" : ""}, is $99 a month or $948 a year. The first 14 days are free on either plan, monthly or yearly. Stripe takes your card details when the trial starts and first charges the card when the 14 days end; we email you a week before that charge, and if you cancel before it, from your studio, it is never charged. So you can put a product up and make a sale before you decide whether it is worth paying for.`,
        ],
      },
      {
        q: "What will it cost?",
        a: [
          "One subscription — $29 a month, or $99 a month on Pro, less if you pay yearly — and 0% of your sales. The card fee your payment processor charges is paid to them, on your own account, and we never take a cut on top of it.",
          "The price is published on the home page. If it ever changes, existing subscribers are told before it applies to them.",
        ],
      },
      {
        q: "Can I switch between monthly and yearly, or between the plans?",
        a: [
          "Yes to both, from your studio, whenever you like. Monthly to yearly charges the year that day, less what is left of the month you already paid for. Yearly to monthly keeps what is left of your year as credit on your account, and that credit pays your months until it runs out.",
          "Moving up to Pro charges that day the difference for what is left of the period you already paid for; going back to the $29 plan keeps what is left of Pro as credit on your account. Inside the trial, no switch charges anything.",
          "On a yearly plan we email you about a month before it renews, with the date, the amount and the link to cancel.",
        ],
      },
      {
        q: "Can I run more than one store, or have someone help me?",
        a: [
          "Both. One account runs up to five stores, each with its own address, products, buyers, Stripe account and plan, and you switch between them at the top of your studio. The 14-day free trial is for an account's first store; each other store is charged from the day its plan starts, and canceling one touches no other.",
          "Each store can have a team of up to five people, invitations still waiting included, each signing in with their own email: an Admin runs everything except the plan, the Stripe connection, the team and deleting the store; an Editor looks after products, courses, calls, bundles, sales pages, the store page and the community's live events, moderates the community and reviews, and writes email drafts without sending them; Support reads orders and bookings, sends purchase emails again, sees who is coming to live events and moderates the community and reviews. What each role may do is checked on our server for every request. You are emailed when someone joins or changes role, and the activity log shows the last 500 changes and downloads your team made.",
          "Stan's help center, read on September 28, 2026, says the only way to give a team member admin access there is to share your login.",
        ],
      },
      {
        q: "Can I move my store from Stan, Gumroad or another platform?",
        a: [
          "Yes, from a spreadsheet, in three imports from “Moving from another platform” in your studio, on every plan. Your list: up to 50,000 rows a file, and only people who agreed to hear from you \u2014 you confirm it each time, a consent column in the file narrows it further, nobody who unsubscribed here is added back, and nobody is emailed because of it. Your products: up to 500 a file, each made a draft that waits in your studio until you publish it, with its title, price, description and link. Your past buyers: up to 20,000 a file, each given what they bought on your store's list of purchases, marked as brought over from another platform, with no payment and no receipt.",
          "Bring products first, because the buyers' file names them by their title or their ID here, then add each product's file or lessons. A buyer brought over for a product that opens your community is let in. If you check “Email each buyer once”, each buyer gets one email from your store's name saying what moved and how to open it \u2014 up to 20,000 buyers per store in 30 days \u2014 and nothing more is sent because of it. The studio reads the file in your browser, you say which column is which, and every row that is not brought in is listed with its row number and the reason, as a spreadsheet you download.",
          "What it does not do: files, pictures and lessons are not imported; memberships, calls and products with several prices cannot be given to past buyers; buyers brought over get no license key here and are not counted as sales, sent to webhooks, credited to affiliates or able to review; and an import cannot be undone in one step. You and your Admins can import. Stan's help center, read on September 28, 2026, allows up to 5,000 imported contacts per store in all, has you send them an opt-in email, and grants a customer access to a product one at a time.",
        ],
      },
      {
        q: "Is it open, or is this a waiting list?",
        a: [
          "Open. You can take an address and be selling the same day.",
          "It is also young, and the mission page lists what is built and what is not, in two columns, so you can see what you are signing up to before you do. That page is updated the day something new actually works, not the day it is planned.",
        ],
      },
    ],
  },
  {
    id: "demo-store",
    emoji: "🧪",
    title: "The demo store",
    blurb: "How to test a real checkout without spending anything.",
    tone: "bg-cream",
    items: [
      {
        q: "How do I try it?",
        a: [
          "Open the demo store, pick a price option and pay with the Stripe test card 4242 4242 4242 4242, any future expiration date, any three digits for the security code and any ZIP code.",
          "The checkout is a real Stripe checkout running in test mode. No real money moves, and no real card is ever charged.",
        ],
      },
      {
        q: "Is the file real?",
        a: [
          "Yes. The sample planner is a real PDF, and the page delivers the file that matches the option you paid for — the one-week file for the one-week price, the five-week file for the five-week price.",
        ],
      },
      {
        q: "Can I put my own file in it?",
        a: [
          "Not in the public demo, which is a fixed sample everyone shares. Your own store is where your file goes: take an address, upload it, and the page and the file are yours.",
        ],
      },
    ],
  },
  {
    id: "money",
    emoji: "💳",
    title: "Money, fees and payouts",
    blurb: "Who charges the buyer, who holds the money, and when you get it.",
    tone: "bg-mint-brand/12",
    items: [
      {
        q: "Whose account is the buyer charged on?",
        a: [
          "Yours. You connect your own Stripe account and the charge is made on it directly. The receipt and the line on your buyer's card statement carry your business name, not ours.",
        ],
      },
      {
        q: "What does Nimbus take from a sale?",
        a: [
          "Nothing. 0% of your sales, with no asterisk. Our only income is the subscription.",
          "Stripe charges its own processing fee on each payment, published on Stripe's own pricing page, and that is taken on your account by Stripe.",
        ],
      },
      {
        q: "When am I paid?",
        a: [
          "On your own Stripe payout schedule, which you set in your own Stripe dashboard. We never hold a balance for you, so there is nothing for us to release.",
        ],
      },
      {
        q: "Can I give someone a discount code?",
        a: [
          "Yes, and it is on the $29 plan. On Stan, discount codes are on the $99 Creator Pro plan, according to its help center, read on September 28, 2026.",
          "You pick the word, say whether it takes a percentage or an amount off, and cap how many times it can be used if you want to. The buyer types it at checkout and Stripe works out the new total.",
          "The code is a coupon on your own Stripe account, not a record of ours. So the count of how many times it has been used is Stripe's count, a code you switch off in your own dashboard is off here too, and if you ever leave, your codes leave with you.",
          "One limit, said plainly: a code comes off the payment it is typed into. On a membership that is the first charge, not every renewal forever.",
        ],
      },
      {
        q: "Can my buyers pay with PayPal?",
        a: [
          "Do not count on it. Nimbus runs on Stripe and only Stripe, and your buyers are offered the ways to pay you switch on in your own Stripe account. Every sale here is a direct charge on that account, and Stripe's documentation, read on September 28, 2026, lists PayPal as not supported for direct charges. Stripe also offers PayPal only to accounts in the EU (except Hungary), the UK, Switzerland, Norway and Liechtenstein. So even if your Stripe dashboard shows PayPal as on, your buyers should not expect it at checkout here.",
          "Stan lets creators take PayPal, Beacons offers it too, and on this one we are behind them. The other road would be a second, separate integration with PayPal, which means a second checkout, a second refund path and a second dispute queue to keep working. We would rather have one that never breaks than two that sometimes do.",
          "Two things follow from that, and you should know them before you sign up. You need a Stripe account in one of the 43 countries the studio offers \u2014 the United States, Canada, the United Kingdom, Australia, Japan, Singapore, Mexico and most of Europe among them, but not everywhere. And a buyer who has only a PayPal balance and no card, wallet or other way to pay cannot buy from you here.",
        ],
      },
      {
        q: "Which currencies and ways to pay can I offer?",
        a: [
          "Your store charges in one of 15 currencies: US, Canadian, Australian, New Zealand, Singapore and Hong Kong dollars, euros, pounds, Swiss francs, Swedish kronor, Norwegian and Danish kroner, Polish zloty, Japanese yen or Mexican pesos, among those your Stripe account can charge in. You or an Admin choose it in your studio, and you are emailed when it changes. Changing it keeps every price's number, so check your prices; it cannot be changed while a membership or payment plan is still running.",
          "The ways to pay are the ones you switch on in your own Stripe account: cards, Apple Pay, Google Pay, Link, and where they fit the buyer and the amount, Klarna, Afterpay or Clearpay, Affirm, iDEAL, Bancontact and others. Your studio lists what is on, read from Stripe, and links to where you switch more on. Memberships and payment plans show only the ways Stripe can charge again each period.",
          "Ways to pay that are not confirmed while the buyer waits \u2014 ACH, SEPA and Bacs Direct Debit, bank transfers, Boleto, OXXO, Konbini, Multibanco, stablecoins \u2014 are left out on purpose, because what your buyers pay for is handed over the moment the payment is confirmed. And one-click offers after paying are shown only to buyers who paid by card, Apple Pay or Google Pay.",
        ],
      },
      {
        q: "Who handles refunds and disputes?",
        a: [
          "You do, in your own Stripe dashboard, with the same tools any business has. Because the charge was made on your account, a refund is a refund you issue, not a request you file with us.",
        ],
      },
      {
        q: "What about refunds on the Nimbus subscription itself?",
        a: [
          "Ask within 14 days of a charge and we refund that charge in full, including renewals. You can cancel at any time and keep access until the end of the period you already paid for. The refund policy page has the exact wording.",
        ],
      },
      {
        q: "Do I get anything for inviting another creator?",
        a: [
          `Yes: ${INVITE_SHARE_PERCENT}% of every payment they make to us, for as long as they pay, on either plan, monthly or yearly. Your invite link is in your studio, under Invite creators. It counts when they accept it and then make their first store, and not for an account that paid us before, or one of your own.`,
          `It is credit on your own Nimbus Labs plan, not cash. It is added ${INVITE_HOLD_DAYS} days after each of their payments, once its refund window has closed, and Stripe takes it off your next bills by itself; two creators on the same plan as yours pay for it, and anything left over stays on your account. If you have not started your plan yet, it waits until you do.`,
          `The creator you invite gets ${formatMoney(INVITE_BONUS_CENTS, "usd")} of credit on their own plan ${INVITE_HOLD_DAYS} days after their first payment. For comparison, Stan pays 20% of each payment in cash, only while you pay Stan too, and names no bonus for the creator invited, in its help center article 'What is Stan's Referral Program?', read on September 30, 2026.`,
        ],
      },
    ],
  },
  {
    id: "your-store",
    emoji: "🏪",
    title: "Your store",
    blurb: "What it can hold today, and what it cannot.",
    tone: "bg-sky-brand/12",
    items: [
      {
        q: "Is there a limit on how much my buyers download?",
        a: [
          "Your plan covers 200 GB of downloads a month for your store. Your studio shows what you have sent out so far, counted from the moment each download starts.",
          "If you go past it, nothing is cut off. Somebody paid you for that file and they get it — we are not going to take a sale and then break it to protect our own bill. Your studio marks the month as past what your plan covers, and your store keeps selling as usual.",
          "For a sense of scale: 200 GB is two hundred copies of a one-gigabyte course, or forty thousand copies of a five-megabyte guide, in a single month.",
        ],
      },
      {
        q: "What can I sell?",
        a: [
          "Digital files, courses, memberships that charge on a schedule, paid calls, one-on-one or in groups of up to 50, live sessions on dates you set, and bundles of 2 to 20 of your products at one price. What is too big to upload, or is not a file at all, is sold as a link to where it already lives. And anything can be given away for free, in exchange for an email address.",
          "One product can carry up to three prices — one week and five weeks, personal and commercial — and each one hands over its own file or its own link. The buyer picks on the card, and what they are charged is read from what you saved rather than from the page they are looking at.",
          "Your page also holds links that are not for sale, with no price and no checkout on them: the channel, the podcast, the profile, the booking page you already pay someone else for.",
        ],
      },
      {
        q: "Can I give something away for an email address?",
        a: [
          "Yes. Set a product's price to 0 and it becomes free: a visitor types their email, we send them a link to it, and when they use that link their address joins your list. Because the link has to be opened from their own inbox, every address on the list is real \u2014 no typos, and nobody signed up by someone else.",
          "Under the email field there is a box, empty until the visitor checks it, that says they want to hear from you. Your list keeps the two apart: you can download everyone who asked for something, or only the people who checked the box, as a CSV file that email tools can import. It is yours to take at any time, with nothing to ask for.",
          "Free products are handed out while your subscription or trial is on, and they do not need Stripe, because no money moves. A list holds up to 100,000 addresses.",
        ],
      },
      {
        q: "Can it write my descriptions, outlines and emails?",
        a: [
          "Yes, as a first draft. In your studio, a box under a product's name, above a course's modules and at the top of a new email takes a few words from you and fills in the product's short and long description, a course outline of up to 8 modules of up to 8 lessons, or an email's subject and body.",
          "It writes in American English from only what you typed and what the product is. It is told never to invent a review, a testimonial, a number of students or sales, a result, a guarantee, a discount or a deadline, and nothing is saved, added or sent until you press the button that does it. Read it before you publish: it goes out under your name.",
          "Each store gets 20 drafts a month on the free trial, 100 on Creator and 400 on Pro, shared between the three, and a draft that fails is not counted. The drafts are written by Anthropic's Claude, which receives what you typed, the product's name, price and kind, and your store's name, and nothing about your buyers, members or list.",
        ],
      },
      {
        q: "Can I sell a private podcast?",
        a: [
          "Yes, on the $29 plan. Under a paid product in your studio, choose \u201cSell this as a private podcast\u201d, then put out episodes as MP3 or M4A files. It can be sold once or as a membership, and goes on sale with its first episode.",
          "Each buyer gets a feed of their own, from the thanks page, their confirmation email or their list of purchases, and adds it to Apple Podcasts, Overcast, Pocket Casts or most other apps in one tap; new episodes arrive there like any show's. Spotify does not take private feeds. Every time the app reads the feed or fetches an episode, we check that the buyer still has it, so a refund or a membership that ends empties their feed within minutes. Podcast directories and search engines are told to keep out.",
        ],
      },
      {
        q: "Can I run a sale, like Black Friday?",
        a: [
          "Yes, on the $29 plan. In your studio, under \u201cA sale across the store\u201d, pick a percentage, when it starts and ends (at most 31 days), and whether it covers every product it can or only some. While it runs, your store and each product's page show the old price crossed out, the new one and when it ends, and Stripe takes it off at checkout with no code to type.",
          "It ends by itself at the time you set: the prices go back, and the discount stops working at Stripe too. It covers products bought once at one price. Memberships, calls, products with price options or a price the buyer chooses keep their price, and on a product with a payment plan the sale price is for paying in full, as its page says.",
        ],
      },
      {
        q: "Can my buyers give something as a gift?",
        a: [
          "Yes, on any paid product bought once that hands over a file, a link, a course or a bundle. Under the buy button on its page there is \u201cBuy it as a gift\u201d: the buyer types the recipient's email, their own name and a message, and pays on Stripe's page as for anything else, on your own Stripe account.",
          "The recipient gets one email with the buyer's name, the message and a link to open it. It is theirs on their own address, as if they had bought it: the download, the course with its modules opening from the day it was paid, the community it opens. The buyer gets the receipt and does not get a copy. A full refund takes the gift back within minutes.",
          "Memberships, calls, products with price options, a price the buyer chooses or licence keys cannot be given.",
        ],
      },
      {
        q: "Can I take a waitlist before something goes on sale?",
        a: [
          "Yes, on any paid product. In your studio, check \u201cComing soon, with a waitlist\u201d under the product: its card and its page then take an email address instead of a payment, and no checkout opens. Each address is confirmed from its own inbox before it counts, and the box to hear more from you starts empty.",
          "When it is ready, press \u201cPut it on sale and tell the waitlist\u201d. It goes on sale that moment, and everyone who confirmed gets one email with its link, its price and a note from you if you write one, with the postal address US law asks for at the foot. That is the only email a waitlist sends; afterwards its addresses are deleted, and whoever checked the box is on your list.",
          "You see how many are waiting and how many confirmed. The emails go out in batches every five minutes and do not count toward your monthly email allowance.",
        ],
      },
      {
        q: "Can I sell a membership?",
        a: [
          "Yes. Any product can charge on a schedule instead of once: daily, weekly, monthly or yearly. The subscription is created on your own Stripe account, like every other charge here, so the member is your customer, in your dashboard, and we take 0% of the renewals too.",
          "Members cancel on their own. Under every membership on your page there is a link: the member types the email they pay with, we send them a link, and it opens Stripe's own page for their membership, where they cancel it themselves. It ends at the end of the period they have paid for, and nobody has to write to you or wait for you. They can change their card and see their receipts there too.",
          "A membership can start with a free trial of 1 to 90 days: the card is taken when they join, nothing is charged until the trial ends, and your page and the buyer's confirmation say so. It can also run for a set number of payments, 2 to 36, and then end by itself; the member can still cancel before that.",
          "When a membership ends \u2014 canceled, or unpaid once Stripe has stopped retrying \u2014 its file, its course and your community close by themselves, and the member is shown a page that says so, with the way to join again. While Stripe is still retrying a failed payment, they keep access.",
          "Your studio's Membership numbers page shows your monthly recurring revenue, paying members and trials, churn over the last 30 days and the share of trials that became paying, overall and for each membership, read from your own Stripe account.",
          "Two things keep members, if you switch them on. A member who presses Cancel is offered a discount you choose, once, on Stripe's own page. And some days after a membership ends, somebody who agreed to hear from you gets one email with a discount to come back, and a link that opens your checkout with it applied; never somebody who already came back.",
          "One thing it cannot do, said plainly: if what you deliver is a link to somewhere else, that link keeps working, so remove the member's access wherever you actually keep it. Your Stripe dashboard is where you see who is still paying.",
        ],
      },
      {
        q: "Can I sell paid calls?",
        a: [
          "Yes. Any one-off product with a price can be sold as a call. You pick how long it lasts, your time zone and the hours you take calls on each day of the week, with up to two stretches a day. You also choose how much notice you need, how far ahead people can book, a gap between calls, and where the call happens: a Google Meet link made for each booking once you connect your Google Calendar, the meeting link you already use, or a private Jitsi Meet room made for each booking.",
          "A call can take one person at each time, or a group of up to 50. Or sell live sessions on dates you set instead of weekly hours: up to 50 dates on one product, each with 1 to 500 seats, its own length and its own link, with sales closing when you say, up to 72 hours before. Buyers see how many seats are left.",
          "The buyer sees the free times in their own time zone, picks one and pays on your own Stripe account. The time is held for them for about 30 minutes while they pay, so two people can never pay for the same time. Once it is paid, you both get an email with a calendar file, the call appears in your studio under Upcoming calls, and the buyer's thank-you page and list of purchases have the link to join.",
          "Every buyer gets a reminder a day before and an hour before, in their time zone, with the link to join; you get one for each time, listing everyone booked. A buyer can move their booking to another open time themselves, up to twice, from the link in their email, until the notice you set before the call.",
          "Your own calendars can close times too. Paste the private iCal address of up to three calendars \u2014 Google's secret address, an Outlook calendar published as ICS, an iCloud public calendar \u2014 and the times you are busy there, up to 120 days ahead, stop being offered, usually within about ten minutes. Only the busy times are kept, never a title or a guest. The other way round, your studio gives you a private calendar address that lists your upcoming bookings, for Google, Outlook or Apple Calendar to subscribe to.",
          "Google Meet links can be made for you. Connect your own Google Calendar in your studio under Video calls, then pick \u201cGoogle Meet (automatic)\u201d under \u201cWhere the call happens\u201d on a call, a group call or live sessions. Each booking then gets an event with a Google Meet link on your primary calendar, with the buyer on its guest list; a group call or a session has one event per time, with up to 200 guests who do not see one another. Google emails nobody: buyers get the link in our booking email, reminders and calendar file. A moved booking moves its event, and a full refund deletes a one-to-one call's event or takes the buyer off a group's guest list. Only the store's owner and Admins can connect or disconnect it, and the owner is emailed each time; disconnecting withdraws our access. Google has not finished reviewing our app yet, so it shows a \u201cGoogle hasn't verified this app\u201d screen when you connect: click Advanced, then continue. If a meeting cannot be made, the booking gets your own link or a private Jitsi Meet room, and we keep trying for about 16 hours; if it works more than two hours before the call, the new link is emailed to those booked, up to 20 (a bigger group keeps the link it has). On a free personal Google account, Google ends meetings of three or more people after 60 minutes.",
          "What it does not do, said plainly: apart from calls set to Google Meet, nothing is written into your calendar as an event: bookings arrive through the feed you subscribe to, which your calendar app refreshes on its own schedule, and busy times are read only from the private addresses you paste. And a buyer cannot cancel on their own: they reply to their confirmation email, which reaches you, and a refund is made from your own Stripe dashboard. Unlike on Stan, Zoom links are not made for you yet: our Zoom app is waiting for Zoom to approve it, and until then you type your own Zoom link. Jitsi Meet is a free service run by a third party, not by us; nobody needs an account to join, but the first person to open a room may be asked to sign in to Jitsi to start it, so open it a few minutes early. The call itself happens on that service; nothing is streamed or recorded here.",
        ],
      },
      {
        q: "Can I offer something extra, before or after they pay, or sell a limited number?",
        a: [
          "Yes, all three. Under any one-off product you can offer another of your products at a price of your own: the buyer sees a box above the buy button, checks it if they want it, and the button says the new total. It is never checked for them. Both are paid in one checkout and both are delivered on the thank-you page.",
          "Or offer it right after they pay: the thank-you page shows it, and one press charges the card they just used, on your own Stripe account. It only works in the browser that paid, for an hour, so a forwarded link can never charge anyone. If the bank wants the buyer to confirm, they confirm it, and nothing is handed over until the payment is through.",
          "After a product you can line up to five such offers, shown one at a time: a funnel. For each one you choose where yes leads and where no thanks leads, so a no can meet the same product for less. Each offer has its own headline, text, picture and price, never above what that product costs on its own, and each one taken gets its own confirmation email. Offers after paying are shown only to buyers who paid by card, Apple Pay or Google Pay, and while sales tax is on, they are paused. Before the checkout, a sales page or a landing page for something free can lead the way, but there is no editor that chains pages into one funnel.",
          "You can also limit how many of a product can be sold. Your page shows how many are left, counted from real payments, and stops selling at zero. A buyer who is paying right now holds one for about 30 minutes, so the last one is never sold to two people; if they do not pay, it comes back.",
        ],
      },
      {
        q: "Can I sell a bundle of products?",
        a: [
          "Yes, on every plan. Make a product the bundle, give it a price, and choose 2 to 20 of your one-off products to go in it: those with one price and a file, a link or a course with lessons. The buyer gets every one exactly as if bought on its own \u2014 its download or link, its course, its license key, its stamped PDF, its place on their list of purchases and the right to review it \u2014 and your community, if one of them opens it. Your store shows what the products cost on their own next to the bundle's price, worked out from their prices today, only when they really cost more.",
          "What a buyer gets is written onto their order when they pay, so changing the bundle later changes it for the next buyer and nobody loses what they paid for. A bundle can be offered in the box at checkout, and as an offer after paying unless it holds a course. Memberships, calls, free products, products with several prices or pay what you want, and other bundles cannot go in one, and a bundle itself has one price, charged once. Any product can also be unpublished and kept as a draft, and a draft can still go in a bundle.",
        ],
      },
      {
        q: "Can buyers pay in installments?",
        a: [
          "Yes. Under any one-off product with one price, offer a payment plan: two to twelve payments, weekly or monthly, of an amount you choose, adding up to at least the full price. The buyer picks between paying in full and the plan, and the button says what is charged today.",
          "They get the product after the first payment. The rest are charged to the same card on your own Stripe account, and the plan's end date is set as soon as the first payment is through \u2014 and checked again every day for anyone who paid and closed the page \u2014 so no buyer is ever charged one payment more than they agreed to. A plan is not a membership, so it is not canceled from your page; a buyer who needs to change something replies to their order confirmation email, which reaches you.",
        ],
      },
      {
        q: "Can the buyer choose the price?",
        a: [
          "Yes, on a product with one price, sold once. Your price becomes the minimum \u2014 at least $1, or the smallest price in your store's currency \u2014 and you add a suggested price, which is already in the box on Stripe's page. The buyer types what they want to pay, and Stripe refuses anything under the minimum.",
          "It does not mix with a membership, price options, a payment plan, the box at checkout, a call or discount codes: the buyer already names the price. A one-click offer after paying, a limited quantity, sales tax and a course all work with it.",
        ],
      },
      {
        q: "Can I ask buyers something before they pay?",
        a: [
          "Yes. Up to three questions on any paid product, shown on Stripe's page under the card: a short answer, a number, or a list to choose from. Each can be required or optional. The answers are in your list of sales and in your Stripe dashboard, and for a call they are in your booking email too.",
          "There is no phone-number or checkbox question, and nothing is asked for a free product, which never reaches Stripe.",
        ],
      },
      {
        q: "Does a buyer who leaves the checkout get a reminder?",
        a: [
          "If you switch it on, and only if they agreed. Stripe's checkout asks the buyer whether they want to hear from you; a buyer who said yes and left without paying gets one email about an hour later with a link back to the product. One per checkout, at most one per buyer and product in a week, and none to anyone who has paid for it since.",
          "It is off until you switch it on, needs your postal address, and needs a Stripe account in the United States, because Stripe asks for that consent only on checkouts of US businesses. While it is on, a checkout left open closes after an hour instead of Stripe's usual day. It is not sent for calls or live sessions.",
        ],
      },
      {
        q: "Is sales tax or VAT added?",
        a: [
          "If you switch it on. Stripe Tax works out sales tax or VAT from each buyer's address, for the places where you have told Stripe you are registered, and adds it at checkout, on your own Stripe account, for one-off sales, offers at checkout, payment plans, memberships and calls. You choose whether your prices already include it or it is added on top.",
          "It switches on once Stripe says your tax setup is complete: your head office address, what you sell, and where you are registered, all set in your own Stripe dashboard. You are the seller, so filing and paying the tax stays yours, with Stripe's reports of what was collected. Stripe charges for Stripe Tax on your account at its own published price. While tax is on, the one-click offer after paying is paused, because tax cannot be added to a one-click charge.",
        ],
      },
      {
        q: "Can I see how my store is doing?",
        a: [
          "Yes. Your studio shows the last 7, 30 or 90 days, or all time: visitors, page views, checkouts started, sales, revenue and conversion, where your visitors came from, and each product and link on its own line. Sales, visits day by day and sources each download as a CSV file; a sales file holds up to 5,000 sales and says so when there are more.",
          "Visits are counted without cookies. A visitor is one person on one device on one day, told apart by a one-way fingerprint that is never stored, and your own visits while logged in are not counted. Instagram and TikTok open links in their own browsers, which hide where a visit came from, so we read the app's name instead. To follow a link of your own, add ?utm_source= and a word to it, and its visits are counted under that word; utm_medium and utm_campaign are counted too.",
          "Sales are read from your own Stripe account, not counted by us: new purchases and new members, before Stripe's fee and any refund. Renewals are in your Stripe dashboard.",
        ],
      },
      {
        q: "Can I add my Meta, Google, TikTok or Pinterest pixel?",
        a: [
          "Yes, on the $29 plan. Paste the pixel ID in your studio and your store's pages tell that platform about every page view, every checkout started, every lead from a free product, and every purchase with its amount, so your ads can learn who buys.",
          "Those platforms set cookies, so visitors in the European Economic Area, the UK, Switzerland and Brazil, and anyone whose country we cannot tell, are asked first, in plain words, and nothing loads unless they say yes. Everywhere else the pixels load unless the visitor's browser sends Global Privacy Control. The ads and what they measure are yours: say in your own privacy notice that you use them.",
        ],
      },
      {
        q: "Can I sell a course?",
        a: [
          "Yes. Turn any paid product into a course from your studio and add modules and lessons. A lesson can have a video of up to 5 GB, text, up to five downloads and a link, and any lesson can be a free preview on your store. Upright phone videos stay upright.",
          "A module can open a set number of days after each student joins, and the student gets an email the day it does. Students open the course right away in the browser they paid in, and on any other device with a link sent to the address they paid with, so nobody makes a password. Your studio shows who opened it and how many lessons each marked done, and you can take a student off the course.",
          "Any lesson can end with a quiz: up to 20 questions, each with one right answer or several, a pass mark, a number of tries, and if you want, later lessons locked until it is passed. It is marked on our side, so the answers are not in the page. Switch certificates on and a student who finishes gets one in the name they type, with a page of its own on your store that anyone can open to check it; they print it or save it as a PDF from their browser.",
          "Under every lesson, students can ask questions and answer each other, under a name they choose; their email address is never shown, and only the course's students and you can read what they write. You answer as the creator from the lesson itself or from the course's page in your studio, the student gets an email with your answer, and your phone can tell you when a comment comes. You can hide or delete any comment, or switch comments off for the course without deleting them.",
          "The course can be sold once, in a payment plan, or as a membership that stays open while the member pays. Videos watched count toward your store's 200 GB a month, the same as downloads.",
        ],
      },
      {
        q: "Can I email the people on my list?",
        a: [
          "Yes, on Pro. From your studio you write one-off emails to everyone who agreed to hear from you, or only to those who got one product, and send them now or at a time you choose. Sequences go out by themselves: a welcome when someone joins, a few emails in the days after someone buys. Each person goes through a sequence once.",
          "Only people who agreed are ever written to: those who checked the box when they got something free or bought from you, and those you import, where you confirm each time that they agreed. Every email carries a one-click unsubscribe, why the reader is getting it and your postal address, which US law requires; anyone who leaves is never written to again, whatever a later import says.",
          "Emails go out under your name, and replies come to you. Pro sends up to 50,000 a month, one-off emails, sequences and community announcements together; during the free trial a store sends up to 1,000, and the full 50,000 opens with the first payment. Your list stays downloadable as a file at any time.",
          "Someone on your team with the Editor role can write drafts, up to 20 per store; you or an Admin read them and send them. And, if you switch it on, one email asks each buyer for a review, 3 to 30 days after buying, counted in the same monthly emails.",
        ],
      },
      {
        q: "Can I send my list to Mailchimp, Kit, beehiiv or MailerLite?",
        a: [
          "Yes, on every plan. Paste an API key from your account on the platform, pick the audience, form, publication or group, and choose who is sent: free sign-ups once they confirm, buyers of every product or of some, with up to three tags per product. Only people who agreed to hear from you are ever sent, and someone who unsubscribed on Mailchimp or beehiiv is never subscribed again.",
          "The key is checked, encrypted and kept; your studio shows only its last four characters, and disconnecting deletes it. What is sent is an email address, a first name when there is one, and the tags. One platform per store; it only adds people, reads nothing back, and does not send those who joined before you connected it, so download your list and import it for them. Stan's help center, read on September 28, 2026, connects Mailchimp, Flodesk and AWeber through Zapier; here Mailchimp, Kit, beehiiv and MailerLite are built in, with no Zapier.",
        ],
      },
      {
        q: "Can buyers leave reviews?",
        a: [
          "Yes, and only buyers can. A review is written from the thank-you page, the buyer's list of purchases or the one email that asks, and each of those first checks the order on your own Stripe account: paid, and not refunded in full. One review per buyer and product, 1 to 5 stars and up to 1,000 characters, under the name they choose or \u201cVerified buyer\u201d; their email is never shown.",
          "You can answer a review in public and hide one, but you cannot change a word of it or delete it. Hiding takes its words off the page but never its stars out of the average, and the page says how many are hidden. A refund in full takes its stars out. Booked calls and free products are not reviewed. On Stan, according to its help center, read on September 28, 2026, reviews are added by the creator, and customers cannot write one.",
        ],
      },
      {
        q: "Can I build a sales page or a landing page?",
        a: [
          "Yes, on every plan. Any product's own page can be built from up to 30 blocks: a hero with the product's picture or a video from YouTube, Vimeo or Loom, text, benefits, what is inside, about you, questions, your guarantee, buttons and reviews. It has its own title and description for search engines, and a share picture drawn from the product's picture, name, price and stars. For a free product the page asks for the email, and afterward can show one of your paid products next.",
          "Every block is plain text in your store's theme: no custom code or styles. A button leads to the checkout the store already has, so a page can never state a price of its own.",
        ],
      },
      {
        q: "Can I run a community or a webinar?",
        a: [
          "A community, yes, one per store. You choose which products open it: any paid product, a membership while it is being paid for, and free products if you want. Members come in with a link emailed to the address they bought with, and that browser stays in for 90 days. Who bought what is checked against your own Stripe account on every visit, so a membership that ends loses access within five minutes.",
          "Inside: up to 20 spaces, each open to the whole community or kept for the buyers of the products you choose; posts with a title, up to 5,000 characters and one picture, which can be edited after they are written; polls of up to 12 answers; comments and one level of replies; likes on posts and comments; and up to three pinned posts and a Start here post. Members mention each other with @, and are told when somebody mentions them, comments on their post or answers their comment, in the community and, if they allow it, as a notification on their computer or phone (on iPhone, once the page is added to the home screen, as Apple requires).",
          "There is a room for talking live, which you can slow down, keep for your own messages, or close. Members can write to you privately, and to each other if you allow it, with a first message that waits to be accepted if you choose. One search box looks through the posts and every comment under them, the lessons of the courses a member has, the events, the people in the directory, the room and the member's own messages.",
          "You can ask up to three questions every member answers once, before their first post or comment, and only you read the answers; and send a welcome message privately, from you, the first time each member comes in.",
          "Every like a member's post or comment gets from somebody else is one point, and points make 9 levels, shown beside every name, with a leaderboard for 7 days, 30 days and all time. You can open a space for posting only from a level, and have a level hand over one of your courses, free; it stays the member's if their points fall later.",
          "Members choose the name they are seen by and whether to appear in the directory; other members never see their email address. They can report a post or a comment, and you hide or delete it, mute a member or take them out. Your announcements can also go by email to members who asked for them, on Pro.",
          "It also holds live events members RSVP to, with reminders, a private video room in the event's page or your own link, and replays \u2014 the next answer has the details. A webinar you want to sell to anyone, not only to members, you sell as a live session on the dates you set, with up to 500 seats each.",
          "What it does not have: search does not listen to what is said inside a video, only to titles and written text. Stan adds webinars to its community with Zoom or Google Meet links made automatically; ours makes Google Meet links once you connect your Google Calendar, and no Zoom links yet.",
        ],
      },
      {
        q: "How do live events in the community work?",
        a: [
          "From the community in your studio you schedule an event: a title, a few words, a start in your time zone and a length from 15 minutes to four hours, up to a year ahead, with an announcement in the feed if you want one. Up to 50 can be coming up at once, and up to 500 are kept with their replays. Members RSVP with one click, and you can cap the places at anything from 1 to 5,000. An event can be for every member, or only for the buyers of some of the products that open the community; the others see it but cannot RSVP or join.",
          "The way in shows on the event's page from 15 minutes before the start until the end, only to members who may come \u2014 and, with a cap, only to those with a place \u2014 checked again on every visit. It is a private Jitsi Meet room made for the event, which members open inside the page or in a tab of its own, your own meeting link, or a Google Meet made on your connected Google Calendar: one meeting with nobody on its guest list, so members ask to join and you let them in. Emails, calendar files and the feed point to the page, never to the room. Members who asked for the community's emails get a reminder a day and an hour before; a move or a cancellation is emailed once to everyone coming; and, if you have turned on phone notifications, you get one 15 minutes before. After it starts you can add a replay from YouTube, Vimeo or Loom.",
          "What it does not do: unlike Stan's webinars, it does not make Zoom links for you yet. On a free personal Google account, Google ends meetings of three or more people after 60 minutes. Jitsi Meet is run by a third party, and the first person to open a room may be asked to sign in to Jitsi to start it, so open it a few minutes early. Jitsi publishes no size limit for its free rooms, and big video calls there get unsteady, so for more than a few dozen people use your own meeting link. Nothing is streamed or recorded here, there is no chat beside the room and no waiting list, and an event is not sold on its own: to sell seats, sell live sessions on dates.",
        ],
      },
      {
        q: "Can I run an affiliate program?",
        a: [
          "Yes. Switch it on, set a commission of 1% to 90% for the store or product by product, and a window of 1 to 90 days after a click. People apply on your store's affiliate page with an email address they confirm, and you approve them; or you let everyone who buys take their own link at once, from the thanks page or their purchase email, without applying. Each gets a link and a page of their own with their clicks, sales, what they earned and what you paid them; they never see who the buyers were. Up to 1,000 people, applications included.",
          "The part to know first: you pay your affiliates yourself. Every sale lands in full in your own Stripe account and we never hold any of it, so there is nothing for us to pay out from. Your studio shows who is owed what, lets you mark a payment with its date and reference, and downloads the lot as a CSV. On Stan, affiliates are paid out through Stan; here, you pay them.",
          "Commission is worked out on what was paid before tax, and a refund on your Stripe account cancels it or reduces it. One-off sales and booked calls earn commission; memberships and payment plans do not. The last affiliate link a buyer followed wins, and nobody earns on their own purchase.",
        ],
      },
      {
        q: "Can I connect Zapier, Make or my own server?",
        a: [
          "Yes, with webhooks. Add up to five https addresses in your studio and choose the events each one hears: a sale, a membership started or canceled, a lead confirmed for a free product, a call booked or moved, and a refund. Each message is JSON, signed with an HMAC-SHA256 in its Nimbus-Signature header, and tried again over about forty hours if the address does not answer. Your studio keeps a log of the last deliveries for up to a week, and a button sends a test.",
          "There is no Nimbus app in Zapier's directory: in Zapier, use Webhooks by Zapier with a Catch Hook. Events read from your Stripe account can take up to about five minutes to arrive.",
          "To read your store from your own tools instead — your list, your community's members, a course's students, your affiliates and your bookings — make an API key in your studio, on every plan. The API reads and changes nothing; the developers page lists every address and what it returns.",
        ],
      },
      {
        q: "Can I sell software with license keys?",
        a: [
          "Yes, on any paid one-off product that is not a membership, a call or a course. Upload the keys your own system made, up to 10,000 at a time, or have them made here in a shape you set. Each buyer gets one no one else has, on the thank-you page, in their email and in their list of purchases, and you are emailed when the pool runs low.",
          "Your software can ask a public address whether a key is valid, revoked or unknown; the answer says nothing about who bought it. There is no activation or seat counting: revoking a key is a record your software has to check.",
        ],
      },
      {
        q: "Can I put the buyer's email on a PDF?",
        a: [
          "Yes. Switch on stamping for a product, and every page of the PDF a buyer downloads carries one line along its foot with their email, the date and their order. It discourages sharing; it does not stop it, and it is not copy protection. PDFs up to 50 MB are stamped; a bigger one, or one locked with a password, is handed over as uploaded and your studio tells you. Say on the product that the buyer's email is printed on it.",
        ],
      },
      {
        q: "Does it work on a phone?",
        a: [
          "That is the case it is designed for. Your store installs to the home screen on both iPhone and Android as an app of its own, with its name, its icon and its color, straight from the browser, with no app store in between. It opens on your store, not on ours.",
          "Your studio installs the same way, and from it you can turn on notifications of every sale, booking, community report, affiliate application, live event about to start and comment under a lesson, on Android and on a computer, and on iPhone and iPad with iOS or iPadOS 16.4 or later once it is on the home screen. It is not an app from the App Store or Google Play; Stan has a native iPhone app, and we do not.",
        ],
      },
      {
        q: "Can I use my own domain?",
        a: [
          ...(isDomainsConfigured()
            ? [
                "Yes, on Pro. In your studio, type the domain you own — shop.yourname.com, or yourname.com — and we show you the two records to add where you bought it: one that sends visitors to your store, and a TXT record that proves the domain is yours, so no other store can use it. When they show up, your store opens on that domain, with its certificate handled for you. Your nimbuslabsai.com address keeps working too, and if Pro ends, visitors to the domain are sent there.",
              ]
            : ["Not yet. It is next on the list, on Pro, and this page will say so on the day it works."]),
        ],
      },
      {
        q: "Can I change my store address later?",
        a: [
          "Yes, whenever you want, from your studio. Nobody has to be asked and there is nothing to wait for.",
          "Your store does not move: same page, same name, same description, same products. Only the address changes.",
          "Every address your store holds keeps working and sends people to the current one, so the link already in your bio, in old posts and in messages other people sent still leads to you. A store holds up to ten addresses at once. When it is full, you can still go back to one you already had; for a new one, let an old one go first. An address you let go stops working at once, leads nowhere for 30 days, and after that anyone may take it, so only let go of one you are sure was never given to anyone.",
        ],
      },
    ],
  },
  {
    id: "delivery",
    emoji: "📦",
    title: "Files and delivery",
    blurb: "What happens in the seconds after someone pays.",
    tone: "bg-pink-brand/10",
    items: [
      {
        q: "How does the buyer get the file?",
        a: [
          "On the screen, immediately after Stripe confirms the payment. There is no waiting for an email to arrive before they can open what they bought.",
          "An email follows anyway: every buyer gets a confirmation from your store's name, with what they bought, what they paid and the way back to it, and replies reach you. It goes out once, even if the buyer closed the page before it loaded. A booked call gets its own confirmation instead, with the time and a calendar file.",
        ],
      },
      {
        q: "Does the download link expire?",
        a: [
          "Yes. The link on the thank-you page works for three days and is tied to that order, so a link that leaks does not turn into a free copy for everyone. A large file is fetched through a signed link that expires in minutes, and where a file is stored is never shown.",
          "A buyer who loses it does not lose what they paid for, a week or a year later. At the foot of every store page there is \u201cBought something here? Get it again\u201d: they type the address they paid with, and we email that address a link to a page with everything it bought from that store, up to the 40 most recent purchases \u2014 downloads, links and courses \u2014 ready to open again. No account, no password.",
          "The list is read from your own Stripe account each time it opens, so a sale you refunded in full, or a membership that has ended, is not on it, and its download stops working. The page answers the same whether or not the address bought anything, so nobody can use it to find out who your customers are.",
        ],
      },
      {
        q: "A buyer says the file never arrived. What now?",
        a: [
          "Send them to \u201cGet it again\u201d at the foot of your store page, at your store address followed by /orders \u2014 they type the address they paid with and a link to everything they bought arrives in their inbox. That answers most of these without you doing anything.",
          "If it still does not appear, check the payment in your own Stripe dashboard: a payment that did not complete is the most common cause. If Stripe shows the payment succeeded and the file still did not arrive, email us with the order details and we will look at it with you.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    emoji: "🔒",
    title: "Your data",
    blurb: "What we keep, and how to have it removed.",
    tone: "bg-amber-brand/12",
    items: [
      {
        q: "What do you store about me?",
        a: [
          "For your store: the email address that logs you in, the store you build, and the Stripe account ID you connect. If you ask a store for something free: your email address, what you asked for, and whether you checked the box to hear from that store \u2014 kept for that store and nobody else. If you join a store's community or its affiliate program: your email address, the name you chose and what you write or earn there, for that store. If you review something you bought: your stars, your words, the name you chose and the order they came from. If you RSVP to a community's live event: that you are coming, for that event. If a store brought you over from another platform: the products it gave you, kept against a one-way hash of your address. If you are on a store's team: your email address, your role and the changes you make there. For the creator research form (“Tell us what you sell”): what you typed in it and, if you checked the box, your email address. The privacy page lists it in full.",
        ],
      },
      {
        q: "How are my store and my buyers protected?",
        a: [
          "Sales are charged on Stripe's own checkout, on your own Stripe account, and what a buyer is charged is worked out on our server from what you saved. You sign in with a link sent to your email that works once and stops working after 15 minutes, or with a passkey if you add one. Each sign-in starts a fresh session, and \u201cLog out of all devices\u201d at the foot of your studio closes every session at once. When your Stripe account, your domain or your webhooks change, we email you saying what changed. What each role on your team may do is checked on our server for every request, the API key of an email platform you connect is stored encrypted, and reviews can be written only for orders your Stripe account says were paid.",
          "Store pages, on our address and on your own domain, the studio and signing in carry a strict Content-Security-Policy with a new nonce on every response, so text somebody typed cannot run as a script. Your ad pixels load only after consent where the law asks for it. Every request that changes something must come from this site, our cookies are HttpOnly and SameSite, and pages carry HSTS, nosniff, a referrer policy, Cross-Origin-Opener-Policy and a Permissions-Policy, and cannot be framed by other sites. Links we email point only at nimbuslabsai.com or your store's own domain.",
          "Files are handed over as downloads that cannot run anything in the browser. A full refund on your Stripe account closes what it paid for by itself: the download at once, the course within 10 minutes, the community within 5, and the license key within about 5; a partial refund keeps access. Checkouts are limited to 20 per 10 minutes per connection per store, and bookings and forms that send an email have limits too, so a script cannot sit on your limited stock or call times. Webhooks are signed, and calendar and webhook addresses cannot reach private networks.",
          "What it does not do: there is no two-factor sign-in, because there are no passwords, so keep your email inbox safe. On a payment plan only a refund in full of the first payment is detected, and a refunded membership closes when its subscription is canceled. If our database cannot be reached, the limits let requests through rather than stop a buyer from paying.",
        ],
      },
      {
        q: "Can I have it deleted?",
        a: [
          "Yes. Email us from the address you used and we remove what we hold about you. You do not have to give a reason.",
          "If you bought from a store or asked it for something free, that store's creator decides about its own records, and the payment itself stays in their Stripe account. Write to them first; if you write to us instead, we pass it on and tell you we did.",
        ],
      },
      {
        q: "Do you sell or share it?",
        a: [
          "We never sell it, to anyone, for any price.",
          "We share it only where running the product needs it: with Stripe for payments, with our host, database and email provider, with the store it belongs to, and with the services a creator connects. The privacy page lists each one and what it receives.",
        ],
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        {/*
          A help centre opens in daylight. Somebody who is here is stuck, and
          a dark, ceremonial banner is the wrong greeting for that; the search
          field is what they need, so it is the largest thing on the screen.
        */}
        <section className="surface-dawn border-b border-line">
          <div className="container-page py-14 sm:py-18">
            <p className="eyebrow">Help center</p>
            <h1 className="t-h1 mt-4">
              How can we <span className="serif font-normal text-violet-deep">help?</span>
            </h1>
            <p className="t-lead mt-5 max-w-2xl text-ink-soft">
              Every answer here is about the product as it is today. Where the answer is &ldquo;not yet,&rdquo; it says
              not yet.
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-mute">
              <Icon name="check" size={15} className="text-mint-deep" />
              Checked against the product on September 28, 2026.
            </p>
            <HelpSearch />
          </div>
        </section>

        <div className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <nav aria-label="Help sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">Sections</p>
            <ul className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
              {SECTIONS.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-[var(--r-md)] border border-line bg-white px-3 text-[0.9375rem] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink lg:border-transparent lg:bg-transparent lg:hover:bg-white"
                  >
                    <Icon name={iconFor(section.emoji)} size={18} className="text-violet-deep" />
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-16">
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} data-help-section className="reveal scroll-mt-24">
                <div className="flex items-start gap-4">
                  <span className="icon-tile">
                    <Icon name={iconFor(section.emoji)} size={22} />
                  </span>
                  <div>
                    <h2 className="t-h3 text-[1.6rem]">{section.title}</h2>
                    <p className="mt-1 text-ink-soft">{section.blurb}</p>
                  </div>
                </div>

                <div className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--r-lg)] border border-line bg-white">
                  {section.items.map((item) => (
                    <details key={item.q} id={answerId(item.q)} data-help-item className="group scroll-mt-24">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-5 font-semibold text-ink transition-colors hover:bg-paper sm:px-6 [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-soft transition-transform duration-300 group-open:rotate-45 group-open:border-violet-brand group-open:text-violet-deep">
                          <Icon name="plus" size={16} />
                        </span>
                      </summary>
                      <div className="space-y-3 px-5 pb-6 sm:px-6">
                        {item.a.map((paragraph) => (
                          <p key={paragraph} className="leading-relaxed text-ink-soft">
                            {paragraph}
                          </p>
                        ))}
                        <CopyLink id={answerId(item.q)} />
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}

            <section className="reveal card flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
              <div>
                <h2 className="t-h3 text-[1.6rem]">Still stuck?</h2>
                <p className="mt-2 max-w-md text-ink-soft">
                  Write to us. A person reads it, and you will get an answer even if the answer is that we have not built
                  that part yet.
                </p>
                <p className="mt-4 text-sm text-ink-mute">
                  Looking for the rules instead?{" "}
                  <Link href="/terms" className="link font-medium">
                    Terms
                  </Link>
                  ,{" "}
                  <Link href="/privacy" className="link font-medium">
                    Privacy
                  </Link>{" "}
                  and{" "}
                  <Link href="/refunds" className="link font-medium">
                    Refunds
                  </Link>
                  .
                </p>
              </div>
              <a href="mailto:support@nimbuslabsai.com" className="btn btn-primary shrink-0">
                <Icon name="mail" size={18} />
                Email support
              </a>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
