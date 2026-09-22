'use client'

import { useQueryState } from 'nuqs'

import SectionCard from '@/components/block/common/section-card'
import WorkspacePicker from '@/components/block/common/workspace-picker'
import BucketsTab from '@/components/block/s3/buckets-tab'
import CredentialsTab from '@/components/block/s3/credentials-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function S3Page() {
  const [wsId] = useQueryState('ws')

  return (
    <SectionCard
      title="S3 Gateway"
      description="S3-compatible credentials and virtual buckets for the selected workspace."
      toolbar={<WorkspacePicker />}
    >
      {!wsId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Select an organization and workspace to manage the S3 gateway.
        </p>
      ) : (
        <Tabs defaultValue="credentials">
          <TabsList className="mb-4">
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="buckets">Buckets</TabsTrigger>
          </TabsList>
          <TabsContent value="credentials">
            <CredentialsTab wsId={wsId} />
          </TabsContent>
          <TabsContent value="buckets">
            <BucketsTab wsId={wsId} />
          </TabsContent>
        </Tabs>
      )}
    </SectionCard>
  )
}
