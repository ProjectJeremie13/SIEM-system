import { useState } from 'react';
import {
  Compass,
  Download,
  Palette,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Role, SegmentName, SegmentState, ThemeConfig } from '../../domain/types';
import { SCENARIOS } from '../../sim/scenarios';
import {
  clearAllWorkspaceData,
  exportWorkspaceBundle,
  importWorkspaceBundle,
  seedDemoIfEmpty,
} from '../../storage/repositories';
import { THEME_PRESETS } from '../../themes/presets';

interface AdminWorkspaceProps {
  role: Role;
  onChangeRole: (role: Role) => void;
  segments: SegmentState[];
  onToggleSegment: (name: SegmentName) => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
  themeConfig: ThemeConfig;
  onOpenThemeStudio: () => void;
  onOpenTutorial: () => void;
  onRefresh: () => Promise<void>;
}

const ROLES: { id: Role; label: string; scope: string }[] = [
  { id: 'end_user', label: 'End User', scope: 'Portal intake & own follow-up' },
  { id: 'analyst', label: 'L1 Analyst', scope: 'Triage, labs, cases, containment' },
  { id: 'senior', label: 'Senior Analyst', scope: 'All cases, bulk export, simulation' },
  { id: 'lead', label: 'SOC Lead', scope: 'Content, audit review, approvals' },
  { id: 'instructor', label: 'Instructor', scope: 'Cohorts, scenario packs, grading' },
  { id: 'auditor', label: 'Auditor', scope: 'Read-only audit & case reports' },
  { id: 'admin', label: 'Administrator', scope: 'Full workspace & data management' },
];

const GAP_TRACKER = [
  { area: 'Persistence & Sync', status: 'Local-First (IndexedDB)', note: 'Cases, alerts, events, and binary blobs survive refresh; bundle export/import round-trips.' },
  { area: 'Identity & Access', status: 'Training Mode (Explicit)', note: 'Client-side persona switcher for training; no fake 0000 PIN theatre.' },
  { area: 'Evidence Chain of Custody', status: 'Blob + SHA-256', note: 'Screenshots & logs stored as binary blobs outside app state with cryptographic digests.' },
  { area: 'Detection & Simulation', status: 'Seeded Worker Engine', note: 'Mulberry32 seeded PRNG, 3s cadence, hysteresis alerts, and persistent alert deduplication.' },
  { area: 'Bounded AI Assistance', status: 'Server-Side Gemini', note: 'Schema-validated Coach, Report Drafter, and Ask-the-Case behind an explicit AI-off switch.' },
];

