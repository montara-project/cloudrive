import { AxiosListResponse } from '@/types/api'

import { PaginateDto } from '../../dtos/paginate'
import { Models } from '../../models'

export type ProviderResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<Models.Provider>>
}
