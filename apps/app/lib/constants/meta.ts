import { Metadata } from 'next'

export const META_URL = 'https://cloudrive.us.ci'
export const META_TITLE = `Cloudrive - All your clouds. One drive.`
export const META_DESCRIPTION = `Cloudrive centers every file from Google Drive, Dropbox, OneDrive, S3, and 12+ other services into a single searchable, syncable drive.`
export const META_IMAGE = '/static/images/brand-logo.png'
export const META_KEYWORDS = `cloud storage, file sync, unified drive, Google Drive, Dropbox, S3`

const SITE_NAME = 'Cloudrive'

export const META: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  keywords: META_KEYWORDS,
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    url: META_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: META_IMAGE,
        width: 1200,
        height: 630,
        alt: META_TITLE,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: META_TITLE,
    description: META_DESCRIPTION,
    site: META_URL,
    creator: SITE_NAME,
    images: [META_IMAGE],
  },
  icons: {
    icon: '/favicon/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
    shortcut: '/favicon/favicon.ico',
    other: {
      rel: 'shortcut icon',
      url: '/favicon/favicon.ico',
    },
  },
} as const
