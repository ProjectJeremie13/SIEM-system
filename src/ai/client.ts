import {
  AskCaseFilterResponseSchema,
  CoachResponseSchema,
  DraftReportResponseSchema,
} from '../domain/schemas';
import type {
  Alert,
  AskCaseFilterResponse,
  Case,
  CaseEvent,
  CoachResponse,
  DraftReportResponse,
  EvidenceMeta,
  LabAttempt,
  Scenario,
} from '../domain/types';

export async function fetchInvestigationCoach(input: {
  scenario: Scenario;
  alert: Alert | null;
  rows: unknown[];
  question: string;
  revealAnswer: boolean;
}): Promise<CoachResponse> {
  const res = await fetch('/api/ai/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Coach request failed (${res.status}).`);
  }
  return CoachResponseSchema.parse(data);
}

export async function fetchDraftReport(input: {
  caseRecord: Case;
  events: CaseEvent[];
  evidenceMeta: EvidenceMeta[];
  labAttempt: LabAttempt | null;
}): Promise<DraftReportResponse> {
  const res = await fetch('/api/ai/draft-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Report drafter failed (${res.status}).`);
  }
  return DraftReportResponseSchema.parse(data);
}

export async function fetchAskCaseFilter(query: string): Promise<AskCaseFilterResponse> {
  const res = await fetch('/api/ai/ask-case', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Query translation failed (${res.status}).`);
  }
  return AskCaseFilterResponseSchema.parse(data);
}
