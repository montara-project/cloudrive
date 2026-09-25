import { onboardingServices } from './onboarding'
import { organizationServices } from './organization'
import { providerServices } from './provider'
import { s3Services } from './s3'
import { storageAccountServices } from './storage-account'
import { workspaceServices } from './workspace'

export const services = {
  organization: organizationServices,
  workspaces: workspaceServices,
  provider: providerServices,
  storageAccount: storageAccountServices,
  s3: s3Services,
  onboarding: onboardingServices,
} as const
