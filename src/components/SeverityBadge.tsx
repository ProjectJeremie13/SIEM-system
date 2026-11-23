import { AlertOctagon, AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { Severity } from '../domain/types';

interface SeverityBadgeProps {
  severity: Severity | 'nominal';
  compact?: boolean;
}

export function SeverityBadge({ severity, compact = false }: SeverityBadgeProps) {
  const map = {
    critical: {
      label: 'CRITICAL',
      color: 'var(--t-crit)',
      Icon: AlertOctagon,
    },
    high: {
      label: 'HIGH',
      color: 'var(--t-high)',
      Icon: ShieldAlert,
    },
    medium: {
      label: 'MEDIUM',
      color: 'var(--t-med)',
      Icon: AlertTriangle,
    },
    low: {
      label: 'LOW',
      color: 'var(--t-info)',
      Icon: Info,
    },
    nominal: {
      label: 'NOMINAL',
      color: 'var(--t-low)',
      Icon: CheckCircle2,
    },
  } as const;

  const item = map[severity];
  const Icon = item.Icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] font-semibold tracking-wider whitespace-nowrap shrink-0"
      style={{ color: item.color }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{compact ? item.label.slice(0, 4) : item.label}</span>
    </span>
  );
}
