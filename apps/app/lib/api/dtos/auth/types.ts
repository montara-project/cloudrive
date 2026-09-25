// Authula's jwt.respond_json replaces the sign-in/exchange response body with
// the minted token pair. `expires_in` is today's lifetime field; the
// `expires_at` variants are accepted ahead of the server emitting absolute
// expiries for both tokens.
export interface TokenPairResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in?: number
  expires_at?: string | number
  refresh_expires_in?: number
  refresh_expires_at?: string | number
}

export type RefreshTokenResponse = TokenPairResponse
