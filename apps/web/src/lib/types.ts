import type { MalariaStatus, TransferStatus, TransferInitiator } from '@m3/shared';

export interface WorkerProfile {
  workerId: string;
  name: string;
  phone: string;
  preferredLanguage: string;
  currentSite: { siteId: string; name: string; area: string; since: string } | null;
  screening: { status: string; completedAt: string | null };
  malariaStatus: MalariaStatus;
  episodeCount: number;
  prescriptionCount: number;
}

export interface LocationNodeDto {
  id: string;
  level: string;
  name: string;
  parentId: string | null;
}

export interface SiteDto {
  siteId: string;
  name: string;
  area: string;
  active: boolean;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TransferDto {
  id: string;
  workerId: string;
  fromSiteId: string | null;
  toSiteId: string;
  initiatorType: TransferInitiator;
  status: TransferStatus;
  note: string | null;
  createdAt: string;
  fromSite?: { siteCode: string; name: string } | null;
  toSite?: { siteCode: string; name: string } | null;
}

export interface DiagnosticDto {
  id: string;
  episodeId: string;
  testType: string;
  result: string;
  species: string | null;
  testDate: string;
}

export interface PrescriptionDto {
  id: string;
  episodeId: string;
  details: string;
  issuedAt: string;
}

export interface FollowUpDto {
  id: string;
  question: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}
