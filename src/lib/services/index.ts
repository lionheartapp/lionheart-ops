export * from '@/lib/services/ai/gemini.service'
export * from '@/lib/services/operations/engine'
export * from '@/lib/services/organizationService'
export * from '@/lib/services/organizationRegistrationService'

import * as orgService from './organizationService'
import * as regService from './organizationRegistrationService'

export const organizationService = {
  getOrganizationBranding: orgService.getOrganizationBranding,
  updateOrganizationBranding: orgService.updateOrganizationBranding,
}

export const organizationRegistrationService = {
  createOrganization: regService.createOrganization,
}
