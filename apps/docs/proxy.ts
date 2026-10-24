import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation'
import { NextRequest, NextResponse } from 'next/server'

import { docsContentRoute } from '@/lib/shared'

// Docs live at the site root, so every page path maps to its Markdown twin.
const { rewrite: rewriteDocs } = rewritePath('{/*path}', `${docsContentRoute}{/*path}/content.md`)
const { rewrite: rewriteSuffix } = rewritePath(
  '{/*path}.md',
  `${docsContentRoute}{/*path}/content.md`
)

export default function proxy(request: NextRequest) {
  const result = rewriteSuffix(request.nextUrl.pathname)
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl))
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteDocs(request.nextUrl.pathname)

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl), {
        // this URL has two representations, selected by `Accept`
        headers: { Vary: 'Accept' },
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  // Docs pages only: with docs at the root, a Markdown-preferring request for
  // /llms.txt, the search API or an OG image must not be rewritten.
  matcher: [
    '/((?!api|og|llms\\.mdx|llms\\.txt|llms-full\\.txt|_next/static|_next/image|favicon.ico).*)',
  ],
}
