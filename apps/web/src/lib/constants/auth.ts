export const AUTH_STORAGE_KEYS = {
  REFRESH_TOKEN: 'authRefreshToken',
  ACCESS_TOKEN: 'authAccessToken',
  ID_TOKEN: 'authIdToken',
  USER: 'authUser',
  ACCESS_TOKEN_EXPIRES_AT: 'authAccessTokenExpiresAt',
  REFRESH_TOKEN_EXPIRES_AT: 'authRefreshTokenExpiresAt',
  AUTH_STORAGE: 'authStorage',
} as const

/** How often the session probe re-checks `/v1/me` while signed in. */
export const SESSION_POLL_INTERVAL_MS = 60_000

export enum AUTH_ERROR_TYPE {
  INVALID_LOGIN_CREDENTIALS = 'INVALID_LOGIN_CREDENTIALS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
}

export enum AUTH_PROVIDER {
  GOOGLE = 'google',
  CUSTOM = 'custom',
}
