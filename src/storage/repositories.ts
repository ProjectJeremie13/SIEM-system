import { transitionCase, type ClosureInput } from '../domain/caseMachine';
import { ExportBundleSchema, ThemeConfigSchema } from '../domain/schemas';
import type {
  Alert,
  AuditEvent,
  Case,
  CaseEvent,
  CaseStatus,
  CaseType,
  EvidenceMeta,
  LabAttempt,
  Role,
  ScenarioKey,
  SegmentName,
  SegmentState,
  Severity,
  ThemeConfig,
} from '../domain/types';
import { createUuid, SeededRng, sha256Hex } from '../sim/rng';
import { INITIAL_SEGMENTS, SCENARIOS } from '../sim/scenarios';
import { DEFAULT_THEME_CONFIG } from '../themes/presets';
import { db } from './db';

const CHANNEL_NAME = 'kobosec_siem_sync';
let syncChannel: BroadcastChannel | null = null;

function notifySync(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  if (!syncChannel) {
    syncChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  syncChannel.postMessage({ type: 'refresh', at: Date.now() });
}

export function subscribeSync(onRefresh: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(CHANNEL_NAME);
  ch.onmessage = () => onRefresh();
  return () => ch.close();
}

async function nextSequence(name: string): Promise<number> {
  return db.transaction('rw', db.meta, async () => {
    const rec = await db.meta.get(name);
    const nextVal = typeof rec?.value === 'number' ? rec.value + 1 : 1;
    await db.meta.put({ key: name, value: nextVal });
    return nextVal;
  });
}

export const settingsRepo = {
  async getTheme(): Promise<ThemeConfig> {
    const rec = await db.meta.get('theme');
    if (rec?.value) {
      const parsed = ThemeConfigSchema.safeParse(rec.value);
      if (parsed.success) return parsed.data;
    }
    return DEFAULT_THEME_CONFIG;
  },

  async saveTheme(theme: ThemeConfig): Promise<void> {
    await db.meta.put({ key: 'theme', value: theme });
    try {
      localStorage.setItem('kobosec_theme_cache', JSON.stringify(theme));
    } catch {
      // ignore storage quota errors on cache
    }
    notifySync();
  },

  async getRole(): Promise<Role> {
    const rec = await db.meta.get('role');
    return (rec?.value as Role) || 'analyst';
  },

  async setRole(role: Role): Promise<void> {
    await db.meta.put({ key: 'role', value: role });
    notifySync();
  },

  async getAiEnabled(): Promise<boolean> {
    const rec = await db.meta.get('aiEnabled');
    return typeof rec?.value === 'boolean' ? rec.value : true;
  },

  async setAiEnabled(enabled: boolean): Promise<void> {
    await db.meta.put({ key: 'aiEnabled', value: enabled });
    notifySync();
  },

  async getSeed(): Promise<number> {
    const rec = await db.meta.get('seed');
    return typeof rec?.value === 'number' ? rec.value : 20261123;
  },

  async setSeed(seed: number): Promise<void> {
    await db.meta.put({ key: 'seed', value: seed });
    notifySync();
  },

  async getSegments(): Promise<SegmentState[]> {
    const rec = await db.meta.get('segments');
    if (Array.isArray(rec?.value) && rec.value.length === INITIAL_SEGMENTS.length) {
      return rec.value as SegmentState[];
    }
    return INITIAL_SEGMENTS;
  },

  async setSegments(segments: SegmentState[], actor: string, role: Role, detail: string): Promise<void> {
    await db.transaction('rw', db.meta, db.auditEvents, async () => {
      await db.meta.put({ key: 'segments', value: segments });
      await db.auditEvents.add({
        id: createUuid(),
        actor,
        role,
        action: 'segment.updated',
        objectType: 'segment',
        objectId: 'network-map',
        summary: detail,
        occurredAt: new Date().toISOString(),
      });
    });
    notifySync();
  },
};

export const auditRepo = {
  async list(limit = 200): Promise<AuditEvent[]> {
    return db.auditEvents.orderBy('occurredAt').reverse().limit(limit).toArray();
  },

  async append(entry: Omit<AuditEvent, 'id' | 'occurredAt'>): Promise<AuditEvent> {
    const full: AuditEvent = {
      ...entry,
      id: createUuid(),
      occurredAt: new Date().toISOString(),
    };
    await db.auditEvents.add(full);
    notifySync();
    return full;
  },
};

export const alertRepo = {
  async list(): Promise<Alert[]> {
    return db.alerts.orderBy('lastSeen').reverse().toArray();
  },

  async upsertFromDetection(input: {
    detectionKey: string;
    detectionVersion: number;
    scenarioKey: ScenarioKey;
    title: string;
    segment: SegmentName;
    sourceIp: string;
    severity: Severity;
    riskScore: number;
  }): Promise<{ alert: Alert; isNew: boolean }> {
    const now = new Date().toISOString();
    const dedupeKey = `${input.detectionKey}:${input.segment}:${input.sourceIp}`;
    const existing = await db.alerts
      .where('dedupeKey')
      .equals(dedupeKey)
      .filter((a) => a.status === 'open' || a.status === 'ack')
      .first();

    if (existing) {
      const updated: Alert = {
        ...existing,
        lastSeen: now,
        sampleCount: existing.sampleCount + 1,
        riskScore: Math.max(existing.riskScore, input.riskScore),
      };
      await db.alerts.put(updated);
      notifySync();
      return { alert: updated, isNew: false };
    }

    const created: Alert = {
      id: createUuid(),
      detectionKey: input.detectionKey,
      detectionVersion: input.detectionVersion,
      scenarioKey: input.scenarioKey,
      title: input.title,
      segment: input.segment,
      sourceIp: input.sourceIp,
      severity: input.severity,
      status: 'open',
      riskScore: input.riskScore,
      dedupeKey,
      firstSeen: now,
      lastSeen: now,
      sampleCount: 1,
      linkedCaseId: null,
    };
    await db.alerts.add(created);
    await auditRepo.append({
      actor: 'Detection Engine',
      role: 'admin',
      action: 'alert.opened',
      objectType: 'alert',
      objectId: created.id,
      summary: `Opened ${created.severity.toUpperCase()} alert: ${created.title} (${created.segment})`,
    });
    notifySync();
    return { alert: created, isNew: true };
  },

  async updateStatus(
    alertId: string,
    status: Alert['status'],
    actor: string,
    role: Role
  ): Promise<Alert> {
    const alert = await db.alerts.get(alertId);
    if (!alert) throw new Error('Alert not found.');
    const updated: Alert = { ...alert, status };
    await db.alerts.put(updated);
    await auditRepo.append({
      actor,
      role,
      action: `alert.${status}`,
      objectType: 'alert',
      objectId: alertId,
      summary: `Alert "${alert.title}" marked ${status}`,
    });
    notifySync();
    return updated;
  },
};

export const caseRepo = {
  async list(): Promise<Case[]> {
    return db.cases.orderBy('openedAt').reverse().toArray();
  },

  async getByRefAndCode(ref: string, code: string): Promise<Case | null> {
    const c = await db.cases.where('ref').equals(ref.trim().toUpperCase()).first();
    if (!c) return null;
    if (c.trackingCode !== code.trim()) return null;
    return c;
  },

  async getEvents(caseId: string): Promise<CaseEvent[]> {
    return db.caseEvents.where('caseId').equals(caseId).sortBy('createdAt');
  },

  async create(input: {
    type: CaseType;
    priority: Severity;
    impact: Case['impact'];
    segment: SegmentName;
    scenarioKey: ScenarioKey | null;
    reporterName: string;
    title: string;
    summary: string;
    stepsToReproduce?: string;
    sourceIp?: string;
    alertId?: string | null;
    seed: number;
    actorRole: Role;
  }): Promise<Case> {
    const seq = await nextSequence(`seq_${input.type}`);
    const year = new Date().getUTCFullYear();
    const ref = `${input.type}-${year}-${String(seq).padStart(6, '0')}`;
    const rng = new SeededRng(input.seed + seq * 97);
    const trackingCode = String(rng.int(100000, 999999));
    const now = new Date().toISOString();

    const record: Case = {
      id: createUuid(),
      ref,
      trackingCode,
      type: input.type,
      status: input.alertId ? 'triaged' : 'new',
      priority: input.priority,
      impact: input.impact,
      segment: input.segment,
      scenarioKey: input.scenarioKey,
      reporterName: input.reporterName.trim() || 'Anonymous Reporter',
      assigneeRole: input.alertId ? input.actorRole : null,
      alertId: input.alertId ?? null,
      title: input.title.trim(),
      summary: input.summary.trim(),
      stepsToReproduce: input.stepsToReproduce?.trim() || undefined,
      sourceIp: input.sourceIp?.trim() || undefined,
      seed: input.seed,
      version: 1,
      openedAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', db.cases, db.caseEvents, db.alerts, db.auditEvents, async () => {
      await db.cases.add(record);
      await db.caseEvents.add({
        id: createUuid(),
        caseId: record.id,
        actor: record.reporterName,
        kind: 'created',
        body: `${record.type} case ${record.ref} opened (${record.segment})`,
        createdAt: now,
      });
      if (input.alertId) {
        const linked = await db.alerts.get(input.alertId);
        if (linked) {
          await db.alerts.put({ ...linked, status: 'ack', linkedCaseId: record.id });
        }
      }
      await db.auditEvents.add({
        id: createUuid(),
        actor: record.reporterName,
        role: input.actorRole,
        action: 'case.created',
        objectType: 'case',
        objectId: record.ref,
        summary: `Opened ${record.ref}: ${record.title}`,
        occurredAt: now,
      });
    });

    notifySync();
    return record;
  },

  async transition(
    caseId: string,
    nextStatus: CaseStatus,
    actor: string,
    role: Role,
    note?: string,
    closure?: ClosureInput
  ): Promise<Case> {
    const current = await db.cases.get(caseId);
    if (!current) throw new Error('Case not found.');
    const now = new Date().toISOString();
    const updated = transitionCase(current, nextStatus, closure, now);
    if (nextStatus === 'triaged' && !updated.assigneeRole) {
      updated.assigneeRole = role;
    }

    await db.transaction('rw', db.cases, db.caseEvents, db.alerts, db.auditEvents, async () => {
      await db.cases.put(updated);
      await db.caseEvents.add({
        id: createUuid(),
        caseId: updated.id,
        actor,
        kind: nextStatus === 'closed' ? 'closed' : nextStatus === 'triaged' ? 'triaged' : 'status',
        body: note?.trim()
          ? `Status → ${nextStatus}: ${note.trim()}`
          : `Status transitioned from ${current.status} to ${nextStatus}`,
        createdAt: now,
      });

      if (nextStatus === 'closed' && updated.alertId) {
        const alert = await db.alerts.get(updated.alertId);
        if (alert) {
          await db.alerts.put({ ...alert, status: 'closed' });
        }
      }

      await db.auditEvents.add({
        id: createUuid(),
        actor,
        role,
        action: `case.${nextStatus}`,
        objectType: 'case',
        objectId: updated.ref,
        summary: `${updated.ref} transitioned ${current.status} → ${nextStatus}`,
        occurredAt: now,
      });
    });

    notifySync();
    return updated;
  },

  async assignRole(caseId: string, assigneeRole: Role, actor: string, role: Role): Promise<Case> {
    const current = await db.cases.get(caseId);
    if (!current) throw new Error('Case not found.');
    const now = new Date().toISOString();
    const updated: Case = {
      ...current,
      assigneeRole,
      version: current.version + 1,
      updatedAt: now,
    };
    await db.transaction('rw', db.cases, db.caseEvents, db.auditEvents, async () => {
      await db.cases.put(updated);
      await db.caseEvents.add({
        id: createUuid(),
        caseId: updated.id,
        actor,
        kind: 'comment',
        body: `Assigned to role: ${assigneeRole}`,
        createdAt: now,
      });
      await db.auditEvents.add({
        id: createUuid(),
        actor,
        role,
        action: 'case.assigned',
        objectType: 'case',
        objectId: updated.ref,
        summary: `Assigned ${updated.ref} to ${assigneeRole}`,
        occurredAt: now,
      });
    });
    notifySync();
    return updated;
  },

  async addComment(caseId: string, actor: string, role: Role, body: string): Promise<void> {
    const current = await db.cases.get(caseId);
    if (!current) throw new Error('Case not found.');
    const now = new Date().toISOString();
    await db.transaction('rw', db.caseEvents, db.auditEvents, async () => {
      await db.caseEvents.add({
        id: createUuid(),
        caseId,
        actor,
        kind: 'comment',
        body: body.trim(),
        createdAt: now,
      });
      await db.auditEvents.add({
        id: createUuid(),
        actor,
        role,
        action: 'case.comment',
        objectType: 'case',
        objectId: current.ref,
        summary: `Added timeline note to ${current.ref}`,
        occurredAt: now,
      });
    });
    notifySync();
  },
};

