import type { Case, CaseStatus, CaseType } from './types';

export const CASE_STATUS_ORDER: CaseStatus[] = [
  'new',
  'triaged',
  'investigating',
  'mitigated',
  'resolved',
  'closed',
];

export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new: ['triaged'],
  triaged: ['investigating', 'mitigated'],
  investigating: ['mitigated', 'resolved'],
  mitigated: ['resolved', 'investigating'],
  resolved: ['closed', 'investigating'],
  closed: ['investigating'], // Explicit reopen path
};

export interface ClosureInput {
  rootCause?: string;
  action?: string;
  systemsImpacted?: string;
  prevention?: string;
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateClosure(type: CaseType, input: ClosureInput): string[] {
  const missing: string[] = [];
  if (type === 'INC') {
    if (!input.rootCause?.trim()) missing.push('Root cause');
    if (!input.action?.trim()) missing.push('Containment / action taken');
    if (!input.systemsImpacted?.trim()) missing.push('Systems impacted');
    if (!input.prevention?.trim()) missing.push('Prevention measure');
  } else {
    // SR (Service Request) requires fulfillment action and target system, not incident root cause
    if (!input.action?.trim()) missing.push('Fulfillment action');
    if (!input.systemsImpacted?.trim()) missing.push('Target systems');
  }
  return missing;
}

export function transitionCase(
  current: Case,
  nextStatus: CaseStatus,
  closure?: ClosureInput,
  nowIso: string = new Date().toISOString()
): Case {
  if (current.status === nextStatus) {
    return current;
  }
  if (!canTransition(current.status, nextStatus)) {
    throw new Error(
      `Illegal case transition from "${current.status}" to "${nextStatus}". Allowed: ${
        ALLOWED_TRANSITIONS[current.status].join(', ') || 'none'
      }.`
    );
  }

  if (nextStatus === 'closed') {
    const merged: ClosureInput = {
      rootCause: closure?.rootCause ?? current.rootCause,
      action: closure?.action ?? current.action,
      systemsImpacted: closure?.systemsImpacted ?? current.systemsImpacted,
      prevention: closure?.prevention ?? current.prevention,
    };
    const missing = validateClosure(current.type, merged);
    if (missing.length > 0) {
      throw new Error(`Cannot close ${current.type} case. Missing required fields: ${missing.join(', ')}.`);
    }
    return {
      ...current,
      ...merged,
      status: 'closed',
      version: current.version + 1,
      updatedAt: nowIso,
      closedAt: nowIso,
    };
  }

  return {
    ...current,
    ...(closure ?? {}),
    status: nextStatus,
    version: current.version + 1,
    updatedAt: nowIso,
    closedAt: current.status === 'closed' ? undefined : current.closedAt,
  };
}
