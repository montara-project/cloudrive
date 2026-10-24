import axios from 'axios'

import { env } from '@/config/env'

const TIME_OUT = 30_000 // 30 seconds

/**
 * The one axios instance every service uses. Served by the Go API, the site
 * shares its origin, so requests go to /v1/... relatively; VITE_API_URL points
 * it elsewhere for a split-origin setup.
 */
export const api = axios.create({
  baseURL: env.VITE_API_URL || undefined,
  timeout: TIME_OUT,
})
