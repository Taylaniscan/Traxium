import type { Metadata } from "next";

import {
  LegalContactLink,
  LegalDocument,
  LegalInlineLink,
  LegalList as List,
  LegalParagraph as Paragraph,
  type LegalSection,
} from "@/components/legal/legal-document";
import {
  COMPETENT_COURT,
  GOVERNING_LAW,
  LEGAL_COMPANY_NAME,
  LIABILITY_CAP_MONTHS,
  PRIVACY_POLICY_PATH,
  TERMS_OF_SERVICE_EFFECTIVE_DATE,
  WORKSPACE_DELETION_DAYS_AFTER_TERMINATION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | Traxium",
  description: `The terms that govern business use of Traxium, provided by ${LEGAL_COMPANY_NAME}.`,
};

const contactLink = <LegalContactLink />;

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "1. Agreement to these terms",
    body: (
      <>
        <Paragraph>
          These Terms of Service (the &ldquo;Terms&rdquo;) govern access to and
          use of Traxium (the &ldquo;Service&rdquo;), provided by{" "}
          {LEGAL_COMPANY_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;). The Service is offered to businesses only and is
          not intended for consumers.
        </Paragraph>
        <Paragraph>
          By creating a workspace, starting a subscription, or signing an order
          form, you accept these Terms on behalf of the organization you
          represent (the &ldquo;Customer&rdquo;) and confirm that you are
          authorized to do so. Individuals invited to a Customer&rsquo;s
          workspace (&ldquo;Users&rdquo;) must also follow these Terms.
        </Paragraph>
        <Paragraph>
          If a signed order form, pilot agreement, or other written agreement
          between us and the Customer (an &ldquo;Order&rdquo;) conflicts with
          these Terms, the Order prevails for that Customer. Any purchase terms
          or general conditions of the Customer do not apply.
        </Paragraph>
      </>
    ),
  },
  {
    id: "accounts",
    title: "2. Accounts and access",
    body: (
      <List
        items={[
          <>
            The Customer decides who receives access, assigns roles, and is
            responsible for all activity in its workspace.
          </>,
          <>
            Users must keep their credentials confidential, use accurate
            account information, and tell us promptly at {contactLink} about
            any unauthorized access.
          </>,
          <>
            We may suspend access to protect the Service, other customers, or
            data, for example during a security incident or suspected misuse.
            We will restore access once the issue is resolved and, where
            possible, give notice first.
          </>,
        ]}
      />
    ),
  },
  {
    id: "trials-and-pilots",
    title: "3. Trials and pilots",
    body: (
      <Paragraph>
        We may offer a free trial or a guided paid pilot. Pilot scope, duration,
        and fees are set out in the applicable Order. Free trials are provided
        as is, without any warranty or liability commitment, and end
        automatically at the end of the trial period unless the Customer starts
        a subscription.
      </Paragraph>
    ),
  },
  {
    id: "fees",
    title: "4. Fees, billing, and taxes",
    body: (
      <List
        items={[
          <>
            Fees are those stated in the Order or shown when the Customer starts
            a subscription. Subscriptions are billed in advance for each billing
            period through our payment processor, Stripe, and renew
            automatically until canceled.
          </>,
          <>
            Fees exclude value-added tax and other applicable taxes, which the
            Customer pays in addition. Where the reverse-charge mechanism
            applies, the Customer accounts for the tax.
          </>,
          <>
            If a payment fails, the workspace remains available until the end of
            the period already paid for. After that, access is paused until
            payment is made. Data is not deleted because of a paused
            subscription, except as described in section 6.
          </>,
          <>
            We may change subscription prices with at least 30 days&rsquo;
            notice. The new price applies from the next billing period. Prices
            fixed in an Order do not change during that Order&rsquo;s term.
          </>,
        ]}
      />
    ),
  },
  {
    id: "cancellation",
    title: "5. Cancellation and termination",
    body: (
      <List
        items={[
          <>
            The Customer may cancel a subscription at any time from the billing
            settings or by contacting us. Cancellation takes effect at the end
            of the current billing period, and access continues until then.
            Fees already paid are not refunded, including for partial periods,
            unless the law or an Order requires otherwise.
          </>,
          <>
            Either party may terminate if the other materially breaches these
            Terms and does not remedy the breach within 30 days of written
            notice.
          </>,
          <>
            We may terminate with 30 days&rsquo; notice if we discontinue the
            Service, and will refund any prepaid fees for the period after
            termination.
          </>,
          <>
            Sections that by their nature should continue, including fees owed,
            confidentiality, limitation of liability, and governing law, survive
            termination.
          </>,
        ]}
      />
    ),
  },
  {
    id: "customer-data",
    title: "6. Customer data",
    body: (
      <>
        <Paragraph>
          The Customer keeps all rights to the data, documents, and evidence it
          enters into the Service (&ldquo;Customer Data&rdquo;). The Customer
          grants us the rights needed to host, process, and display Customer
          Data only to provide, secure, and support the Service and as
          instructed by the Customer.
        </Paragraph>
        <Paragraph>
          The Customer is responsible for the accuracy and lawfulness of
          Customer Data and for having the rights and permissions needed to
          upload it. We process personal data in Customer Data under our data
          processing agreement, which we sign with Customers on request, and as
          described in our{" "}
          <LegalInlineLink href={PRIVACY_POLICY_PATH}>Privacy Policy</LegalInlineLink>.
        </Paragraph>
        <Paragraph>
          The Customer can export its saving-card data while it has access. After
          the subscription or Order ends, we delete Customer Data within{" "}
          {WORKSPACE_DELETION_DAYS_AFTER_TERMINATION} days, following an agreed
          export window, unless the law requires us to keep it longer. Copies in
          backups are overwritten on our providers&rsquo; regular cycle.
        </Paragraph>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "7. Acceptable use",
    body: (
      <>
        <Paragraph>The Customer and its Users must not:</Paragraph>
        <List
          items={[
            "use the Service in violation of any law or the rights of others;",
            "upload malware or content they have no right to share;",
            "attempt to access another customer's data or bypass access controls, rate limits, or usage quotas;",
            "probe, scan, or load-test the Service, or test its security, without our written permission;",
            "copy, reverse engineer, or create a competing product from the Service, except as the law expressly permits;",
            "resell, sublicense, or provide the Service to third parties outside the Customer's organization.",
          ]}
        />
      </>
    ),
  },
  {
    id: "our-rights",
    title: "8. Our intellectual property",
    body: (
      <Paragraph>
        We and our licensors own the Service, including its software, design,
        and documentation. Subject to these Terms and payment of fees, we grant
        the Customer a non-exclusive, non-transferable right to use the Service
        for its internal business purposes during the subscription or Order. If
        the Customer gives us feedback, we may use it without obligation.
      </Paragraph>
    ),
  },
  {
    id: "service-and-support",
    title: "9. Service changes and support",
    body: (
      <>
        <Paragraph>
          We continuously improve the Service and may change features. We will
          not materially reduce the core functionality of a paid subscription
          during its current term.
        </Paragraph>
        <Paragraph>
          Support is provided by email during business hours, as described on
          our{" "}
          <LegalInlineLink href="/trust">Trust &amp; security</LegalInlineLink>{" "}
          page. Unless an Order says otherwise, we do not commit to a specific
          availability level or service level agreement. The Service relies on
          third-party providers, such as hosting, storage, email, and payment
          providers, whose outages may affect availability.
        </Paragraph>
      </>
    ),
  },
  {
    id: "no-professional-advice",
    title: "10. No financial or accounting advice",
    body: (
      <Paragraph>
        Traxium helps teams record, approve, and report procurement savings.
        Savings figures, forecasts, and reports are calculated from data the
        Customer provides. They are not financial, accounting, tax, or legal
        advice, do not determine accounting recognition, and do not guarantee
        that any savings will be achieved. The Customer remains responsible for
        its business decisions and financial reporting.
      </Paragraph>
    ),
  },
  {
    id: "warranties",
    title: "11. Warranties and disclaimers",
    body: (
      <Paragraph>
        We will provide the Service with reasonable skill and care, in line with
        its documentation. Except as stated in these Terms or an Order, and to
        the extent the law allows, the Service is provided &ldquo;as is&rdquo;
        and we make no other warranties, including that the Service will be
        uninterrupted or error-free.
      </Paragraph>
    ),
  },
  {
    id: "liability",
    title: "12. Limitation of liability",
    body: (
      <List
        items={[
          <>
            Our total liability arising out of or relating to these Terms and
            the Service is limited to the fees the Customer paid us for the
            Service in the {LIABILITY_CAP_MONTHS} months before the event giving
            rise to the claim.
          </>,
          <>
            We are not liable for indirect or consequential loss, including lost
            profits, lost savings, lost revenue, business interruption, or loss
            of goodwill, or for loss of data beyond our obligation to restore it
            from available backups.
          </>,
          <>
            These limits do not apply to liability that cannot be limited by
            law, including liability for intent or deliberate recklessness, or
            to the Customer&rsquo;s obligation to pay fees.
          </>,
        ]}
      />
    ),
  },
  {
    id: "indemnity",
    title: "13. Customer indemnity",
    body: (
      <Paragraph>
        The Customer will indemnify us against third-party claims arising from
        Customer Data or from use of the Service by the Customer or its Users in
        breach of these Terms or the law, including reasonable legal costs.
      </Paragraph>
    ),
  },
  {
    id: "confidentiality",
    title: "14. Confidentiality",
    body: (
      <Paragraph>
        Each party will keep the other&rsquo;s non-public business, technical,
        and commercial information confidential, use it only to perform under
        these Terms, and protect it with at least reasonable care. This does not
        apply to information that is public, already known to the receiving
        party, independently developed, or that must be disclosed by law.
      </Paragraph>
    ),
  },
  {
    id: "governing-law",
    title: "15. Governing law and disputes",
    body: (
      <Paragraph>
        These Terms and any dispute arising from them are governed by{" "}
        {GOVERNING_LAW}. The United Nations Convention on Contracts for the
        International Sale of Goods does not apply. Disputes will be submitted
        exclusively to {COMPETENT_COURT}.
      </Paragraph>
    ),
  },
  {
    id: "changes",
    title: "16. Changes to these terms",
    body: (
      <Paragraph>
        We may update these Terms. For material changes we will notify workspace
        administrators by email at least 30 days before they take effect.
        Continued use of the Service after that date means the Customer accepts
        the updated Terms; if the Customer does not agree, it may cancel before
        they take effect.
      </Paragraph>
    ),
  },
  {
    id: "general",
    title: "17. General",
    body: (
      <List
        items={[
          "Neither party may assign these Terms without the other's consent, except to a successor in a merger or sale of substantially all of its business.",
          "Neither party is liable for delays caused by events beyond its reasonable control.",
          "These Terms and any Order are the entire agreement between the parties about the Service.",
          "If a provision is unenforceable, the rest of these Terms remains in effect.",
          "Notices may be given by email to the addresses on file and, for us, to the contact address below.",
          "Failure to enforce a provision is not a waiver of it.",
        ]}
      />
    ),
  },
  {
    id: "contact",
    title: "18. Contact",
    body: (
      <Paragraph>
        {LEGAL_COMPANY_NAME} &middot; {contactLink}
      </Paragraph>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      title="Terms of Service"
      effectiveDate={TERMS_OF_SERVICE_EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
