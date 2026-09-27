import type { Metadata } from 'next'

import { ContactForm } from '../../components/contact-form'
import {
  ClockIcon,
  GlobeIcon,
  LockIcon,
  MapPinIcon,
  SparklesIcon,
  UsersIcon,
} from '../../components/icons'
import { Navbar } from '../../components/navbar'
import { Reveal } from '../../components/reveal'
import { Footer } from '../../components/sections'

export const metadata: Metadata = {
  title: 'Contact — Cloudrive',
  description:
    'Get in touch with the Cloudrive team: product support, sales, security, and press. We reply within one business day.',
}

const container = 'mx-auto w-full max-w-6xl px-6'

const channels = [
  {
    Icon: GlobeIcon,
    title: 'General support',
    email: 'support@cloudrive.us.ci',
    note: 'Product questions and troubleshooting · replies within 1 business day',
    tile: 'bg-primary/10 text-primary',
    hoverBorder: 'hover:border-primary/40',
  },
  {
    Icon: UsersIcon,
    title: 'Sales & teams',
    email: 'hello@cloudrive.us.ci',
    note: 'Team plans, SSO/SCIM, volume pricing · replies within 1 business day',
    tile: 'bg-emerald-500/10 text-emerald-600',
    hoverBorder: 'hover:border-emerald-500/40',
  },
  {
    Icon: LockIcon,
    title: 'Security & privacy',
    email: 'support@cloudrive.us.ci',
    note: 'Vulnerability reports, DPO requests, data-subject access · treated confidentially',
    tile: 'bg-accent/15 text-accent',
    hoverBorder: 'hover:border-accent/50',
  },
  {
    Icon: SparklesIcon,
    title: 'Press & partnerships',
    email: 'hello@cloudrive.us.ci',
    note: 'Media inquiries, brand assets, integrations · replies within 2 business days',
    tile: 'bg-primary/10 text-primary',
    hoverBorder: 'hover:border-primary/40',
  },
]

const infoCards = [
  {
    Icon: SparklesIcon,
    tone: 'bg-accent/15 text-accent',
    title: 'Before you write in',
    body: (
      <>
        Most setup and sync questions are already answered in the{' '}
        <a href="/#faq" className="font-semibold text-primary hover:underline">
          FAQ
        </a>
        . Beta status and incident history live on the status page.
      </>
    ),
  },
  {
    Icon: MapPinIcon,
    tone: 'bg-primary/10 text-primary',
    title: 'Headquarters',
    body: (
      <>
        Montara Project
        <br />
        Semarang, Indonesia
      </>
    ),
  },
  {
    Icon: ClockIcon,
    tone: 'bg-emerald-500/10 text-emerald-600',
    title: 'Support hours',
    body: (
      <>
        Monday-Friday, 9:00-18:00 WIB.
        <br />
        Security reports are monitored around the clock.
      </>
    ),
  },
]

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background">
        <section className="bg-dotgrid border-b border-border">
          <div className={`${container} py-16 text-center sm:py-20`}>
            <Reveal className="mx-auto max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                <span
                  className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                We usually reply within one business day
              </p>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
                Talk to the{' '}
                <span className="relative whitespace-nowrap text-primary">
                  Cloudrive team
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
              <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Real humans, no ticket black holes. Pick a channel below or use the form — every
                message becomes a tracked ticket.
              </p>
            </Reveal>
          </div>
        </section>

        <section aria-label="Contact channels" className="bg-card">
          <div className={`${container} py-14`}>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {channels.map(({ Icon, title, email, note, tile, hoverBorder }, i) => (
                <Reveal key={email} delayMs={i * 70}>
                  <li
                    className={`flex h-full flex-col rounded-2xl border border-border bg-background p-5 transition-all duration-200 hover:-translate-y-1 ${hoverBorder}`}
                  >
                    <span className={`flex size-10 items-center justify-center rounded-xl ${tile}`}>
                      <Icon className="size-5" />
                    </span>
                    <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
                    <a
                      href={`mailto:${email}`}
                      className="mt-1 text-sm font-semibold text-primary hover:underline"
                    >
                      {email}
                    </a>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section aria-label="Contact form" className="bg-background">
          <div
            className={`${container} grid gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px]`}
          >
            <Reveal className="min-w-0">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Send us a message
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Every message becomes a tracked ticket and lands in the right team&apos;s queue.
                </p>
                <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
                  <ContactForm />
                </div>
              </div>
            </Reveal>

            <Reveal delayMs={120}>
              <aside className="space-y-5">
                {infoCards.map(({ Icon, tone, title, body }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-border bg-card p-6 transition-colors duration-200 hover:border-primary/40"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-9 items-center justify-center rounded-xl ${tone}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <h3 className="text-sm font-bold text-foreground">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </aside>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
