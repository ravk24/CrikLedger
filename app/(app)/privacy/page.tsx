import { PolicyPage } from "@/components/legal/PolicyPage";
import Link from "next/link";

export const metadata = { title: "Privacy policy · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
//
// Two claims from the source draft are STILL deliberately not published
// here — they remain in Project Details/cric_ledger/03-privacy-policy.md,
// so re-syncing from that doc must not pull them in. They are not true of
// the software today, and a policy page is a promise:
//   - "you can delete your account from within the application" — there is
//     no delete-account route or UI; the email path below is the real one.
//   - "the database is backed up automatically every day at ~3:00 AM" — the
//     nightly workflow has never run (see memory.md open items). The
//     security list below states only what is demonstrably true.
//
// The "no third-party analytics" claim below IS true: posthog-js was
// removed from the app when Razorpay was dropped. Re-adding any analytics
// SDK means rewriting that section in the same commit.
export default function Privacy() {
  return (
    <PolicyPage title="Privacy policy" updated="20 August 2026">
      <p>
        This Privacy Policy explains how CrikLedger collects, uses, stores, and
        protects information when you use the CrikLedger application and
        website.
      </p>
      <p>
        CrikLedger is operated by <strong>Ravi Kant</strong>, an individual
        operating an unregistered business under the brand name{" "}
        <strong>CrikLedger</strong>.
      </p>

      <h2>Information we collect</h2>

      <h3>Account information</h3>
      <p>When you create a CrikLedger account, we may collect:</p>
      <ul>
        <li>Name</li>
        <li>Email address</li>
        <li>Password</li>
      </ul>
      <p>
        Passwords are stored in hashed form. CrikLedger does not store passwords
        in plain text.
      </p>

      <h3>Team and ledger information</h3>
      <p>
        When you use CrikLedger, you may provide information relating to your
        team, including team name, player names, match information, expenses,
        player contributions, amounts paid, outstanding balances, surplus or
        credit balances, and the payment status of ledger entries.
      </p>
      <p>
        CrikLedger may store the name of a player who has been added to a team
        even when that player does not have a CrikLedger account. For such
        players, CrikLedger stores their <strong>name only</strong> as part of
        the team&apos;s records.
      </p>

      <h2>Payment information</h2>
      <p>CrikLedger does not collect or store your:</p>
      <ul>
        <li>Credit or debit card number</li>
        <li>CVV</li>
        <li>UPI credentials</li>
        <li>Bank account credentials</li>
        <li>Other payment-instrument credentials</li>
      </ul>
      <p>
        CrikLedger does not currently use an online payment gateway. Paid
        feature purchases are handled through a{" "}
        <Link href="/how-to-buy">manual payment process</Link>: CrikLedger provides
        payment instructions, you pay directly using the method provided, and
        you send us confirmation of the payment. CrikLedger has no access to
        your payment-instrument credentials at any point.
      </p>
      <p>
        We keep the payment confirmation you send us, and the account email it
        relates to, as the record of your purchase.
      </p>

      <h2>Why we use your information</h2>
      <ul>
        <li>Create and maintain your account</li>
        <li>Provide CrikLedger features</li>
        <li>Maintain your team and ledger records</li>
        <li>Calculate player balances</li>
        <li>Provide purchased digital features and confirm purchases</li>
        <li>Provide customer support</li>
        <li>Investigate reported technical problems</li>
        <li>Detect misuse, fraud, or attempts to compromise the application</li>
        <li>Maintain the security and reliability of the service</li>
      </ul>

      <h2>Analytics</h2>
      <p>
        <strong>
          CrikLedger does not use third-party product analytics or user-tracking
          services.
        </strong>{" "}
        There is no PostHog, Google Analytics, or comparable analytics platform
        in the application.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li>
          <strong>Vercel</strong> — application hosting
        </li>
        <li>
          <strong>Supabase / PostgreSQL</strong> — application and database
          infrastructure
        </li>
      </ul>
      <p>
        These providers may process information as necessary to provide their
        respective services.
      </p>

      <h2>Data security</h2>
      <p>
        CrikLedger takes reasonable measures to protect information stored in
        the application, including:
      </p>
      <ul>
        <li>Password hashing</li>
        <li>HTTPS-secured connections</li>
        <li>Restricted administrative access</li>
        <li>Read-only administrative access to application records</li>
      </ul>
      <p>
        Administrative access is used only for purposes such as investigating
        bugs, reported errors, or feature-related issues. Administrators cannot
        modify users&apos; ledger or match records through the administrative
        interface.
      </p>

      <h2>Data deletion</h2>
      <p>
        To delete your CrikLedger account and its data, email us at{" "}
        <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a> from the
        address associated with your account. We will action the request,
        subject to information that may need to be retained for legitimate
        legal, accounting, fraud-prevention, dispute-resolution, or other
        compliance purposes.
      </p>

      <h2>Data retention</h2>
      <p>
        We retain information only for as long as reasonably necessary to
        provide the service and for legitimate business, security, legal,
        accounting, fraud-prevention, and dispute-resolution purposes. Certain
        records may therefore remain for a period after account deletion where
        retention is necessary for these purposes.
      </p>

      <h2>Your data rights</h2>
      <p>
        Depending on applicable law, you may request information about the
        personal data we hold about you, request correction of inaccurate
        information, or request deletion of your information. Send requests to{" "}
        <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a>.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this Privacy Policy when CrikLedger&apos;s features,
        services, technology, or legal requirements change. The updated version
        will be published on this page with a revised &ldquo;Last updated&rdquo;
        date.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a> or
        call <a href="tel:+919142349007">+91 9142349007</a>.
      </p>
    </PolicyPage>
  );
}
