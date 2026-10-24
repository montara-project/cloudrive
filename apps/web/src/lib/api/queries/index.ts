import { contactQueries } from './contact'
import { waitlistQueries } from './waitlist'

export const queries = {
  contact: contactQueries,
  waitlist: waitlistQueries,
} as const
