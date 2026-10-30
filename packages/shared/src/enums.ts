/** Domain enums shared across API, mobile and web. */

export const LANGUAGES = ['en', 'hi', 'bn', 'mr'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  bn: 'বাংলা (Bengali)',
  mr: 'मराठी (Marathi)',
};

/** Screening lifecycle. One completed baseline per worker. */
export const SCREENING_STATUS = ['DRAFT', 'COMPLETE'] as const;
export type ScreeningStatus = (typeof SCREENING_STATUS)[number];

/** Verified malaria status derived ONLY from authorized diagnostic records. */
export const MALARIA_STATUS = [
  'NO_RESULT', // no verified diagnostic result on record
  'AWAITING', // sample taken / test pending
  'POSITIVE',
  'NEGATIVE',
] as const;
export type MalariaStatus = (typeof MALARIA_STATUS)[number];

export const TEST_TYPE = ['RDT', 'MICROSCOPY'] as const;
export type TestType = (typeof TEST_TYPE)[number];

export const DIAGNOSTIC_RESULT = ['POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'] as const;
export type DiagnosticResultValue = (typeof DIAGNOSTIC_RESULT)[number];

export const PLASMODIUM_SPECIES = [
  'P_FALCIPARUM',
  'P_VIVAX',
  'MIXED',
  'OTHER',
  'UNKNOWN',
] as const;
export type PlasmodiumSpecies = (typeof PLASMODIUM_SPECIES)[number];

export const EPISODE_STATUS = ['SUSPECTED', 'CONFIRMED', 'RESOLVED'] as const;
export type EpisodeStatus = (typeof EPISODE_STATUS)[number];

/** Site-location hierarchy levels. */
export const LOCATION_LEVEL = ['STATE', 'DISTRICT', 'TALUKA', 'AREA'] as const;
export type LocationLevel = (typeof LOCATION_LEVEL)[number];

/** Who initiated a transfer request. */
export const TRANSFER_INITIATOR = ['WORKER', 'CONTRACTOR'] as const;
export type TransferInitiator = (typeof TRANSFER_INITIATOR)[number];

/**
 * Transfer request states (worker_architecture.md §17).
 * Worker-initiated: needs BOTH current + destination contractor approval.
 * Contractor-initiated (by destination contractor): needs worker acceptance
 * + current-site contractor approval; no extra destination approval.
 */
export const TRANSFER_STATUS = [
  'PENDING_WORKER_RESPONSE',
  'PENDING_CURRENT_CONTRACTOR',
  'PENDING_DESTINATION_CONTRACTOR',
  'ACCEPTED', // completed — site changed
  'REJECTED',
  'CANCELLED',
] as const;
export type TransferStatus = (typeof TRANSFER_STATUS)[number];

export const TRANSFER_TERMINAL_STATUSES: TransferStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
];

export const DECISION = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type Decision = (typeof DECISION)[number];

/** Local sync state for offline-first records (mobile). */
export const SYNC_STATE = ['LOCAL', 'PENDING', 'SYNCED', 'FAILED'] as const;
export type SyncState = (typeof SYNC_STATE)[number];
