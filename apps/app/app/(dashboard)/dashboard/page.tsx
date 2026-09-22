'use client'

import { IconArrowRight, IconBuilding, IconCloud, IconPackages } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import StatCard from '@/components/block/dashboard/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { queries } from '@/lib/api/queries'

export default function DashboardPage() {
  const orgs = useQuery(
    queries.organizations.list({ limit: 5, order_by: 'created_at', order: 'desc' })
  )
  const providers = useQuery(queries.providers.list())

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          All your clouds. One drive. Manage organizations, workspaces and connected storage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Organizations"
          value={orgs.data?.metadata?.total}
          href="/organizations"
          icon={IconBuilding}
          loading={orgs.isLoading}
        />
        <StatCard
          title="Providers"
          value={providers.data?.metadata?.total}
          href="/providers"
          icon={IconPackages}
          loading={providers.isLoading}
        />
        <Link href="/storage">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Storage Accounts</p>
                <p className="text-2xl font-semibold">Connect</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <IconCloud className="size-5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent organizations</CardTitle>
          <Link
            href="/organizations"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View all <IconArrowRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {orgs.isLoading ? (
            <div className="py-6 text-center">
              <span className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (orgs.data?.data ?? []).length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No organizations yet —{' '}
              <Link href="/organizations" className="text-primary hover:underline">
                create your first one
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(orgs.data?.data ?? []).map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/organizations/${org.id}`}
                    className="flex items-center justify-between py-3 hover:text-primary"
                  >
                    <span className="font-medium">{org.name}</span>
                    <span className="text-sm text-muted-foreground">@{org.slug}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
