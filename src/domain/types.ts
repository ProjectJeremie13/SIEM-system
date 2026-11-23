export type ThemeId = 'morozov' | 'aerox' | 'crimson' | 'nord' | 'tura' | 'stream';

export interface ThemeConfig {
  presetId: ThemeId;
  customAccent: string | null;
  radius: 'sharp' | 'editorial' | 'matte' | 'modular';
  density: 'compact' | 'comfortable';
  typography: 'geometric' | 'editorial' | 'technical';
  chartStyle: 'line' | 'area';
}

export type Role = 'end_user' | 'analyst' | 'senior' | 'lead' | 'instructor' | 'auditor' | 'admin';

export type CaseType = 'INC' | 'SR';

export type CaseStatus =
  | 'new'
  | 'triaged'
  | 'investigating'
  | 'mitigated'
  | 'resolved'
  | 'closed';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type SegmentName =
  | 'WAN'
  | 'DMZ'
  | 'Web Portal'
  | 'API Gateway'
  | 'RPA Bots'
  | 'VPN';

export interface SegmentState {
  name: SegmentName;
  criticality: 1 | 2 | 3 | 4 | 5;
  status: 'up' | 'contained';
  ownerTeam: string;
}

export interface Case {
  id: string; // UUID primary key
  ref: string; // INC-2026-000001
  trackingCode: string; // 6-digit numeric tracking code
  type: CaseType;
  status: CaseStatus;
  priority: Severity;
  impact: 'self' | 'team' | 'department' | 'everyone';
  segment: SegmentName;
  scenarioKey: ScenarioKey | null;
  reporterName: string;
  assigneeRole: Role | null;
  alertId: string | null;
  title: string;
  summary: string;
  stepsToReproduce?: string;
  sourceIp?: string;
  rootCause?: string;
  action?: string;
  systemsImpacted?: string;
  prevention?: string;
  learnedSkill?: string;
  learnedConcept?: string;
  latestScore?: number;
  seed: number;
  version: number;
  openedAt: string; // UTC ISO-8601
  updatedAt: string; // UTC ISO-8601
  closedAt?: string; // UTC ISO-8601
}

export interface Alert {
  id: string;
  detectionKey: string;
  detectionVersion: number;
  scenarioKey: ScenarioKey;
  title: string;
  segment: SegmentName;
  sourceIp: string;
  severity: Severity;
  status: 'open' | 'ack' | 'suppressed' | 'closed';
  riskScore: number;
  dedupeKey: string;
  firstSeen: string; // UTC ISO-8601
  lastSeen: string; // UTC ISO-8601
  sampleCount: number;
  linkedCaseId: string | null;
}

export interface EvidenceMeta {
  id: string;
  caseId: string;
  kind: 'screenshot' | 'export' | 'log';
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  capturedAt: string; // UTC ISO-8601
  capturedBy: string;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  actor: string;
  kind: 'created' | 'triaged' | 'status' | 'comment' | 'evidence' | 'scored' | 'closed';
  body: string;
  createdAt: string; // UTC ISO-8601
}

export interface AuditEvent {
  id: string;
  actor: string;
  role: Role;
  action: string;
  objectType: 'case' | 'alert' | 'segment' | 'evidence' | 'sim' | 'settings';
  objectId: string;
  summary: string;
  occurredAt: string; // UTC ISO-8601
}

export interface LabAttempt {
  id: string;
  targetId: string; // caseId or alertId
  scenarioKey: ScenarioKey;
  answers: Record<string, number>;
  correctCount: number;
  wrongCount: number;
  score: number;
  hintsUsed: number;
  completedAt: string; // UTC ISO-8601
}

export type ScenarioKey = 'bf' | 'slow' | 'lat';

export interface LoginLogRow {
  id: string;
  ts: string;
  srcIp: string;
  username: string;
  outcome: 'FAIL' | 'SUCCESS';
  endpoint: string;
  latencyMs: number;
}

export interface NetworkLogRow {
  id: string;
  ts: string;
  host: string;
  destination: string;
  mbps: number;
  rttMs: number;
  lossPct: number;
  protocol: string;
}

export interface DirectoryUserRow {
  id: string;
  username: string;
  department: string;
  mfaEnabled: boolean;
  riskFlag: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  why: string;
}

export interface Scenario {
  schemaVersion: 1;
  key: ScenarioKey;
  title: string;
  segment: SegmentName;
  metric: 'auth.failed' | 'net.throughput';
  severity: Severity;
  mitre: string[];
  detectionKey: string;
  detectionVersion: number;
  defaultSourceIp: string;
  symptom: string[];
  hints: [string, string, string];
  extendedHints: [string, string, string];
  course: {
    what: string;
    readLogs: string;
    checklist: string[];
  };
  quiz: QuizQuestion[];
  skill: string;
  concept: string;
  fixture: {
    logins: LoginLogRow[];
    network: NetworkLogRow[];
    users: DirectoryUserRow[];
  };
}

export interface TelemetrySample {
  seq: number;
  ts: string; // UTC ISO-8601
  throughputMbps: number;
  failedLoginsPerMin: number;
  activeScenario: ScenarioKey | null;
  activeSegment: SegmentName | null;
}

export interface SimEvent {
  id: string;
  ts: string;
  segment: SegmentName;
  srcIp: string;
  port: number;
  action: 'ALLOW' | 'ALERT' | 'DROP';
  severity: Severity;
  scenarioKey: ScenarioKey | null;
  message: string;
}

export interface ActiveThreat {
  id: string;
  scenarioKey: ScenarioKey;
  segment: SegmentName;
  srcIp: string;
  startedAtMs: number;
  ttlMs: number;
}

export interface CoachResponse {
  summary: string;
  guidingQuestion: string;
  hypotheses: {
    title: string;
    likelihood: string;
    falsifyingCheck: string;
  }[];
  nextChecks: string[];
  citations: string[];
}

export interface DraftReportResponse {
  rootCause: string;
  action: string;
  systemsImpacted: string;
  prevention: string;
  confidence: string;
  citations: string[];
}

export interface AskCaseFilterResponse {
  targetTable: 'cases' | 'alerts';
  status: string;
  severity: string;
  caseType: string;
  searchText: string;
  explanation: string;
}
