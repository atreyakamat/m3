import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { travelRecord } from '@/db/schema';
import { outboxRepo } from '@/db/outbox';
import type { TravelRecordDto } from '@/api';

export interface LocalTravelRecord {
  id: string;
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
  syncState: 'LOCAL' | 'PENDING' | 'SYNCED' | 'FAILED';
  createdAt: string;
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const travelLocalRepo = {
  listAll(): LocalTravelRecord[] {
    try {
      const rows = getDb().select().from(travelRecord).orderBy(desc(travelRecord.createdAt)).all();
      return rows.map((r) => ({
        id: r.id,
        planningTravel: Boolean(r.planningTravel),
        departureDate: r.departureDate,
        returnDate: r.returnDate,
        destination: r.destination,
        state: r.state,
        hadFeverOrMalaria: Boolean(r.hadFeverOrMalaria),
        treatmentGiven: Boolean(r.treatmentGiven),
        completedCourse: Boolean(r.completedCourse),
        treatmentPlace: r.treatmentPlace,
        status: r.status,
        syncState: (r.syncState as LocalTravelRecord['syncState']) || 'LOCAL',
        createdAt: r.createdAt,
      }));
    } catch {
      return [];
    }
  },

  createRecord(
    data: {
      planningTravel: boolean;
      departureDate?: string | null;
      returnDate?: string | null;
      destination?: string | null;
      state?: string | null;
      hadFeverOrMalaria?: boolean;
      treatmentGiven?: boolean;
      completedCourse?: boolean;
      treatmentPlace?: string | null;
    },
    syncState: 'LOCAL' | 'PENDING' | 'SYNCED' = 'PENDING',
  ): LocalTravelRecord {
    const id = generateUuid();
    const idempotencyKey = generateUuid();
    const now = new Date().toISOString();

    getDb()
      .insert(travelRecord)
      .values({
        id,
        planningTravel: data.planningTravel,
        departureDate: data.departureDate ?? null,
        returnDate: data.returnDate ?? null,
        destination: data.destination ?? null,
        state: data.state ?? null,
        hadFeverOrMalaria: data.hadFeverOrMalaria ?? false,
        treatmentGiven: data.treatmentGiven ?? false,
        completedCourse: data.completedCourse ?? false,
        treatmentPlace: data.treatmentPlace ?? null,
        status: 'SUBMITTED',
        idempotencyKey,
        syncState,
        createdAt: now,
      })
      .run();

    if (syncState === 'PENDING') {
      outboxRepo.enqueue({
        entityType: 'travel_record',
        localId: id,
        payload: {
          planningTravel: data.planningTravel,
          departureDate: data.departureDate,
          returnDate: data.returnDate,
          destination: data.destination,
          state: data.state,
          hadFeverOrMalaria: data.hadFeverOrMalaria,
          treatmentGiven: data.treatmentGiven,
          completedCourse: data.completedCourse,
          treatmentPlace: data.treatmentPlace,
        },
        idempotencyKey,
      });
    }

    return {
      id,
      planningTravel: data.planningTravel,
      departureDate: data.departureDate ?? null,
      returnDate: data.returnDate ?? null,
      destination: data.destination ?? null,
      state: data.state ?? null,
      hadFeverOrMalaria: data.hadFeverOrMalaria ?? false,
      treatmentGiven: data.treatmentGiven ?? false,
      completedCourse: data.completedCourse ?? false,
      treatmentPlace: data.treatmentPlace ?? null,
      status: 'SUBMITTED',
      syncState,
      createdAt: now,
    };
  },

  saveRemoteRecords(remote: TravelRecordDto[]): void {
    const db = getDb();
    for (const r of remote) {
      const existing = db.select().from(travelRecord).where(eq(travelRecord.id, r.id)).get();
      if (!existing) {
        db.insert(travelRecord)
          .values({
            id: r.id,
            planningTravel: r.planningTravel,
            departureDate: r.departureDate,
            returnDate: r.returnDate,
            destination: r.destination,
            state: r.state,
            hadFeverOrMalaria: r.hadFeverOrMalaria,
            treatmentGiven: r.treatmentGiven,
            completedCourse: r.completedCourse,
            treatmentPlace: r.treatmentPlace,
            status: r.status,
            idempotencyKey: r.id,
            syncState: 'SYNCED',
            createdAt: r.createdAt,
          })
          .run();
      }
    }
  },
};