export const evidenceRepo = {
  async listForCase(caseId: string): Promise<EvidenceMeta[]> {
    return db.evidenceMeta.where('caseId').equals(caseId).sortBy('capturedAt');
  },

  async listAll(): Promise<EvidenceMeta[]> {
    return db.evidenceMeta.orderBy('capturedAt').reverse().toArray();
  },

  async getBlob(evidenceId: string): Promise<Blob | null> {
    const rec = await db.evidenceBlobs.get(evidenceId);
    return rec?.blob ?? null;
  },

  async addBlob(input: {
    caseId: string;
    kind: EvidenceMeta['kind'];
    filename: string;
    blob: Blob;
    capturedBy: string;
    role: Role;
  }): Promise<EvidenceMeta> {
    const sha256 = await sha256Hex(input.blob);
    const id = createUuid();
    const now = new Date().toISOString();

    const meta: EvidenceMeta = {
      id,
      caseId: input.caseId,
      kind: input.kind,
      filename: input.filename,
      mime: input.blob.type || 'application/octet-stream',
      bytes: input.blob.size,
      sha256,
      capturedAt: now,
      capturedBy: input.capturedBy,
    };

    const targetCase = await db.cases.get(input.caseId);

    await db.transaction(
      'rw',
      db.evidenceMeta,
      db.evidenceBlobs,
      db.caseEvents,
      db.auditEvents,
      async () => {
        await db.evidenceMeta.add(meta);
        await db.evidenceBlobs.add({ id, blob: input.blob });
        await db.caseEvents.add({
          id: createUuid(),
          caseId: input.caseId,
          actor: input.capturedBy,
          kind: 'evidence',
          body: `Attached ${meta.kind} "${meta.filename}" (${meta.bytes} B · SHA-256 ${sha256.slice(0, 12)}…)`,
          createdAt: now,
        });
        await db.auditEvents.add({
          id: createUuid(),
          actor: input.capturedBy,
          role: input.role,
          action: 'evidence.attached',
          objectType: 'evidence',
          objectId: targetCase?.ref || input.caseId,
          summary: `Stored ${meta.filename} (${sha256.slice(0, 12)}…)`,
          occurredAt: now,
        });
      }
    );

    notifySync();
    return meta;
  },
};

