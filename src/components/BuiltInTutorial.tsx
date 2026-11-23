import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  List,
  Palette,
  Play,
  X,
  Zap,
} from 'lucide-react';
import type { ScenarioKey } from '../domain/types';

export type TutorialRoute = 'overview' | 'alerts' | 'cases' | 'portal' | 'admin';

export interface TutorialStep {
  id: string;
  number: string;
  title: string;
  route: TutorialRoute;
  targetArea: string;
  summary: string;
  howToNavigate: string[];
  actionLabel?: string;
  actionKind?: 'inject-bf' | 'open-theme-studio' | 'focus-cases-lab';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'sim-clock',
    number: '01',
    title: 'Overview & Simulation Clock',
    route: 'overview',
    targetArea: 'Simulation Control Strip & 4-Column KPIs',
    summary:
      'Start here. The simulator runs a deterministic 3-second clock driven by a seeded PRNG so every demo and grading run is reproducible.',
    howToNavigate: [
      'Use Pause Clock / Resume Clock or Step +3s to control time manually.',
      'Click any Inject Scenario button (Credential Stuffing, Bandwidth Hog, ISP Latency) to distort live metrics immediately.',
      'Enter a numeric Seed and press Replay to reproduce the exact same telemetry sequence.',
      'Click the Open Alerts or Open Cases KPI cards to jump straight to triage queues.',
    ],
    actionLabel: 'Inject Credential Stuffing Demo',
    actionKind: 'inject-bf',
  },
  {
    id: 'telemetry-segments',
    number: '02',
    title: 'Charts, Samples & Segment Containment',
    route: 'overview',
    targetArea: 'Dual Telemetry Charts & Monitored Segments',
    summary:
      'Inspect spikes in Failed Logins (> 10/min) or drops in WAN Throughput (< 50 Mbps) across the 16-sample rolling window.',
    howToNavigate: [
      'Click any sample dot on either SVG chart (or press Enter while tabbed to a point) to open the Sample Inspector.',
      'Switch between Chart and Data Table at the top-right of the graph for tabular keyboard inspection.',
      'In Monitored Segments below, click Contain to isolate a compromised segment and suppress its active threats.',
    ],
  },
  {
    id: 'alerts-coach',
    number: '03',
    title: 'Alerts Queue & Bounded AI Coach',
    route: 'alerts',
    targetArea: 'Persistent Alerts & Investigation Coach',
    summary:
      'Detection alerts persist in IndexedDB even after the 90-second simulation threat fades, with risk scoring and deduplication.',
    howToNavigate: [
      'Filter alerts by Open, Ack, Suppressed, or Closed using the segmented filter bar.',
      'Select an alert on the left to view observed symptoms, MITRE ATT&CK ID, and risk score.',
      'Click Promote to Incident Case to create a linked case and move into investigation.',
      'Use the Bounded Investigation Coach below to ask questions grounded strictly in visible log rows (or toggle AI Coach Off anytime).',
    ],
  },
  {
    id: 'cases-labs',
    number: '04',
    title: 'Cases, Resolution Labs & Closure Gate',
    route: 'cases',
    targetArea: 'Unified Queue, Lab Fixtures & Evidence Locker',
    summary:
      'Cases follow an enforced state machine (New → Triaged → Investigating → Mitigated → Resolved → Closed). Illegal transitions are blocked.',
    howToNavigate: [
      'Select a case in the left queue and advance its status using the highlighted buttons in the Lifecycle Stepper.',
      'Open Resolution Lab & Quiz to search synthetic Login and Network logs, reveal up to 6 progressive hints, and grade the 5-question quiz.',
      'Open Evidence to upload files or capture an SVG telemetry snapshot stored as a binary Blob with a SHA-256 hash.',
      'Advance to Resolved, then open Closure Gate to fill Root Cause, Action, Systems, and Prevention (or draft with AI) before signing off.',
    ],
  },
  {
    id: 'history-audit',
    number: '05',
    title: 'Closed History & Append-Only Audit',
    route: 'cases',
    targetArea: 'Closed History & Audit Log Sub-Tabs',
    summary:
      'Every closed case preserves its timeline, skill attribution, lab score, and SHA-256 evidence hashes for reporting and review.',
    howToNavigate: [
      'At the top of the Cases workspace, switch to Closed History to search signed-off reports and export single or bulk .txt dossiers.',
      'Switch to Audit Log to inspect the immutable UTC event trail recording every case transition, segment containment, and lab run.',
      'Use the Ask the Cases bar above the queue to translate plain-English queries into structured filters.',
    ],
  },
  {
    id: 'portal-intake',
    number: '06',
    title: 'End User Service Desk Portal',
    route: 'portal',
    targetArea: 'INC / SR Intake & Follow-Up Lookup',
    summary:
      'Simulates how staff or customers log Incidents (INC) or Service Requests (SR) without needing full analyst access.',
    howToNavigate: [
      'Choose INC (Report Incident) or SR (Service Request), set Segment, Urgency, and Impact, then submit.',
      'Copy the generated sequential Reference (e.g. INC-2026-000001) and 6-digit Tracking PIN.',
      'Use Follow-Up Lookup on the right to verify live status and analyst timeline updates as an end user.',
    ],
  },
  {
    id: 'themes-admin',
    number: '07',
    title: 'Theme Studio & Admin Controls',
    route: 'admin',
    targetArea: '6 Visual Themes, Roles & Data Portability',
    summary:
      'Switch between six visual themes modeled after distinct design systems, fine-tune tokens, switch training roles, or export your entire workspace.',
    howToNavigate: [
      'Use the 1-click theme bar above any workspace or click Theme Studio in the top-right header to customize colors, radius, typography, and chart style.',
      'On the Admin tab, switch Training-Mode Personas (End User through Administrator or Auditor).',
      'Export or Import full .json workspace bundles to back up or share scenarios across browsers.',
    ],
    actionLabel: 'Open Theme Studio',
    actionKind: 'open-theme-studio',
  },
];

