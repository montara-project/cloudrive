'use client'

import {
  IconAdjustmentsHorizontal,
  IconChartPie,
  IconPlugConnected,
  IconRefresh,
} from '@tabler/icons-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConnectStorageAccountForm } from '@/components/block/storage/form'
import StorageOverview from '@/components/block/storage/overview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'

import StorageAllocation from './storage-allocation'

/**
 * Settings → Storage tab: the workspace's storage management chrome —
 * overview and upload allocation — mirroring the reference product's
 * Storage page. Allocation/overview choice deep-links via `?view=`.
 */
export default function StorageSettingsPanel() {
  const { wsId, workspace } = useWorkspaceContext()
  const [view, setView] = useQueryState('view')
  const [openAdd, setOpenAdd] = useState(false)
  const queryClient = useQueryClient()

  const isSyncing = useIsFetching({ queryKey: ['storage/accounts'] }) > 0

  const handleSync = async () => {
    // The accounts prefix covers both the account list and every
    // `storage/accounts/quota` query, so quotas refetch from the providers.
    await queryClient.invalidateQueries({ queryKey: ['storage/accounts'] })
    toast.success('Accounts synced')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace
              ? `View all cloud accounts connected to ${workspace.name}, then connect or disconnect accounts.`
              : 'View all cloud accounts, their quotas, then connect or disconnect accounts.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            className="rounded-full"
            disabled={!wsId || isSyncing}
            onClick={handleSync}
          >
            <IconRefresh className={isSyncing ? 'size-4 animate-spin' : 'size-4'} /> Sync now
          </Button>
          <Button
            variant="primary"
            size="md"
            className="rounded-full"
            disabled={!wsId}
            onClick={() => setOpenAdd(true)}
          >
            <IconPlugConnected className="size-4" /> Connect
          </Button>
        </div>
      </div>

      <Tabs
        value={view ?? 'allocation'}
        onValueChange={(value) => setView(value === 'allocation' ? null : value)}
        className="flex flex-col gap-4"
      >
        <TabsList className="w-fit rounded-full border bg-background p-1">
          <TabsTrigger
            value="overview"
            className="rounded-full px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <IconChartPie className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger
            value="allocation"
            className="rounded-full px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <IconAdjustmentsHorizontal className="size-4" /> Allocation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <StorageOverview onConnect={() => setOpenAdd(true)} />
        </TabsContent>
        <TabsContent value="allocation" className="mt-0">
          {/* key remounts on wsId change so the saved allocation is read once
              the workspace id resolves (it is '' on the very first render). */}
          <StorageAllocation key={wsId} />
        </TabsContent>
      </Tabs>

      {wsId && <ConnectStorageAccountForm wsId={wsId} open={openAdd} onOpenChange={setOpenAdd} />}
    </div>
  )
}
