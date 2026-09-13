import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Cloudrive",
  description:
    "How Cloudrive collects, uses, and protects your data — including our zero-copy approach to your file contents, OAuth tokens, cookies, and your rights.",
};

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    blocks: [
      {
        kind: "p",
        text: "This Privacy Policy explains how Cloudrive, Inc. (“Cloudrive”, “we”, “us”) collects, uses, and protects information when you use our service. The short version: we index enough metadata to give you one searchable drive, we stream file contents on demand instead of storing them, and we never sell your data.",
      },
    ],
  },
  {
    id: "collection",
    title: "2. Information we collect",
    blocks: [
      { kind: "p", text: "We collect the following categories of information:" },
      {
        kind: "list",
        items: [
          "Account information: name, email address, password or single sign-on identifier, and workspace details.",
          "Source metadata: file names, folder structure, sizes, MIME types, timestamps, permissions, and provider identifiers from services you connect (Google Drive, Dropbox, OneDrive, S3, Box, and others).",
          "Provider tokens: OAuth access and refresh tokens that let us call provider APIs on your behalf.",
          "Usage information: features used, searches performed, devices, browser type, and interaction events.",
          "Support information: messages you send us through forms or email.",
        ],
      },
      {
        kind: "note",
        text: "We do not collect payment-card numbers; card data is handled directly by our PCI-compliant payment processor.",
      },
    ],
  },
  {
    id: "use",
    title: "3. How we use information",
    blocks: [
      {
        kind: "list",
        items: [
          "Operate the service: indexing Sources, powering search, syncing status, and rendering the unified drive.",
          "Maintain security: detecting abuse, unauthorized access, and enforcing rate limits.",
          "Communicate with you: transactional email, security notices, and service updates.",
          "Improve the product: aggregated, de-identified analytics about feature usage and performance.",
          "Meet legal obligations where required.",
        ],
      },
      {
        kind: "p",
        text: "We do not use Your Content metadata to train machine-learning models, and we do not build advertising profiles from your data.",
      },
    ],
  },
  {
    id: "zero-copy",
    title: "4. Your file contents (zero-copy)",
    blocks: [
      {
        kind: "p",
        text: "Cloudrive is designed so that your files never need to leave their providers. When you preview, search results snippets, or open a file, we stream the content through the provider's API to your device over TLS 1.3 and do not persist it on our infrastructure.",
      },
      {
        kind: "list",
        items: [
          "Optional unified cache: paid plans may cache file contents to speed up offline and preview access. Cache contents are encrypted with AES-256 and evicted automatically according to your plan's retention window.",
          "Search index: we index metadata and, for supported text formats, extracted text snippets. Snippets are treated as Your Content and deleted with the index.",
          "Disconnecting a Source deletes its index, snippets, and cached copies within 24 hours.",
        ],
      },
    ],
  },
  {
    id: "oauth",
    title: "5. OAuth tokens and provider access",
    blocks: [
      {
        kind: "p",
        text: "We connect to providers using OAuth 2.0 only — we never see or store your provider passwords. You can revoke Cloudrive's access at any time from the provider's own security settings or by disconnecting the Source in Cloudrive. When revoked, all associated tokens are invalidated and deleted from our systems.",
      },
    ],
  },
  {
    id: "cookies",
    title: "6. Cookies and tracking",
    blocks: [
      {
        kind: "list",
        items: [
          "Essential cookies keep you signed in and protect against cross-site request forgery. The service cannot function without them.",
          "Preference cookies remember choices such as layout and theme.",
          "We use privacy-preserving, cookieless analytics to count page views and feature usage. We do not use third-party advertising or cross-site tracking cookies.",
        ],
      },
    ],
  },
  {
    id: "sharing",
    title: "7. How we share information",
    blocks: [
      { kind: "p", text: "We share information only in these circumstances:" },
      {
        kind: "list",
        items: [
          "Service providers: infrastructure, email, and payment vendors under contracts that restrict use of your data to providing services to us.",
          "Legal requirements: when compelled by valid legal process, or to protect rights, property, or safety, where permitted by law.",
          "Business transfers: as part of a merger or acquisition, with notice and continued protection under this policy.",
        ],
      },
      {
        kind: "note",
        text: "We have never sold personal information and we do not share it for cross-context behavioral advertising.",
      },
    ],
  },
  {
    id: "retention",
    title: "8. Data retention and deletion",
    blocks: [
      {
        kind: "p",
        text: "Account information is retained while your account is active. Deleting your account starts deletion of personal data within 24 hours, with complete removal from backups within 90 days. Source indexes, OAuth tokens, and caches are deleted within 24 hours of disconnecting a Source. Minimal legal-hold and billing records may be retained where required by law.",
      },
    ],
  },
  {
    id: "security",
    title: "9. Security",
    blocks: [
      {
        kind: "list",
        items: [
          "TLS 1.3 in transit and AES-256 at rest across all systems.",
          "Per-workspace encryption keys for caches and indexes.",
          "SOC 2 Type II audit in progress during the beta period.",
          "Regular third-party penetration testing and a coordinated vulnerability disclosure program (security@cloudrive.app).",
        ],
      },
    ],
  },
  {
    id: "rights",
    title: "10. Your rights",
    blocks: [
      {
        kind: "p",
        text: "Depending on your jurisdiction (including GDPR in the EEA/UK and CCPA/CPRA in California), you may have the right to access, correct, export, and delete your personal information, object to or restrict certain processing, and lodge a complaint with a supervisory authority.",
      },
      {
        kind: "p",
        text: "You can exercise most rights directly in-product (export and deletion in account settings) or by emailing privacy@cloudrive.app. We respond to verified requests within 30 days and never discriminate against you for exercising them.",
      },
    ],
  },
  {
    id: "transfers",
    title: "11. International data transfers",
    blocks: [
      {
        kind: "p",
        text: "Cloudrive is operated from the United States. Where personal information is transferred out of the EEA or UK, we rely on the EU Standard Contractual Clauses and the UK International Data Transfer Addendum, supplemented by technical safeguards such as encryption in transit and at rest.",
      },
    ],
  },
  {
    id: "children",
    title: "12. Children's privacy",
    blocks: [
      {
        kind: "p",
        text: "Cloudrive is not directed to children under 16, and we do not knowingly collect their personal information. If you believe a child has provided us personal information, contact us and we will delete it.",
      },
    ],
  },
  {
    id: "changes-policy",
    title: "13. Changes to this policy",
    blocks: [
      {
        kind: "p",
        text: "We will post any changes to this policy on this page and update the date above. For material changes we will also notify you by email or in-product before they take effect.",
      },
    ],
  },
  {
    id: "contact-privacy",
    title: "14. Contact us",
    blocks: [
      {
        kind: "p",
        text: "For privacy questions or to contact our Data Protection Officer: privacy@cloudrive.app, or Cloudrive, Inc., 548 Market Street, San Francisco, CA 94104, USA.",
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 13, 2026"
      intro="This policy describes what Cloudrive collects, how we use it, and the controls you have — written to be read, not just linked in a footer."
      sections={sections}
    />
  );
}