interface BuiltInTutorialProps {
  open: boolean;
  stepIndex: number;
  onStepChange: (nextIndex: number) => void;
  onClose: () => void;
  onNavigateRoute: (route: TutorialRoute) => void;
  onInjectScenario: (key: ScenarioKey) => void;
  onOpenThemeStudio: () => void;
  completedSteps: Record<string, boolean>;
  onMarkStepDone: (stepId: string) => void;
}

export function BuiltInTutorial({
  open,
  stepIndex,
  onStepChange,
  onClose,
  onNavigateRoute,
  onInjectScenario,
  onOpenThemeStudio,
  completedSteps,
  onMarkStepDone,
}: BuiltInTutorialProps) {
  const [showDirectory, setShowDirectory] = useState(false);

  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];

  useEffect(() => {
    if (!open) return;
    onNavigateRoute(step.route);
    onMarkStepDone(step.id);
  }, [open, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const total = TUTORIAL_STEPS.length;
  const visitedCount = Object.keys(completedSteps).length;

  const handleAction = () => {
    if (step.actionKind === 'inject-bf') {
      onNavigateRoute('overview');
      onInjectScenario('bf');
    } else if (step.actionKind === 'open-theme-studio') {
      onOpenThemeStudio();
    }
  };

  return (
    <aside
      role="region"
      aria-label="Built-in navigation tutorial"
      className="fixed bottom-4 right-4 z-40 w-[min(460px,calc(100vw-2rem))] max-h-[82vh] overflow-y-auto theme-surface p-5 flex flex-col gap-4"
      style={{
        border: '1px solid var(--t-border-strong)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="flex items-center gap-2.5">
          <Compass className="w-4 h-4 shrink-0" style={{ color: 'var(--t-accent)' }} />
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
              <span>System Navigation Guide</span>
              <span aria-hidden="true">·</span>
              <span>
                Step {step.number} / 0{total}
              </span>
            </div>
            <h2 className="text-base font-semibold font-display mt-0.5">{step.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDirectory((s) => !s)}
            aria-label={showDirectory ? 'Back to step view' : 'View all tutorial chapters'}
            title="All chapters"
            className="p-2 theme-btn-secondary cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            {showDirectory ? <BookOpen className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="p-2 theme-btn-secondary cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-1 overflow-hidden" style={{ backgroundColor: 'var(--t-surface-alt)' }}>
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${((stepIndex + 1) / total) * 100}%`,
              backgroundColor: 'var(--t-accent)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
          <span>Focus: {step.targetArea}</span>
          <span>
            {visitedCount}/{total} explored
          </span>
        </div>
      </div>

      {showDirectory ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--t-text-muted)' }}>
            Jump to any workspace guide:
          </p>
          {TUTORIAL_STEPS.map((s, idx) => {
            const active = idx === stepIndex;
            const done = Boolean(completedSteps[s.id]);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onStepChange(idx);
                  onNavigateRoute(s.route);
                  setShowDirectory(false);
                }}
                className="w-full text-left p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                  color: active ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                  border: '1px solid var(--t-border)',
                  borderRadius: 'var(--t-radius-sm)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono-tabular font-semibold shrink-0">{s.number}</span>
                  <span className="text-xs font-medium truncate">{s.title}</span>
                </div>
                {done && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-80" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--t-text)' }}>
            {step.summary}
          </p>

          <div className="p-3 theme-surface-alt space-y-2">
            <span className="block text-[11px] font-mono-tabular font-semibold" style={{ color: 'var(--t-text-muted)' }}>
              How to navigate &amp; use this view
            </span>
            <ol className="text-xs space-y-1.5 list-decimal pl-4" style={{ color: 'var(--t-text)' }}>
              {step.howToNavigate.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </div>

          {step.actionLabel && (
            <button
              type="button"
              onClick={handleAction}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold theme-btn-secondary cursor-pointer min-h-[38px]"
            >
              {step.actionKind === 'inject-bf' ? (
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--t-high)' }} />
              ) : step.actionKind === 'open-theme-studio' ? (
                <Palette className="w-3.5 h-3.5" style={{ color: 'var(--t-accent)' }} />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{step.actionLabel}</span>
            </button>
          )}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => onStepChange(Math.max(0, stepIndex - 1))}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[38px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        {stepIndex < total - 1 ? (
          <button
            type="button"
            onClick={() => onStepChange(Math.min(total - 1, stepIndex + 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[38px]"
          >
            <span>Next Step</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[38px]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish Tour</span>
          </button>
        )}
      </div>
    </aside>
  );
}
