import type { Metadata } from 'next'

import { LegalPage, type LegalSection } from '../../components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service — Cloudrive',
  description:
    'The terms that govern your use of Cloudrive: accounts, acceptable use, zero-copy content handling, billing, and liability.',
}

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of terms',
    blocks: [
      {
        kind: 'p',
        text: 'By creating a Cloudrive account, accessing our website, or using any part of the service, you agree to be bound by these Terms of Service (“Terms”) and our Privacy Policy. If you use Cloudrive on behalf of an organization, you represent that you have authority to bind that organization, and “you” refers to that organization.',
      },
      {
        kind: 'p',
        text: 'If you do not agree to these Terms, do not use the service. Cloudrive is currently offered in public beta; supplemental beta terms in section 8 also apply.',
      },
    ],
  },
  {
    id: 'service',
    title: '2. Description of the service',
    blocks: [
      {
        kind: 'p',
        text: 'Cloudrive provides a unified interface and index for files stored across third-party cloud storage providers (“Sources”). Cloudrive connects to your Sources through their official APIs, presents their content in a single drive, and offers search, sync status, sharing, and version history across them.',
      },
      {
        kind: 'p',
        text: 'Cloudrive is not a storage provider for your Source content. Unless you explicitly upload files to Cloudrive-hosted cache storage, your files remain in the providers where you stored them.',
      },
    ],
  },
  {
    id: 'accounts',
    title: '3. Accounts and eligibility',
    blocks: [
      { kind: 'p', text: 'You must be at least 16 years old to use Cloudrive. You agree to:' },
      {
        kind: 'list',
        items: [
          'Provide accurate, current registration information and keep it up to date.',
          'Safeguard your credentials and enable available multi-factor authentication.',
          'Promptly notify us of any unauthorized use of your account.',
          'Be responsible for all activity that occurs under your account.',
        ],
      },
    ],
  },
  {
    id: 'acceptable-use',
    title: '4. Acceptable use',
    blocks: [
      { kind: 'p', text: 'You agree not to use Cloudrive to:' },
      {
        kind: 'list',
        items: [
          'Store, index, or distribute content that is unlawful, infringing, or violates third-party rights.',
          'Access Sources you are not authorized to access, or exceed the scope of a provider authorization granted to you.',
          'Interfere with, overload, or reverse-engineer the service, or circumvent usage limits and access controls.',
          'Resell or provide the service to third parties without a written agreement with us.',
          'Harass, threaten, or violate the privacy of other users.',
        ],
      },
      {
        kind: 'p',
        text: 'We may investigate suspected violations and suspend or terminate accounts that violate these Terms, where practicable with notice.',
      },
    ],
  },
  {
    id: 'your-content',
    title: '5. Your content and the zero-copy model',
    blocks: [
      {
        kind: 'p',
        text: '“Your Content” means files, metadata, and other materials stored in your connected Sources. You retain all ownership of Your Content. Nothing in these Terms transfers ownership to us.',
      },
      { kind: 'p', text: "Under Cloudrive's zero-copy architecture:" },
      {
        kind: 'list',
        items: [
          'We index metadata (names, sizes, modification dates, permissions) from your Sources to power search and the unified drive.',
          "File contents are streamed on demand through the provider's API and are not permanently stored by us, except for the optional unified cache you enable.",
          'Editing a file through Cloudrive edits the original at its Source; two-way sync keeps status consistent.',
          'Disconnecting a Source removes its index from Cloudrive and deletes nothing at the provider.',
        ],
      },
      {
        kind: 'note',
        text: 'You grant Cloudrive the limited license needed to index, cache transiently, display, and sync Your Content strictly to operate the service on your behalf. This license ends when you disconnect the related Source or delete your account.',
      },
    ],
  },
  {
    id: 'third-party',
    title: '6. Third-party providers',
    blocks: [
      {
        kind: 'p',
        text: "Your use of each connected provider remains governed by that provider's own terms and privacy policy. Cloudrive is not affiliated with, endorsed by, or responsible for third-party providers, and we do not control their APIs, availability, or changes to them. If a provider revokes our API access or changes its terms, features involving that provider may be modified or discontinued.",
      },
    ],
  },
  {
    id: 'billing',
    title: '7. Subscriptions, billing, and refunds',
    blocks: [
      {
        kind: 'list',
        items: [
          'Paid plans renew automatically each month or year until cancelled.',
          'Prices exclude taxes, which are added at the applicable rate where required.',
          'You can cancel at any time; access continues until the end of the paid period.',
          'Beta-period usage is free. When billing begins, we will notify you at least 14 days in advance and you may downgrade or cancel first.',
          'Refunds for billing errors are issued at our discretion within 30 days of the charge.',
        ],
      },
    ],
  },
  {
    id: 'beta',
    title: '8. Beta terms',
    blocks: [
      {
        kind: 'p',
        text: 'Cloudrive is in public beta. The service may contain defects, and features, plans, and APIs may change or be discontinued at any time. During the beta, the service is provided “as is” without availability commitments, and we may throttle or suspend usage to protect stability.',
      },
      {
        kind: 'note',
        text: 'Because the beta relies on live third-party APIs, please keep authoritative copies of important work in its Source provider and do not rely on Cloudrive as your only access path during the beta.',
      },
    ],
  },
  {
    id: 'termination',
    title: '9. Termination',
    blocks: [
      {
        kind: 'p',
        text: 'You may stop using Cloudrive and delete your account at any time. We may suspend or terminate your access for material breach of these Terms, unlawful use, or risk to other users or our infrastructure. Upon termination, indexes and account data are deleted in line with our Privacy Policy; Your Content at third-party providers is untouched.',
      },
    ],
  },
  {
    id: 'disclaimers',
    title: '10. Disclaimers and limitation of liability',
    blocks: [
      {
        kind: 'p',
        text: 'Except as expressly stated, Cloudrive is provided “as is” and “as available” without warranties of any kind, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted or error-free.',
      },
      {
        kind: 'p',
        text: "To the maximum extent permitted by law, Cloudrive's aggregate liability arising out of or relating to the service is limited to the amounts you paid us in the 12 months preceding the claim, or USD 100 if you have not paid us. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.",
      },
    ],
  },
  {
    id: 'governing-law',
    title: '11. Governing law and disputes',
    blocks: [
      {
        kind: 'p',
        text: 'These Terms are governed by the laws of the State of California, USA, excluding its conflict-of-laws rules. The parties will attempt to resolve any dispute informally for 30 days before bringing a claim, which must be filed in the state or federal courts located in San Francisco County, California, except that either party may seek injunctive relief for intellectual-property misuse in any competent court.',
      },
    ],
  },
  {
    id: 'changes',
    title: '12. Changes to these terms',
    blocks: [
      {
        kind: 'p',
        text: 'We may update these Terms as the service evolves. For material changes we will notify you by email or in-product at least 14 days before they take effect. Continuing to use Cloudrive after the effective date constitutes acceptance of the updated Terms.',
      },
    ],
  },
  {
    id: 'contact',
    title: '13. Contact us',
    blocks: [
      {
        kind: 'p',
        text: 'Questions about these Terms can be sent to support@cloudrive.us.ci, Semarang, Indonesia',
      },
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 13, 2026"
      intro="These Terms govern your access to and use of Cloudrive, the service that centers your files from multiple cloud storage providers into one drive. Please read them carefully."
      sections={sections}
    />
  )
}
