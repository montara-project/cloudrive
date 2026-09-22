'use client'

import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

import SectionCard from '../common/section-card'
import { OrganizationColumn } from './column'
import { AddOrganizationForm } from './form'

export default function OrganizationContent() {
  const [openAdd, setOpenAdd] = useState(false)

  const { offset, limit, pageIndex } = usePaginationQuery()
  const defaultQueryParams = useMemo(() => ({ offset, limit }), [offset, limit])

  const {
    data: orgs,
    isLoading,
    isFetching,
    isPending,
  } = useQuery(queries.organizations.list(defaultQueryParams))

  const total = getTotal(orgs)
  const columns = OrganizationColumn({ loading: isLoading || isFetching || isPending })
  const chains = useMemo(() => (orgs?.data && orgs?.data?.length > 0 ? orgs.data : []), [orgs])

  return (
    <>
      <SectionCard
        title="Organizations"
        description="Your organizations and teams."
        toolbar={
          <Button variant="primary" size="sm" onClick={() => setOpenAdd(true)}>
            <IconPlus className="size-4" /> New organization
          </Button>
        }
      >
        <ReactTable
          total={total}
          data={chains}
          pageIndex={pageIndex}
          pageSize={limit}
          columns={columns}
        />

        <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
      </SectionCard>
    </>
  )
}
