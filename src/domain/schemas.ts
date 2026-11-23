import { z } from 'zod';

export const RoleSchema = z.enum([
  'end_user',
  'analyst',
  'senior',
  'lead',
  'instructor',
  'auditor',
  'admin',
]);

export const CaseTypeSchema = z.enum(['INC', 'SR']);

export const CaseStatusSchema = z.enum([
  'new',
  'triaged',
  'investigating',
  'mitigated',
  'resolved',
  'closed',
]);

export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const SegmentNameSchema = z.enum([
  'WAN',
  'DMZ',
  'Web Portal',
  'API Gateway',
  'RPA Bots',
  'VPN',
]);

export const ScenarioKeySchema = z.enum(['bf', 'slow', 'lat']);

export const ThemeConfigSchema = z.object({
  presetId: z.enum(['morozov', 'aerox', 'crimson', 'nord', 'tura', 'stream']),
  customAccent: z.string().nullable(),
  radius: z.enum(['sharp', 'editorial', 'matte', 'modular']),
  density: z.enum(['compact', 'comfortable']),
  typography: z.enum(['geometric', 'editorial', 'technical']),
  chartStyle: z.enum(['line', 'area']),
});

export const CaseSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  trackingCode: z.string().min(4),
  type: CaseTypeSchema,
  status: CaseStatusSchema,
  priority: SeveritySchema,
  impact: z.enum(['self', 'team', 'department', 'everyone']),
  segment: SegmentNameSchema,
  scenarioKey: ScenarioKeySchema.nullable(),
  reporterName: z.string().min(1),
  assigneeRole: RoleSchema.nullable(),
  alertId: z.string().nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  stepsToReproduce: z.string().optional(),
  sourceIp: z.string().optional(),
  rootCause: z.string().optional(),
  action: z.string().optional(),
  systemsImpacted: z.string().optional(),
  prevention: z.string().optional(),
  learnedSkill: z.string().optional(),
  learnedConcept: z.string().optional(),
  latestScore: z.number().min(0).max(100).optional(),
  seed: z.number(),
  version: z.number().int().min(1),
  openedAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().optional(),
});

export const ExportBundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  seed: z.number(),
  cases: z.array(CaseSchema),
  alerts: z.array(
    z.object({
      id: z.string(),
      detectionKey: z.string(),
      detectionVersion: z.number(),
      scenarioKey: ScenarioKeySchema,
      title: z.string(),
      segment: SegmentNameSchema,
      sourceIp: z.string(),
      severity: SeveritySchema,
      status: z.enum(['open', 'ack', 'suppressed', 'closed']),
      riskScore: z.number(),
      dedupeKey: z.string(),
      firstSeen: z.string(),
      lastSeen: z.string(),
      sampleCount: z.number(),
      linkedCaseId: z.string().nullable(),
    })
  ),
  caseEvents: z.array(
    z.object({
      id: z.string(),
      caseId: z.string(),
      actor: z.string(),
      kind: z.enum(['created', 'triaged', 'status', 'comment', 'evidence', 'scored', 'closed']),
      body: z.string(),
      createdAt: z.string(),
    })
  ),
  evidenceMeta: z.array(
    z.object({
      id: z.string(),
      caseId: z.string(),
      kind: z.enum(['screenshot', 'export', 'log']),
      filename: z.string(),
      mime: z.string(),
      bytes: z.number(),
      sha256: z.string(),
      capturedAt: z.string(),
      capturedBy: z.string(),
    })
  ),
  auditEvents: z.array(
    z.object({
      id: z.string(),
      actor: z.string(),
      role: RoleSchema,
      action: z.string(),
      objectType: z.enum(['case', 'alert', 'segment', 'evidence', 'sim', 'settings']),
      objectId: z.string(),
      summary: z.string(),
      occurredAt: z.string(),
    })
  ),
  labAttempts: z.array(
    z.object({
      id: z.string(),
      targetId: z.string(),
      scenarioKey: ScenarioKeySchema,
      answers: z.record(z.string(), z.number()),
      correctCount: z.number(),
      wrongCount: z.number(),
      score: z.number(),
      hintsUsed: z.number(),
      completedAt: z.string(),
    })
  ),
});

export const CoachResponseSchema = z.object({
  summary: z.string(),
  guidingQuestion: z.string(),
  hypotheses: z
    .array(
      z.object({
        title: z.string(),
        likelihood: z.string(),
        falsifyingCheck: z.string(),
      })
    )
    .max(3),
  nextChecks: z.array(z.string()).max(4),
  citations: z.array(z.string()),
});

export const DraftReportResponseSchema = z.object({
  rootCause: z.string(),
  action: z.string(),
  systemsImpacted: z.string(),
  prevention: z.string(),
  confidence: z.string(),
  citations: z.array(z.string()),
});

export const AskCaseFilterResponseSchema = z.object({
  targetTable: z.enum(['cases', 'alerts']),
  status: z.string(),
  severity: z.string(),
  caseType: z.string(),
  searchText: z.string(),
  explanation: z.string(),
});
