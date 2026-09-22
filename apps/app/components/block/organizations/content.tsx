import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

import SectionCard from '../common/section-card'
import { OrganizationColumn } from './column'

export default function OrganizationContent() {
  const { offset, limit, pageIndex } = usePaginationQuery()
  const defaultQueryParams = useMemo(() => ({ offset, limit }), [offset, limit])

  const orgs = useQuery(queries.organizations.list(defaultQueryParams))

  const total = getTotal(orgs.data)
  const columns = OrganizationColumn({ loading: orgs.isPending })
  const chains = useMemo(
    () => (orgs.data?.data && orgs.data?.data?.length > 0 ? orgs.data.data : []),
    [orgs.data]
  )

  return (
    <>
      <SectionCard
        title="Organizations"
        description="Your organizations and teams."
        toolbar={
          <Button variant="primary" size="sm">
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
      </SectionCard>
    </>
  )
}
