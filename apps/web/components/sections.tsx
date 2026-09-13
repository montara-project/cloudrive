'use client'

import {
  ArrowRightIcon,
  BoxMark,
  CheckIcon,
  ChevronDownIcon,
  CloudriveLogo,
  DocFileIcon,
  DropboxMark,
  GlobeIcon,
  GoogleDriveMark,
  HistoryIcon,
  ICloudMark,
  ImageFileIcon,
  LayersIcon,
  LockIcon,
  OneDriveMark,
  PdfFileIcon,
  PlugIcon,
  QuoteIcon,
  S3Mark,
  SearchIcon,
  SharePointMark,
  SheetFileIcon,
  SyncIcon,
  UsersIcon,
  VideoFileIcon,
  WebdavMark,
  ZapIcon,
  ZipFileIcon,
} from './icons'
import { Reveal } from './reveal'
import { WaitlistForm } from './waitlist-form'

const container = 'mx-auto w-full max-w-6xl px-6'

function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'center',
}: {
  eyebrow: string
  title: string
  lede?: string
  align?: 'center' | 'left'
}) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-sm font-bold tracking-widest text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {lede && <p className="mt-4 text-lg leading-8 text-muted-foreground">{lede}</p>}
    </Reveal>
  )
}

/* ================= Hero ================= */

