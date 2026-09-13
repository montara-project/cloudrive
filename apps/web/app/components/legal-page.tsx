import { Navbar } from "./navbar";
import { Footer } from "./sections";
import { TableOfContents, type TocItem } from "./table-of-contents";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

const container = "mx-auto w-full max-w-6xl px-6";

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "list") {
    return (
      <ul
        className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:text-primary"
        role="list"
      >
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.kind === "note") {
    return (
      <aside
        aria-label="Important note"
        className="rounded-r-xl border-l-4 border-accent bg-accent/10 px-5 py-4 text-sm leading-7 text-foreground"
      >
        {block.text}
      </aside>
    );
  }
  return <p className="text-[15px] leading-7 text-muted-foreground">{block.text}</p>;
}

/**
 * Shared layout for long-form legal pages: page header, sticky table of
 * contents on desktop, collapsible TOC on mobile, and sequential h1 → h2
 * heading hierarchy for screen-reader navigation.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const tocItems: TocItem[] = sections.map(({ id, title: sectionTitle }) => ({
    id,
    title: sectionTitle,
  }));

  return (
    <>
      <Navbar />
      <main className="bg-background">
        <div className={`${container} py-16 sm:py-20`}>
          <header className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-sm font-semibold text-muted-foreground">
              Last updated: <time className="text-foreground">{updated}</time>
            </p>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{intro}</p>
          </header>

          <div className="mt-12 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="mb-3 px-4 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  On this page
                </p>
                <TableOfContents items={tocItems} />
              </div>
            </aside>

            <div className="min-w-0">
              <details className="mb-10 rounded-2xl border border-border bg-card lg:hidden">
                <summary className="flex items-center justify-between px-5 py-4 text-sm font-bold text-foreground marker:content-[''] [&::-webkit-details-marker]:hidden">
                  On this page
                </summary>
                <div className="px-5 pt-1 pb-4">
                  <TableOfContents items={tocItems} />
                </div>
              </details>

              <article className="max-w-3xl space-y-12">
                {sections.map((section) => (
                  <section key={section.id} id={section.id} className="scroll-mt-24">
                    <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
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
        </div>
      </main>
      <Footer />
    </>
  );
}
