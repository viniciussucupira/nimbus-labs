import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Nimbus Labs",
  description:
    "Terms of Service for Nimbus Labs products, including the Retone subscription.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of the
        websites, products, and subscription services operated by Nimbus Labs
        (“Nimbus Labs,” “we,” “us,” or “our”), including Retone (available at{" "}
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
        Nimbus Labs is an independent software studio based in Brazil. We sell
        software-as-a-service (SaaS) subscriptions to customers worldwide. By
        creating an account, purchasing a subscription, or otherwise using the
        Services, you agree to these Terms. If you do not agree, do not use the
        Services.
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
          Retone is a SaaS product that lets you rewrite text using artificial
          intelligence, including changes to tone, style, and length. Our first
          paid product is a monthly Retone subscription priced at US$8 per
          month, unless a different price is shown at checkout.
        </p>
        <p>
          We may update, improve, or discontinue features. When practical, we
          will provide reasonable notice of material changes. The Services are
          provided for your personal or internal business use. You may not
          resell, sublicense, or offer the Services to third parties as your
          own product without our prior written permission.
        </p>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
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

      <LegalSection title="4. Subscriptions and payment">
        <p>
          Retone is offered as a monthly subscription. Unless otherwise stated
          at checkout, the price is US$8 per month. Subscriptions renew
          automatically each month until you cancel.
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

      <LegalSection title="5. Cancellation">
        <p>
          You may cancel your subscription at any time, for any reason. After
          you cancel, you will not be charged for future billing periods. You
          will retain access until the end of the period you have already paid
          for, unless a refund applies under our Refund Policy.
        </p>
      </LegalSection>

      <p>
        Merchant of Record: Nimbus Labs uses Paddle as our Merchant of Record.
        Paddle is the legal seller of our services and is responsible for
        processing your payment, providing customer support, and handling
        refunds. All transactions are governed by Paddle&apos;s terms as well
        as our own.
      </p>

      <LegalSection title="6. Refunds">
        <p>
          Refunds are governed by our{" "}
          <Link
            href="/refunds"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            Refund Policy
          </Link>
          . In summary, you may request a full refund within 14 days of a
          charge.
        </p>
      </LegalSection>

      <LegalSection title="7. Intellectual property">
        <p>
          Nimbus Labs and its licensors own all rights in the Services,
          including the software, branding, design, and documentation. These
          Terms do not grant you any right to use our name, logos, or
          trademarks except as needed to identify the Services.
        </p>
        <p>
          You retain ownership of the text you submit to the Services (“User
          Content”). You grant Nimbus Labs a limited license to process User
          Content solely to provide the Services — for example, to send it to
          an AI API for rewriting and return the result to you.
        </p>
        <p>
          You may use output generated for you for your lawful purposes. You
          are responsible for reviewing that output before you rely on it or
          publish it.
        </p>
      </LegalSection>

      <LegalSection title="8. AI-generated output">
        <p>
          The Services use third-party artificial intelligence models. Output
          may be inaccurate, incomplete, or unsuitable for your purpose. We do
          not guarantee that output is unique, error-free, or free of
          third-party rights. You are solely responsible for how you use the
          output.
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
          MONTHS BEFORE THE CLAIM AROSE, OR US$24, WHICHEVER IS GREATER.
        </p>
        <p>
          Some jurisdictions do not allow certain limitations. In those cases,
          our liability is limited to the maximum extent permitted by law.
          Nothing in these Terms limits liability that cannot be limited under
          Brazilian law or other applicable mandatory law, including liability
          for fraud or willful misconduct.
        </p>
      </LegalSection>

      <LegalSection title="11. Indemnification">
        <p>
          You agree to indemnify and hold Nimbus Labs harmless from claims
          arising out of your User Content, your use of the Services, or your
          violation of these Terms or applicable law.
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
