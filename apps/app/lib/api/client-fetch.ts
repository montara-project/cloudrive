import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { isEmpty } from 'lodash'

import { getAccessToken } from '../auth/auth-client'
import { refreshTokens } from '../auth/refresh'
import { clearAuthTokens } from '../auth/token-storage'
import { AUTH_STORAGE_KEYS } from '../constants/auth'
import { ms } from '../date'

const timeout = ms('5m')

interface CreateAxiosProps {
  baseURL: string
  storageKey?: string
}

/** Marks a request that has already been replayed after a token rotation. */
type RetriedConfig = InternalAxiosRequestConfig & { _authRetried?: boolean }

/**
 * Create axios instance
 * @param params
 * @returns
 */
function createAxios({ baseURL, storageKey }: CreateAxiosProps) {
  // Bearer tokens only — the server does not issue session cookies, so no
  // credentials flag is needed.
  const axiosInstance = axios.create({ baseURL, timeout })

  // Interceptor Request
  if (storageKey && !isEmpty(storageKey)) {
    axiosInstance.interceptors.request.use(async (config) => {
      const currentConfig = { ...config }

      const accessToken = await getAccessToken()

      // Check Session if exists
      if (accessToken) {
        try {
          currentConfig.headers.Authorization = `Bearer ${accessToken}`
        } catch (error) {
          console.error(error)
        }
      }

      return currentConfig
    })
  }

  // Interceptor Response
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Network error')
      }

      if (error.response?.status === 401) {
        if (storageKey === AUTH_STORAGE_KEYS.AUTH_STORAGE) {
          // The access token we sent was rejected. Rotate once and replay the
          // request with the fresh token before giving up — clearing the
          // session here would sign the user out even though the refresh
          // token may still be perfectly valid. Auth endpoints themselves are
          // exempt: their 401 means bad credentials, not a stale token.
          const config = error.config as RetriedConfig | undefined

          if (config && !config._authRetried && !config.url?.includes('/v1/auth/')) {
            config._authRetried = true
            const accessToken = await refreshTokens()
            if (accessToken) {
              config.headers.Authorization = `Bearer ${accessToken}`
              return axiosInstance.request(config)
            }
          }

          clearAuthTokens()
          window.location.href = '/'
        }
        throw new Error('Unauthorized')
      }

      if (error.response?.status === 403) {
        throw new Error('Forbidden')
      }

      return Promise.reject(error)
    }
  )

  return axiosInstance
}

/**
 * Fetch API
 * @example
 * const fetchApi = new ClientFetchApi({ baseURL: 'https://api.example.com', storageKey: 'token' }).default
 * fetchApi.get('/users')
 */
export class ClientFetchApi {
  private _axiosInstance: AxiosInstance | null
  private readonly _baseURL: string
  private readonly _storageKey?: string

  constructor({ baseURL, storageKey }: CreateAxiosProps) {
    this._axiosInstance = null
    this._baseURL = baseURL
    this._storageKey = storageKey
  }

  public get default(): AxiosInstance {
    if (!this._axiosInstance) {
      this._axiosInstance = createAxios({
        baseURL: this._baseURL,
        storageKey: this._storageKey,
      })

      return this._axiosInstance
    }

    return this._axiosInstance
  }
}
