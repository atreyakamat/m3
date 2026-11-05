import type {
  AuthUser,
  CreateWorkerTransferInput,
  Language,
  MalariaStatus,
  SymptomReportInput,
} from '@m3/shared';
import { apiFetch } from './client';

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  exists: (phone: string) => apiFetch<{ exists: boolean }>(`/auth/exists?phone=${encodeURIComponent(phone)}`),
  register: (body: { name: string; phone: string; pin: string; preferredLanguage: Language }) =>
    apiFetch<AuthResponse>('/auth/worker/register', { method: 'POST', body }),
  login: (body: { phone: string; pin: string }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body }),
  changeCredential: (token: string, body: { newCredential: string; confirmCredential: string }) =>
    apiFetch<AuthResponse>('/auth/change-credential', { method: 'POST', token, body }),
};

export interface WorkerProfile {
  workerId: string;
  name: string;
  phone: string;
  preferredLanguage: Language;
  currentSite: { siteId: string; name: string; area: string; since: string } | null;
  currentContractor?: { contractorId: string; name: string } | null;
  screening: { status: string; completedAt: string | null };
  malariaStatus: MalariaStatus;
  episodeCount: number;
  prescriptionCount: number;
}

export interface WorkerGeneratedPass {
  token: string;
  expiresAt: string;
  remainingSeconds: number;
  workerCode: string;
}

export interface WorkerPassStatusDto {
  workerCode: string;
  name: string;
  currentSite: { siteId: string; name: string; area?: string } | null;
  currentContractor: { contractorId: string; name: string } | null;
  activeToken: { expiresAt: string; remainingSeconds: number; tokenPrefix: string } | null;
  pendingTransfers: Array<{
    id: string;
    status: string;
    initiatorType: string;
    fromSite: { siteId: string; name: string } | null;
    toSite: { siteId: string; name: string };
    fromContractor: { contractorId: string; name: string } | null;
    toContractor: { contractorId: string; name: string } | null;
    workerDecision: string;
    createdAt: string;
    note?: string | null;
  }>;
}

export const workerApi = {
  me: (token: string) => apiFetch<WorkerProfile>('/workers/me', { token }),
  selectSite: (token: string, siteId: string) =>
    apiFetch('/workers/me/site', { method: 'POST', token, body: { siteId } }),
  updateLanguage: (token: string, language: Language) =>
    apiFetch<{ preferredLanguage: Language }>('/workers/me/language', {
      method: 'POST',
      token,
      body: { language },
    }),
  generatePass: (token: string) =>
    apiFetch<WorkerGeneratedPass>('/workers/me/pass/generate', { method: 'POST', token, body: {} }),
  passStatus: (token: string) =>
    apiFetch<WorkerPassStatusDto>('/workers/me/pass/status', { token }),
  revokePass: (token: string) =>
    apiFetch<{ revoked: boolean }>('/workers/me/pass/revoke', { method: 'POST', token, body: {} }),
  getHousehold: (token: string) =>
    apiFetch<HouseholdResponse>('/workers/me/household', { token }),
  addHousehold: (token: string, body: Record<string, unknown>) =>
    apiFetch<HouseholdMemberDto & { duplicateWarning?: boolean }>('/workers/me/household', { method: 'POST', token, body }),
  updateHousehold: (token: string, id: string, body: Record<string, unknown>) =>
    apiFetch<HouseholdMemberDto>(`/workers/me/household/${id}`, { method: 'PUT', token, body }),
  getCorrections: (token: string) =>
    apiFetch<any[]>('/workers/me/corrections', { token }),
  requestCorrection: (token: string, body: Record<string, unknown>) =>
    apiFetch('/workers/me/corrections', { method: 'POST', token, body }),
  consentInstall: (token: string, body: { consentVersion: string; language: string; status: string; deviceInfo?: string }) =>
    apiFetch('/workers/me/consent/install', { method: 'POST', token, body }),
  consentSubmission: (token: string, body: { consentVersion: string; language: string; status: string; screeningId?: string; deviceInfo?: string }) =>
    apiFetch('/workers/me/consent/submission', { method: 'POST', token, body }),
};

