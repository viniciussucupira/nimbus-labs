/**
 * The questions answered on the home page, and their answers.
 *
 * They live here rather than beside the component that draws them because the
 * page writes them down twice: once for a reader, once in the form a search
 * engine reads. One list, so the two can never say different things.
 */
import { PRICE_CENTS, TRIAL_DAYS } from "@/lib/plan";

export const HOME_QUESTIONS = [
  {
    q: "Can I sign up and start selling today?",
    a: `Yes. You take your store address, connect your own Stripe account and put up what you sell; a buyer can pay for it on your account, with nothing taken on top. The address, the page, the editor and connecting Stripe cost nothing. The $${PRICE_CENTS / 100} subscription switches on the till — selling, and giving things away for an email address — and its first ${TRIAL_DAYS} days are free, so you can make a sale before you decide.`,
  },
  {
    q: "Who holds the money from my sales?",
    a: "You do. Payments go to your own Stripe account through direct charges, so payouts follow your Stripe settings and we never sit between you and your buyer's money. We charge a monthly subscription and take 0% of your sales.",
  },
  {
    q: "What happens if Nimbus Labs disappears?",
    a: "Your Stripe account, your customers and your payouts stay yours, because they were never held by us. Your email list downloads as a file at any time, and a shutdown would come with notice in writing.",
  },
  {
    q: "What does Stan have that Nimbus does not, yet?",
    a: "Among other things: automatic Instagram replies, communities, funnels and paying affiliates. Every one is listed by name on the feature-by-feature page, with where we stand on it, and nothing is advertised here before it exists.",
  },
  {
    q: "Who is behind this?",
    a: "Vinicius Sucupira, an independent builder working in public. Support is in English, in writing, and a person answers it.",
  },
];
