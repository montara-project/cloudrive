import { authServices } from './auth'
import { organizationServices } from './organization'
import { providerServices } from './provider'
import { s3Services } from './s3'
import { storageAccountServices } from './storage-account'
import { workspaceServices } from './workspace'

export const services = {
  auth: authServices,
  organization: organizationServices,
  workspaces: workspaceServices,
  provider: providerServices,
  storageAccount: storageAccountServices,
  s3: s3Services,
} as const
