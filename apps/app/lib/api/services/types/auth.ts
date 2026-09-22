import type { AxiosResponse } from 'axios'

import type { MagicLinkDto, RefreshDto, SignInDto } from '../../dtos/auth/schema'
import type { RefreshTokenResponse, TokenPairResponse } from '../../dtos/auth/types'
import type { Models } from '../../models'

export type AuthResources = {
  signIn: (reqBody: SignInDto) => Promise<AxiosResponse<TokenPairResponse>>
  signUp: (reqBody: { email: string; password: string; name: string }) => Promise<AxiosResponse>
  magicLinkSignIn: (
    reqBody: MagicLinkDto & { callback_url: string }
  ) => Promise<AxiosResponse<{ message?: string }>>
  magicLinkExchange: (reqBody: { token: string }) => Promise<AxiosResponse<TokenPairResponse>>
  profile: () => Promise<AxiosResponse<Models.User>>
  refresh: (reqBody: RefreshDto) => Promise<AxiosResponse<RefreshTokenResponse>>
  signOut: () => Promise<AxiosResponse>
}
