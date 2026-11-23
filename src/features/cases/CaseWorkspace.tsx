import { useEffect, useState } from 'react';
import {
  BookOpen,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  FlaskConical,
  HelpCircle,
  Lock,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { fetchAskCaseFilter, fetchDraftReport } from '../../ai/client';
import { SeverityBadge } from '../../components/SeverityBadge';
import {
  ALLOWED_TRANSITIONS,
  CASE_STATUS_ORDER,
  validateClosure,
} from '../../domain/caseMachine';
import { scoreQuiz } from '../../domain/scoring';
import type {
  AuditEvent,
  Case,
  CaseEvent,
  CaseStatus,
  DraftReportResponse,
  EvidenceMeta,
  LabAttempt,
  Role,
  ScenarioKey,
  TelemetrySample,
} from '../../domain/types';
import { SCENARIOS } from '../../sim/scenarios';
import {
  caseRepo,
  evidenceRepo,
  formatCaseReportText,
  labRepo,
} from '../../storage/repositories';

interface CaseWorkspaceProps {
  cases: Case[];
  auditEvents: AuditEvent[];
  role: Role;
  aiEnabled: boolean;
  samples: TelemetrySample[];
  selectedCaseId: string | null;
  onSelectCaseId: (id: string | null) => void;
  onRefresh: () => Promise<void>;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CaseWorkspace({
  cases,
  auditEvents,
  role,
  aiEnabled,
  samples,
  selectedCaseId,
  onSelectCaseId,
  onRefresh,
}: CaseWorkspaceProps) {
  const [subTab, setSubTab] = useState<'queue' | 'history' | 'audit'>('queue');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'INC' | 'SR'>('all');
  const [searchText, setSearchText] = useState('');
  const [nlQuery, setNlQuery] = useState('');
  const [nlExplanation, setNlExplanation] = useState<string | null>(null);
  const [nlLoading, setNlLoading] = useState(false);

  const [detailTab, setDetailTab] = useState<'overview' | 'lab' | 'evidence' | 'close'>('overview');
  const [caseEvents, setCaseEvents] = useState<CaseEvent[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceMeta[]>([]);
  const [labAttempts, setLabAttempts] = useState<LabAttempt[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Timeline comment
  const [commentText, setCommentText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Lab state
  const [labSearch, setLabSearch] = useState('');
  const [hintsShown, setHintsShown] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [latestEval, setLatestEval] = useState<ReturnType<typeof scoreQuiz> | null>(null);

  // Closure form
  const [rootCause, setRootCause] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [systemsImpacted, setSystemsImpacted] = useState('');
  const [prevention, setPrevention] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<DraftReportResponse | null>(null);

  // History bulk selection
  const [selectedHistoryRefs, setSelectedHistoryRefs] = useState<Record<string, boolean>>({});

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? cases[0] ?? null;

  useEffect(() => {
    if (!selectedCase) return;
    setRootCause(selectedCase.rootCause ?? '');
    setActionTaken(selectedCase.action ?? '');
    setSystemsImpacted(selectedCase.systemsImpacted ?? selectedCase.segment);
    setPrevention(selectedCase.prevention ?? '');
    setActionError(null);
    setAiDraft(null);
    setLatestEval(null);
    setQuizAnswers({});
    setHintsShown(0);

    let active = true;
    Promise.all([
      caseRepo.getEvents(selectedCase.id),
      evidenceRepo.listForCase(selectedCase.id),
      labRepo.listForTarget(selectedCase.id),
    ]).then(([evs, evMeta, attempts]) => {
      if (!active) return;
      setCaseEvents(evs);
      setEvidenceList(evMeta);
      setLabAttempts(attempts);
    });
    return () => {
      active = false;
    };
  }, [selectedCase?.id, selectedCase?.version]);

  // Load blob preview URLs cleanly
  useEffect(() => {
    const created: string[] = [];
    let cancelled = false;
    Promise.all(
      evidenceList.map(async (meta) => {
        if (!meta.mime.startsWith('image/')) return [meta.id, ''] as const;
        const blob = await evidenceRepo.getBlob(meta.id);
        if (!blob) return [meta.id, ''] as const;
        const url = URL.createObjectURL(blob);
        created.push(url);
        return [meta.id, url] as const;
      })
    ).then((entries) => {
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      const next: Record<string, string> = {};
      for (const [id, u] of entries) {
        if (u) next[id] = u;
      }
      setPreviewUrls(next);
    });
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [evidenceList]);

  const filteredCases = cases.filter((c) => {
    if (subTab === 'history' && c.status !== 'closed') return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const hay = `${c.ref} ${c.title} ${c.summary} ${c.segment} ${c.reporterName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handleTransition = async (nextStatus: CaseStatus) => {
    if (!selectedCase) return;
    setActionError(null);
    try {
      await caseRepo.transition(
        selectedCase.id,
        nextStatus,
        `User (${role})`,
        role,
        undefined,
        nextStatus === 'closed'
          ? { rootCause, action: actionTaken, systemsImpacted, prevention }
          : undefined
      );
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Transition rejected.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !commentText.trim()) return;
    await caseRepo.addComment(selectedCase.id, `User (${role})`, role, commentText);
    setCommentText('');
    await onRefresh();
    setCaseEvents(await caseRepo.getEvents(selectedCase.id));
  };

  const handleUploadFile = async (file: File) => {
    if (!selectedCase) return;
    await evidenceRepo.addBlob({
      caseId: selectedCase.id,
      kind: file.type.startsWith('image/') ? 'screenshot' : 'log',
      filename: file.name,
      blob: file,
      capturedBy: `User (${role})`,
      role,
    });
    await onRefresh();
    setEvidenceList(await evidenceRepo.listForCase(selectedCase.id));
  };

  const handleCaptureTelemetrySnapshot = async () => {
    if (!selectedCase) return;
    const last = samples.slice(-12);
    const svgLines = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="240" viewBox="0 0 760 240">`,
      `<rect width="760" height="240" fill="#111317"/>`,
      `<text x="20" y="30" fill="#f3f3f1" font-family="monospace" font-size="13">KOBOSEC SIEM TELEMETRY SNAPSHOT · ${selectedCase.ref} · ${new Date().toISOString()}</text>`,
      `<text x="20" y="54" fill="#9ca0a8" font-family="monospace" font-size="11">Segment: ${selectedCase.segment} · Latest WAN: ${last[last.length - 1]?.throughputMbps ?? 0} Mbps · Failed Logins: ${last[last.length - 1]?.failedLoginsPerMin ?? 0}/min</text>`,
      `<rect x="20" y="72" width="720" height="142" fill="#191b1f" stroke="#2c2f37"/>`,
      ...last.map((s, i) => {
        const x = 40 + i * 58;
        const barH = Math.min(110, s.failedLoginsPerMin * 2.2);
        return `<rect x="${x}" y="${198 - barH}" width="22" height="${barH}" fill="${s.failedLoginsPerMin > 10 ? '#e06c59' : '#8a95a5'}"/><text x="${x + 11}" y="210" text-anchor="middle" fill="#9ca0a8" font-family="monospace" font-size="9">${s.throughputMbps}M</text>`;
      }),
      `</svg>`,
    ].join('');
    const blob = new Blob([svgLines], { type: 'image/svg+xml' });
    await evidenceRepo.addBlob({
      caseId: selectedCase.id,
      kind: 'screenshot',
      filename: `${selectedCase.ref}-telemetry-${Date.now()}.svg`,
      blob,
      capturedBy: `User (${role})`,
      role,
    });
    await onRefresh();
    setEvidenceList(await evidenceRepo.listForCase(selectedCase.id));
  };

  const handleGradeLab = async () => {
    if (!selectedCase) return;
    const scenarioKey: ScenarioKey = selectedCase.scenarioKey ?? 'bf';
    const sc = SCENARIOS[scenarioKey];
    const evalResult = scoreQuiz(sc.quiz, quizAnswers);
    setLatestEval(evalResult);
    await labRepo.recordAttempt({
      targetId: selectedCase.id,
      caseId: selectedCase.id,
      scenarioKey,
      answers: quizAnswers,
      correctCount: evalResult.correctCount,
      wrongCount: evalResult.wrongCount,
      score: evalResult.score,
      hintsUsed: hintsShown,
      actor: `User (${role})`,
      role,
    });
    await onRefresh();
    setLabAttempts(await labRepo.listForTarget(selectedCase.id));
  };

  const handleDraftWithAi = async () => {
    if (!selectedCase) return;
    setDraftLoading(true);
    setActionError(null);
    try {
      const draft = await fetchDraftReport({
        caseRecord: selectedCase,
        events: caseEvents,
        evidenceMeta: evidenceList,
        labAttempt: labAttempts[labAttempts.length - 1] ?? null,
      });
      setAiDraft(draft);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to draft report.');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleAskCases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    setNlExplanation(null);
    try {
      const dsl = await fetchAskCaseFilter(nlQuery);
      if (dsl.status && CASE_STATUS_ORDER.includes(dsl.status as CaseStatus)) {
        setStatusFilter(dsl.status as CaseStatus);
      } else {
        setStatusFilter('all');
      }
      if (dsl.caseType === 'INC' || dsl.caseType === 'SR') {
        setTypeFilter(dsl.caseType);
      } else {
        setTypeFilter('all');
      }
      setSearchText(dsl.searchText || '');
      setNlExplanation(dsl.explanation);
    } catch (err) {
      setNlExplanation(err instanceof Error ? err.message : 'Filter translation unavailable.');
    } finally {
      setNlLoading(false);
    }
  };

  const handleBulkExport = async () => {
    const closed = cases.filter((c) => c.status === 'closed');
    const chosen = closed.filter((c) => selectedHistoryRefs[c.id]);
    const targets = chosen.length > 0 ? chosen : closed;
    if (targets.length === 0) return;

    const parts = await Promise.all(
      targets.map(async (c) => {
        const [evs, evMeta] = await Promise.all([
          caseRepo.getEvents(c.id),
          evidenceRepo.listForCase(c.id),
        ]);
        return formatCaseReportText(c, evs, evMeta);
      })
    );
    downloadTextFile(`kobosec-case-reports-${new Date().toISOString().slice(0, 10)}.txt`, parts.join('\n\n'));
  };

  const scenarioKey: ScenarioKey = selectedCase?.scenarioKey ?? 'bf';
  const scenario = SCENARIOS[scenarioKey];
  const closureMissing = selectedCase
    ? validateClosure(selectedCase.type, {
        rootCause,
        action: actionTaken,
        systemsImpacted,
        prevention,
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Sub-navigation: Queue | Closed History | Immutable Audit Log */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 theme-surface-alt">
          {(
            [
              ['queue', `Unified Queue (${cases.length})`],
              ['history', `Closed History (${cases.filter((c) => c.status === 'closed').length})`],
              ['audit', `Audit Log (${auditEvents.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className="px-3.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: subTab === id ? 'var(--t-accent)' : 'transparent',
                color: subTab === id ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
                borderRadius: 'var(--t-radius-sm)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {subTab === 'history' && (
          <button
            type="button"
            onClick={handleBulkExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Selected / All Closed (.txt)</span>
          </button>
        )}
      </div>

      {subTab === 'audit' ? (
        <div className="theme-surface p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold font-display">Append-Only Audit Trail</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Immutable UTC log of state transitions, evidence hashes, segment changes, and lab completions.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}>
                  <th className="py-2.5 px-3 font-medium">Occurred (UTC)</th>
                  <th className="py-2.5 px-3 font-medium">Actor</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium">Action</th>
                  <th className="py-2.5 px-3 font-medium">Object</th>
                  <th className="py-2.5 px-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="font-mono-tabular">
                {auditEvents.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--t-border)' }}>
                    <td className="py-2 px-3 whitespace-nowrap">{ev.occurredAt.replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-2 px-3 font-body">{ev.actor}</td>
                    <td className="py-2 px-3">{ev.role}</td>
                    <td className="py-2 px-3">{ev.action}</td>
                    <td className="py-2 px-3">{ev.objectId}</td>
                    <td className="py-2 px-3 font-body">{ev.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Filter + Natural-Language Ask-the-Case Bar */}
          <div className="theme-surface p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-dim)' }} />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Filter by reference, title, segment, reporter…"
                  aria-label="Filter cases"
                  className="w-full pl-9 pr-3 py-2 text-xs theme-input"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'INC' | 'SR')}
                aria-label="Filter by case type"
                className="px-3 py-2 text-xs theme-input"
              >
                <option value="all">All Types (INC + SR)</option>
                <option value="INC">INC · Incident</option>
                <option value="SR">SR · Service Request</option>
              </select>

              {subTab === 'queue' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | CaseStatus)}
                  aria-label="Filter by case status"
                  className="px-3 py-2 text-xs theme-input"
                >
                  <option value="all">All Statuses</option>
                  {CASE_STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {st.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {aiEnabled && (
              <form onSubmit={handleAskCases} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
                <input
                  type="text"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder='Ask the Cases (e.g. "show open incidents on Web Portal")'
                  aria-label="Natural language case query"
                  className="flex-1 px-3 py-1.5 text-xs theme-input"
                />
                <button
                  type="submit"
                  disabled={nlLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium theme-btn-secondary cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{nlLoading ? 'Translating…' : 'Translate to Filter'}</span>
                </button>
              </form>
            )}
            {nlExplanation && (
              <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                Filter applied: {nlExplanation}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Case List */}
            <div className="lg:col-span-4 theme-surface divide-y" style={{ borderColor: 'var(--t-border)' }}>
              {filteredCases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className="p-4 flex items-start gap-3 transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--t-surface-alt)' : 'transparent',
                      borderColor: 'var(--t-border)',
                    }}
                  >
                    {subTab === 'history' && (
                      <input
                        type="checkbox"
                        checked={Boolean(selectedHistoryRefs[c.id])}
                        onChange={(e) =>
                          setSelectedHistoryRefs((prev) => ({
                            ...prev,
                            [c.id]: e.target.checked,
                          }))
                        }
                        aria-label={`Select ${c.ref} for bulk export`}
                        className="mt-1 accent-[var(--t-accent)]"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectCaseId(c.id)}
                      className="flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-mono-tabular font-semibold" style={{ color: 'var(--t-accent)' }}>
                          {c.ref}
                        </span>
                        <SeverityBadge severity={c.priority} compact />
                      </div>
                      <p className="text-sm font-semibold leading-snug">{c.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                        <span>{c.status.toUpperCase()}</span>
                        <span aria-hidden="true">·</span>
                        <span>{c.segment}</span>
                        {typeof c.latestScore === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Lab {c.latestScore}/100</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}

              {filteredCases.length === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>
                  No cases match these filters.
                </div>
              )}
            </div>

            {/* Selected Case Drawer */}
            <div className="lg:col-span-8">
              {selectedCase ? (
                <div className="theme-surface p-5 space-y-5">
                  {/* Case Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--t-border)' }}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular mb-1" style={{ color: 'var(--t-text-muted)' }}>
                        <span>{selectedCase.ref}</span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedCase.type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedCase.segment}</span>
                        <span aria-hidden="true">·</span>
                        <span>Opened {selectedCase.openedAt.slice(0, 16).replace('T', ' ')} UTC</span>
                      </div>
                      <h2 className="text-xl font-semibold font-display">{selectedCase.title}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={selectedCase.priority} />
                      <button
                        type="button"
                        onClick={() =>
                          downloadTextFile(
                            `${selectedCase.ref}.txt`,
                            formatCaseReportText(selectedCase, caseEvents, evidenceList)
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium theme-btn-secondary cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Report .txt</span>
                      </button>
                    </div>
                  </div>

                  {/* Enforced Lifecycle Stepper */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
                        Enforced Case Lifecycle (v{selectedCase.version})
                      </span>
                      <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                        Assignee: {selectedCase.assigneeRole ?? 'Unassigned'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                      {CASE_STATUS_ORDER.map((st) => {
                        const isCurrent = selectedCase.status === st;
                        const isAllowed = ALLOWED_TRANSITIONS[selectedCase.status].includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            disabled={!isAllowed && !isCurrent}
                            onClick={() => {
                              if (st === 'closed') {
                                setDetailTab('close');
                              } else if (isAllowed) {
                                handleTransition(st);
                              }
                            }}
                            className="py-2 px-2 text-xs font-mono-tabular uppercase font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: isCurrent ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                              color: isCurrent ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                              border: isAllowed ? '1px solid var(--t-accent)' : '1px solid var(--t-border)',
                              borderRadius: 'var(--t-radius-sm)',
                            }}
                            title={
                              isCurrent
                                ? 'Current state'
                                : isAllowed
                                  ? `Transition to ${st}`
                                  : `Illegal from ${selectedCase.status}`
                            }
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>

                    {actionError && (
                      <p className="text-xs p-2.5 theme-surface-alt" style={{ color: 'var(--t-crit)' }}>
                        {actionError}
                      </p>
                    )}
                  </div>

                  {/* Case Inner Tabs */}
                  <div className="flex flex-wrap items-center gap-1 p-1 theme-surface-alt">
                    {(
                      [
                        ['overview', 'Timeline & Course', FileText],
                        ['lab', 'Resolution Lab & Quiz', FlaskConical],
                        ['evidence', `Evidence (${evidenceList.length})`, Camera],
                        ['close', 'Closure Gate', Lock],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDetailTab(id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                        style={{
                          backgroundColor: detailTab === id ? 'var(--t-accent)' : 'transparent',
                          color: detailTab === id ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
                          borderRadius: 'var(--t-radius-sm)',
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Inner Tab Panels */}
                  {detailTab === 'overview' && (
                    <div className="space-y-5">
                      <div className="p-4 theme-surface-alt space-y-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
                          Incident Summary · Reporter: {selectedCase.reporterName} · Tracking PIN: <span className="font-mono-tabular">{selectedCase.trackingCode}</span>
                        </p>
                        <p className="text-sm">{selectedCase.summary}</p>
                        {selectedCase.learnedSkill && (
                          <p className="text-xs font-mono-tabular pt-2" style={{ color: 'var(--t-low)' }}>
                            Skill Verified: {selectedCase.learnedSkill} ({selectedCase.latestScore ?? 100}/100)
                          </p>
                        )}
                      </div>

                      {/* Guided Crash Course */}
                      <div className="p-4 theme-surface-alt space-y-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" style={{ color: 'var(--t-accent)' }} />
                          <h3 className="text-sm font-semibold font-display">
                            Guided Crash Course · {scenario.title}
                          </h3>
                        </div>
                        <p className="text-xs"><strong>What is happening:</strong> {scenario.course.what}</p>
                        <p className="text-xs"><strong>How to read logs:</strong> {scenario.course.readLogs}</p>
                        <ul className="text-xs list-disc pl-4 space-y-1" style={{ color: 'var(--t-text-muted)' }}>
                          {scenario.course.checklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Immutable Case Timeline */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold font-display">Case Timeline</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {caseEvents.map((ev) => (
                            <div key={ev.id} className="p-2.5 theme-surface-alt text-xs flex flex-wrap justify-between gap-2">
                              <div>
                                <span className="font-semibold">{ev.actor}:</span>{' '}
                                <span>{ev.body}</span>
                              </div>
                              <span className="font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
                                {ev.createdAt.slice(11, 19)} UTC
                              </span>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={handleAddComment} className="flex gap-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Append investigation note to immutable timeline…"
                            aria-label="Add timeline comment"
                            className="flex-1 px-3 py-2 text-xs theme-input"
                          />
                          <button type="submit" className="px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer">
                            Append Note
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {detailTab === 'lab' && (
                    <div className="space-y-5">
                      {/* Hint Ladder */}
                      <div className="p-4 theme-surface-alt space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" style={{ color: 'var(--t-accent)' }} />
                            <h3 className="text-sm font-semibold font-display">
                              Progressive Hint Ladder ({hintsShown}/6)
                            </h3>
                          </div>
                          {hintsShown < 6 && (
                            <button
                              type="button"
                              onClick={() => setHintsShown((h) => Math.min(6, h + 1))}
                              className="px-3 py-1.5 text-xs font-medium theme-btn-secondary cursor-pointer"
                            >
                              Reveal Next Hint
                            </button>
                          )}
                        </div>
                        {hintsShown === 0 ? (
                          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                            Inspect the synthetic log fixtures below first. Reveal hints only if stuck.
                          </p>
                        ) : (
                          <ol className="text-xs space-y-1.5 list-decimal pl-4">
                            {[...scenario.hints, ...scenario.extendedHints]
                              .slice(0, hintsShown)
                              .map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                          </ol>
                        )}
                      </div>

                      {/* Searchable Log Fixtures */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold font-display">Synthetic Log Fixtures</h3>
                          <input
                            type="text"
                            value={labSearch}
                            onChange={(e) => setLabSearch(e.target.value)}
                            placeholder="Filter log rows (IP, user, host)…"
                            aria-label="Filter fixture logs"
                            className="px-3 py-1.5 text-xs theme-input w-64"
                          />
                        </div>

                        <div className="overflow-x-auto theme-surface-alt p-3">
                          <p className="text-xs font-mono-tabular mb-2" style={{ color: 'var(--t-text-muted)' }}>
                            Authentication Logs
                          </p>
                          <table className="w-full text-left border-collapse text-xs font-mono-tabular">
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}>
                                <th className="py-1.5 px-2">ID</th>
                                <th className="py-1.5 px-2">Time</th>
                                <th className="py-1.5 px-2">Source IP</th>
                                <th className="py-1.5 px-2">Username</th>
                                <th className="py-1.5 px-2">Outcome</th>
                                <th className="py-1.5 px-2 text-right">Latency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scenario.fixture.logins
                                .filter((r) =>
                                  JSON.stringify(r).toLowerCase().includes(labSearch.toLowerCase())
                                )
                                .map((r) => (
                                  <tr key={r.id} style={{ borderBottom: '1px solid var(--t-border)' }}>
                                    <td className="py-1.5 px-2">{r.id}</td>
                                    <td className="py-1.5 px-2">{r.ts}</td>
                                    <td className="py-1.5 px-2">{r.srcIp}</td>
                                    <td className="py-1.5 px-2">{r.username}</td>
                                    <td
                                      className="py-1.5 px-2 font-semibold"
                                      style={{ color: r.outcome === 'FAIL' ? 'var(--t-crit)' : 'var(--t-low)' }}
                                    >
                                      {r.outcome}
                                    </td>
                                    <td className="py-1.5 px-2 text-right">{r.latencyMs} ms</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="overflow-x-auto theme-surface-alt p-3">
                          <p className="text-xs font-mono-tabular mb-2" style={{ color: 'var(--t-text-muted)' }}>
                            Network Flow &amp; Path Telemetry
                          </p>
                          <table className="w-full text-left border-collapse text-xs font-mono-tabular">
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}>
                                <th className="py-1.5 px-2">ID</th>
                                <th className="py-1.5 px-2">Host</th>
                                <th className="py-1.5 px-2">Destination</th>
                                <th className="py-1.5 px-2 text-right">Mbps</th>
                                <th className="py-1.5 px-2 text-right">RTT</th>
                                <th className="py-1.5 px-2 text-right">Loss %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scenario.fixture.network
                                .filter((r) =>
                                  JSON.stringify(r).toLowerCase().includes(labSearch.toLowerCase())
                                )
                                .map((r) => (
                                  <tr key={r.id} style={{ borderBottom: '1px solid var(--t-border)' }}>
                                    <td className="py-1.5 px-2">{r.id}</td>
                                    <td className="py-1.5 px-2">{r.host}</td>
                                    <td className="py-1.5 px-2">{r.destination}</td>
                                    <td className="py-1.5 px-2 text-right">{r.mbps}</td>
                                    <td className="py-1.5 px-2 text-right">{r.rttMs} ms</td>
                                    <td
                                      className="py-1.5 px-2 text-right"
                                      style={{ color: r.lossPct > 2 ? 'var(--t-crit)' : 'var(--t-text)' }}
                                    >
                                      {r.lossPct}%
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 5-Question Assessed Quiz */}
                      <div className="space-y-4 pt-2">
                        <h3 className="text-sm font-semibold font-display">
                          Assessment Quiz (5 Questions)
                        </h3>
                        {scenario.quiz.map((q, qi) => (
                          <div key={q.id} className="p-3.5 theme-surface-alt space-y-2">
                            <p className="text-xs font-semibold">
                              {qi + 1}. {q.prompt}
                            </p>
                            <div className="space-y-1.5">
                              {q.options.map((opt, oi) => (
                                <label key={oi} className="flex items-start gap-2 text-xs cursor-pointer">
                                  <input
                                    type="radio"
                                    name={q.id}
                                    checked={quizAnswers[q.id] === oi}
                                    onChange={() =>
                                      setQuizAnswers((prev) => ({ ...prev, [q.id]: oi }))
                                    }
                                    className="mt-0.5 accent-[var(--t-accent)]"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                            {latestEval && (
                              <p
                                className="text-xs pt-1 font-mono-tabular"
                                style={{
                                  color: latestEval.perQuestion[q.id]?.correct
                                    ? 'var(--t-low)'
                                    : 'var(--t-crit)',
                                }}
                              >
                                {latestEval.perQuestion[q.id]?.correct ? 'CORRECT' : 'INCORRECT'} —{' '}
                                {q.why}
                              </p>
                            )}
                          </div>
                        ))}

                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <button
                            type="button"
                            disabled={Object.keys(quizAnswers).length < scenario.quiz.length}
                            onClick={handleGradeLab}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer disabled:opacity-50 min-h-[40px]"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Submit &amp; Grade Assessment</span>
                          </button>

                          {latestEval && (
                            <span className="text-sm font-mono-tabular font-semibold">
                              Score: {latestEval.score}/100 · {latestEval.correctCount}/{scenario.quiz.length}
                            </span>
                          )}
                        </div>

                        {labAttempts.length > 0 && (
                          <div className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                            Attempt history: {labAttempts.map((a) => `${a.score}/100`).join(' → ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {detailTab === 'evidence' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[40px]">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image / Log File</span>
                          <input
                            type="file"
                            accept="image/*,.txt,.log,.json,.csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadFile(file);
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={handleCaptureTelemetrySnapshot}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium theme-btn-secondary cursor-pointer min-h-[40px]"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Capture Telemetry Snapshot (SVG Blob)</span>
                        </button>
                      </div>

                      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                        Evidence bytes are stored in an isolated IndexedDB Blob store with SHA-256 chain-of-custody hashes — never base64 inside application state.
                      </p>

                      <div className="grid gap-3">
                        {evidenceList.map((ev) => (
                          <div key={ev.id} className="p-3.5 theme-surface-alt space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold">{ev.filename}</span>
                              <span className="font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
                                {ev.mime} · {(ev.bytes / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <p className="text-[11px] font-mono-tabular break-all" style={{ color: 'var(--t-text-dim)' }}>
                              SHA-256: {ev.sha256} · Captured {ev.capturedAt}
                            </p>
                            {previewUrls[ev.id] && (
                              <img
                                src={previewUrls[ev.id]}
                                alt={ev.filename}
                                referrerPolicy="no-referrer"
                                className="max-h-48 w-auto border"
                                style={{ borderColor: 'var(--t-border)' }}
                              />
                            )}
                          </div>
                        ))}
                        {evidenceList.length === 0 && (
                          <p className="text-xs p-4 theme-surface-alt" style={{ color: 'var(--t-text-muted)' }}>
                            No binary evidence attached yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {detailTab === 'close' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold font-display">
                            Closure Gate ({selectedCase.type} Requirements)
                          </h3>
                          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                            {selectedCase.type === 'INC'
                              ? 'Incident closure requires root cause, containment action, systems impacted, and prevention.'
                              : 'Service Request closure requires fulfillment action and target systems.'}
                          </p>
                        </div>
                        {aiEnabled && (
                          <button
                            type="button"
                            disabled={draftLoading}
                            onClick={handleDraftWithAi}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{draftLoading ? 'Drafting…' : 'Draft Closure with AI'}</span>
                          </button>
                        )}
                      </div>

                      {aiDraft && (
                        <div className="p-3.5 theme-surface-alt space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">AI Draft Proposal ({aiDraft.confidence})</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRootCause(aiDraft.rootCause);
                                setActionTaken(aiDraft.action);
                                setSystemsImpacted(aiDraft.systemsImpacted);
                                setPrevention(aiDraft.prevention);
                              }}
                              className="underline cursor-pointer"
                              style={{ color: 'var(--t-accent)' }}
                            >
                              Apply All Draft Fields
                            </button>
                          </div>
                          <p style={{ color: 'var(--t-text-muted)' }}>
                            Citations: {aiDraft.citations.join(', ') || 'Case summary'}
                          </p>
                        </div>
                      )}

                      <div className="grid gap-3">
                        {selectedCase.type === 'INC' && (
                          <div>
                            <label htmlFor="close-rc" className="block text-xs font-medium mb-1">
                              Root Cause
                            </label>
                            <textarea
                              id="close-rc"
                              rows={2}
                              value={rootCause}
                              onChange={(e) => setRootCause(e.target.value)}
                              className="w-full p-2.5 text-xs theme-input"
                            />
                          </div>
                        )}
                        <div>
                          <label htmlFor="close-act" className="block text-xs font-medium mb-1">
                            {selectedCase.type === 'INC' ? 'Containment / Action Taken' : 'Fulfillment Action'}
                          </label>
                          <textarea
                            id="close-act"
                            rows={2}
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            className="w-full p-2.5 text-xs theme-input"
                          />
                        </div>
                        <div>
                          <label htmlFor="close-sys" className="block text-xs font-medium mb-1">
                            Systems Impacted
                          </label>
                          <input
                            id="close-sys"
                            type="text"
                            value={systemsImpacted}
                            onChange={(e) => setSystemsImpacted(e.target.value)}
                            className="w-full p-2.5 text-xs theme-input"
                          />
                        </div>
                        {selectedCase.type === 'INC' && (
                          <div>
                            <label htmlFor="close-prev" className="block text-xs font-medium mb-1">
                              Prevention Measure
                            </label>
                            <textarea
                              id="close-prev"
                              rows={2}
                              value={prevention}
                              onChange={(e) => setPrevention(e.target.value)}
                              className="w-full p-2.5 text-xs theme-input"
                            />
                          </div>
                        )}
                      </div>

                      {closureMissing.length > 0 && (
                        <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-high)' }}>
                          Required before closing: {closureMissing.join(', ')}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {selectedCase.status === 'resolved' ? (
                          <button
                            type="button"
                            disabled={closureMissing.length > 0}
                            onClick={() => handleTransition('closed')}
                            className="px-4 py-2 text-xs font-semibold theme-btn-primary cursor-pointer disabled:opacity-50 min-h-[40px]"
                          >
                            Sign Off &amp; Close Case
                          </button>
                        ) : selectedCase.status !== 'closed' ? (
                          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                            Advance lifecycle to <strong>RESOLVED</strong> above before final sign-off.
                          </p>
                        ) : (
                          <span className="text-xs font-mono-tabular" style={{ color: 'var(--t-low)' }}>
                            Case closed at {selectedCase.closedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="theme-surface p-8 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>
                  Select a case from the queue to inspect timeline, run labs, or attach evidence.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
