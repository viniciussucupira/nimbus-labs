import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { REFUND_DAYS, TRIAL_DAYS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Refund Policy — Marktmorgen",
  description:
    `Cancel anytime. Every charge refunded in full on request within ${REFUND_DAYS} days of it.`,
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" lastUpdated="October 6, 2026">
      <p>
        This Refund Policy applies to what you pay Marktmorgen, a product of
        Solrenning, an independent software studio, for the creator store at
        marktmorgen.com: the monthly
        or yearly subscription, on any plan, at the price shown at
        checkout.
      </p>
      <p>
        It does not cover something you bought from a creator&apos;s store.
        That money went straight into that creator&apos;s own Stripe account
        and never passed through us, so the refund is theirs to give. Section 6
        says what to do.
      </p>

      <LegalSection id="cancel" title="1. Cancel anytime">
        <p>
          You may cancel your subscription at any time, for any reason, with no
          questions asked. After you cancel, you will not be charged for future
          billing periods. You will keep access until the end of the period you
          have already paid for, unless you also request a refund as described
          below.
        </p>
        <p>
          To cancel, open your studio and choose &ldquo;Cancel the
          subscription&rdquo; under &ldquo;What you pay us,&rdquo; then
          &ldquo;Yes, cancel it.&rdquo; You can also
          ask us by email, as described in section 3.
        </p>
      </LegalSection>

      <LegalSection id="guarantee" title={`2. ${REFUND_DAYS}-day money-back guarantee`}>
        <p>
          If you request a refund within thirty ({REFUND_DAYS}) days of a
          charge, we will refund that charge in full. No reason is required
          and none will be asked for.
        </p>
        <p>
          This applies to every charge, not only your first: the initial
          subscription payment, later renewal charges on any plan, monthly
          or yearly, and a charge made when you switch plans or switch between
          monthly and yearly billing. Each charge has its own {REFUND_DAYS}{" "}
          days, counted from the day that charge was made.
        </p>
        <p>
          It is separate from, and comes after, the free trial. The first{" "}
          {TRIAL_DAYS} days of your first store cost nothing and are never
          charged if you cancel inside them; this guarantee covers what
          happens once you have actually been charged.
        </p>
        <p>
          A refund closes the paid features of the store it was for — your
          checkout, and on Pro the email sending — from the day it is made.
          Everything you built stays where it is, and your own Stripe account,
          its customers and its payout history are untouched: that money was
          never ours to return.
        </p>
      </LegalSection>

      <LegalSection title="3. How to request a cancellation or refund">
        <p>
          Email{" "}
          <a
            href="mailto:support@marktmorgen.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@marktmorgen.com
          </a>{" "}
          from the email address associated with your account. Please include:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>the email on the account;</li>
          <li>whether you want to cancel, request a refund, or both; and</li>
          <li>the date of the charge, if you are requesting a refund.</li>
        </ul>
        <p>
          We will confirm by email once your cancellation, refund, or both
          have been processed. Refunds are returned to the original payment method and
          may take several business days to appear, depending on your bank or
          card issuer.
        </p>
      </LegalSection>

      <LegalSection title={`4. After ${REFUND_DAYS} days`}>
        <p>
          Refunds are not available for requests made more than {REFUND_DAYS}{" "}
          days after a charge, except where applicable consumer law requires
          them. You may still cancel at any time to stop future charges, and
          the charge after this one has a fresh {REFUND_DAYS} days of its own.
        </p>
      </LegalSection>

      <LegalSection title="5. Chargebacks">
        <p>
          If you have a billing issue, please contact us first so we can help.
          Unwarranted chargebacks may result in account suspension.
        </p>
      </LegalSection>

      <LegalSection title="6. If you bought from a creator’s store">
        <p>
          Write to the creator you bought from: reply to the confirmation email
          the store sent you after you paid, and your reply reaches them. Their
          store is theirs: they
          set the terms of the sale, they received the money in their own
          Stripe account, and they are the only one who can return it.
        </p>
        <p>
          If you cannot reach them, write to us at{" "}
          <a
            href="mailto:support@marktmorgen.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@marktmorgen.com
          </a>{" "}
          with your order confirmation email. We cannot move money we never held, but we can
          pass your message to the creator and tell you what we did.
        </p>
      </LegalSection>

      <LegalSection title="7. Changes">
        <p>
          We may update this Refund Policy. The &ldquo;Last updated&rdquo; date at
          the top of this page will change when we do. The policy in effect at the
          time of a charge will apply to that charge.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact">
        <p>
          Marktmorgen
          <br />
          Email:{" "}
          <a
            href="mailto:support@marktmorgen.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@marktmorgen.com
          </a>
          <br />
          Website:{" "}
          <a
            href="https://marktmorgen.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            marktmorgen.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
