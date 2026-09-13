'use client'

import { ArrowRightIcon, ChevronDownIcon } from './icons'
import { Navbar } from './navbar'
import { ReadingProgress } from './reading-progress'
import { Reveal } from './reveal'
import { Footer } from './sections'
import { TableOfContents, type TocItem } from './table-of-contents'

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; text: string }

export type LegalSection = {
  id: string
  title: string
  blocks: LegalBlock[]
}

const container = 'mx-auto w-full max-w-6xl px-6'

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'list') {
    return (
      <ul
        className="list-disc space-y-2 pl-5 text-base leading-[1.75] text-muted-foreground marker:text-primary"
        
      >
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  if (block.kind === 'note') {
    return (
      <aside
        aria-label="Important note"
        className="rounded-r-xl border-l-4 border-accent bg-accent/10 px-5 py-4"
      >
        <p className="text-xs font-bold tracking-wider text-accent uppercase">Note</p>
        <p className="mt-1 text-sm leading-7 text-foreground">{block.text}</p>
      </aside>
    )
  }
  return <p className="text-base leading-[1.75] text-muted-foreground">{block.text}</p>
}

/**
 * Shared layout for long-form legal pages: branded header band with breadcrumb,
 * reading-progress bar, sticky table of contents (desktop) with a contact
 * escalation card, collapsible TOC on mobile, and sequential h1 → h2 heading
 * hierarchy for screen-reader navigation.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}) {
  const tocItems: TocItem[] = sections.map(({ id, title: sectionTitle }) => ({
    id,
    title: sectionTitle,
  }))

  return (
    <>
      <Navbar />
      <ReadingProgress />
      <main className="bg-background">
        <section className="bg-dotgrid border-b border-border">
          <div className={`${container} py-14 sm:py-16`}>
            <Reveal className="max-w-3xl">
              <nav aria-label="Breadcrumb">
                <ol
                  className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground"
                  
                >
                  <li>
                    <a href="/" className="transition-colors duration-150 hover:text-primary">
                      Home
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="text-foreground">
                    {title}
                  </li>
                </ol>
              </nav>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {title}
              </h1>
              <p className="mt-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
                  <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                  Last updated <time className="text-foreground">{updated}</time>
                </span>
              </p>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">{intro}</p>
            </Reveal>
          </div>
        </section>

        <div
          className={`${container} grid gap-12 py-14 sm:py-16 lg:grid-cols-[240px_minmax(0,1fr)]`}
        >
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div>
                <p className="mb-3 px-4 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  On this page
                </p>
                <TableOfContents items={tocItems} />
              </div>
              <div className="ml-4 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-bold text-foreground">Questions?</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  We&apos;re happy to clarify anything in this document.
                </p>
                <a
                  href="/contact"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors duration-150 hover:text-blue-700"
                >
                  Contact us
                  <ArrowRightIcon className="size-3.5" />
                </a>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <details className="group mb-10 rounded-2xl border border-border bg-card lg:hidden">
              <summary className="flex items-center justify-between px-5 py-4 text-sm font-bold text-foreground marker:content-[''] [&::-webkit-details-marker]:hidden">
                On this page
                <ChevronDownIcon className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="px-5 pt-1 pb-4">
                <TableOfContents items={tocItems} />
              </div>
            </details>

            <article className="max-w-3xl">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="group scroll-mt-24 border-b border-border py-10 first:pt-0 last:border-b-0"
                >
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    <a
                      href={`#${section.id}`}
                      aria-label={`Link to ${section.title}`}
                      className="mr-1.5 text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100"
                    >
                      #
                    </a>
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {section.blocks.map((block, i) => (
                      <Block key={i} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