export interface HouseholdMemberDto {
  id: string;
  memberCode: string;
  fullName: string | null;
  gender: string | null;
  ageOrDob: string | null;
  relationship: string;
  isDependent: boolean;
  livesInSameRoom: boolean;
  phoneAvailable: boolean;
  phone: string | null;
  duplicateWarning?: boolean;
}

export interface HouseholdResponse {
  members: HouseholdMemberDto[];
  stats: {
    totalCount: number;
    dependentCount: number;
    roommateCount: number;
  };
}

export interface SiteSummary {
  siteId: string;
  name: string;
  area: string;
  active: boolean;
}
export interface LocationNodeDto {
  id: string;
  level: string;
  name: string;
  parentId: string | null;
}

export const sitesApi = {
  locations: (token: string, level?: string, parentId?: string) => {
    const q = new URLSearchParams();
    if (level) q.set('level', level);
    if (parentId) q.set('parentId', parentId);
    return apiFetch<LocationNodeDto[]>(`/sites/locations?${q.toString()}`, { token });
  },
  search: (token: string, search?: string, areaId?: string) => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (areaId) q.set('areaId', areaId);
    return apiFetch<{ items: SiteSummary[]; total: number }>(`/sites?${q.toString()}`, { token });
  },
};

export interface ScreeningRecordDto {
  id: string;
  workerId: string;
  status: string;
  version: string;
  consentGiven: boolean;
  answers: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const screeningApi = {
  get: (token: string) => apiFetch<ScreeningRecordDto | null>('/screening/me', { token }),
  saveDraft: (token: string, answers: Record<string, unknown>, consentGiven: boolean) =>
    apiFetch('/screening/me/draft', { method: 'PUT', token, body: { answers, consentGiven } }),
  complete: (
    token: string,
    answers: Record<string, unknown>,
    extra?: { isAssisted?: boolean; assistedByStaffId?: string | null },
  ) =>
    apiFetch('/screening/me/complete', {
      method: 'POST',
      token,
      body: {
        answers,
        consentGiven: true,
        isAssisted: extra?.isAssisted ?? false,
        assistedByStaffId: extra?.assistedByStaffId ?? null,
      },
    }),
};

export interface TravelRecordDto {
  id: string;
  workerId: string;
  direction?: string | null;
  departureStatus?: string | null;
  planningTravel: boolean;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
  state: string | null;
  originState?: string | null;
  originDistrict?: string | null;
  hadFeverOrMalaria: boolean;
  treatmentGiven: boolean;
  completedCourse: boolean;
  treatmentPlace: string | null;
  status: string;
  createdAt: string;
}

export interface DiagnosticDto {
  id: string;
  episodeId: string;
  testType: string;
  result: string;
  species?: string | null;
  testDate: string;
}

export interface PrescriptionDto {
  id: string;
  episodeId: string;
  workerId: string;
  details: string;
  issuedAt: string;
  issuedById?: string | null;
}

export interface FollowUpDto {
  id: string;
  workerId: string;
  episodeId?: string | null;
  question: string;
  response: string | null;
  note?: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface EpisodeDto {
  id: string;
  workerId: string;
  status: string;
  onsetDate: string | null;
  createdAt: string;
  diagnostics: DiagnosticDto[];
  prescriptions: PrescriptionDto[];
}

export const recordsApi = {
  episodes: (token: string) => apiFetch<EpisodeDto[]>('/records/me/episodes', { token }),
  diagnostics: (token: string) => apiFetch<DiagnosticDto[]>('/records/me/diagnostics', { token }),
  currentPrescription: (token: string) => apiFetch<PrescriptionDto | null>('/records/me/prescriptions/current', { token }),
  prescriptionHistory: (token: string) => apiFetch<PrescriptionDto[]>('/records/me/prescriptions/history', { token }),
  followUps: (token: string) => apiFetch<FollowUpDto[]>('/records/me/follow-ups', { token }),
  travel: (token: string) => apiFetch<TravelRecordDto[]>('/records/me/travel', { token }),
  submitTravel: (token: string, body: Record<string, unknown>) =>
    apiFetch<TravelRecordDto>('/records/me/travel', { method: 'POST', token, body }),
  submitSymptom: (token: string, body: SymptomReportInput) =>
    apiFetch('/records/me/symptom-reports', { method: 'POST', token, body }),
  respondFollowUp: (token: string, body: { followUpId: string; response: string; note?: string }) =>
    apiFetch('/records/me/follow-ups/respond', { method: 'POST', token, body }),
};

export const travelApi = {
  leave: (token: string, body: Record<string, unknown>) =>
    apiFetch<TravelRecordDto>('/travel/leave', { method: 'POST', token, body }),
  enter: (token: string, body: Record<string, unknown>) =>
    apiFetch<TravelRecordDto>('/travel/enter', { method: 'POST', token, body }),
  cancel: (token: string, travelRecordId: string, reason?: string) =>
    apiFetch('/travel/my-record/cancel', { method: 'POST', token, body: { travelRecordId, reason } }),
};

export interface TransferDto {
  id: string;
  status: string;
  fromSite: { siteCode: string; name: string } | null;
  toSite: { siteCode: string; name: string };
  initiatorType: string;
  createdAt: string;
}

export const transferApi = {
  mine: (token: string) => apiFetch<TransferDto[]>('/transfers/me', { token }),
  create: (token: string, body: CreateWorkerTransferInput) =>
    apiFetch<TransferDto>('/transfers/worker', { method: 'POST', token, body }),
  accept: (token: string, id: string) => apiFetch(`/transfers/${id}/worker/accept`, { method: 'POST', token, body: {} }),
  reject: (token: string, id: string) => apiFetch(`/transfers/${id}/worker/reject`, { method: 'POST', token, body: {} }),
  cancel: (token: string, id: string) => apiFetch(`/transfers/${id}/cancel`, { method: 'POST', token, body: {} }),
};

// ---- Contractor APIs ----

export interface ContractorProfile {
  contractorId: string;
  name: string;
  phone: string;
  active: boolean;
  createdAt: string;
  assignedSites: Array<{
    siteId: string;
    name: string;
    area: string;
    activeWorkers: number;
  }>;
}

export interface ContractorSiteSummary {
  siteId: string;
  name: string;
  area: string;
  activeWorkers: number;
}

export interface ContractorSiteStats {
  siteCode: string;
  siteName: string;
  totalWorkers: number;
  positive: number;
  negative: number;
  awaitingResults: number;
  noResultRecorded: number;
  lastUpdated: string;
}

export interface ContractorWorkerRow {
  workerId: string;
  patientId: string;
  name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
}

export interface ContractorWorkerDetail {
  workerId: string;
  patientId: string;
  name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  dependantsCount?: number;
  currentSite: {
    siteId: string;
    name: string;
  };
  malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
}

export interface ContractorJoinRequest {
  joinRequestId: string;
  workerId: string;
  workerName: string;
  phone: string;
  age: number | null;
  gender: string | null;
  siteId: string;
  siteName: string;
  createdAt: string;
  status: string;
  decidedAt: string | null;
}

export interface ContractorTransferRow {
  transferId: string;
  workerId: string;
  workerName: string;
  currentSite: { siteId: string; name: string } | null;
  destinationSite: { siteId: string; name: string };
  initiator: string;
  currentContractorApproval: string;
  destinationContractorApproval: string;
  workerAcceptance: string;
  status: string;
  createdAt: string;
  effectiveAt: string | null;
  isAwaitingMyApproval: boolean;
}

export interface ContractorTravelRow {
  travelRecordId: string;
  workerId: string;
  workerName: string;
  phone: string;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
  state: string | null;
  status: string;
  isUpcoming: boolean;
  malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
  isSevenDayAlert: boolean;
  hasReport: boolean;
  reportId: string | null;
  reportStatus: string | null;
}

export interface ContractorNotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

export interface WorkerPassIdentityConfirmationDto {
  workerCode: string;
  name: string;
  currentSite: { siteId: string; name: string } | null;
  currentContractor: { contractorId: string; name: string } | null;
  hasActiveAssignment: boolean;
  isAssignedToCaller: boolean;
  pendingTransfer: {
    id: string;
    status: string;
    fromSite: string | null;
    toSite: string;
    initiator: string;
    createdAt: string;
  } | null;
  canRequest: boolean;
  reason?: string;
  token: string;
}

export interface ContractorPassRequestResult {
  transferId?: string;
  assignmentId?: string;
  directAssignment: boolean;
  status: string;
  message: string;
}

export interface ContractorPhoneCheckResult {
  exists: boolean;
  workerCode?: string;
  name?: string;
  currentSite?: { siteId: string; name: string } | null;
  currentContractor?: string | null;
}

export const contractorApi = {
  profile: (token: string) =>
    apiFetch<ContractorProfile>('/contractor/profile', { token }),
  sites: async (token: string) => {
    const p = await apiFetch<ContractorProfile>('/contractor/profile', { token });
    return p.assignedSites ?? [];
  },
  stats: (token: string, siteCode: string) =>
    apiFetch<ContractorSiteStats>(`/contractor/sites/${siteCode}/stats`, { token }),
  workers: (token: string, siteCode: string, query?: { search?: string; malaria?: string }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.malaria) params.set('malaria', query.malaria);
    const qs = params.toString();
    return apiFetch<{ items: ContractorWorkerRow[]; total: number }>(
      `/contractor/sites/${siteCode}/workers${qs ? `?${qs}` : ''}`,
      { token },
    );
  },
  workerDetail: (token: string, workerCode: string) =>
    apiFetch<ContractorWorkerDetail>(`/contractor/workers/${workerCode}`, { token }),
  joinRequests: (token: string, siteCode: string, status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<{ items: ContractorJoinRequest[]; total: number }>(
      `/contractor/sites/${siteCode}/join-requests${qs}`,
      { token },
    );
  },
  decideJoinRequest: (token: string, id: string, approve: boolean) =>
    apiFetch<{ joinRequestId: string; status: string }>(`/join-requests/${id}/decide`, {
      method: 'POST',
      token,
      body: { approve },
    }),
  transfers: (token: string, siteCode: string, status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<{ items: ContractorTransferRow[]; total: number }>(
      `/contractor/sites/${siteCode}/transfers${qs}`,
      { token },
    );
  },
  approveTransfer: (token: string, id: string, reason?: string) =>
    apiFetch(`/transfers/${id}/contractor/approve`, {
      method: 'POST',
      token,
      body: { reason },
    }),
  rejectTransfer: (token: string, id: string, reason: string) =>
    apiFetch(`/transfers/${id}/contractor/reject`, {
      method: 'POST',
      token,
      body: { reason },
    }),
  initiateTransfer: (token: string, body: { workerCode: string; destinationSiteId: string; reason?: string }) =>
    apiFetch('/transfers/contractor', {
      method: 'POST',
      token,
      body,
    }),
  travels: (token: string, siteCode: string) =>
    apiFetch<{ items: ContractorTravelRow[]; total: number }>(
      `/contractor/sites/${siteCode}/travels`,
      { token },
    ),
  submitTravelReport: (token: string, body: { workerId: string; travelRecordId: string; comment: string }) =>
    apiFetch<{ id: string; status: string }>('/travel/reports', {
      method: 'POST',
      token,
      body,
    }),
  notifications: (token: string, unreadOnly?: boolean) => {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    return apiFetch<{ items: ContractorNotificationRow[]; unread: number }>(
      `/contractor/notifications${qs}`,
      { token },
    );
  },
  ackNotification: (token: string, id: string) =>
    apiFetch<{ id: string; read: boolean }>(`/contractor/notifications/${id}/ack`, {
      method: 'POST',
      token,
      body: {},
    }),
  scanPass: (token: string, passToken: string) =>
    apiFetch<WorkerPassIdentityConfirmationDto>('/contractor/pass/scan', {
      method: 'POST',
      token,
      body: { token: passToken },
    }),
  requestPass: (
    token: string,
    body: { token: string; siteCode: string; note?: string },
  ) =>
    apiFetch<ContractorPassRequestResult>('/contractor/pass/request', {
      method: 'POST',
      token,
      body,
    }),
  checkWorkerPhone: (token: string, phone: string) =>
    apiFetch<ContractorPhoneCheckResult>(
      `/contractor/workers/check-phone?phone=${encodeURIComponent(phone)}`,
      { token },
    ),
};

// ---- Health Worker APIs ----

export interface HealthWorkerFacility {
  id: string;
  facilityCode: string;
  name: string;
  type: string;
  district: string;
  taluka: string;
}

export interface HealthWorkerProfile {
  userId: string;
  displayName: string;
  staffCode: string | null;
  phone: string | null;
  role: string;
  assignedFacilities: HealthWorkerFacility[];
  activeFacility: HealthWorkerFacility | null;
}

export interface HealthWorkerDashboardDto {
  facility: HealthWorkerFacility;
  totalAssignedWorkers: number;
  awaitingScreening: number;
  screenedCount: number;
  suspectedCases: number;
  confirmedPositiveCases: number;
  confirmedNegativeCases: number;
  pendingFollowUps: number;
  newTravelArrivals: number;
  newFeelingUnwellReports: number;
}

export interface HealthWorkerSearchWorker {
  id: string;
  workerCode: string;
  name: string;
  phone: string;
  preferredLanguage: string;
  currentSite: string | null;
  screeningStatus: string;
  latestMalariaStatus: string;
}

export interface HealthWorkerSearchHousehold {
  id: string;
  memberCode: string;
  fullName: string | null;
  relationship: string;
  ageOrDob: string | null;
  gender: string | null;
  isDependent: boolean;
  primaryWorker: {
    id: string;
    workerCode: string;
    name: string;
  };
  latestAssessment: {
    assessedAt: string;
    diagnosis?: string | null;
    testResult?: string | null;
  } | null;
}

export interface HealthWorkerSearchResult {
  workers: HealthWorkerSearchWorker[];
  householdMembers: HealthWorkerSearchHousehold[];
}

export const healthWorkerApi = {
  me: (token: string) =>
    apiFetch<HealthWorkerProfile>('/health-worker/me', { token }),
  setActiveFacility: (token: string, facilityId: string) =>
    apiFetch<{ activeFacility: HealthWorkerFacility; switchedAt: string }>(
      '/health-worker/active-facility',
      { method: 'POST', token, body: { facilityId } },
    ),
  dashboard: (token: string, facilityId?: string) => {
    const qs = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    return apiFetch<HealthWorkerDashboardDto>(`/health-worker/dashboard${qs}`, { token });
  },
  search: (token: string, q: string, facilityId?: string) => {
    const params = new URLSearchParams({ q });
    if (facilityId) params.set('facilityId', facilityId);
    return apiFetch<HealthWorkerSearchResult>(`/health-worker/search?${params.toString()}`, { token });
  },
  worker: (token: string, id: string) =>
    apiFetch<any>(`/health-worker/workers/${id}`, { token }),
  householdMember: (token: string, id: string) =>
    apiFetch<any>(`/health-worker/household-members/${id}`, { token }),
  recordScreening: (token: string, body: Record<string, unknown>) =>
    apiFetch<any>('/health-worker/screening', { method: 'POST', token, body }),
  recordHouseholdScreening: (token: string, body: Record<string, unknown>) =>
    apiFetch<any>('/health-worker/household-screening', { method: 'POST', token, body }),
  recordSuspectedCase: (token: string, body: Record<string, unknown>) =>
    apiFetch<any>('/health-worker/cases', { method: 'POST', token, body }),
  recordTestRequest: (token: string, body: Record<string, unknown>) =>
    apiFetch<any>('/health-worker/test-requests', { method: 'POST', token, body }),
  followUps: (token: string, facilityId: string) =>
    apiFetch<any[]>(`/health-worker/follow-ups?facilityId=${encodeURIComponent(facilityId)}`, { token }),
  recordFollowUp: (token: string, body: Record<string, unknown>) =>
    apiFetch<any>('/health-worker/follow-ups', { method: 'POST', token, body }),
  travelArrivals: (token: string, facilityId: string) =>
    apiFetch<any[]>(`/health-worker/travel-arrivals?facilityId=${encodeURIComponent(facilityId)}`, { token }),
  arrivalScreening: (token: string, travelId: string, body: Record<string, unknown>) =>
    apiFetch<any>(`/travel/${travelId}/arrival-screening`, { method: 'POST', token, body }),
  symptomReports: (token: string, facilityId: string) =>
    apiFetch<any[]>(`/health-worker/symptom-reports?facilityId=${encodeURIComponent(facilityId)}`, { token }),
  reviewSymptomReport: (token: string, id: string, actionTaken: string) =>
    apiFetch<any>(`/health-worker/symptom-reports/${id}/review`, {
      method: 'POST',
      token,
      body: { actionTaken },
    }),
};
