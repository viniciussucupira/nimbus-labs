import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { isDomainsConfigured } from "@/lib/domains";

export const metadata: Metadata = {
  title: "Terms of Service — Nimbus Labs",
  description:
    "Terms of Service for Nimbus Labs: the creator store at nimbuslabsai.com, what a creator is responsible for when they sell through it, and how payment works.",
};

export default function TermsPage() {
  const domains = isDomainsConfigured();
  return (
    <LegalPage title="Terms of Service" lastUpdated="September 22, 2026">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of the
        websites, products, and subscription services operated by Nimbus Labs
        (“Nimbus Labs,” “we,” “us,” or “our”). They cover this website and the
        Nimbus creator store (collectively, the “Services”).
      </p>
      <p>
        Nimbus Labs is an independent software studio. We sell software to
        customers worldwide. By creating an account, purchasing a subscription,
        or otherwise using the Services, you agree to these Terms. If you do
        not agree, do not use the Services.
      </p>

      <LegalSection title="1. Eligibility and accounts">
        <p>
          You must be at least 18 years old, or the age of majority in your
          jurisdiction, to use the Services. By using the Services, you confirm
          that you meet this requirement.
        </p>
        <p>
          You are responsible for providing accurate account information and for
          keeping your login credentials confidential. You are also responsible
          for all activity that occurs under your account. Notify us promptly at{" "}
          <a
            href="mailto:support@nimbuslabsai.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@nimbuslabsai.com
          </a>{" "}
          if you believe your account has been compromised.
        </p>
        <p>
          We may suspend or terminate accounts that violate these Terms or that
          we reasonably believe pose a risk to the Services, other users, or
          our operations.
        </p>
      </LegalSection>

      <LegalSection title="2. The Services">
        <p>
          <strong className="text-black">The Nimbus creator store.</strong> A
          hosted store page where a creator sells digital files, plans, and
          calls. The buyer pays into the creator&apos;s own connected Stripe
          account, and the file is delivered as soon as the payment clears.
          Nimbus Labs takes 0% of a creator&apos;s sales; what we charge a
          creator is a subscription for the store itself.
        </p>
        <p>
          Creator stores are open. Taking a store address, building the page and
          connecting a Stripe account are free. Taking a card on that page
          requires a paid subscription, which begins with a free trial of 14
          days and then renews every month or every year, whichever you chose,
          at the price shown on the home page until it is cancelled. The price
          and the payment provider are shown before any card is asked for, and
          these Terms apply to that subscription. We email you at least seven
          days before the first charge after the trial, and, on a yearly
          subscription, between 15 and 45 days before each renewal, with the
          date, the amount and how to cancel.
        </p>
        <p>
          We may update, improve, or discontinue features. When practical, we
          will provide reasonable notice of material changes. Except for a
          creator store used as described in section 3, the Services are
          provided for your personal or internal business use. You may not
          resell, sublicense, or offer the Services to third parties as your
          own product without our prior written permission.
        </p>
      </LegalSection>

      <LegalSection title="3. Selling through a Nimbus store">
        <p>
          This section applies if you use Nimbus to sell to your own buyers.
        </p>
        <p>
          <strong className="text-black">You are the seller.</strong> Each sale
          made through your store is a contract between you and your buyer.
          Nimbus Labs is not a party to it, is not the merchant of record for
          it, and does not sell your products to anyone.
        </p>
        <p>
          <strong className="text-black">The money is never ours.</strong>{" "}
          Payments are made into your own Stripe account through Stripe direct
          charges. We never hold, route, or take a cut of your sales revenue.
          Payouts follow the schedule and settings of your own Stripe account,
          and your relationship with Stripe is governed by your agreement with
          Stripe, not by these Terms.
        </p>
        <p>
          <strong className="text-black">What you are responsible for.</strong>{" "}
          The product you sell and its description and price; having the rights
          to everything you upload and sell; answering your own buyers;
          refunds, disputes, and chargebacks on your own sales; and any tax you
          owe on your sales, including sales tax, VAT, or GST where it applies
          to you.
        </p>
        <p>
          <strong className="text-black">What you may not sell.</strong>{" "}
          Anything unlawful; anything that infringes someone else&apos;s rights;
          sexual content; anything that misleads your buyer about what they are
          paying for; and anything that falls under the list of restricted
          businesses published by Stripe, since your payments run through
          Stripe.
        </p>
        <p>
          We may remove a product or suspend a store that breaks this section.
          Doing so does not affect the money already in your own Stripe
          account.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            use the Services for unlawful, harmful, fraudulent, or abusive
            purposes;
          </li>
          <li>
            attempt to reverse engineer, disrupt, overload, or interfere with
            the Services;
          </li>
          <li>
            submit content that infringes another person’s rights or that
            contains malware;
          </li>
          <li>
            circumvent usage limits, payment requirements, or security
            measures; or
          </li>
          <li>
            upload or sell anything you do not have the right to distribute.
          </li>
        </ul>
        <p>
          If you email your list through the Services, you also agree to write
          only to people who agreed to hear from you; never to import an
          address that was bought, rented, borrowed or collected without that
          agreement; to give a true postal address where you can be reached,
          which we print at the foot of each email; to write subject lines that
          are not misleading; and to follow the laws on commercial email that
          apply to you and to your readers, including the CAN-SPAM Act in the
          United States. Every email carries an unsubscribe link we honor for
          good, and you may not ask anyone to do more than press it.
        </p>
        <p>
          We may investigate suspected violations and take action, including
          pausing a send, switching off email for a store, or suspension or
          termination of your account.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions and payment">
        <p>
          A creator store subscription will be offered at whatever price is
          shown at checkout, and these Terms will apply to it. The sales a
          creator makes are not ours: they run through that creator&apos;s own
          Stripe account, as described in section 3.
        </p>
        <p>
          Payment is processed by third-party payment providers. We do not
          store full payment card numbers. Prices are in United States dollars
          unless otherwise stated. You are responsible for any applicable
          taxes.
        </p>
        <p>
          We may change subscription prices. If we do, we will provide notice
          before the new price applies to a future billing period. The new
          price will not apply to a period you have already paid for.
        </p>
        <p>
          There are two plans. Nimbus Labs, at $29 a month or $300 a year,
          includes everything to sell. Nimbus Labs Pro, at $99 a month or $948
          a year, adds email to your list{domains ? " and your store on a domain you own" : ""},
          with up to 50,000 emails a month,
          counted together for one-off emails and sequences; during the free
          trial a store may send up to 1,000 emails a month, and the full
          number opens with the first payment. What is not sent in a month does
          not carry over. Emails a month cannot cover wait for the next one.
        </p>
        {domains ? (
          <p>
            A domain you add stays yours: you keep it where you bought it and
            keep its settings. While your store is on Pro it opens your store;
            when Pro ends, its visitors are sent to your nimbuslabsai.com
            address, and you can take the domain off at any time.
          </p>
        ) : null}
        <p>
          You may switch between monthly and yearly billing, and between the
          two plans, from your studio.
          A switch that costs more is charged when you make it, less the unused
          part of the period you already paid for. A switch that costs less
          leaves the unused part as credit on your account, applied to your
          next charges until it is used up. Credit is not paid out in cash,
          except where a refund applies under our Refund Policy.
        </p>
      </LegalSection>

      <LegalSection title="6. Cancellation">
        <p>
          You may cancel your subscription at any time, for any reason. After
          you cancel, you will not be charged for future billing periods. You
          will retain access until the end of the period you have already paid
          for, unless a refund applies under our Refund Policy.
        </p>
      </LegalSection>

      <LegalSection title="7. Refunds">
        <p>
          Refunds of what you pay <em>us</em> are governed by our{" "}
          <Link
            href="/refunds"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            Refund Policy
          </Link>
          . In summary, you may request a full refund within 14 days of a
          charge.
        </p>
        <p>
          A refund on something you bought from a creator&apos;s store is a
          matter between you and that creator, who received your money in their
          own Stripe account and sets their own refund terms.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          Nimbus Labs and its licensors own all rights in the Services,
          including the software, branding, design, and documentation. These
          Terms do not grant you any right to use our name, logos, or
          trademarks except as needed to identify the Services.
        </p>
        <p>
          You retain ownership of what you submit to the Services (“User
          Content”) — the files, images, text and descriptions you upload to
          your store. You grant Nimbus Labs a limited license to host, store
          and deliver User Content solely to provide the Services: to show your
          store page to the people you send there, and to hand a file to the
          buyer who paid you for it. We do not use your files or your store&apos;s
          text to train anything, and we do not sell or licence them to anyone.
        </p>
        <p>
          That licence lasts as long as you keep the content on Nimbus. Remove a
          product, or close your store, and it ends for the content you removed.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of warranties">
        <p>
          THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT. We do not warrant that the Services will be
          uninterrupted, secure, or error-free.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NIMBUS LABS AND
          ITS OWNERS, OFFICERS, AND CONTRACTORS WILL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
          ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE
          SERVICES.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE
          SERVICES WILL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE THREE (3)
          MONTHS BEFORE THE CLAIM AROSE, OR US$50, WHICHEVER IS GREATER. Money
          a buyer paid into a creator&apos;s own Stripe account was never paid
          to us and is not part of that amount.
        </p>
        <p>
          Some jurisdictions do not allow certain limitations. In those cases,
          our liability is limited to the maximum extent permitted by law.
          Nothing in these Terms limits liability that cannot be limited under
          applicable mandatory law, including liability for fraud or willful
          misconduct.
        </p>
      </LegalSection>

      <LegalSection title="11. Indemnification">
        <p>
          You agree to indemnify and hold Nimbus Labs harmless from claims
          arising out of your User Content, the products you sell through a
          Nimbus store, your use of the Services, or your violation of these
          Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="12. Termination">
        <p>
          We may suspend or terminate your access if you breach these Terms, if
          required by law, or if we discontinue the Services. Upon termination,
          your right to use the Services ends. Sections that by their nature
          should survive — including intellectual property, disclaimers,
          limitation of liability, and governing law — will survive.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to these Terms">
        <p>
          We may update these Terms from time to time. The effective date at
          the top of this page will be revised when we do. Material changes
          will be posted on this page. Continued use of the Services after
          changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="14. Governing law">
        <p>
          These Terms are governed by the laws of the Federative Republic of
          Brazil, without regard to conflict-of-law rules. Courts located in
          Brazil will have exclusive jurisdiction, except that you may have
          additional mandatory consumer rights in your country of residence.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact">
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
