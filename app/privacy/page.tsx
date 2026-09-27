import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Nimbus Labs",
  description:
    "How Nimbus Labs collects, uses, and protects personal information — including the data of buyers in a creator's store, and your GDPR rights.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="September 26, 2026">
      <p>
        Nimbus Labs (“Nimbus Labs,” “we,” “us,” or “our”) is an independent
        software studio. This Privacy Policy explains how we collect, use,
        share, and protect personal information when you use our websites and
        products — the Nimbus creator store at nimbuslabsai.com (the
        “Services”).
      </p>
      <p>
        If you have questions about this policy or about your personal data,
        contact us at{" "}
        <a
          href="mailto:support@nimbuslabsai.com"
          className="text-black underline underline-offset-2 hover:no-underline"
        >
          support@nimbuslabsai.com
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
          <strong className="text-black">What a creator puts in a store.</strong>{" "}
          If you run a Nimbus store, we host what you put in it: your store
          name and description, your photo if you add one, the theme and colour
          you choose, your product titles, prices and descriptions, the links
          you put on the page, and the files you upload for delivery to your
          buyers. Your photo is shrunk on your own device before it is sent, is
          shown publicly on your store page and in previews of links to it, and
          is deleted from our storage when you remove or replace it.
        </p>
        <p>
          <strong className="text-black">Buyer information.</strong> When
          someone buys from a creator&apos;s store, we handle the buyer&apos;s
          email address and the details of that order — what was bought, when,
          for how much, and whether the file was delivered — so the sale can be
          completed and the creator can see it. The card details are handled by
          Stripe and never reach us. That buyer information belongs to the
          creator, not to us, and section 4 explains what that means.
        </p>
        <p>
          <strong className="text-black">A confirmation of each purchase.</strong>{" "}
          After a buyer pays, we email them one confirmation on the
          creator&apos;s behalf, under the store&apos;s name, with what they
          bought and how to get back to it; replies go to the creator. What it
          says is read from the payment on the creator&apos;s Stripe account.
          We keep only a mark that it was sent, tied to that checkout, for 40
          days, so it is never sent twice. If a creator asks buyers questions
          at checkout, the answers are kept with the payment on the
          creator&apos;s own Stripe account, shown to the creator, and for a
          booked call included in the creator&apos;s booking email.
        </p>
        <p>
          <strong className="text-black">A reminder after an unpaid checkout.</strong>{" "}
          Only on stores whose creator switched it on, and only for a buyer who
          agreed on Stripe&apos;s own checkout page to hear from that creator:
          if they leave without paying, we email them once, on the
          creator&apos;s behalf, with a link back to the product. Stripe keeps
          the address and the answer on the creator&apos;s account. We keep a
          mark that the reminder for that checkout was handled, for two weeks;
          a one-way hash of the address and the product for a week, so nobody
          gets two reminders about the same thing; and the link in the reminder
          that stops them, tied to the address and the store, for 400 days.
          Pressing it keeps a one-way hash of the address for that store for
          good, so that store never sends them a reminder again.
        </p>
        <p>
          <strong className="text-black">Managing a membership.</strong> When
          a member asks for a link to manage or cancel their membership, we use
          the email address they type to look for their membership on the
          creator&apos;s own Stripe account and, if there is one, to email them
          the link. We keep a record that ties that link to their Stripe
          customer for one hour, and nothing else; the page says the same thing
          whether or not a membership was found.
        </p>
        <p>
          <strong className="text-black">Getting a purchase again.</strong>{" "}
          When a buyer asks a store for what they bought, we use the email
          address they type to look for their paid purchases on the
          creator&apos;s own Stripe account and, if there are any, to email them
          a link to a page that lists them. We keep a record that ties that link
          to the address for 24 hours, and nothing else; the list itself is read
          from Stripe each time the page opens, and the page says the same thing
          whether or not a purchase was found.
        </p>
        <p>
          <strong className="text-black">Counting visits to a store.</strong>{" "}
          When a creator&apos;s store page is opened, the page tells us so,
          with the site that sent the visitor or the campaign word in the link.
          To count people rather than page loads we make a one-way fingerprint
          of the day, the store, the visitor&apos;s network address and browser,
          and add it to a counter that keeps only an estimate of how many
          different fingerprints it has seen. The fingerprint and the address
          are not stored, no cookie is set, and the daily counts are kept for
          about thirteen months, with a running all-time total of the same
          counts for as long as the store exists. The creator sees totals,
          never a person.
        </p>
        <p id="ads">
          <strong className="text-black">
            Ad measurement a creator switches on.
          </strong>{" "}
          A creator can add their own Meta, Google, TikTok or Pinterest pixel to
          their store. When they do, and only once it is allowed, those pages
          load that platform&apos;s script, which sets its own cookies and tells
          the platform about page views, checkouts started, requests for free
          products and purchases with their amount, on the creator&apos;s behalf
          and under that platform&apos;s own privacy policy. Visitors in the
          European Economic Area, the United Kingdom, Switzerland and Brazil are
          asked first and nothing loads unless they agree; everywhere else the
          pixels load unless the browser sends Global Privacy Control. The
          choice is kept on the visitor&apos;s device for that store, and a link
          at the foot of its pages changes it.
        </p>
        <p>
          <strong className="text-black">Booking a call.</strong> When someone
          books a paid call, we use the time they picked, their time zone and
          the email address on their Stripe receipt to hold that time while they
          pay, to write the booking down, and to send one confirmation to them
          and one to the creator. So that each can answer the other, the
          buyer&apos;s confirmation has the creator&apos;s email address as the
          address replies go to, and the creator&apos;s has the buyer&apos;s.
          While they pay, a cookie in the buyer&apos;s browser names the
          checkout they opened, for 31 minutes, so that going back to pick
          another time lets go of the first one. Each booking is reminded to
          the buyer, and to the creator, a day and an hour before, from a queue
          that names the booking and its time. If the buyer moves the booking
          to another time from the link in their email, we keep the new time
          and how many times it was moved, tied to that checkout, for 200
          days. The same kind of cookie, for
          the same 31 minutes, is set when someone starts to buy a product sold
          in a limited number, so that pressing buy again hands back the one
          they were holding.
        </p>
        <p>
          <strong className="text-black">Payment plans and sales tax.</strong>{" "}
          When a buyer chooses a payment plan, Stripe keeps their card on the
          creator&apos;s account for the remaining payments, and we keep the
          checkout on a list until the plan has been given its end date, so it
          stops after the last payment. When a creator switches on sales tax,
          Stripe asks the buyer for the address it needs to work the tax out,
          under Stripe&apos;s own privacy policy; we do not keep it.
        </p>
        <p>
          <strong className="text-black">Courses.</strong>{" "}
          When someone buys a course, we note the email address they paid with
          and when, so the course opens for them and modules that open over
          time open on the right day. The browser that paid keeps a cookie for
          a day so the course can open straight away, and any browser let into
          a course keeps a cookie for 90 days so the student does not have to
          ask again. For each student we keep when they joined, when they last
          opened the course and which lessons they marked done; the creator
          sees this in their studio, and we email the student when a module
          opens for them. A student taken off a course by its creator is kept
          on a list so the course stays closed to them. To check who bought a
          course, we ask the creator&apos;s own Stripe account by email address.
        </p>
        <p>
          <strong className="text-black">A one-click offer after paying.</strong>{" "}
          When a product is followed by a one-click offer, Stripe keeps the
          buyer&apos;s card on the creator&apos;s account for payments the buyer
          makes while present, and a cookie in the buyer&apos;s browser, for two
          hours, lets only that browser take the offer. We keep a record of
          whether the offer was taken, tied to that order, for eight days.
        </p>
        <p>
          <strong className="text-black">
            Free copies, and a creator&apos;s list.
          </strong>{" "}
          When you ask a creator&apos;s store for something they give away for
          free, we collect your email address, what you asked for, when, and
          whether you ticked the box saying you want to hear from that creator.
          The box starts empty. We send you one email, with the link to what
          you asked for, and nothing else. When you use that link, your address
          is added to that creator&apos;s list, marked with your choice, and
          the creator can download the list. If you never use the link, the
          request is deleted after 7 days and your address is not added to
          anything. To limit abuse, we also keep a one-way hash of your email
          address, and of your IP address, for one hour.
        </p>
        <p>
          <strong className="text-black">Emails from a creator.</strong> A
          creator on the Pro plan can email the people on their list who agreed
          to hear from them: those who ticked the box when they got something
          free or bought, and those the creator imports after confirming that
          each of them agreed. We send those emails on the creator&apos;s
          behalf, under the creator&apos;s name, through our email provider.
          For each one we use your address, the email the creator wrote and a
          random code for your unsubscribe link. We do not put tracking pixels
          or tracked links in them. When you unsubscribe — one press, from the
          link or your mail app&apos;s own button — we record it and when, and
          you are not written to by that creator again unless you tick their
          box again yourself.
        </p>
        <p id="community">
          <strong className="text-black">A creator&apos;s community.</strong>{" "}
          When a creator opens a community on their store, we decide who may
          come in by looking up the email address a person types on the
          creator&apos;s own Stripe account, or on that creator&apos;s list for
          something free, and we email that address a link that works for one
          hour. Using it sets a cookie for that store in their browser for 90
          days, the same one a course uses. For each member we keep their email
          address, the name they choose to be seen by, whether they chose to be
          listed in the member directory and to be emailed announcements, when
          they joined and were last there, and whether the creator muted or
          removed them. We keep what members write: posts, comments, the
          pictures they add, likes, and reports of a post or comment. Posts,
          comments, pictures and likes are seen by the other members and by the
          creator. The directory shows only the chosen name, and only of those
          who asked to be listed. A member&apos;s email address is seen by the
          creator and never by other members. What is written is kept while
          the community exists, until its author or the creator deletes it;
          deleting a post deletes its comments, likes, reports and picture.
          Who reported something is kept for 90 days, so each member&apos;s
          report counts once. The answer about whether someone may come in is
          kept for up to five minutes, a record of each announcement emailed
          and who it went to for up to 60 days, the code in a member&apos;s
          unsubscribe link with their member record, and, to limit abuse, one-way hashes
          of the address and network address that asked for a link for one
          hour.
        </p>
        <p id="affiliates">
          <strong className="text-black">
            A creator&apos;s affiliate programme.
          </strong>{" "}
          When someone follows an affiliate&apos;s link to a store, a cookie
          named <code>nl_via_</code> followed by the store&apos;s address holds
          the affiliate&apos;s code and the time of the click, for up to 90
          days; a purchase counts for the affiliate only within the window the
          creator set. To count a click once per visitor per day we keep a
          one-way hash of the visitor&apos;s network address and browser for
          two days. When a purchase counts, we note which product, when, what
          was paid before tax and in all, and the share it earns, and never
          the buyer&apos;s name or email address. When someone applies to be an
          affiliate, we keep their email address, the note they wrote, their
          code, when they applied and what the creator decided, their clicks
          and sales, and the payments the creator records to them with the
          date and reference the creator types. An affiliate who signs in to
          their page keeps a cookie named <code>nl_aff_</code> followed by the
          store&apos;s address, for 30 days. The creator sees all of this; an
          affiliate sees only their own figures. It is kept with the
          store&apos;s records. We never hold or pay out an affiliate&apos;s
          money: the creator pays them.
        </p>
        <p id="calendars">
          <strong className="text-black">Calendars a creator connects.</strong>{" "}
          A creator can give us the private iCal address of up to three of
          their own calendars. We store the address, never show it again once
          saved, and use it only to read when they are busy; we keep only the
          busy times, never a title, guest or place, and each reading for up to
          six hours. The calendar&apos;s provider sees our request for it. A
          creator also gets a private address of their own that lists their
          upcoming calls and sessions with the name and email address of each
          buyer, for the calendar app they subscribe with; replacing that
          address turns the old one off.
        </p>
        <p id="webhooks">
          <strong className="text-black">Webhooks a creator adds.</strong> A
          creator can give us up to five web addresses of their own, such as a
          Zapier or Make hook. When a sale, a change to a membership, a
          confirmed request for something free, a booking, a moved booking or a
          refund happens in their store, we send that address a message with
          its details, which can include the buyer&apos;s name and email
          address, the product and the amount. What happens to it there is the
          creator&apos;s choice and responsibility. We keep each address and its
          signing secret until the creator removes it, a mark of each event
          sent for 30 days so it is never sent twice, and each delivery, with
          the answer the address gave, for up to seven days.
        </p>
        <p id="licence-keys">
          <strong className="text-black">Licence keys.</strong> When a creator
          sells a product with licence keys, we keep each key with the sale it
          went to, when, and the buyer&apos;s email address, so the buyer can
          see it again and the creator can see who has it, and whether the
          creator revoked it. Anyone can ask whether a key is valid; the answer
          says nothing about who bought it. Keys are kept with the
          store&apos;s records.
        </p>
        <p id="quizzes">
          <strong className="text-black">
            Course quizzes and certificates.
          </strong>{" "}
          For each student and quiz we keep how many tries they used, their
          last answers, their best mark and whether they passed, with their
          course progress. A certificate keeps the name exactly as the student
          typed it, the course title, the creator&apos;s name, the
          student&apos;s email address and when it was issued or withdrawn.
          Its page shows the name, the course, the creator and the date to
          anyone who has its address, is kept out of search engines, and never
          shows the email address. Certificates are kept for good, so the page
          goes on proving what it says; a withdrawn one says it was withdrawn.
          A student who wants theirs withdrawn asks the creator.
        </p>
        <p id="stamping">
          <strong className="text-black">Stamped PDFs.</strong> When a creator
          switches on stamping for a product, every page of the PDF a buyer
          downloads carries the buyer&apos;s email address, the date and the
          end of the order number. The stamped copy is made by our own code, is
          kept privately beside the creator&apos;s file so a later download
          gets the same copy, and is deleted with that file; a note of which
          copy belongs to which sale is kept for about 400 days. Anyone the
          buyer passes the file to can read that line.
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
        <p>
          <strong className="text-black">Research outreach.</strong> If we
          contacted you first to ask about your experience as a creator, we
          used business contact details you had made public: your name, your
          business email address or social media profile, your store or
          profile link and, for UK companies, the public Companies House
          register. We use them only to send that research message and to
          continue the conversation if you reply. Our legal basis is our
          legitimate interest in understanding what creators need before we
          build a product. You can object at any time by replying
          &quot;stop&quot; or by emailing us, and we will not contact you
          again.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use information">
        <p>We use personal information to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>create and manage your account;</li>
          <li>
            process subscriptions, renewals, cancellations, and refunds, and
            email you before a charge you might not expect: the first one after
            your free trial, and each renewal of a yearly subscription;
          </li>
          <li>
            provide the Services: host your store page, keep the files you sell
            where only you can reach them, and hand a file to a buyer who paid
            you for it;
          </li>
          <li>
            send you a free copy you asked a creator&apos;s store for and, once
            you use the link we sent, add your address to that creator&apos;s
            list with the choice you made;
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
            <strong className="text-black">Stripe</strong>, when you buy from a
            creator&apos;s store, because the payment is made into that
            creator&apos;s own Stripe account and Stripe processes the card
            details directly;
          </li>
          <li>
            <strong className="text-black">
              The creator you bought from or asked for something free
            </strong>
            , who receives your email address and the details of your order or
            request, including whether you agreed to hear from them, because it
            is their store;
          </li>
          <li>
            <strong className="text-black">
              The other members of a community you join
            </strong>
            , who see what you post there and the name you chose, never your
            email address;
          </li>
          <li>
            <strong className="text-black">
              The addresses a creator connects
            </strong>
            : a creator&apos;s webhook addresses receive the details of events
            in their store, which can include your name and email address as a
            buyer, and the calendar app a creator subscribes with reads their
            bookings, with each buyer&apos;s name and email address. Affiliates
            never receive buyers&apos; names or email addresses;
          </li>
          <li>
            <strong className="text-black">Vercel</strong>, our host, which
            serves the site and, when a creator adds their own domain, receives
            that domain&apos;s name to check its records and issue its
            certificate;
          </li>
          <li>
            <strong className="text-black">Resend</strong>, our email
            provider, which delivers the emails we send: login links,
            receipts and the links to what you asked for, the links that let
            members, students and affiliates in, and the emails a creator sends
            to their list or their community;
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

      <LegalSection title="4. If you buy from a creator’s store">
        <p>
          The store belongs to the creator, not to us. For the personal data of
          that store&apos;s buyers, and of the people who ask it for something
          free, the creator is the controller and Nimbus
          Labs is their processor: we handle that data to run the store on
          their behalf and on their instructions, and we do not use it for our
          own purposes, do not sell it, and do not email a creator&apos;s
          buyers or list to market anything of ours.
        </p>
        <p>
          The same is true for the members of a creator&apos;s community, the
          people who apply to their affiliate programme, and their
          students&apos; quiz answers and certificates: the creator is the
          controller, and we handle that data on their behalf.
        </p>
        <p>
          In practice this means a request about your data as a buyer — a copy
          of it, a correction, a deletion — is answered by the creator you
          bought from. Write to them first. If you write to us instead, we will
          pass it on and tell you we did.
        </p>
        <p>
          Two things stay ours in that situation: the security of the systems
          the data sits in, and the legal obligations we have to keep records
          of our own, such as fraud prevention and anything the law requires us
          to retain.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p>We may use cookies and similar technologies to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>keep you logged in;</li>
          <li>remember preferences;</li>
          <li>understand how the site is used; and</li>
          <li>maintain security.</li>
        </ul>
        <p>
          Besides the short-lived cookies described in section 1, a
          creator&apos;s store may set these, each for that store alone: a pass
          that lets a
          browser into a course or a community, named <code>nl_learn_</code>{" "}
          followed by a code for the store, for 90 days; the code and time of
          an affiliate link a visitor followed, named <code>nl_via_</code>{" "}
          followed by the store&apos;s address, for up to 90 days; and an
          affiliate&apos;s own sign-in, named <code>nl_aff_</code> followed by
          the store&apos;s address, for 30 days. The ad pixels a creator may
          add are described in section 1 and are asked for first where the law
          says so.
        </p>
        <p>
          You can control cookies through your browser settings. Disabling
          certain cookies may affect logging in or other features. Where required
          by law, we will request consent for non-essential cookies.
        </p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          Account and billing records are kept for as long as your account is
          active and as needed for tax, accounting, and legal purposes. Support
          emails are retained as long as
          needed to resolve your request and maintain a reasonable business
          record.
        </p>
        <p>
          A creator&apos;s list is kept for as long as their store exists, or
          until the creator, or the person on it, asks us to remove an address.
          A request for a free copy whose link is never used is deleted after
          7 days. An address that unsubscribed from a creator stays on that
          list, marked as unsubscribed, so it is never written to again; if you
          ask for it to be deleted entirely instead, it is.
        </p>
        <p>
          A community&apos;s posts, comments, pictures and member records are
          kept while the community exists, until the author or the creator
          deletes them. An affiliate programme&apos;s records, licence keys and
          the list of who holds them are kept with the store&apos;s records.
          Certificates are kept for good, so their pages keep proving what
          they say. Webhook deliveries are kept for up to seven days, and the
          mark that an event was sent for 30 days. A calendar reading is kept
          for up to six hours, and the calendar address until the creator
          removes it.
        </p>
        <p>
          Creator research answers are kept for up to 24 months from the date
          you sent them, or until you ask us to delete them, whichever comes
          first. They are stored with our database provider (Upstash) on
          infrastructure used by our hosting provider (Vercel).
        </p>
        <p>
          Research outreach records (who we contacted, when, and any reply) are
          kept for up to 24 months from the last contact. If you ask us to
          stop, we keep only your name and contact detail on a do-not-contact
          list, so that we can respect your request.
        </p>
      </LegalSection>

      <LegalSection title="7. International transfers">
        <p>
          Nimbus Labs serves customers internationally. Your information may
          be processed in the countries where we and our service providers
          operate, which include the United States and may include the
          European Union. Where required, we use appropriate
          safeguards for cross-border transfers. Our database provider,
          Upstash, stores creator research answers under its Data Processing
          Agreement, which includes the EU Standard Contractual Clauses, the UK
          Addendum and the EU-U.S. Data Privacy Framework.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights, including under the GDPR">
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
            href="mailto:support@nimbuslabsai.com"
            className="text-black underline underline-offset-2 hover:no-underline"
          >
            support@nimbuslabsai.com
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

      <LegalSection title="9. Children’s privacy">
        <p>
          The Services are not directed to children under 18. We do not
          knowingly collect personal information from children. If you believe
          a child has provided us with personal data, contact us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          We use reasonable technical and organizational measures to protect
          personal information. No method of transmission or storage is
          completely secure. You are responsible for keeping your account
          credentials confidential.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Privacy Policy from time to time. The “Last
          updated” date at the top of this page will change when we do. We encourage you
          to review this page periodically.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
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
