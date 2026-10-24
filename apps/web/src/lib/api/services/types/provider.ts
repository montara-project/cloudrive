import type { AxiosListResponse } from '@/types/api'

import type { PaginateDto } from '../../dtos/paginate'
import type { Models } from '../../models'

export type ProviderResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<Models.Provider>>
}
