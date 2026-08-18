import { PolicyPage } from "@/components/legal/PolicyPage";

export const metadata = { title: "Contact us · CrikLedger" };

// Static by design — see components/legal/PolicyPage.
export default function Contact() {
  return (
    <PolicyPage title="Contact us" updated="18 August 2026">
      <p>
        If you have a question about CrikLedger, need help with a feature, have
        identified an error, or need assistance with a purchase or refund,
        please contact us.
      </p>

      <h2>Support</h2>
      <dl>
        <dt>Email</dt>
        <dd>
          <a href="mailto:crikledger@gmail.com">crikledger@gmail.com</a>
        </dd>
        <dt>Phone</dt>
        <dd>
          <a href="tel:+919142349007">+91 9142349007</a>
        </dd>
      </dl>
      <p>
        For refund requests, account-related requests, or other matters where a
        record of communication is useful, we recommend contacting us by email.
      </p>

      <h2>Business / operating address</h2>
      <p>
        Ravi Kant
        <br />
        C-1706, R7, Kolte-Patil Life Republic
        <br />
        Marunji, Pune – 411057
        <br />
        India
      </p>

      <h2>Support hours</h2>
      <p>
        Monday–Saturday, 10:00 AM–7:00 PM IST.
        <br />
        We aim to respond to support enquiries within{" "}
        <strong>two working days</strong>.
      </p>
    </PolicyPage>
  );
}