export const labRepo = {
  async listForTarget(targetId: string): Promise<LabAttempt[]> {
    return db.labAttempts.where('targetId').equals(targetId).sortBy('completedAt');
  },

  async recordAttempt(input: {
    targetId: string;
    caseId?: string;
    scenarioKey: ScenarioKey;
    answers: Record<string, number>;
    correctCount: number;
    wrongCount: number;
    score: number;
    hintsUsed: number;
    actor: string;
    role: Role;
  }): Promise<LabAttempt> {
    const now = new Date().toISOString();
    const attempt: LabAttempt = {
      id: createUuid(),
      targetId: input.targetId,
      scenarioKey: input.scenarioKey,
      answers: input.answers,
      correctCount: input.correctCount,
      wrongCount: input.wrongCount,
      score: input.score,
      hintsUsed: input.hintsUsed,
      completedAt: now,
    };

    const scenario = SCENARIOS[input.scenarioKey];

    await db.transaction('rw', db.labAttempts, db.cases, db.caseEvents, db.auditEvents, async () => {
      await db.labAttempts.add(attempt);
      if (input.caseId) {
        const c = await db.cases.get(input.caseId);
        if (c) {
          await db.cases.put({
            ...c,
            learnedSkill: scenario.skill,
            learnedConcept: scenario.concept,
            latestScore: input.score,
            version: c.version + 1,
            updatedAt: now,
          });
          await db.caseEvents.add({
            id: createUuid(),
            caseId: c.id,
            actor: input.actor,
            kind: 'scored',
            body: `Resolution lab scored ${input.score}/100 (${input.correctCount}/${input.correctCount + input.wrongCount} correct, ${input.hintsUsed} hints) — Skill: ${scenario.skill}`,
            createdAt: now,
          });
        }
      }
      await db.auditEvents.add({
        id: createUuid(),
        actor: input.actor,
        role: input.role,
        action: 'lab.completed',
        objectType: 'case',
        objectId: input.caseId || input.targetId,
        summary: `Completed ${scenario.key} lab (${input.score}/100)`,
        occurredAt: now,
      });
    });

    notifySync();
    return attempt;
  },
};

