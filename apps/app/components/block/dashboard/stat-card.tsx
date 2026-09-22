'use client'

import { IconBuilding } from '@tabler/icons-react'
import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  title: string
  value: number | undefined
  href: string
  icon: typeof IconBuilding
  loading: boolean
}

export default function StatCard({ title, value, href, icon: Icon, loading }: StatCardProps) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '…' : (value ?? 0)}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
