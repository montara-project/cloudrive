import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import PageHeader from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import InvitationsTab from './invitations-tab'
import MembersTab from './members-tab'
import WorkspacesTab from './workspaces-tab'

export default function OrganizationDetailContent({ orgId }: { orgId: string }) {
  const navigate = useNavigate()

  const { data: org, isLoading, isError } = useQuery(queries.organizations.get({ id: orgId }))
  const del = useMutation(queries.organizations.delete())
  const [deleting, setDeleting] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Organization" />
        <div className="flex justify-center py-20">
          <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (isError || !org?.data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Organization" />
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">Organization not found or unavailable.</p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/settings', search: { tab: 'organizations' } })}
          >
            <IconArrowLeft className="size-4" /> Back to organizations
          </Button>
        </div>
      </div>
    )
  }

  const header = (
    <PageHeader
      title={org.data.name}
      description={<>@{org.data.slug}</>}
      leading={
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link to="/settings" search={{ tab: 'organizations' }}>
            <IconArrowLeft className="size-4" />
          </Link>
        </Button>
      }
      actions={
        <>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
            <IconTrash className="size-4" /> Delete
          </Button>
        </>
      }
    />
  )

  return (
    <div className="flex flex-col gap-6">
      {header}

      <SectionCard title={org.data.name} description={`@${org.data.slug}`}>
        <Tabs defaultValue="workspaces">
          <TabsList className="mb-4">
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>
          <TabsContent value="workspaces">
            <WorkspacesTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="invitations">
            <InvitationsTab orgId={orgId} />
          </TabsContent>
        </Tabs>
      </SectionCard>

      <SimpleAlertDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete organization"
        description={`Delete "${org.data.name}"? Its workspaces and storage accounts will be removed. This cannot be undone.`}
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await del.mutateAsync(orgId)
            toast.success('Organization deleted')
            navigate({ to: '/settings', search: { tab: 'organizations' } })
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
