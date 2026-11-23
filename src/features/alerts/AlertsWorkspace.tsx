import { useState } from 'react';
import { Bot, Check, FolderPlus, ShieldOff, Sparkles } from 'lucide-react';
import { fetchInvestigationCoach } from '../../ai/client';
import { SeverityBadge } from '../../components/SeverityBadge';
import type { Alert, CoachResponse } from '../../domain/types';
import { SCENARIOS } from '../../sim/scenarios';

interface AlertsWorkspaceProps {
  alerts: Alert[];
  aiEnabled: boolean;
  onToggleAi: () => void;
  onUpdateAlertStatus: (alertId: string, status: Alert['status']) => Promise<void>;
  onPromoteToCase: (alert: Alert) => Promise<void>;
  onOpenCase: (caseId: string) => void;
}

export function AlertsWorkspace({
  alerts,
  aiEnabled,
  onToggleAi,
  onUpdateAlertStatus,
  onPromoteToCase,
  onOpenCase,
}: AlertsWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | Alert['status']>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(alerts[0]?.id ?? null);

  // AI Coach state
  const [question, setQuestion] = useState('What distinguishes this signal from normal baseline activity?');
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachResult, setCoachResult] = useState<CoachResponse | null>(null);

  const filtered = alerts.filter((a) => statusFilter === 'all' || a.status === statusFilter);
  const selected = alerts.find((a) => a.id === selectedAlertId) ?? filtered[0] ?? null;
  const scenario = selected ? SCENARIOS[selected.scenarioKey] : null;

  const runCoach = async () => {
    if (!selected || !scenario) return;
    setCoachLoading(true);
    setCoachError(null);
    try {
      const visibleRows =
        scenario.metric === 'auth.failed' ? scenario.fixture.logins : scenario.fixture.network;
      const result = await fetchInvestigationCoach({
        scenario,
        alert: selected,
        rows: visibleRows,
        question,
        revealAnswer,
      });
      setCoachResult(result);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : 'Unable to reach AI Coach.');
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold font-display">Persistent Detection Alerts</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            Deduplicated alerts persist independently of the 90-second simulation threat TTL.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 theme-surface-alt">
          {(['all', 'open', 'ack', 'suppressed', 'closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className="px-3 py-1.5 text-xs font-medium capitalize cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: statusFilter === st ? 'var(--t-accent)' : 'transparent',
                color: statusFilter === st ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
                borderRadius: 'var(--t-radius-sm)',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Alert Queue List */}
        <div className="lg:col-span-5 theme-surface divide-y" style={{ borderColor: 'var(--t-border)' }}>
          {filtered.map((a) => {
            const isSelected = selected?.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedAlertId(a.id);
                  setCoachResult(null);
                  setCoachError(null);
                }}
                className="w-full text-left p-4 transition-colors cursor-pointer block"
                style={{
                  backgroundColor: isSelected ? 'var(--t-surface-alt)' : 'transparent',
                  borderColor: 'var(--t-border)',
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                    Risk {a.riskScore}/100 · {a.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--t-text)' }}>
                  {a.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                  <span>{a.segment}</span>
                  <span aria-hidden="true">·</span>
                  <span>{a.sourceIp}</span>
                  <span aria-hidden="true">·</span>
                  <span>{a.sampleCount} hit{a.sampleCount === 1 ? '' : 's'}</span>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>
              No alerts match the selected filter. Inject a scenario on Overview to trigger detections.
            </div>
          )}
        </div>

        {/* Alert Detail & Bounded AI Coach */}
        <div className="lg:col-span-7 space-y-6">
          {selected && scenario ? (
            <>
              <div className="theme-surface p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular mb-1" style={{ color: 'var(--t-text-muted)' }}>
                      <span>{selected.detectionKey} v{selected.detectionVersion}</span>
                      <span aria-hidden="true">·</span>
                      <span>MITRE {scenario.mitre.join(', ')}</span>
                      <span aria-hidden="true">·</span>
                      <span>Last seen {selected.lastSeen.slice(11, 19)} UTC</span>
                    </div>
                    <h3 className="text-lg font-semibold font-display">{selected.title}</h3>
                  </div>
                  <SeverityBadge severity={selected.severity} />
                </div>

                <div className="p-3.5 theme-surface-alt space-y-1.5">
                  <p className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
                    Observed Symptoms
                  </p>
                  <ul className="text-xs space-y-1 list-disc pl-4">
                    {scenario.symptom.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {selected.linkedCaseId ? (
                    <button
                      type="button"
                      onClick={() => onOpenCase(selected.linkedCaseId!)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Open Linked Case</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPromoteToCase(selected)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Promote to Incident Case</span>
                    </button>
                  )}

                  {selected.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => onUpdateAlertStatus(selected.id, 'ack')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  )}

                  {selected.status !== 'suppressed' && selected.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => onUpdateAlertStatus(selected.id, 'suppressed')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      <span>Suppress</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bounded Investigation Coach (Dossier Section 09) */}
              <div className="theme-surface p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" style={{ color: 'var(--t-accent)' }} />
                    <div>
                      <h4 className="text-sm font-semibold font-display">Bounded Investigation Coach</h4>
                      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                        Schema-validated Gemini assistance · cites visible log rows only
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleAi}
                    className="px-3 py-1.5 text-xs font-medium theme-btn-secondary cursor-pointer"
                  >
                    {aiEnabled ? 'AI Coach: On' : 'AI Coach: Off'}
                  </button>
                </div>

                {!aiEnabled ? (
                  <p className="text-xs p-3 theme-surface-alt" style={{ color: 'var(--t-text-muted)' }}>
                    AI Coach is disabled. All simulation, lab, and grading workflows operate deterministically offline.
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="coach-question" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t-text-muted)' }}>
                          Ask the Coach about visible telemetry
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="coach-question"
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs theme-input"
                          />
                          <button
                            type="button"
                            disabled={coachLoading}
                            onClick={runCoach}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer whitespace-nowrap min-h-[40px] disabled:opacity-60"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{coachLoading ? 'Analyzing…' : 'Consult Coach'}</span>
                          </button>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--t-text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={revealAnswer}
                          onChange={(e) => setRevealAnswer(e.target.checked)}
                          className="accent-[var(--t-accent)]"
                        />
                        <span>Allow Coach to reveal direct containment answer (otherwise guiding question only)</span>
                      </label>
                    </div>

                    {coachError && (
                      <div className="p-3 text-xs theme-surface-alt" style={{ color: 'var(--t-crit)' }}>
                        {coachError}
                      </div>
                    )}

                    {coachResult && (
                      <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>
                        <p className="text-xs leading-relaxed">{coachResult.summary}</p>
                        <div className="p-3 theme-surface-alt">
                          <span className="text-[11px] font-mono-tabular font-semibold" style={{ color: 'var(--t-accent)' }}>
                            Guiding Question
                          </span>
                          <p className="text-xs mt-1">{coachResult.guidingQuestion}</p>
                        </div>

                        {coachResult.hypotheses.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
                              Ranked Hypotheses
                            </span>
                            <div className="grid gap-2">
                              {coachResult.hypotheses.map((h, i) => (
                                <div key={i} className="p-2.5 theme-surface-alt text-xs">
                                  <div className="flex items-center justify-between gap-2 font-semibold">
                                    <span>{h.title}</span>
                                    <span className="font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                                      {h.likelihood}
                                    </span>
                                  </div>
                                  <p className="mt-1" style={{ color: 'var(--t-text-muted)' }}>
                                    Falsifying check: {h.falsifyingCheck}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                          <span>Citations:</span>
                          <span>{coachResult.citations.length > 0 ? coachResult.citations.join(', ') : 'None returned'}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="theme-surface p-8 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>
              Select an alert from the queue to inspect telemetry and consult the coach.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