export function formatCaseReportText(
  c: Case,
  events: CaseEvent[],
  evidence: EvidenceMeta[]
): string {
  const lines = [
    '====================================================================',
    `KOBOSEC SIEM · CASE REPORT · ${c.ref}`,
    '====================================================================',
    `Type:           ${c.type} (${c.type === 'INC' ? 'Security Incident' : 'Service Request'})`,
    `Status:         ${c.status.toUpperCase()}`,
    `Priority:       ${c.priority.toUpperCase()}`,
    `Segment:        ${c.segment}`,
    `Reporter:       ${c.reporterName}`,
    `Assigned Role:  ${c.assigneeRole ?? 'Unassigned'}`,
    `Opened (UTC):   ${c.openedAt}`,
    `Closed (UTC):   ${c.closedAt ?? 'Open'}`,
    `Seed:           ${c.seed}`,
    '',
    '--- SUMMARY ---',
    c.title,
    c.summary,
    '',
    '--- CLOSURE ANALYSIS ---',
    `Root Cause:     ${c.rootCause ?? 'N/A'}`,
    `Action Taken:   ${c.action ?? 'N/A'}`,
    `Systems:        ${c.systemsImpacted ?? c.segment}`,
    `Prevention:     ${c.prevention ?? 'N/A'}`,
    '',
    '--- LEARNING & SKILL ATTRIBUTION ---',
    `Skill:          ${c.learnedSkill ?? 'Not yet assessed'}`,
    `Concept:        ${c.learnedConcept ?? 'N/A'}`,
    `Lab Score:      ${typeof c.latestScore === 'number' ? `${c.latestScore}/100` : 'Not recorded'}`,
    '',
    '--- EVIDENCE CHAIN OF CUSTODY ---',
    ...(evidence.length > 0
      ? evidence.map(
          (e) =>
            `[${e.capturedAt}] ${e.filename} (${e.kind}, ${e.mime}, ${e.bytes} B) SHA-256: ${e.sha256}`
        )
      : ['No binary evidence attached.']),
    '',
    '--- IMMUTABLE TIMELINE ---',
    ...events.map((ev) => `[${ev.createdAt}] (${ev.actor}) ${ev.body}`),
    '====================================================================',
  ];
  return lines.join('\n');
}

