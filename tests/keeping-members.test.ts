/**
 * Keeping the members a creator already has: the ones who choose to leave, and
 * the ones who leave without choosing.
 *
 * Measured before it was built (30 September 2026): of Stan, Skool, Circle,
 * Whop, Kajabi and Gumroad, none makes an offer in the cancel flow. And a
 * member whose card expires is retried against the dead card by Stripe and
 * then cut off, unless the creator dug out a setting in their own Stripe
 * dashboard to have them emailed.
 *
 * The rules checked here are the ones that keep this honest:
 *
 *   - an offer is made only where it can be honoured exactly as worded;
 *   - a setting that lost its coupon reads as off, never as a button that
 *     fails for the member pressing it;
 *   - the failed-payment email says what happened, what to do, and what
 *     happens if they do nothing — and never threatens.
 */
import { NO_SAVE, canOffer, parseSaveOffer, saveOn, saveWords } from "@/lib/save-offer";
import { failedPaymentEmail } from "@/lib/payment-recovery";
import { done, is, part } from "./check";

part("What is kept of an offer, and what reads as off");
is("nothing stored is off", parseSaveOffer(null), NO_SAVE);
is("a real offer is kept", parseSaveOffer({ percent: 25, months: 2, coupon: "co_ABC123" }), { percent: 25, months: 2, coupon: "co_ABC123" });
// The case that matters: without its coupon, an "on" setting would put a
// Cancel button in front of a member that fails when pressed.
is("an offer that lost its coupon is off", parseSaveOffer({ percent: 25, months: 2, coupon: "" }), NO_SAVE);
is("a percentage nobody can pick is off", parseSaveOffer({ percent: 37, months: 1, coupon: "co_ABC123" }), NO_SAVE);
is("a length past three payments is read as one", parseSaveOffer({ percent: 25, months: 12, coupon: "co_ABC123" }).months, 1);
is("a coupon id with anything odd in it is not trusted", parseSaveOffer({ percent: 25, months: 1, coupon: "co ABC;DROP" }), NO_SAVE);
is("on, with a coupon", saveOn({ save: { percent: 25, months: 1, coupon: "co_ABC123" } }), true);
is("off without one", saveOn({ save: NO_SAVE }), false);

part("An offer is made only where it can be honoured");
// One payment: a coupon applied once, to the next invoice whenever it comes —
// true on every membership.
is("one payment, monthly", canOffer({ months: 1 }, "month", 1), true);
is("one payment, yearly", canOffer({ months: 1 }, "year", 1), true);
is("one payment, weekly", canOffer({ months: 1 }, "week", 1), true);
// Several payments: a repeating coupon counts MONTHS. Only on a monthly
// membership are months and payments the same thing.
is("two payments, monthly", canOffer({ months: 2 }, "month", 1), true);
// On a yearly membership the next payment can be ten months off, so a
// two-month coupon lapses before it touches anything. Offering it would tell
// the member "25% off" and give them nothing.
is("two payments, yearly: not made", canOffer({ months: 2 }, "year", 1), false);
// On a weekly one it would cover eight or nine payments where two were promised.
is("two payments, weekly: not made", canOffer({ months: 2 }, "week", 1), false);
// Every three months is not "monthly" either: two months of coupon may cover
// one payment or none.
is("two payments, every 3 months: not made", canOffer({ months: 2 }, "month", 3), false);

part("How the creator reads it");
is("one", saveWords({ percent: 25, months: 1 }), "25% off the next payment");
is("several", saveWords({ percent: 50, months: 3 }), "50% off the next 3 payments");

part("The email to a member whose renewal failed");
const base = {
  nextTry: "October 3" as string | null,
  storeName: "Harbor Kitchen",
  amount: "$29",
  payUrl: "https://invoice.stripe.com/i/acct_x/test_abc",
  manageUrl: "https://marktmorgen.com/@harbor/manage",
};
const member = failedPaymentEmail({ ...base, title: "The Inner Circle Membership", isPlan: false });
is("the subject says what happened, from whom", member.subject, "Your payment to Harbor Kitchen didn't go through");
// The first draft read "your The Inner Circle Membership membership".
is(
  "any product name reads right",
  member.text.includes("The latest payment of $29 for The Inner Circle Membership didn't go through."),
  true,
);
is("the link that pays it is in it", member.text.includes(base.payUrl), true);
is("it says the card is kept for next time", member.text.includes("used for your next payments too"), true);
is("it says exactly when the card is tried again", member.text.includes("the card on file is tried again on October 3"), true);
is("a member keeps access meanwhile, and is told so", member.text.includes("your access stays on in the meantime"), true);
// When the creator's Stripe has retries off, "it will be tried again" would be
// a false comfort: the member does nothing, waiting for a retry that never
// comes, and is cut off.
const noRetry = failedPaymentEmail({ ...base, nextTry: null, title: "The Inner Circle", isPlan: false });
is("with no retry scheduled, it does not promise one", noRetry.text.includes("tried again on"), false);
is("and says plainly that none is coming", noRetry.text.includes("won't be tried again"), true);
is("and it offers the way out", member.text.includes("To cancel instead"), true);

const unknown = failedPaymentEmail({ ...base, title: null, isPlan: false });
// The first draft read "your your membership".
is("no product name still reads right", unknown.text.includes("The latest payment of $29 to Harbor Kitchen didn't go through."), true);

const plan = failedPaymentEmail({ ...base, title: "Pricing Course", isPlan: true });
// A payment plan pays for something already handed over: there is no access
// to keep on or off, and nothing to "cancel instead".
is("a payment plan makes no promise about access", plan.text.includes("access"), false);
is("and does not offer to cancel it", plan.text.includes("cancel"), false);

// Nothing in either that reads as a threat. A creator's members are the
// people who pay them, not debtors.
for (const [name, mail] of [["member", member], ["plan", plan]] as const) {
  const lower = mail.text.toLowerCase();
  is(`the ${name} email threatens nothing`, ["collection", "suspend", "terminate", "legal", "overdue", "final notice", "immediately"].filter((w) => lower.includes(w)), []);
}

done();