export function Hero() {
  return (
    <section id="top" className="bg-dotgrid border-b border-border">
      <div className={`${container} pt-16 pb-20 sm:pt-24 sm:pb-28`}>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
              Now in public beta
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl sm:leading-[1.08]">
              All your clouds.{' '}
              <span className="relative whitespace-nowrap text-primary">
                One drive.
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 12"
                  className="absolute -bottom-2 left-0 w-full text-accent"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M3 9c50-5.5 140-6.5 214-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
          </Reveal>

          <Reveal delayMs={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Cloudrive centers every file from Google Drive, Dropbox, OneDrive, S3, and 12+ other
              services into a single drive — searchable, synced, and openable from anywhere. No more
              tab-hopping.
            </p>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#waitlist"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_0_0_#1e40af] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:shadow-none sm:w-auto"
              >
                Get early access
                <ArrowRightIcon className="size-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted active:translate-y-0 sm:w-auto"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              Free during beta · No credit card required
            </p>
          </Reveal>
        </div>

        <Reveal delayMs={320} className="mt-14 sm:mt-16">
          <DriveMockup />
        </Reveal>

        <Reveal delayMs={120} className="mt-14">
          <TrustStrip />
        </Reveal>
      </div>
    </section>
  )
}

/* ================= Product mockup (pure JSX/SVG, flat) ================= */

const sources = [
  { name: 'Google Drive', files: '42,318', Mark: GoogleDriveMark },
  { name: 'Dropbox', files: '12,904', Mark: DropboxMark },
  { name: 'OneDrive', files: '8,211', Mark: OneDriveMark },
  { name: 'S3 · assets', files: '155,501', Mark: S3Mark },
]

const mockFiles = [
  {
    name: 'Q3-Roadmap.pdf',
    source: 'Google Drive',
    size: '2.4 MB',
    when: 'Edited 2h ago',
    FileIcon: PdfFileIcon,
  },
  {
    name: 'Q4-metrics.xlsx',
    source: 'Google Drive',
    size: '88 KB',
    when: 'Edited 1h ago',
    FileIcon: SheetFileIcon,
  },
  {
    name: 'brand-assets-2026.zip',
    source: 'Dropbox',
    size: '184 MB',
    when: 'Added yesterday',
    FileIcon: ZipFileIcon,
  },
  {
    name: 'drone-flyover-4k.mov',
    source: 'OneDrive',
    size: '1.2 GB',
    when: 'Added 3d ago',
    FileIcon: VideoFileIcon,
  },
  {
    name: 'contracts/MSA-acme.pdf',
    source: 'Box',
    size: '640 KB',
    when: 'Added last week',
    FileIcon: DocFileIcon,
  },
  {
    name: 'team-offsite.jpg',
    source: 'iCloud',
    size: '3.8 MB',
    when: 'Added 5d ago',
    FileIcon: ImageFileIcon,
  },
]

const driveNav = [
  { label: 'All files', active: true },
  { label: 'Shared', active: false },
  { label: 'Starred', active: false },
]

const floatChips = [
  {
    className: '-left-24 top-20 float-slow',
    Mark: GoogleDriveMark,
    title: 'Google Drive',
    note: '42,318 files',
    dot: 'bg-emerald-500',
  },
  {
    className: '-right-20 top-48 float-slower',
    Mark: DropboxMark,
    title: 'Dropbox',
    note: 'Two-way sync',
    dot: 'bg-primary',
  },
  {
    className: '-left-14 bottom-14 float-slower',
    Mark: OneDriveMark,
    title: 'OneDrive',
    note: '8,211 files',
    dot: 'bg-sky-500',
  },
]

function DriveMockup() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {floatChips.map(({ className, Mark, title, note, dot }) => (
        <div
          key={title}
          aria-hidden="true"
          className={`absolute z-10 hidden items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 xl:flex ${className}`}
        >
          <Mark className="size-5 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-bold text-foreground">{title}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`size-1.5 rounded-full ${dot}`} />
              {note}
            </p>
          </div>
        </div>
      ))}

      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-accent/25 sm:translate-x-4 sm:translate-y-4"
      />
      <div className="relative overflow-hidden rounded-3xl border border-border bg-muted p-3 sm:p-5">
        <div className="overflow-hidden rounded-2xl border border-border bg-card text-left">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-[#F87171]" />
              <span className="size-2.5 rounded-full bg-[#FBBF24]" />
              <span className="size-2.5 rounded-full bg-[#34D399]" />
            </div>
            <p className="flex-1 truncate text-center text-xs font-semibold text-muted-foreground">
              cloudrive — All files
            </p>
            <span className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
              <span
                className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                aria-hidden="true"
              />
              All sources synced
            </span>
          </div>

          <div className="grid sm:grid-cols-[190px_1fr]">
            <aside className="hidden border-r border-border p-4 sm:block">
              <p className="px-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Sources
              </p>
              <ul className="mt-2 space-y-1">
                {sources.map(({ name, files, Mark }) => (
                  <li
                    key={name}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-foreground"
                  >
                    <Mark className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{name}</span>
                    <span className="text-[11px] text-muted-foreground">{files}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 px-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                Drive
              </p>
              <ul className="mt-2 space-y-1">
                {driveNav.map(({ label, active }) => (
                  <li
                    key={label}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </aside>

            <div className="p-4">
              <div className="flex h-10 items-center gap-2.5 rounded-xl border border-border bg-muted px-3.5 text-sm text-muted-foreground">
                <SearchIcon className="size-4 shrink-0" />
                <span className="flex-1 truncate">Search every cloud at once…</span>
                <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
                  ⌘K
                </kbd>
              </div>

              <ul className="mt-3 divide-y divide-border">
                {mockFiles.map(({ name, source, size, when, FileIcon }) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted"
                  >
                    <FileIcon className="size-5 shrink-0" />
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground md:inline">
                      {source}
                    </span>
                    <span className="hidden w-16 text-right text-xs text-muted-foreground sm:block">
                      {size}
                    </span>
                    <span className="hidden w-28 text-right text-xs text-muted-foreground lg:block">
                      {when}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
            4 sources connected · 218,934 files centered
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= Trust strip ================= */

const trustedBy = ['Nimbus Labs', 'Pixelbay', 'Quantify', 'Hexaform', 'Dataship']

function TrustStrip() {
  return (
    <div className="text-center">
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        Trusted by teams at
      </p>
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {trustedBy.map((name) => (
          <li key={name} className="text-base font-bold text-muted-foreground/70">
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ================= Problem ================= */

const pains = [
  {
    title: 'Six tabs to find one file',
    body: 'Drive for docs, Dropbox for assets, S3 for archives. Search means searching the same thing six times.',
  },
  {
    title: 'Duplicates everywhere',
    body: 'The same deck downloaded, re-uploaded, and forked across clouds until nobody knows which copy is current.',
  },
  {
    title: 'Permissions in chaos',
    body: 'Every provider has its own sharing model, so access audits turn into archaeology across five admin consoles.',
  },
]

export function Problem() {
  return (
    <section className="bg-card">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading
          eyebrow="The problem"
          title="Your files live in six places. Your work lives in none of them."
          lede="Cloud storage solved storing files. It created a new problem: your team's knowledge is scattered across disconnected services that don't talk to each other."
        />
        <ul className="mt-12 grid gap-5 md:grid-cols-3" >
          {pains.map((pain, i) => (
            <Reveal key={pain.title} delayMs={i * 80}>
              <li className="h-full rounded-2xl border border-border bg-background p-6 transition-all duration-200 hover:-translate-y-1 hover:border-accent/50">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-sm font-extrabold text-accent">
                  0{i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-foreground">{pain.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pain.body}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ================= Features ================= */

const features = [
  {
    Icon: SearchIcon,
    tone: {
      tile: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
      card: 'hover:border-primary/40',
    },
    title: 'Universal search',
    body: 'One search bar across every connected cloud. Filter by source, type, owner, or date — results in milliseconds.',
  },
  {
    Icon: SyncIcon,
    tone: {
      tile: 'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
      card: 'hover:border-emerald-500/40',
    },
    title: 'Live two-way sync',
    body: "Edits flow both directions in real time. Change a file in Dropbox and it's updated in Cloudrive — and back — instantly.",
  },
  {
    Icon: LayersIcon,
    tone: {
      tile: 'bg-accent/15 text-accent group-hover:bg-accent group-hover:text-accent-foreground',
      card: 'hover:border-accent/50',
    },
    title: 'Zero-copy architecture',
    body: 'Cloudrive indexes and links; it never duplicates. Your files stay in place, your storage bills stay the same.',
  },
  {
    Icon: UsersIcon,
    tone: {
      tile: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
      card: 'hover:border-primary/40',
    },
    title: 'One permissions model',
    body: "Share once, honoring each source's native rules. Audit who can see what from a single console.",
  },
  {
    Icon: HistoryIcon,
    tone: {
      tile: 'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
      card: 'hover:border-emerald-500/40',
    },
    title: 'Unified version timeline',
    body: 'Every revision from every provider on one timeline. Restore any version of any file in two clicks.',
  },
  {
    Icon: LockIcon,
    tone: {
      tile: 'bg-accent/15 text-accent group-hover:bg-accent group-hover:text-accent-foreground',
      card: 'hover:border-accent/50',
    },
    title: 'End-to-end encryption',
    body: 'AES-256 at rest, TLS 1.3 in transit, and per-workspace keys. OAuth only — we never see your passwords.',
  },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-background">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading
          eyebrow="Features"
          title="Everything your clouds do, in one place"
          lede="Cloudrive sits on top of the providers you already use and gives them a single, coherent interface."
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" >
          {features.map(({ Icon, tone, title, body }, i) => (
            <Reveal key={title} delayMs={(i % 3) * 80}>
              <li
                className={`group h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 ${tone.card}`}
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-xl transition-colors duration-200 ${tone.tile}`}
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ================= How it works ================= */

const steps = [
  {
    title: 'Connect your accounts',
    body: 'Authorize each provider with OAuth in about two minutes. No migration, no uploads, nothing moves.',
  },
  {
    title: 'Cloudrive centers everything',
    body: 'We index every file, folder, and permission into one unified drive with a single search index.',
  },
  {
    title: 'Work from one drive',
    body: 'Open, search, share, and edit everything — on web, desktop, and mobile — while files stay at the source.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-card">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading eyebrow="How it works" title="Centered in minutes, not weekends" />
        <ol className="mt-12 grid gap-5 md:grid-cols-3" >
          {steps.map(({ title, body }, i) => (
            <Reveal key={title} delayMs={i * 100}>
              <li className="relative h-full rounded-2xl border border-border bg-background p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                {i < steps.length - 1 && (
                  <ArrowRightIcon
                    className="absolute top-1/2 -right-[22px] hidden size-5 -translate-y-1/2 text-border md:block"
                    aria-hidden="true"
                  />
                )}
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ================= Integrations ================= */

const integrations = [
  { name: 'Google Drive', Mark: GoogleDriveMark },
  { name: 'Dropbox', Mark: DropboxMark },
  { name: 'OneDrive', Mark: OneDriveMark },
  { name: 'iCloud Drive', Mark: ICloudMark },
  { name: 'Amazon S3', Mark: S3Mark },
  { name: 'Box', Mark: BoxMark },
  { name: 'SharePoint', Mark: SharePointMark },
  { name: 'WebDAV / FTP', Mark: WebdavMark },
]

export function Integrations() {
  return (
    <section id="integrations" className="scroll-mt-16 bg-background">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading
          eyebrow="Integrations"
          title="Every major cloud, first-class"
          lede="Connect as many sources as you want. New providers ship monthly — vote on what's next."
        />
        <ul className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4" >
          {integrations.map(({ name, Mark }, i) => (
            <Reveal key={name} delayMs={(i % 4) * 60}>
              <li className="flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-card px-4 py-6 text-center transition-colors duration-200 hover:border-primary/40">
                <Mark className="size-9" />
                <span className="text-sm font-semibold text-foreground">{name}</span>
              </li>
            </Reveal>
          ))}
        </ul>
        <Reveal delayMs={120}>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm font-medium text-muted-foreground">
            <PlugIcon className="size-4 text-primary" />
            Plus Slack, Notion, and Zapier on Pro plans.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ================= Stats ================= */

const stats = [
  { value: '12+', label: 'Cloud providers' },
  { value: '2.1B', label: 'Files centered' },
  { value: '40k', label: 'Teams on board' },
  { value: '99.99%', label: 'Uptime SLA' },
]

export function Stats() {
  return (
    <section className="bg-primary" aria-label="Cloudrive by the numbers">
      <div className={`${container} py-16 sm:py-20`}>
        <dl className="grid grid-cols-2 gap-y-10 text-center lg:grid-cols-4">
          {stats.map(({ value, label }, i) => (
            <Reveal
              key={label}
              delayMs={i * 80}
              className="px-4 lg:border-blue-300/40 lg:border-l lg:first:border-l-0"
            >
              <div>
                <dd className="text-4xl font-extrabold tracking-tight text-white tabular-nums sm:text-5xl">
                  {value}
                </dd>
                <dt className="mt-2 text-sm font-semibold text-blue-200">{label}</dt>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}

/* ================= Testimonials ================= */

const testimonials = [
  {
    quote:
      "We cut our 'where is the latest file?' threads by 80%. Cloudrive is the first tab my team opens every morning.",
    name: 'Maya Krishnan',
    role: 'Head of Operations, Nimbus Labs',
    initials: 'MK',
    tone: 'bg-primary/10 text-primary',
  },
  {
    quote:
      'Pointing S3 buckets and Google Drives at one interface took ten minutes. Zero migration, zero downtime.',
    name: 'Tom Okafor',
    role: 'Platform Lead, Dataship',
    initials: 'TO',
    tone: 'bg-accent/15 text-accent',
  },
  {
    quote:
      'One permissions console for five clouds ended our audit nightmares. Security signed off in a week.',
    name: 'Elena Vasquez',
    role: 'CISO, Quantify',
    initials: 'EV',
    tone: 'bg-emerald-500/10 text-emerald-700',
  },
]

export function Testimonials() {
  return (
    <section className="bg-card" aria-label="What customers say">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading eyebrow="Testimonials" title="Teams stop tab-hopping on day one" />
        <ul className="mt-12 grid gap-5 md:grid-cols-3" >
          {testimonials.map(({ quote, name, role, initials, tone }, i) => (
            <Reveal key={name} delayMs={i * 80}>
              <li className="flex h-full flex-col rounded-2xl border border-border bg-background p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40">
                <QuoteIcon className="size-6 text-accent" />
                <p className="mt-4 flex-1 text-sm leading-7 text-foreground">
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ${tone}`}
                  >
                    {initials}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ================= Pricing ================= */

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For personal cloud-hopping.',
    features: [
      '3 connected sources',
      '10 GB unified cache',
      'Universal search',
      'Community support',
    ],
    cta: 'Start for free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: 'per month',
    description: 'For professionals who live in their files.',
    features: [
      'Unlimited sources',
      '2 TB unified cache',
      'Version timeline + restore',
      'Priority sync queue',
      'Desktop & mobile apps',
    ],
    cta: 'Get early access',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$29',
    period: 'per user / month',
    description: 'For teams that share everything.',
    features: [
      'Everything in Pro',
      'SSO / SAML + SCIM',
      'Admin & audit console',
      'Shared team drive',
      'API access',
    ],
    cta: 'Talk to sales',
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 bg-background">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple plans, transparent pricing"
          lede="Start free while we're in beta. Upgrade when your clouds multiply."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map(({ name, price, period, description, features, cta, highlighted }, i) => (
            <Reveal key={name} delayMs={i * 80} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-200 ${
                  highlighted
                    ? 'border-2 border-primary bg-card shadow-[10px_10px_0_0_#fde68a] lg:-translate-y-2'
                    : 'border-border bg-card hover:-translate-y-1 hover:border-primary/40'
                }`}
              >
                {highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3.5 py-1 text-xs font-bold whitespace-nowrap text-accent-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
                  {name}
                </h3>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">
                    {price}
                  </span>
                  <span className="text-sm text-muted-foreground">{period}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                <ul className="mt-6 flex-1 space-y-3" >
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="#waitlist"
                  className={`mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 ${
                    highlighted
                      ? 'bg-primary text-primary-foreground shadow-[0_4px_0_0_#1e40af] hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:shadow-none'
                      : 'border border-border bg-background text-foreground hover:-translate-y-0.5 hover:bg-muted active:translate-y-0'
                  }`}
                >
                  {cta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================= FAQ ================= */

const faqs = [
  {
    q: 'Does Cloudrive copy or move my files?',
    a: "No. Cloudrive is zero-copy: we index metadata and stream content on demand through the provider's own API. Your files never leave their original location, and deleting a source disconnects it cleanly.",
  },
  {
    q: 'How is this different from just mounting multiple drives?',
    a: 'Mounting gives you multiple windows into multiple silos. Cloudrive gives you one namespace, one search index, one permissions console, and one version timeline — across all sources at once.',
  },
  {
    q: 'Is my data secure?',
    a: 'We use OAuth (never passwords), encrypt everything with AES-256 at rest and TLS 1.3 in transit, and support per-workspace keys. Cloudrive is SOC 2 Type II audited during beta.',
  },
  {
    q: 'What happens if I disconnect a provider?',
    a: 'The source disappears from your unified drive, but nothing is deleted from the provider itself. Indexes are removed from our systems within 24 hours.',
  },
  {
    q: 'Can I self-host Cloudrive?',
    a: 'A self-hosted distribution for Team plans is on the roadmap. During beta, Cloudrive runs fully managed on our infrastructure.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 bg-card">
      <div className={`${container} py-20 sm:py-24`}>
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {faqs.map(({ q, a }, i) => (
            <Reveal key={q} delayMs={i * 60}>
              <details className="group rounded-2xl border border-border bg-background transition-colors duration-200 open:border-primary/40">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 text-left text-base font-bold text-foreground marker:content-[''] [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-6 pb-6 text-sm leading-7 text-muted-foreground">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================= Final CTA ================= */

export function CtaSection() {
  return (
    <section id="waitlist" className="bg-dotgrid-dark scroll-mt-16 bg-foreground">
      <div className={`${container} py-20 text-center sm:py-28`}>
        <Reveal className="mx-auto max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-blue-200">
            <ZapIcon className="size-3.5" />
            Beta invites roll out weekly
          </p>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Stop tab-hopping. <span className="text-amber-400">Start centering.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Join the waitlist and be first to connect every cloud you use to a single drive.
          </p>
        </Reveal>
        <Reveal delayMs={140} className="mt-9">
          <WaitlistForm />
        </Reveal>
      </div>
    </section>
  )
}

/* ================= Footer ================= */

const footerColumns = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'Changelog', href: '/#' },
      { label: 'Status', href: '/#' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/#' },
      { label: 'Blog', href: '/#' },
      { label: 'Careers', href: '/#' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'DPA', href: '/#' },
      { label: 'Security', href: '/#' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className={`${container} py-14`}>
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <CloudriveLogo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              One drive for every cloud. Built for teams whose files live everywhere.
            </p>
          </div>
          {footerColumns.map(({ heading, links }) => (
            <nav key={heading} aria-label={heading}>
              <p className="text-sm font-bold text-foreground">{heading}</p>
              <ul className="mt-4 space-y-2.5" >
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-muted-foreground transition-colors duration-200 hover:text-primary"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Cloudrive, Inc. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GlobeIcon className="size-3.5" />
            All your clouds. One drive.
          </p>
        </div>
      </div>
    </footer>
  )
}
