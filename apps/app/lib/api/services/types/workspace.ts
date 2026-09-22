import { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { PaginateDto } from '../../dtos/paginate'
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../../dtos/workspace/schema'
import { Models } from '../../models'

export type WorkspaceResources = {
  list: (orgId: string, params: PaginateDto) => Promise<AxiosListResponse<Models.Workspace>>
  create: (
    orgId: string,
    reqBody: CreateWorkspaceDto
  ) => Promise<AxiosItemResponse<Models.Workspace>>
  get: (wsId: string) => Promise<AxiosItemResponse<Models.Workspace>>
  update: (
    wsId: string,
    reqBody: UpdateWorkspaceDto
  ) => Promise<AxiosItemResponse<Models.Workspace>>
  delete: (wsId: string) => Promise<AxiosDeleteResponse>
}

export type WorkspaceMemberResources = {
  list: (wsId: string, params: PaginateDto) => Promise<AxiosListResponse<Models.WorkspaceMember>>
  add: (
    wsId: string,
    reqBody: { user_id: string; role: string }
  ) => Promise<AxiosItemResponse<Models.WorkspaceMember>>
  update: (
    wsId: string,
    userId: string,
    reqBody: { role: string }
  ) => Promise<AxiosItemResponse<Models.WorkspaceMember>>
  remove: (wsId: string, userId: string) => Promise<AxiosDeleteResponse>
}
