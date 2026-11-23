import { useState } from 'react';
import {
  Activity,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SkipForward,
  Zap,
} from 'lucide-react';
import { SeverityBadge } from '../../components/SeverityBadge';
import { TelemetryCharts } from '../../components/TelemetryCharts';
import type {
  ActiveThreat,
  Alert,
  Case,
  ScenarioKey,
  SegmentName,
  SegmentState,
  SimEvent,
  TelemetrySample,
  ThemeConfig,
} from '../../domain/types';
import { SCENARIOS } from '../../sim/scenarios';

interface OverviewWorkspaceProps {
  running: boolean;
  onToggleRunning: () => void;
  onStepTick: () => void;
  onInjectScenario: (key: ScenarioKey) => void;
  seed: number;
  onReseed: (nextSeed: number) => void;
  autoInject: boolean;
  onToggleAutoInject: () => void;
  samples: TelemetrySample[];
  events: SimEvent[];
  threats: ActiveThreat[];
  segments: SegmentState[];
  onToggleSegment: (name: SegmentName) => void;
  alerts: Alert[];
  cases: Case[];
  themeConfig: ThemeConfig;
  onNavigateAlerts: () => void;
  onNavigateCases: () => void;
}

export function OverviewWorkspace({
  running,
  onToggleRunning,
  onStepTick,
  onInjectScenario,
  seed,
  onReseed,
  autoInject,
  onToggleAutoInject,
  samples,
  events,
  threats,
  segments,
  onToggleSegment,
  alerts,
  cases,
  themeConfig,
  onNavigateAlerts,
  onNavigateCases,
}: OverviewWorkspaceProps) {
  const [metricFilter, setMetricFilter] = useState<'both' | 'throughput' | 'logins'>('both');
  const [selectedSample, setSelectedSample] = useState<TelemetrySample | null>(null);
  const [seedInput, setSeedInput] = useState(String(seed));

  const latest = samples[samples.length - 1];
  const openAlertsCount = alerts.filter((a) => a.status === 'open').length;
  const openCasesCount = cases.filter((c) => c.status !== 'closed').length;
  const containedCount = segments.filter((s) => s.status === 'contained').length;

  const throughputAlert = (latest?.throughputMbps ?? 100) < 50;
  const loginAlert = (latest?.failedLoginsPerMin ?? 0) > 10;

  return (
    <div className="space-y-6">
      {/* Lab Simulation Control Strip (kept in workspace toolbar, never in top header) */}
      <div className="theme-surface p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleRunning}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]"
          >
            {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{running ? 'Pause Clock' : 'Resume Clock'}</span>
          </button>

          <button
            type="button"
            onClick={onStepTick}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Step +3s</span>
          </button>

          <div className="h-5 w-px mx-1 hidden sm:block" style={{ backgroundColor: 'var(--t-border)' }} />

          <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
            Inject Scenario:
          </span>
          {(
            [
              ['bf', 'Credential Stuffing'],
              ['slow', 'Bandwidth Hog'],
              ['lat', 'ISP Latency'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onInjectScenario(key)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
            >
              <Zap className="w-3 h-3" style={{ color: 'var(--t-high)' }} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--t-text-muted)' }}>
            <input
              type="checkbox"
              checked={autoInject}
              onChange={onToggleAutoInject}
              className="accent-[var(--t-accent)] w-4 h-4"
            />
            <span>Auto-inject</span>
          </label>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseInt(seedInput, 10);
              if (!Number.isNaN(parsed) && parsed > 0) {
                onReseed(parsed);
              }
            }}
            className="flex items-center gap-1.5"
          >
            <label htmlFor="sim-seed-input" className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
              Seed
            </label>
            <input
              id="sim-seed-input"
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="w-24 px-2 py-1.5 text-xs font-mono-tabular theme-input"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[36px]"
              title="Replay simulation from seed"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Replay</span>
            </button>
          </form>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={onNavigateAlerts}
          className="theme-surface p-4 text-left cursor-pointer transition-colors hover:border-[var(--t-border-strong)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
              Open Alerts
            </span>
            <SeverityBadge severity={openAlertsCount > 0 ? 'high' : 'nominal'} compact />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-display font-mono-tabular">
              {openAlertsCount}
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
              {threats.length} live threat{threats.length === 1 ? '' : 's'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onNavigateCases}
          className="theme-surface p-4 text-left cursor-pointer transition-colors hover:border-[var(--t-border-strong)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
              Open Cases (INC + SR)
            </span>
            <SeverityBadge severity={openCasesCount > 0 ? 'medium' : 'nominal'} compact />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-display font-mono-tabular">
              {openCasesCount}
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
              {cases.length} total stored
            </span>
          </div>
        </button>

        <div className="theme-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
              WAN Throughput
            </span>
            <SeverityBadge severity={throughputAlert ? 'critical' : 'nominal'} compact />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-display font-mono-tabular">
              {latest?.throughputMbps ?? '—'}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--t-text-muted)' }}>
                Mbps
              </span>
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
              min 50 Mbps
            </span>
          </div>
        </div>

        <div className="theme-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
              Failed Logins / min
            </span>
            <SeverityBadge severity={loginAlert ? 'critical' : 'nominal'} compact />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-display font-mono-tabular">
              {latest?.failedLoginsPerMin ?? '—'}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--t-text-muted)' }}>
                /min
              </span>
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
              {containedCount} seg contained
            </span>
          </div>
        </div>
      </div>

      {/* Dual Telemetry Charts */}
      <TelemetryCharts
        samples={samples}
        chartStyle={themeConfig.chartStyle}
        metricFilter={metricFilter}
        onMetricFilterChange={setMetricFilter}
        selectedSeq={selectedSample?.seq ?? null}
        onSelectSample={setSelectedSample}
      />

      {/* Selected Sample Inspector */}
      {selectedSample && (
        <div className="theme-surface p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
              <span>Sample #{selectedSample.seq}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedSample.ts}</span>
              {selectedSample.activeSegment && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Segment: {selectedSample.activeSegment}</span>
                </>
              )}
            </div>
            <p className="text-sm font-medium">
              {selectedSample.activeScenario
                ? `Active Incident Signal: ${SCENARIOS[selectedSample.activeScenario].title}`
                : 'Nominal baseline sample — no active threat injection'}
            </p>
            <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
              WAN: {selectedSample.throughputMbps} Mbps · Auth Failures: {selectedSample.failedLoginsPerMin}/min
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedSample.activeScenario && (
              <button
                type="button"
                onClick={onNavigateAlerts}
                className="px-3 py-2 text-xs font-semibold theme-btn-primary cursor-pointer"
              >
                Investigate in Alerts
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedSample(null)}
              className="px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Lower Split: Segment Health Map + Live Event Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 theme-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold font-display">01. Monitored Segments</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
                Toggle containment to isolate compromised segments
              </p>
            </div>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--t-border)' }}>
            {segments.map((seg) => {
              const hasThreat = threats.some((t) => t.segment === seg.name);
              const isContained = seg.status === 'contained';
              return (
                <div
                  key={seg.name}
                  className="py-3 flex items-center justify-between gap-3"
                  style={{ borderColor: 'var(--t-border)' }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{seg.name}</span>
                      <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
                        Crit {seg.criticality}/5
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--t-text-muted)' }}>
                      <span>{seg.ownerTeam}</span>
                      <span aria-hidden="true">·</span>
                      {isContained ? (
                        <span className="inline-flex items-center gap-1 font-mono-tabular" style={{ color: 'var(--t-high)' }}>
                          <ShieldOff className="w-3 h-3" /> CONTAINED
                        </span>
                      ) : hasThreat ? (
                        <span className="inline-flex items-center gap-1 font-mono-tabular" style={{ color: 'var(--t-crit)' }}>
                          <ShieldAlert className="w-3 h-3" /> ALERTING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono-tabular" style={{ color: 'var(--t-low)' }}>
                          <ShieldCheck className="w-3 h-3" /> NOMINAL
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleSegment(seg.name)}
                    className="px-3 py-1.5 text-xs font-medium theme-btn-secondary cursor-pointer whitespace-nowrap min-h-[36px]"
                  >
                    {isContained ? 'Restore' : 'Contain'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 theme-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold font-display">02. Live Telemetry Stream</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
                UTC-timestamped synthetic events · {running ? '3s cadence active' : 'clock paused'}
              </p>
            </div>
            <Activity className="w-4 h-4" style={{ color: running ? 'var(--t-accent)' : 'var(--t-text-dim)' }} />
          </div>

          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}>
                  <th className="py-2 px-2 font-medium">Time (UTC)</th>
                  <th className="py-2 px-2 font-medium">Severity</th>
                  <th className="py-2 px-2 font-medium">Segment</th>
                  <th className="py-2 px-2 font-medium">Source IP</th>
                  <th className="py-2 px-2 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody className="font-mono-tabular">
                {events.slice(0, 20).map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--t-border)' }}>
                    <td className="py-2 px-2 whitespace-nowrap">{ev.ts.slice(11, 19)}</td>
                    <td className="py-2 px-2">
                      <SeverityBadge severity={ev.action === 'ALERT' ? ev.severity : 'nominal'} compact />
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">{ev.segment}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{ev.srcIp}</td>
                    <td className="py-2 px-2 font-body">{ev.message}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center" style={{ color: 'var(--t-text-muted)' }}>
                      Waiting for first 3-second telemetry sample…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