export async function exportWorkspaceBundle(): Promise<string> {
  const [seed, cases, alerts, caseEvents, evidenceMeta, auditEvents, labAttempts] =
    await Promise.all([
      settingsRepo.getSeed(),
      db.cases.toArray(),
      db.alerts.toArray(),
      db.caseEvents.toArray(),
      db.evidenceMeta.toArray(),
      db.auditEvents.toArray(),
      db.labAttempts.toArray(),
    ]);

  const bundle = {
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    seed,
    cases,
    alerts,
    caseEvents,
    evidenceMeta,
    auditEvents,
    labAttempts,
  };
  return JSON.stringify(bundle, null, 2);
}

export async function importWorkspaceBundle(jsonText: string): Promise<{ cases: number; alerts: number }> {
  const raw = JSON.parse(jsonText);
  const parsed = ExportBundleSchema.parse(raw);

  await db.transaction(
    'rw',
    [db.cases, db.alerts, db.caseEvents, db.evidenceMeta, db.auditEvents, db.labAttempts, db.meta],
    async () => {
      await db.cases.clear();
      await db.alerts.clear();
      await db.caseEvents.clear();
      await db.evidenceMeta.clear();
      await db.auditEvents.clear();
      await db.labAttempts.clear();

      if (parsed.cases.length) await db.cases.bulkAdd(parsed.cases);
      if (parsed.alerts.length) await db.alerts.bulkAdd(parsed.alerts);
      if (parsed.caseEvents.length) await db.caseEvents.bulkAdd(parsed.caseEvents);
      if (parsed.evidenceMeta.length) await db.evidenceMeta.bulkAdd(parsed.evidenceMeta);
      if (parsed.auditEvents.length) await db.auditEvents.bulkAdd(parsed.auditEvents);
      if (parsed.labAttempts.length) await db.labAttempts.bulkAdd(parsed.labAttempts);
      await db.meta.put({ key: 'seed', value: parsed.seed });
    }
  );
  notifySync();
  return { cases: parsed.cases.length, alerts: parsed.alerts.length };
}

