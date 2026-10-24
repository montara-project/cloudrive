import { contactServices } from './contact'
import { waitlistServices } from './waitlist'

export const services = {
  contact: contactServices,
  waitlist: waitlistServices,
} as const
