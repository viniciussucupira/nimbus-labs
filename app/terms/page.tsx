import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Nimbus Labs",
  description:
    "Terms of Service for Nimbus Labs: the creator store at nimbuslabsai.com, what a creator is responsible for when they sell through it, and the Retone subscription.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="September 18, 2026">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of the
        websites, products, and subscription services operated by Nimbus Labs
        (“Nimbus Labs,” “we,” “us,” or “our”). They cover this website and the
        Nimbus creator store, and they also cover Retone (available at{" "}
        <a
          href="https://retoneai.net"
          className="text-black underline underline-offset-2 hover:no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          retoneai.net
        </a>
        ) and any other software we may offer (collectively, the “Services”).
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
            href="mailto:viniciussucupira091@gmail.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            viniciussucupira091@gmail.com
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
          Creator stores are not open to the public yet. What this website
          offers today is a working demo store and an early access list. When
          stores open, the subscription price and the payment provider will be
          shown before you are asked to pay, and these Terms will apply to that
          subscription.
        </p>
        <p>
          <strong className="text-black">Retone.</strong> A separate product
          that rewrites text using artificial intelligence, including changes
          to tone, style, and length. It is sold at retoneai.net as a
          subscription of US$14 per month or as a one-time purchase of US$49,
          unless a different price is shown at checkout.
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
            use the Services to generate content that is illegal or that you do
            not have the right to process.
          </li>
        </ul>
        <p>
          We may investigate suspected violations and take action, including
          suspension or termination of your account.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions and payment">
        <p>
          Retone is offered as a monthly subscription of US$14 per month, which
          renews automatically until you cancel, and as a one-time purchase of
          US$49, which does not renew. Unless otherwise stated at checkout,
          those are the prices that apply.
        </p>
        <p>
          Retone is sold through Paddle, which acts as our Merchant of Record
          for that product. Paddle is the legal seller of Retone and is
          responsible for processing your payment and handling refunds for it,
          and those transactions are governed by Paddle&apos;s terms as well as
          our own. Paddle is not involved in a Nimbus creator store: the sales
          a creator makes run through that creator&apos;s own Stripe account,
          as described in section 3.
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
          Content”) — the text you send to be rewritten, and the files, images,
          and descriptions you upload to your store. You grant Nimbus Labs a
          limited license to host, process, and deliver User Content solely to
          provide the Services: to send text to an AI API and return the
          result to you, and to store your store&apos;s files and hand them to
          the buyer you sold them to.
        </p>
        <p>
          You may use output generated for you for your lawful purposes. You
          are responsible for reviewing that output before you rely on it or
          publish it.
        </p>
      </LegalSection>

      <LegalSection title="9. AI-generated output">
        <p>
          Some of the Services use third-party artificial intelligence models.
          Output may be inaccurate, incomplete, or unsuitable for your purpose.
          We do not guarantee that output is unique, error-free, or free of
          third-party rights. You are solely responsible for how you use the
          output.
        </p>
      </LegalSection>

      <LegalSection title="10. Disclaimer of warranties">
        <p>
          THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT. We do not warrant that the Services will be
          uninterrupted, secure, or error-free.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitation of liability">
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

      <LegalSection title="12. Indemnification">
        <p>
          You agree to indemnify and hold Nimbus Labs harmless from claims
          arising out of your User Content, the products you sell through a
          Nimbus store, your use of the Services, or your violation of these
          Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="13. Termination">
        <p>
          We may suspend or terminate your access if you breach these Terms, if
          required by law, or if we discontinue the Services. Upon termination,
          your right to use the Services ends. Sections that by their nature
          should survive — including intellectual property, disclaimers,
          limitation of liability, and governing law — will survive.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to these Terms">
        <p>
          We may update these Terms from time to time. The effective date at
          the top of this page will be revised when we do. Material changes
          will be posted on this page. Continued use of the Services after
          changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="15. Governing law">
        <p>
          These Terms are governed by the laws of the Federative Republic of
          Brazil, without regard to conflict-of-law rules. Courts located in
          Brazil will have exclusive jurisdiction, except that you may have
          additional mandatory consumer rights in your country of residence.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact">
        <p>
          Nimbus Labs
          <br />
          Email:{" "}
          <a
            href="mailto:viniciussucupira091@gmail.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            viniciussucupira091@gmail.com
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
