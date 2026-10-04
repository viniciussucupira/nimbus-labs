/**
 * The questions answered on the home page, and their answers.
 *
 * They live here rather than beside the component that draws them because the
 * page writes them down twice: once for a reader, once in the form a search
 * engine reads. One list, so the two can never say different things.
 */
import { PRICE_CENTS, REFUND_DAYS, TRIAL_DAYS } from "@/lib/plan";
import { paypalSalesConfigured } from "@/lib/paypal-sales";

export const HOME_QUESTIONS = [
  {
    q: "Can I sign up and start selling today?",
    a: `Yes. You take your store address, connect your own Stripe account and put up what you sell; a buyer can pay for it on your account, with nothing taken on top. The address, the page, the editor and connecting Stripe cost nothing. The $${PRICE_CENTS / 100} subscription switches on your checkout — selling, and giving things away for an email address — and its first ${TRIAL_DAYS} days are free. Your card is taken when the trial starts and first charged when it ends, so you can make a sale before you decide, and canceling inside the trial means it is never charged. The trial is for your first store; a second store is paid from day one. After that, every charge is covered by a ${REFUND_DAYS}-day money-back guarantee: ask inside ${REFUND_DAYS} days of any charge, for any reason or none, and it comes back in full.`,
  },
  {
    q: "Who holds the money from my sales?",
    a: "You do. Payments go to your own Stripe account through direct charges, so payouts follow your Stripe settings and we never sit between you and your buyer's money. We charge a monthly subscription and take 0% of your sales.",
  },
  {
    q: "What happens to my payments and customer data if I leave?",
    a: "Your Stripe account, its customers and its payout history stay with you, because they were never held by us: every charge was made on your account. Your email list, your buyers and your product list download as files at any time. What does not travel is what runs here — your store page, your course pages and the links that deliver your files — so buyers would need somewhere new to collect what they bought. A shutdown would come with notice in writing."
  },
  {
    q: "What does Stan have that Marktmorgen does not, yet?",
    a: `Among other things: automatic Instagram replies, ${paypalSalesConfigured() ? "" : "PayPal at checkout, "}an iPhone app from the App Store, Zoom links made for each booking and webinar, affiliate payouts that need no PayPal account of your own, and stores with no limit on products, where ours hold 2,000. What we have in their place: a studio that installs from the browser with notifications, Google Meet links made on your own Google Calendar, a private Jitsi Meet room for each booking and each live event, and an affiliate program whose payouts leave your own PayPal, in one press or on payday by itself. Each gap is listed by name on the feature-by-feature page, with where we stand on it, and nothing is advertised here before it exists.`,
  },
  {
    q: "Who is behind this?",
    a: "A small independent studio, working in public. Support is in English, in writing, and a person answers it.",
  },
];
