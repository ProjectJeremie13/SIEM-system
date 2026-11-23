import Dexie, { type Table } from 'dexie';
import type {
  Alert,
  AuditEvent,
  Case,
  CaseEvent,
  EvidenceMeta,
  LabAttempt,
  Role,
  SegmentState,
  ThemeConfig,
} from '../domain/types';

export interface EvidenceBlobRecord {
  id: string;
  blob: Blob;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class KobosecDatabase extends Dexie {
  cases!: Table<Case, string>;
  alerts!: Table<Alert, string>;
  caseEvents!: Table<CaseEvent, string>;
  evidenceMeta!: Table<EvidenceMeta, string>;
  evidenceBlobs!: Table<EvidenceBlobRecord, string>;
  auditEvents!: Table<AuditEvent, string>;
  labAttempts!: Table<LabAttempt, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('kobosec_siem_v1');
    this.version(1).stores({
      cases: 'id, ref, status, type, priority, openedAt, alertId',
      alerts: 'id, dedupeKey, status, severity, scenarioKey, lastSeen',
      caseEvents: 'id, caseId, createdAt',
      evidenceMeta: 'id, caseId, sha256, capturedAt',
      evidenceBlobs: 'id',
      auditEvents: 'id, occurredAt, objectType, objectId',
      labAttempts: 'id, targetId, scenarioKey, completedAt',
      meta: 'key',
    });
  }
}

export const db = new KobosecDatabase();

export interface PersistedPreferences {
  theme: ThemeConfig;
  role: Role;
  aiEnabled: boolean;
  seed: number;
  autoInject: boolean;
  segments: SegmentState[];
}
