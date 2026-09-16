import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Nimbus Labs",
  description:
    "How Nimbus Labs collects, uses, and protects personal information, including GDPR rights.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="September 16, 2026">
      <p>
        Merchant of Record: Nimbus Labs uses Paddle as our Merchant of Record.
        Paddle is the legal seller of our services and is responsible for
        processing your payment, providing customer support, and handling
        refunds. All transactions are governed by Paddle&apos;s terms as well
        as our own.
      </p>
      <p>
        Nimbus Labs (“Nimbus Labs,” “we,” “us,” or “our”) is an independent
        software studio based in Brazil. This Privacy Policy explains how we
        collect, use, share, and protect personal information when you use our
        websites and subscription products, including Retone (
        <a
          href="https://retoneai.net"
          className="text-black underline underline-offset-2 hover:no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          retoneai.net
        </a>
        ) (the “Services”).
      </p>
      <p>
        If you have questions about this policy or about your personal data,
        contact us at{" "}
        <a
          href="mailto:viniciussucupira091@gmail.com"
          className="text-black underline underline-offset-2 hover:no-underline"
        >
          viniciussucupira091@gmail.com
        </a>
        .
      </p>

      <LegalSection title="1. Information we collect">
        <p>We collect the following categories of information:</p>
        <p>
          <strong className="text-black">Account information.</strong> When you
          create an account or subscribe, we collect your email address and any
          other information you choose to provide (such as your name, if
          requested at checkout).
        </p>
        <p>
          <strong className="text-black">Payment information.</strong> Payments
          are processed by third-party payment processors. We do not store your
          full credit or debit card number, CVC, or equivalent payment
          credentials. Our processors may collect billing name, address, and
          payment method details as needed to complete the transaction. We may
          receive limited payment metadata, such as the last four digits of a
          card, payment status, and subscription period.
        </p>
        <p>
          <strong className="text-black">Text submitted for rewriting.</strong>{" "}
          If you use Retone, you may submit text to be rewritten. That text is
          sent to third-party AI application programming interfaces (APIs)
          solely to generate a rewritten result and return it to you. We do not
          store the text you submit for rewriting, and we do not use it to
          train our own models.
        </p>
        <p>
          <strong className="text-black">Usage and technical data.</strong> We
          may collect information such as IP address, browser type, device
          type, pages visited, referring URL, and approximate location derived
          from IP address. This helps us operate, secure, and improve the
          Services.
        </p>
        <p>
          <strong className="text-black">Communications.</strong> If you email
          us, we keep the content of that correspondence and your contact
          details so we can respond.
        </p>
        <p>
          <strong className="text-black">Creator research answers.</strong> If
          you fill in the form at{" "}
          <Link
            href="/creators"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            nimbuslabsai.com/creators
          </Link>
          , we collect your name, email address, country, the platform where
          you sell, the store or profile link you choose to share, your
          answers, the date you sent them, and the consent choices you ticked.
          To limit abuse, we also keep a one-way hash of your IP address for
          one hour; we do not store the IP address itself with your answers.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use information">
        <p>We use personal information to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>create and manage your account;</li>
          <li>process subscriptions, renewals, cancellations, and refunds;</li>
          <li>
            provide the Services, including sending your text to AI APIs to
            generate output;
          </li>
          <li>
            communicate with you about your account, billing, and service
            updates;
          </li>
          <li>
            detect, prevent, and investigate fraud, abuse, and security
            incidents;
          </li>
          <li>comply with legal obligations;</li>
          <li>improve the reliability and quality of the Services; and</li>
          <li>
            if you answered our creator research, read your answers to decide
            what to build next and, only if you ticked the matching optional
            box, email you follow-up questions about your answers or tell you
            when we launch a product for creators. Each of these is a separate
            choice, and we contact you only by email.
          </li>
        </ul>
        <p>
          Where the GDPR or similar laws apply, we process personal data on the
          following legal bases: performance of a contract (providing the
          subscription), legitimate interests (security, service improvement,
          and necessary communications), consent (where we ask for it, such as
          optional cookies and the creator research form), and legal
          obligation. You can withdraw consent at any time by emailing us;
          this does not affect processing that happened before you withdrew
          it.
        </p>
      </LegalSection>

      <LegalSection title="3. How we share information">
        <p>We do not sell your personal information.</p>
        <p>We share information only with:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-black">Payment processors</strong>, to
            charge your subscription and handle refunds;
          </li>
          <li>
            <strong className="text-black">AI API providers</strong>, to
            process text you submit for rewriting (this content is not stored
            by us);
          </li>
          <li>
            <strong className="text-black">
              Hosting, analytics, and infrastructure providers
            </strong>
            , to operate our websites and Services; and
          </li>
          <li>
            <strong className="text-black">
              Professional advisors or authorities
            </strong>
            , when required by law or to protect our rights.
          </li>
        </ul>
        <p>
          These providers are permitted to use the information only to perform
          services for us or as required by law.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies">
        <p>We may use cookies and similar technologies to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>keep you signed in;</li>
          <li>remember preferences;</li>
          <li>understand how the site is used; and</li>
          <li>maintain security.</li>
        </ul>
        <p>
          You can control cookies through your browser settings. Disabling
          certain cookies may affect sign-in or other features. Where required
          by law, we will request consent for non-essential cookies.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>
          Account and billing records are kept for as long as your account is
          active and as needed for tax, accounting, and legal purposes. Text
          submitted to Retone for rewriting is processed in transit via API and
          is not stored by Nimbus Labs. Support emails are retained as long as
          needed to resolve your request and maintain a reasonable business
          record.
        </p>
        <p>
          Creator research answers are kept for up to 24 months from the date
          you sent them, or until you ask us to delete them, whichever comes
          first. They are stored with our database provider (Upstash) on
          infrastructure used by our hosting provider (Vercel).
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Nimbus Labs is based in Brazil and serves customers internationally.
          Your information may be processed in Brazil and in other countries
          where our service providers operate, which may include the United
          States or the European Union. Where required, we use appropriate
          safeguards for cross-border transfers. Our database provider,
          Upstash, stores creator research answers under its Data Processing
          Agreement, which includes the EU Standard Contractual Clauses, the UK
          Addendum and the EU-U.S. Data Privacy Framework.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights, including under the GDPR">
        <p>
          Depending on your location, you may have the right to access the
          personal data we hold about you; correct inaccurate data; delete your
          data; restrict or object to certain processing; receive a copy of
          your data in a portable format; and withdraw consent where processing
          is based on consent.
        </p>
        <p>
          If you are in the European Economic Area, the United Kingdom, or
          another jurisdiction with similar laws — including under the General
          Data Protection Regulation (GDPR) — you may exercise these rights by
          emailing{" "}
          <a
            href="mailto:viniciussucupira091@gmail.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            viniciussucupira091@gmail.com
          </a>
          . We will respond within the time required by applicable law,
          typically one month under the GDPR. You also have the right to lodge
          a complaint with your local data protection authority.
        </p>
        <p>
          You may cancel your account and subscription at any time. Cancellation
          and refunds are described in our{" "}
          <Link
            href="/refunds"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            Refund Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Children’s privacy">
        <p>
          The Services are not directed to children under 18. We do not
          knowingly collect personal information from children. If you believe
          a child has provided us with personal data, contact us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use reasonable technical and organizational measures to protect
          personal information. No method of transmission or storage is
          completely secure. You are responsible for keeping your account
          credentials confidential.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          We may update this Privacy Policy from time to time. The “Last
          updated” date at the top of this page will change when we do. We encourage you
          to review this page periodically.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
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
