/** Shared transport vocabulary; UI components remain platform-specific. */
export const roles = ['worker','clinician','pathology','health_worker','research_lab','contractor'] as const
export type Role = typeof roles[number]
export const diagnosticStatuses = ['pending','positive','negative','indeterminate','cancelled'] as const
export const species = ['pf','pv','mixed','other','undetermined'] as const
