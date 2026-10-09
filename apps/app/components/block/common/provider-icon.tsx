'use client'

import {
  IconBrandDropbox,
  IconBrandGoogleDrive,
  IconBrandOnedrive,
  IconBucket,
  IconCloud,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'

type ProviderIconProps = {
  slug?: string | null
  name?: string | null
  protocol?: string | null
  className?: string
}

// BRANDS maps known provider slugs to their brand glyph and color so account
// cards read at a glance like the provider's own console. Unknown slugs fall
// back to a neutral cloud.
const BRANDS: Record<string, { Icon: typeof IconCloud; className: string }> = {
  google_drive: { Icon: IconBrandGoogleDrive, className: 'text-[#34A853]' },
  dropbox: { Icon: IconBrandDropbox, className: 'text-[#0061FF]' },
  onedrive: { Icon: IconBrandOnedrive, className: 'text-[#0364B8]' },
}

export default function ProviderIcon({ slug, protocol, className }: ProviderIconProps) {
  const brand = slug ? BRANDS[slug] : undefined

  if (brand) {
    const Icon = brand.Icon
    return (
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted',
          className
        )}
      >
        <Icon className={cn('size-5', brand.className)} />
      </div>
    )
  }

  if (protocol?.startsWith('s3')) {
    return (
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted',
          className
        )}
      >
        <IconBucket className="size-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary',
        className
      )}
    >
      <IconCloud className="size-5" />
    </div>
  )
}

export function providerBrandName(slug?: string | null, name?: string | null): string {
  if (name) return name
  if (!slug) return 'Storage'
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
