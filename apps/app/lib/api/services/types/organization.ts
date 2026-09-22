import { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import {
  AddMemberDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '../../dtos/organization/schema'
import { PaginateDto } from '../../dtos/paginate'
import { Models } from '../../models'

export type OrganizationResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<Models.Organization>>
  create: (reqBody: CreateOrganizationDto) => Promise<AxiosItemResponse<Models.Organization>>
  get: (orgId: string) => Promise<AxiosItemResponse<Models.Organization>>
  update: (
    orgId: string,
    reqBody: UpdateOrganizationDto
  ) => Promise<AxiosItemResponse<Models.Organization>>
  delete: (orgId: string) => Promise<AxiosDeleteResponse>
}

export type OrganizationMemberResources = {
  list: (
    orgId: string,
    params?: PaginateDto
  ) => Promise<AxiosListResponse<Models.OrganizationMember>>
  add: (
    orgId: string,
    reqBody: AddMemberDto
  ) => Promise<AxiosItemResponse<Models.OrganizationMember>>
  update: (
    orgId: string,
    userId: string,
    reqBody: { role: string }
  ) => Promise<AxiosItemResponse<Models.OrganizationMember>>
  remove: (orgId: string, userId: string) => Promise<AxiosDeleteResponse>
}

export type OrganizationInvitationResources = {
  list: (
    orgId: string,
    params?: PaginateDto
  ) => Promise<AxiosListResponse<Models.OrganizationInvitation>>
  create: (
    orgId: string,
    reqBody: CreateInvitationDto
  ) => Promise<AxiosItemResponse<Models.OrganizationInvitation>>
  update: (
    orgId: string,
    invitationId: string,
    reqBody: { status: string }
  ) => Promise<AxiosItemResponse<Models.OrganizationInvitation>>
  delete: (orgId: string, invitationId: string) => Promise<AxiosDeleteResponse>
}
