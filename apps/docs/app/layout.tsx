import type { Metadata } from 'next'

import { RootProvider } from 'fumadocs-ui/provider/next'

import './global.css'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
})

// Icons live in public/favicon (shared with apps/web), so they are declared
// here rather than through the app/icon file convention.
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
  manifest: '/favicon/site.webmanifest',
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
