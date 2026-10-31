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
    apiFetch<AuthResponse>('/auth/worker/login', { method: 'POST', body }),
};

export interface WorkerProfile {
  workerId: string;
  name: string;
  phone: string;
  preferredLanguage: Language;
  currentSite: { siteId: string; name: string; area: string; since: string } | null;
  screening: { status: string; completedAt: string | null };
  malariaStatus: MalariaStatus;
  episodeCount: number;
  prescriptionCount: number;
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
};

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

export const screeningApi = {
  get: (token: string) => apiFetch<unknown>('/screening/me', { token }),
  saveDraft: (token: string, answers: Record<string, unknown>, consentGiven: boolean) =>
    apiFetch('/screening/me/draft', { method: 'PUT', token, body: { answers, consentGiven } }),
  complete: (token: string, answers: Record<string, unknown>) =>
    apiFetch('/screening/me/complete', { method: 'POST', token, body: { answers, consentGiven: true } }),
};

export interface TravelRecordDto {
  id: string;
  workerId: string;
  planningTravel: boolean;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
  state: string | null;
  hadFeverOrMalaria: boolean;
  treatmentGiven: boolean;
  completedCourse: boolean;
  treatmentPlace: string | null;
  status: string;
  createdAt: string;
}

export const recordsApi = {
  diagnostics: (token: string) => apiFetch<unknown[]>('/records/me/diagnostics', { token }),
  currentPrescription: (token: string) => apiFetch<unknown>('/records/me/prescriptions/current', { token }),
  prescriptionHistory: (token: string) => apiFetch<unknown[]>('/records/me/prescriptions/history', { token }),
  followUps: (token: string) => apiFetch<unknown[]>('/records/me/follow-ups', { token }),
  travel: (token: string) => apiFetch<TravelRecordDto[]>('/records/me/travel', { token }),
  submitTravel: (token: string, body: Record<string, unknown>) =>
    apiFetch<TravelRecordDto>('/records/me/travel', { method: 'POST', token, body }),
  submitSymptom: (token: string, body: SymptomReportInput) =>
    apiFetch('/records/me/symptom-reports', { method: 'POST', token, body }),
  respondFollowUp: (token: string, body: { followUpId: string; response: string; note?: string }) =>
    apiFetch('/records/me/follow-ups/respond', { method: 'POST', token, body }),
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
