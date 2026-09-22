// Authula's jwt.respond_json replaces the sign-in/exchange response body with
// the minted token pair.
export interface TokenPairResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in?: number
}

export type RefreshTokenResponse = TokenPairResponse
