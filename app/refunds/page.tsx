import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy — Nimbus Labs",
  description:
    "Cancel anytime. Full refund if requested within 14 days of a charge.",
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" lastUpdated="September 28, 2026">
      <p>
        This Refund Policy applies to what you pay Nimbus Labs, an independent
        software studio, for the creator store at nimbuslabsai.com: the monthly
        or yearly subscription, on either plan, at the price shown at
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

      <LegalSection title="2. 14-day full refund">
        <p>
          If you request a refund within fourteen (14) days of a charge, we
          will refund that charge in full. This applies to the initial
          subscription payment, to later renewal charges, monthly or yearly,
          and to a charge made when you switch plans or between monthly and
          yearly billing, provided the request is made within 14 days of the
          specific charge.
        </p>
      </LegalSection>

      <LegalSection title="3. How to request a cancellation or refund">
        <p>
          Email{" "}
          <a
            href="mailto:support@nimbuslabsai.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@nimbuslabsai.com
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

      <LegalSection title="4. After 14 days">
        <p>
          Refunds are not available for requests made more than 14 days after
          a charge, except where applicable consumer law requires them. You may still cancel at any time to stop
          future charges.
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
            href="mailto:support@nimbuslabsai.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@nimbuslabsai.com
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
          Nimbus Labs
          <br />
          Email:{" "}
          <a
            href="mailto:support@nimbuslabsai.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@nimbuslabsai.com
          </a>
          <br />
          Website:{" "}
          <a
            href="https://nimbuslabsai.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            nimbuslabsai.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
