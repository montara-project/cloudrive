import { getValidAccessToken } from './refresh'

/**
 * Resolve the access token attached to outgoing API requests.
 *
 * Goes through `getValidAccessToken`, so an expiring token is refreshed before
 * the request leaves — callers never attach a token that dies mid-flight.
 */
export const getAccessToken = async () => {
  return getValidAccessToken()
}
