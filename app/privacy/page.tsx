import type { Metadata } from "next";

import {
  LegalContactLink,
  LegalDocument,
  LegalList as List,
  LegalParagraph as Paragraph,
  LegalTerm as Term,
  type LegalSection,
} from "@/components/legal/legal-document";
import {
  LEGAL_COMPANY_NAME,
  LEGAL_WEBSITE_DOMAIN,
  PILOT_LEAD_RETENTION_MONTHS,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  WORKSPACE_DELETION_DAYS_AFTER_TERMINATION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Traxium",
  description: `How ${LEGAL_COMPANY_NAME} collects, uses, and protects personal data on its website and in the Traxium application.`,
};

const contactLink = <LegalContactLink />;

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "1. Who we are",
    body: (
      <>
        <Paragraph>
          {LEGAL_COMPANY_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
          operates Traxium, a procurement savings governance application for
          business customers, and the website at {LEGAL_WEBSITE_DOMAIN}. This
          policy explains how we handle personal data when you visit our
          website, request a pilot, or use Traxium.
        </Paragraph>
        <Paragraph>Questions about this policy can be sent to {contactLink}.</Paragraph>
      </>
    ),
  },
  {
    id: "our-role",
    title: "2. Our role",
    body: (
      <>
        <Paragraph>
          For website visitors, pilot requests, account administration, and
          billing, we decide how personal data is used and act as the{" "}
          <Term>controller</Term>.
        </Paragraph>
        <Paragraph>
          Content that a customer organization enters into its Traxium
          workspace, such as saving cards, supplier and pricing data, approvals,
          comments, and evidence files, is processed on that customer&rsquo;s
          behalf. For that content we act as a <Term>processor</Term>, and the
          customer organization is the controller. Our processing of workspace
          content is governed by our agreement with the customer, including a
          data processing agreement.
        </Paragraph>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "3. Information we collect",
    body: (
      <List
        items={[
          <>
            <Term>Pilot requests.</Term> Your name, work email, company name,
            country, and, if you provide them, job title, company size,
            industry, current savings-tracking method, savings challenges,
            pilot timeline, and message. To prevent spam and abuse we also store
            one-way cryptographic hashes of your IP address and browser user
            agent; we do not store the raw values with your request.
          </>,
          <>
            <Term>Account information.</Term> Your name, email address, role,
            and workspace memberships. Passwords are handled by our
            authentication provider and stored only in hashed form; we never
            see them.
          </>,
          <>
            <Term>Workspace content.</Term> Information your organization
            records in Traxium, which can include names and contact details of
            colleagues, buyers, and supplier contacts, and documents uploaded as
            evidence.
          </>,
          <>
            <Term>Billing information.</Term> Payments are processed by Stripe.
            We store customer and subscription identifiers and subscription
            status, not payment card details.
          </>,
          <>
            <Term>Security and technical data.</Term> An audit log of actions
            taken in a workspace, sign-in events, rate-limiting counters, error
            reports, and server logs kept by our hosting provider, which can
            include IP address, browser type, and request times.
          </>,
        ]}
      />
    ),
  },
  {
    id: "how-we-use-data",
    title: "4. How we use information and our legal bases",
    body: (
      <>
        <List
          items={[
            <>
              <Term>To respond to pilot requests</Term> and assess fit, based on
              our legitimate interest in answering business inquiries and on
              steps you ask us to take before entering a contract.
            </>,
            <>
              <Term>To provide and support Traxium</Term>, including accounts,
              invitations, password resets, and service emails, based on our
              contract with the customer.
            </>,
            <>
              <Term>To keep the service secure</Term>, prevent abuse, and
              diagnose errors, based on our legitimate interest in operating a
              secure, reliable service.
            </>,
            <>
              <Term>To manage billing</Term>, based on our contract and our legal
              obligations, including tax and accounting rules.
            </>,
            <>
              <Term>To comply with the law</Term> and respond to lawful requests.
            </>,
          ]}
        />
        <Paragraph>
          We do not sell personal data, use it for advertising, or make
          decisions about you based solely on automated processing that produce
          legal or similarly significant effects.
        </Paragraph>
      </>
    ),
  },
  {
    id: "cookies",
    title: "5. Cookies and browser storage",
    body: (
      <Paragraph>
        Traxium uses only essential cookies needed to keep you signed in and to
        protect your session, and your browser&rsquo;s local storage for display
        preferences such as layout density. We do not use advertising cookies
        or third-party tracking cookies. If we introduce optional analytics, we
        will update this policy and ask for consent where the law requires it.
      </Paragraph>
    ),
  },
  {
    id: "service-providers",
    title: "6. Service providers",
    body: (
      <>
        <Paragraph>
          We share personal data only with providers that help us run Traxium,
          under contracts that limit their use of the data:
        </Paragraph>
        <List
          items={[
            <>
              <Term>Vercel</Term> &mdash; application hosting and delivery.
            </>,
            <>
              <Term>Supabase</Term> &mdash; database, private file storage, and
              authentication, hosted in the European Union (Frankfurt, Germany).
            </>,
            <>
              <Term>Stripe</Term> &mdash; subscription billing and payment
              processing.
            </>,
            <>
              <Term>Resend</Term> &mdash; delivery of service and notification
              emails.
            </>,
            <>
              <Term>Sentry</Term> &mdash; error monitoring, configured not to
              collect personal identifiers by default.
            </>,
          ]}
        />
        <Paragraph>
          We may also disclose information if required by law, to protect our
          rights or the safety of others, or as part of a merger, acquisition,
          or sale of assets, in which case this policy will continue to apply.
        </Paragraph>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "7. International transfers",
    body: (
      <Paragraph>
        Our primary database and file storage are located in the European Union.
        Some providers may process data in other countries, including the United
        States. Where data is transferred outside your country or the European
        Economic Area, we rely on appropriate safeguards such as adequacy
        decisions or Standard Contractual Clauses.
      </Paragraph>
    ),
  },
  {
    id: "retention",
    title: "8. How long we keep information",
    body: (
      <List
        items={[
          <>
            <Term>Pilot requests</Term> that do not lead to a customer
            relationship are deleted within {PILOT_LEAD_RETENTION_MONTHS} months
            of our last contact with you, or sooner if you ask.
          </>,
          <>
            <Term>Account and workspace data</Term> is kept for the duration of
            the customer agreement and deleted within{" "}
            {WORKSPACE_DELETION_DAYS_AFTER_TERMINATION} days after it ends,
            following an agreed export window, unless the law requires us to
            keep it longer.
          </>,
          <>
            <Term>Audit logs</Term> are kept for as long as the workspace exists.
          </>,
          <>
            <Term>Billing records</Term> are kept for as long as tax and
            accounting laws require.
          </>,
          <>
            <Term>Backups</Term> are overwritten on our providers&rsquo; regular
            backup cycle.
          </>,
        ]}
      />
    ),
  },
  {
    id: "security",
    title: "9. Security",
    body: (
      <Paragraph>
        We protect information with encryption in transit, private file
        storage, workspace isolation, role-based access controls, short-lived
        signed download links, and rate limiting. No method of transmission or
        storage is completely secure, but we work to protect your information
        and will notify affected customers and authorities of a personal data
        breach as the law requires.
      </Paragraph>
    ),
  },
  {
    id: "your-rights",
    title: "10. Your rights",
    body: (
      <>
        <Paragraph>
          Depending on where you live, you may have the right to access, correct,
          or delete your personal data; to restrict or object to its processing;
          to receive a copy in a portable format; and to withdraw consent where
          we rely on it. You also have the right to complain to the data
          protection authority in your country.
        </Paragraph>
        <Paragraph>
          To exercise these rights, email {contactLink}. We will respond within
          one month and may need to verify your identity first. If your request
          concerns workspace content held for an organization that uses
          Traxium, please contact that organization; we will help it respond.
        </Paragraph>
      </>
    ),
  },
  {
    id: "business-customers",
    title: "11. Business customers",
    body: (
      <Paragraph>
        We sign a data processing agreement with business customers that sets
        out how we process workspace content on their behalf. To request one,
        contact {contactLink}.
      </Paragraph>
    ),
  },
  {
    id: "children",
    title: "12. Children",
    body: (
      <Paragraph>
        Traxium is a business service and is not directed at children under 16.
        We do not knowingly collect their personal data.
      </Paragraph>
    ),
  },
  {
    id: "changes",
    title: "13. Changes to this policy",
    body: (
      <Paragraph>
        We may update this policy from time to time. We will change the
        effective date above and, for material changes, notify workspace
        administrators by email before the changes take effect.
      </Paragraph>
    ),
  },
  {
    id: "contact",
    title: "14. Contact us",
    body: (
      <Paragraph>
        {LEGAL_COMPANY_NAME} &middot; {contactLink}
      </Paragraph>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      effectiveDate={PRIVACY_POLICY_EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
