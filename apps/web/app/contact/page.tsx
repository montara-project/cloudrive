import type { Metadata } from "next";
import { ContactForm } from "../components/contact-form";
import { Footer } from "../components/sections";
import { GlobeIcon, LockIcon, SparklesIcon, UsersIcon } from "../components/icons";
import { Reveal } from "../components/reveal";
import { Navbar } from "../components/navbar";

export const metadata: Metadata = {
  title: "Contact — Cloudrive",
  description:
    "Get in touch with the Cloudrive team: product support, sales, security, and press. We reply within one business day.",
};

const container = "mx-auto w-full max-w-6xl px-6";

const channels = [
  {
    Icon: GlobeIcon,
    title: "General support",
    email: "support@cloudrive.app",
    note: "Product questions and troubleshooting · replies within 1 business day",
    tone: "bg-primary/10 text-primary",
  },
  {
    Icon: UsersIcon,
    title: "Sales & teams",
    email: "sales@cloudrive.app",
    note: "Team plans, SSO/SCIM, volume pricing · replies within 1 business day",
    tone: "bg-emerald-500/10 text-emerald-600",
  },
  {
    Icon: LockIcon,
    title: "Security & privacy",
    email: "security@cloudrive.app",
    note: "Vulnerability reports, DPO requests, data-subject access · treated confidentially",
    tone: "bg-accent/15 text-accent",
  },
  {
    Icon: SparklesIcon,
    title: "Press & partnerships",
    email: "press@cloudrive.app",
    note: "Media inquiries, brand assets, integrations · replies within 2 business days",
    tone: "bg-primary/10 text-primary",
  },
];

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background">
        <section className="bg-dotgrid border-b border-border">
          <div className={`${container} py-16 text-center sm:py-20`}>
            <Reveal className="mx-auto max-w-2xl">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                Talk to the Cloudrive team
              </h1>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Real humans, no ticket black holes. Pick a channel below or use the form — we
                reply within one business day.
              </p>
            </Reveal>
          </div>
        </section>

        <section aria-label="Contact channels" className="bg-card">
          <div className={`${container} py-14`}>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
              {channels.map(({ Icon, title, email, note, tone }, i) => (
                <Reveal key={email} delayMs={i * 70}>
                  <li className="flex h-full flex-col rounded-2xl border border-border bg-background p-5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40">
                    <span
                      className={`flex size-10 items-center justify-center rounded-xl ${tone}`}
                    >
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
          <div className={`${container} grid gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px]`}>
            <Reveal className="min-w-0">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Send us a message
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Every message becomes a tracked ticket and lands in the right team&apos;s queue.
                </p>
                <div className="mt-8">
                  <ContactForm />
                </div>
              </div>
            </Reveal>

            <Reveal delayMs={120}>
              <aside className="space-y-5">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-bold text-foreground">Before you write in</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Most setup and sync questions are already answered in the{" "}
                    <a href="/#faq" className="font-semibold text-primary hover:underline">
                      FAQ
                    </a>
                    . Beta status and incident history live on the status page.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-bold text-foreground">Headquarters</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Cloudrive, Inc.
                    <br />
                    548 Market Street
                    <br />
                    San Francisco, CA 94104, USA
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-bold text-foreground">Support hours</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Monday–Friday, 9:00–18:00 PT. Security reports are monitored around the
                    clock.
                  </p>
                </div>
              </aside>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