export function AdminWorkspace({
  role,
  onChangeRole,
  segments,
  onToggleSegment,
  aiEnabled,
  onToggleAi,
  themeConfig,
  onOpenThemeStudio,
  onOpenTutorial,
  onRefresh,
}: AdminWorkspaceProps) {
  const [bundleMsg, setBundleMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleExportBundle = async () => {
    const json = await exportWorkspaceBundle();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kobosec-workspace-bundle-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBundleMsg('Workspace bundle exported.');
  };

  const handleImportBundle = async (file: File) => {
    try {
      const text = await file.text();
      const res = await importWorkspaceBundle(text);
      await onRefresh();
      setBundleMsg(`Imported ${res.cases} cases and ${res.alerts} alerts.`);
    } catch (err) {
      setBundleMsg(err instanceof Error ? err.message : 'Invalid bundle JSON.');
    }
  };

  const handleResetDemo = async () => {
    await clearAllWorkspaceData();
    await seedDemoIfEmpty();
    await onRefresh();
    setConfirmClear(false);
    setBundleMsg('Workspace reset to clean deterministic seed.');
  };

  const activePreset = THEME_PRESETS[themeConfig.presetId];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Training Role & Appearance */}
        <div className="lg:col-span-6 theme-surface p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold font-display">Training Mode Persona &amp; Theme</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
                Per ADR-07: local-first builds label role switching honestly as Training Mode rather than simulating security with a hard-coded PIN.
              </p>
            </div>
            <Shield className="w-4 h-4 shrink-0" style={{ color: 'var(--t-accent)' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChangeRole(r.id)}
                  className="text-left p-2.5 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                    color: active ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                    border: '1px solid var(--t-border)',
                    borderRadius: 'var(--t-radius-sm)',
                  }}
                >
                  <div className="text-xs font-semibold">{r.label}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{r.scope}</div>
                </button>
              );
            })}
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid var(--t-border)' }}>
            <div>
              <p className="text-xs font-medium">Active Theme: {activePreset.name}</p>
              <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                Radius: {themeConfig.radius} · Type: {themeConfig.typography} · Chart: {themeConfig.chartStyle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenTutorial}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Navigation Tutorial</span>
              </button>
              <button
                type="button"
                onClick={onOpenThemeStudio}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Open Theme Studio</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Portability, AI Toggle & Reset */}
        <div className="lg:col-span-6 theme-surface p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold font-display">Persistence, AI &amp; Portability</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Round-trip workspace bundles via Zod-validated JSON or reset IndexedDB cleanly.
            </p>
          </div>

          <div className="p-3.5 theme-surface-alt flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Bounded Gemini AI Assistance</p>
              <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                Controls Coach, Report Drafter, and Ask-the-Case across all views.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleAi}
              className="px-3.5 py-2 text-xs font-semibold theme-btn-secondary cursor-pointer whitespace-nowrap"
            >
              {aiEnabled ? 'AI Enabled' : 'AI Disabled'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportBundle}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Workspace Bundle (.json)</span>
            </button>

            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Bundle</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportBundle(f);
                }}
              />
            </label>

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetDemo}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer min-h-[40px]"
                style={{
                  backgroundColor: 'var(--t-crit)',
                  color: '#ffffff',
                  borderRadius: 'var(--t-radius-sm)',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Reset IndexedDB</span>
              </button>
            )}
          </div>

          {bundleMsg && (
            <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-low)' }}>
              {bundleMsg}
            </p>
          )}
        </div>
      </div>

      {/* Segment Containment & Detection Packs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 theme-surface p-5 space-y-3">
          <h3 className="text-base font-semibold font-display">Segment Containment Matrix</h3>
          <div className="divide-y" style={{ borderColor: 'var(--t-border)' }}>
            {segments.map((s) => (
              <div key={s.name} className="py-2.5 flex items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--t-border)' }}>
                <div>
                  <span className="font-semibold">{s.name}</span>{' '}
                  <span className="font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                    (Crit {s.criticality}/5 · {s.ownerTeam})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSegment(s.name)}
                  className="px-2.5 py-1 text-xs font-medium theme-btn-secondary cursor-pointer"
                >
                  {s.status === 'contained' ? 'Restore' : 'Contain'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 theme-surface p-5 space-y-3">
          <h3 className="text-base font-semibold font-display">Detection-as-Code &amp; Scenario Packs</h3>
          <div className="grid gap-2.5">
            {Object.values(SCENARIOS).map((sc) => (
              <div key={sc.key} className="p-3 theme-surface-alt text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{sc.title}</span>
                  <span className="font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                    {sc.detectionKey} v{sc.detectionVersion} · {sc.mitre.join(', ')}
                  </span>
                </div>
                <p style={{ color: 'var(--t-text-muted)' }}>
                  Segment: {sc.segment} · Metric: {sc.metric} · Skill: {sc.skill}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Honest Architecture & Gap Register (moved out of main SIEM console per Section 07 clutter cleanup) */}
      <div className="theme-surface p-5 space-y-3">
        <div>
          <h3 className="text-base font-semibold font-display">Platform Architecture &amp; Scope Register</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            Transparency record of how this training simulator models real SOC capabilities.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}>
                <th className="py-2 px-3 font-medium">Capability</th>
                <th className="py-2 px-3 font-medium">Implementation</th>
                <th className="py-2 px-3 font-medium">Boundary &amp; Trade-off</th>
              </tr>
            </thead>
            <tbody>
              {GAP_TRACKER.map((g) => (
                <tr key={g.area} style={{ borderBottom: '1px solid var(--t-border)' }}>
                  <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{g.area}</td>
                  <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap">{g.status}</td>
                  <td className="py-2.5 px-3" style={{ color: 'var(--t-text-muted)' }}>{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
