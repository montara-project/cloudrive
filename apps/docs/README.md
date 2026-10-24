# Cloudrive docs

Documentation site for Cloudrive, built with Next.js and
[Fumadocs](https://fumadocs.dev). Pages are MDX under `content/docs`; slugs and the
sidebar come from file paths and `meta.json`.

```sh
pnpm dev:docs                             # http://localhost:3001/docs
pnpm --filter @cloudrive/docs typecheck   # next typegen && tsc --noEmit
pnpm build:docs
```

| File                            | Role                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `source.config.ts`              | Collections (Fumadocs MDX Config API, output in `.source/`) |
| `lib/source.ts`                 | `loader()` over the `docs` collection                       |
| `app/docs/layout.tsx`           | Docs layout and sidebar                                     |
| `app/docs/[[...slug]]/page.tsx` | Page rendering                                              |
| `components/mdx-components.tsx` | MDX components                                              |

Never edit `.source/`: it is generated on install, dev and build.