export async function clearAllWorkspaceData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.cases, db.alerts, db.caseEvents, db.evidenceMeta, db.evidenceBlobs, db.auditEvents, db.labAttempts, db.meta],
    async () => {
      await db.cases.clear();
      await db.alerts.clear();
      await db.caseEvents.clear();
      await db.evidenceMeta.clear();
      await db.evidenceBlobs.clear();
      await db.auditEvents.clear();
      await db.labAttempts.clear();
      await db.meta.delete('seq_INC');
      await db.meta.delete('seq_SR');
      await db.meta.delete('seeded_v1');
    }
  );
  notifySync();
}

export async function seedDemoIfEmpty(): Promise<void> {
  const seeded = await db.meta.get('seeded_v1');
  if (seeded?.value === true) return;
  const existingCases = await db.cases.count();
  if (existingCases > 0) {
    await db.meta.put({ key: 'seeded_v1', value: true });
    return;
  }

  const seed = await settingsRepo.getSeed();
  // Seed one initial alert + one closed reference case so History & Alerts show rich domain data on first visit
  const { alert } = await alertRepo.upsertFromDetection({
    detectionKey: 'auth.credential_stuffing',
    detectionVersion: 3,
    scenarioKey: 'bf',
    title: SCENARIOS.bf.title,
    segment: 'Web Portal',
    sourceIp: '203.0.113.50',
    severity: 'high',
    riskScore: 86,
  });

  const sampleCase = await caseRepo.create({
    type: 'INC',
    priority: 'high',
    impact: 'team',
    segment: 'WAN',
    scenarioKey: 'slow',
    reporterName: 'M. Naidoo',
    title: 'Morning ERP slowdown during unscheduled cloud backup',
    summary: 'Users reported 3x page load times across WAN starting 08:40 UTC.',
    sourceIp: '10.20.8.44',
    seed,
    actorRole: 'analyst',
  });

  await caseRepo.transition(sampleCase.id, 'triaged', 'L1 Analyst', 'analyst', 'Accepted from intake queue');
  await caseRepo.transition(sampleCase.id, 'investigating', 'L1 Analyst', 'analyst', 'Correlating WAN top-talkers');
  await labRepo.recordAttempt({
    targetId: sampleCase.id,
    caseId: sampleCase.id,
    scenarioKey: 'slow',
    answers: { 'slow-q1': 1, 'slow-q2': 0, 'slow-q3': 1, 'slow-q4': 1, 'slow-q5': 0 },
    correctCount: 5,
    wrongCount: 0,
    score: 100,
    hintsUsed: 0,
    actor: 'L1 Analyst',
    role: 'analyst',
  });
  await caseRepo.transition(sampleCase.id, 'mitigated', 'L1 Analyst', 'analyst', 'Applied 10 Mbps QoS ceiling on BACKUP-SRV');
  await caseRepo.transition(sampleCase.id, 'resolved', 'L1 Analyst', 'analyst', 'Interactive WAN throughput recovered above 90 Mbps');
  await caseRepo.transition(
    sampleCase.id,
    'closed',
    'L1 Analyst',
    'analyst',
    'Verified recovery & closed',
    {
      rootCause: 'BACKUP-SRV (10.20.8.44) executed an unthrottled 62.4 Mbps cloud backup during business hours.',
      action: 'Applied temporary QoS cap and paused backup job until maintenance window.',
      systemsImpacted: 'WAN uplink, ERP Proxy, VoIP SBC',
      prevention: 'Enforced 22:00-05:00 backup window and permanent egress QoS policy.',
    }
  );

  // Also open one active triaged case linked to the open alert
  const activeCase = await caseRepo.create({
    type: 'INC',
    priority: 'high',
    impact: 'department',
    segment: 'Web Portal',
    scenarioKey: 'bf',
    reporterName: 'Detection Engine',
    title: 'Credential stuffing burst against Web Portal /login',
    summary: '38+ failed logins/min from 203.0.113.50 across 8 accounts with one subsequent SUCCESS.',
    sourceIp: '203.0.113.50',
    alertId: alert.id,
    seed,
    actorRole: 'analyst',
  });

  await caseRepo.transition(activeCase.id, 'investigating', 'L1 Analyst', 'analyst', 'Inspecting LOG-001..LOG-010 in lab');
  await db.meta.put({ key: 'seeded_v1', value: true });
  notifySync();
}
