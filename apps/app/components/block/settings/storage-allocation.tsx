'use client'

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconDeviceFloppy,
  IconGripVertical,
} from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import ProviderIcon, { providerBrandName } from '@/components/block/common/provider-icon'
import { Button } from '@/components/ui/button'
import { useStorageUsage } from '@/hooks/use-storage-usage'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

// STRATEGIES is the upload-distribution catalog; ids are stable so the saved
// allocation keeps working when the copy changes.
const STRATEGIES = [
  {
    id: 'round_robin',
    title: 'Round Robin',
    description: 'Uploads take turns across accounts in order, regardless of capacity.',
  },
  {
    id: 'weighted_round_robin',
    title: 'Weighted Round Robin',
    description: 'Larger accounts receive proportionally more uploads based on capacity.',
  },
  {
    id: 'least_used',
    title: 'Least Used',
    description: 'Sends each upload to the account with the lowest used percentage.',
  },
  {
    id: 'most_free_space',
    title: 'Most Free Space',
    description: 'Sends each upload to the account with the most free space. Best for large files.',
  },
  {
    id: 'custom_order',
    title: 'Custom Order',
    description: 'Fills accounts in the exact order you set below.',
  },
] as const

type StrategyId = (typeof STRATEGIES)[number]['id']

type SavedAllocation = {
  strategy: StrategyId
  order: string[]
}

const storageKey = (wsId: string) => `cloudrive.storage.allocation.${wsId}`

function readSaved(wsId: string | undefined): SavedAllocation {
  if (!wsId || typeof window === 'undefined') return { strategy: 'round_robin', order: [] }

  try {
    const raw = window.localStorage.getItem(storageKey(wsId))
    if (!raw) return { strategy: 'round_robin', order: [] }
    const parsed = JSON.parse(raw) as Partial<SavedAllocation>
    return {
      strategy: STRATEGIES.some((s) => s.id === parsed.strategy)
        ? (parsed.strategy as StrategyId)
        : 'round_robin',
      order: Array.isArray(parsed.order) ? parsed.order.filter((id) => typeof id === 'string') : [],
    }
  } catch {
    return { strategy: 'round_robin', order: [] }
  }
}

/**
 * StorageAllocation renders the upload-distribution configuration: strategy
 * cards plus the priority-ordered account list. Selection and order persist
 * per workspace in localStorage — the server has no allocation API yet, so
 * "Save changes" stores the config client-side.
 */
export default function StorageAllocation() {
  const { wsId } = useWorkspaceContext()
  const { accounts, usage, providerById, isLoading } = useStorageUsage(wsId ?? undefined)
  const queryClient = useQueryClient()

  const [strategy, setStrategy] = useState<StrategyId>(() => readSaved(wsId).strategy)
  const [order, setOrder] = useState<string[]>(() => readSaved(wsId).order)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Newly connected accounts go to the end; stale saved ids drop out.
  const orderedAccounts = (() => {
    const byId = new Map(accounts.map((account) => [account.id, account]))
    const ordered: typeof accounts = []
    for (const id of order) {
      const account = byId.get(id)
      if (account) ordered.push(account)
    }
    for (const account of accounts) {
      if (!order.includes(account.id)) ordered.push(account)
    }
    return ordered
  })()

  const move = (index: number, direction: -1 | 1) => {
    setOrder((prev) => {
      const ids = prev.length ? prev : orderedAccounts.map((account) => account.id)
      const target = index + direction
      if (target < 0 || target >= ids.length) return prev
      return arrayMove(ids, index, target)
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const ids = prev.length ? prev : orderedAccounts.map((account) => account.id)
      return arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    })
  }

  const handleSave = async () => {
    if (!wsId) return
    try {
      await queryClient.invalidateQueries({ queryKey: ['storage/accounts'] })
      const allocation: SavedAllocation = {
        strategy,
        order: orderedAccounts.map((account) => account.id),
      }
      window.localStorage.setItem(storageKey(wsId), JSON.stringify(allocation))
      toast.success('Storage allocation saved')
    } catch {
      toast.error('Could not save the allocation')
    }
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="p-5 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Storage allocation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how new uploads are distributed across your connected accounts.
        </p>

        <div
          role="radiogroup"
          aria-label="Upload distribution strategy"
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {STRATEGIES.map((item) => {
            const selected = strategy === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStrategy(item.id)}
                className={cn(
                  'cursor-pointer rounded-xl border p-4 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('text-sm font-semibold', selected && 'text-primary')}>
                    {item.title}
                  </span>
                  {selected && <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </button>
            )
          })}
        </div>

        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <h3 className="text-sm font-semibold">Account order</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drag accounts to set the upload priority. Newly connected accounts go to the end.
          </p>

          {isLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-background" />
              ))}
            </div>
          ) : orderedAccounts.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed bg-background px-4 py-6 text-center text-xs text-muted-foreground">
              Connect a storage account first — its position in the upload order is set here.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedAccounts.map((account) => account.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-3 space-y-2">
                  {orderedAccounts.map((account, index) => (
                    <SortableAccountRow
                      key={account.id}
                      account={account}
                      index={index}
                      total={orderedAccounts.length}
                      providerSlug={providerById.get(account.provider_id)?.slug}
                      providerProtocol={providerById.get(account.provider_id)?.protocol}
                      providerName={providerBrandName(
                        providerById.get(account.provider_id)?.slug,
                        providerById.get(account.provider_id)?.name
                      )}
                      freeLabel={
                        usage.has(account.id)
                          ? formatBytes(usage.get(account.id)!.total - usage.get(account.id)!.used)
                          : null
                      }
                      onMove={move}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            size="md"
            className="rounded-full"
            disabled={!wsId || isLoading || orderedAccounts.length === 0}
            onClick={handleSave}
          >
            <IconDeviceFloppy className="size-4" /> Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}

type SortableAccountRowProps = {
  account: { id: string; display_name: string; account_email?: string }
  index: number
  total: number
  providerSlug?: string | null
  providerProtocol?: string | null
  providerName: string
  freeLabel: string | null
  onMove: (index: number, direction: -1 | 1) => void
}

function SortableAccountRow({
  account,
  index,
  total,
  providerSlug,
  providerProtocol,
  providerName,
  freeLabel,
  onMove,
}: SortableAccountRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  })

  const label = account.account_email || account.display_name

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5',
        isDragging && 'z-10 border-primary/40 shadow-md'
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        {...attributes}
        {...listeners}
        className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <IconGripVertical className="size-4" />
      </button>

      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      <ProviderIcon slug={providerSlug} protocol={providerProtocol} className="size-8 rounded-lg" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {providerName}
          {freeLabel && ` · ${freeLabel} free`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg"
          disabled={index === 0}
          aria-label={`Move ${label} up`}
          onClick={() => onMove(index, -1)}
        >
          <IconArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg"
          disabled={index === total - 1}
          aria-label={`Move ${label} down`}
          onClick={() => onMove(index, 1)}
        >
          <IconArrowDown className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
