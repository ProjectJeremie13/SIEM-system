import { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, Palette } from 'lucide-react';
import { BuiltInTutorial } from './components/BuiltInTutorial';
import { ThemeStudioDrawer } from './components/ThemeStudioDrawer';
import { calculateRiskScore } from './domain/scoring';
import type {
  ActiveThreat,
  Alert,
  AuditEvent,
  Case,
  Role,
  ScenarioKey,
  SegmentName,
  SegmentState,
  SimEvent,
  TelemetrySample,
  ThemeConfig,
  ThemeId,
} from './domain/types';
import { AdminWorkspace } from './features/admin/AdminWorkspace';
import { AlertsWorkspace } from './features/alerts/AlertsWorkspace';
import { CaseWorkspace } from './features/cases/CaseWorkspace';
import { OverviewWorkspace } from './features/overview/OverviewWorkspace';
import { PortalWorkspace } from './features/portal/PortalWorkspace';
import { SimulationEngine } from './sim/engine';
import { INITIAL_SEGMENTS, SCENARIOS } from './sim/scenarios';
import {
  alertRepo,
  auditRepo,
  caseRepo,
  settingsRepo,
  seedDemoIfEmpty,
  subscribeSync,
} from './storage/repositories';
import { applyThemeConfig, DEFAULT_THEME_CONFIG, THEME_PRESETS } from './themes/presets';

type RouteId = 'overview' | 'alerts' | 'cases' | 'portal' | 'admin';

const NAV_ITEMS: { id: RouteId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'cases', label: 'Cases' },
  { id: 'portal', label: 'Portal' },
  { id: 'admin', label: 'Admin' },
];

const QUICK_THEME_IDS: ThemeId[] = ['morozov', 'aerox', 'crimson', 'nord', 'tura', 'stream'];

export default function App() {
  const [route, setRoute] = useState<RouteId>('overview');
  const [themeStudioOpen, setThemeStudioOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [completedTutorialSteps, setCompletedTutorialSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('kobosec_tutorial_progress');
      return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const [ready, setReady] = useState(false);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [role, setRole] = useState<Role>('analyst');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [seed, setSeed] = useState(20261123);
  const [segments, setSegments] = useState<SegmentState[]>(INITIAL_SEGMENTS);

  const [cases, setCases] = useState<Case[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [running, setRunning] = useState(true);
  const [autoInject, setAutoInject] = useState(true);
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [threats, setThreats] = useState<ActiveThreat[]>([]);

  const engineRef = useRef<SimulationEngine>(new SimulationEngine(20261123));
  const segmentsRef = useRef<SegmentState[]>(INITIAL_SEGMENTS);
  const autoInjectRef = useRef<boolean>(true);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    autoInjectRef.current = autoInject;
  }, [autoInject]);

  const refreshData = useCallback(async () => {
    const [nextCases, nextAlerts, nextAudit, nextSegments] = await Promise.all([
      caseRepo.list(),
      alertRepo.list(),
      auditRepo.list(150),
      settingsRepo.getSegments(),
    ]);
    setCases(nextCases);
    setAlerts(nextAlerts);
    setAuditEvents(nextAudit);
    setSegments(nextSegments);
  }, []);

  const processTick = useCallback(async () => {
    const out = engineRef.current.step(segmentsRef.current, autoInjectRef.current);
    setSamples((prev) => [...prev.slice(-15), out.sample]);
    setEvents((prev) => [...out.events, ...prev].slice(0, 60));
    setThreats(out.threats);

    if (out.triggeredAlerts.length > 0) {
      for (const trig of out.triggeredAlerts) {
        const sc = SCENARIOS[trig.scenarioKey];
        const segObj = segmentsRef.current.find((s) => s.name === trig.segment);
        const risk = calculateRiskScore(sc.severity, segObj?.criticality ?? 4, 0.9);
        await alertRepo.upsertFromDetection({
          detectionKey: sc.detectionKey,
          detectionVersion: sc.detectionVersion,
          scenarioKey: sc.key,
          title: sc.title,
          segment: trig.segment,
          sourceIp: trig.srcIp,
          severity: sc.severity,
          riskScore: risk,
        });
      }
      await refreshData();
    }
  }, [refreshData]);

  // Initial hydration + seed
  useEffect(() => {
    let mounted = true;

    async function boot() {
      await seedDemoIfEmpty();
      const [loadedTheme, loadedRole, loadedAi, loadedSeed, loadedSegs] = await Promise.all([
        settingsRepo.getTheme(),
        settingsRepo.getRole(),
        settingsRepo.getAiEnabled(),
        settingsRepo.getSeed(),
        settingsRepo.getSegments(),
      ]);

      if (!mounted) return;
      setThemeConfig(loadedTheme);
      applyThemeConfig(loadedTheme);
      setRole(loadedRole);
      setAiEnabled(loadedAi);
      setSeed(loadedSeed);
      setSegments(loadedSegs);
      segmentsRef.current = loadedSegs;

      engineRef.current.reseed(loadedSeed);
      // Warm up 8 initial baseline samples so charts are populated immediately
      const initialSamples: TelemetrySample[] = [];
      const initialEvents: SimEvent[] = [];
      for (let i = 0; i < 8; i++) {
        const out = engineRef.current.step(loadedSegs, false);
        initialSamples.push(out.sample);
        initialEvents.unshift(...out.events);
      }
      setSamples(initialSamples);
      setEvents(initialEvents.slice(0, 40));

      await refreshData();
      if (mounted) setReady(true);
    }

    boot();
    const unsub = subscribeSync(() => {
      refreshData();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [refreshData]);

  // 3,000 ms monotonic simulation clock
  useEffect(() => {
    if (!ready || !running) return;
    const timer = window.setInterval(() => {
      processTick();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [ready, running, processTick]);

  const handleThemeChange = async (next: ThemeConfig) => {
    setThemeConfig(next);
    applyThemeConfig(next);
    await settingsRepo.saveTheme(next);
  };

  const handleQuickPreset = (presetId: ThemeId) => {
    const p = THEME_PRESETS[presetId];
    handleThemeChange({
      ...themeConfig,
      presetId,
      customAccent: null,
      radius: p.defaultRadius,
      typography: p.defaultTypography,
      chartStyle: p.defaultChartStyle,
    });
  };

  const handleInjectScenario = async (key: ScenarioKey) => {
    const threat = engineRef.current.injectThreat(key, segmentsRef.current);
    if (!threat) return;
    await processTick();
  };

  const handleReseed = async (nextSeed: number) => {
    setSeed(nextSeed);
    await settingsRepo.setSeed(nextSeed);
    engineRef.current.reseed(nextSeed);
    const warm: TelemetrySample[] = [];
    for (let i = 0; i < 8; i++) {
      warm.push(engineRef.current.step(segmentsRef.current, false).sample);
    }
    setSamples(warm);
    setThreats([]);
  };

  const handleToggleSegment = async (name: SegmentName) => {
    const next = segments.map((s) =>
      s.name === name
        ? { ...s, status: s.status === 'up' ? ('contained' as const) : ('up' as const) }
        : s
    );
    const target = next.find((s) => s.name === name);
    if (target?.status === 'contained') {
      engineRef.current.purgeSegmentThreats(name);
      setThreats(engineRef.current.getThreats());
    }
    setSegments(next);
    await settingsRepo.setSegments(
      next,
      `User (${role})`,
      role,
      `Segment ${name} changed to ${target?.status ?? 'up'}`
    );
    await refreshData();
  };

  const handlePromoteAlert = async (alert: Alert) => {
    const sc = SCENARIOS[alert.scenarioKey];
    const created = await caseRepo.create({
      type: 'INC',
      priority: alert.severity,
      impact: 'department',
      segment: alert.segment,
      scenarioKey: alert.scenarioKey,
      reporterName: `User (${role})`,
      title: sc.title,
      summary: sc.symptom.join(' · '),
      sourceIp: alert.sourceIp,
      alertId: alert.id,
      seed,
      actorRole: role,
    });
    await refreshData();
    setSelectedCaseId(created.id);
    setRoute('cases');
  };

  const openAlertsBadge = alerts.filter((a) => a.status === 'open').length;
  const activePreset = THEME_PRESETS[themeConfig.presetId];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Strictly 3-Zone Top Bar Contract */}
      <header
        className="w-full px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--t-bg) 88%, transparent)',
          borderBottom: '1px solid var(--t-border)',
        }}
      >
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => setRoute('overview')}
          className="text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0 cursor-pointer"
          style={{ color: 'var(--t-text)' }}
        >
          KOBOSEC
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav aria-label="Primary workspaces" className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoute(item.id)}
                className="text-sm font-medium whitespace-nowrap shrink-0 pb-0.5 cursor-pointer transition-colors"
                style={{
                  color: active ? 'var(--t-text)' : 'var(--t-text-muted)',
                  borderBottom: active ? '2px solid var(--t-accent)' : '2px solid transparent',
                }}
              >
                {item.label}
                {item.id === 'alerts' && openAlertsBadge > 0 ? ` (${openAlertsBadge})` : ''}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setThemeStudioOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold theme-btn-primary whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
          >
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Theme Studio</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Strip (below header, only on < md) */}
      <div
        className="flex md:hidden items-center gap-2 overflow-x-auto px-4 py-2"
        style={{ borderBottom: '1px solid var(--t-border)', backgroundColor: 'var(--t-surface)' }}
      >
        {NAV_ITEMS.map((item) => {
          const active = route === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRoute(item.id)}
              className="px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: active ? 'var(--t-accent)' : 'transparent',
                color: active ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
                borderRadius: 'var(--t-radius-sm)',
              }}
            >
              {item.label}
              {item.id === 'alerts' && openAlertsBadge > 0 ? ` (${openAlertsBadge})` : ''}
            </button>
          );
        })}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Workspace Context + Instant 6-Theme Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--t-text-muted)' }}>
            <span className="font-mono-tabular font-semibold" style={{ color: 'var(--t-text)' }}>
              {NAV_ITEMS.find((n) => n.id === route)?.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>Training Mode ({role})</span>
            <span aria-hidden="true">·</span>
            <span>Theme: {activePreset.name}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setTutorialOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 font-medium underline cursor-pointer"
              style={{ color: 'var(--t-accent)' }}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tutorialOpen ? 'Hide Guide' : 'Navigation Tutorial'}</span>
            </button>
          </div>

          {/* Direct 1-Click Theme Selector across all 6 reference-image themes */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick theme switcher">
            {QUICK_THEME_IDS.map((tid) => {
              const p = THEME_PRESETS[tid];
              const isSelected = themeConfig.presetId === tid;
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => handleQuickPreset(tid)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'var(--t-accent)' : 'var(--t-surface)',
                    color: isSelected ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
                    border: '1px solid var(--t-border)',
                    borderRadius: 'var(--t-radius-sm)',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 shrink-0"
                    style={{
                      backgroundColor: p.tokens.accent,
                      border: `1px solid ${p.tokens.borderStrong}`,
                      borderRadius: '1px',
                    }}
                    aria-hidden="true"
                  />
                  <span>{p.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!ready ? (
          <div className="theme-surface p-12 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>
            Initializing IndexedDB workspace and seeded telemetry engine…
          </div>
        ) : (
          <>
            {route === 'overview' && (
              <OverviewWorkspace
                running={running}
                onToggleRunning={() => setRunning((r) => !r)}
                onStepTick={processTick}
                onInjectScenario={handleInjectScenario}
                seed={seed}
                onReseed={handleReseed}
                autoInject={autoInject}
                onToggleAutoInject={() => setAutoInject((a) => !a)}
                samples={samples}
                events={events}
                threats={threats}
                segments={segments}
                onToggleSegment={handleToggleSegment}
                alerts={alerts}
                cases={cases}
                themeConfig={themeConfig}
                onNavigateAlerts={() => setRoute('alerts')}
                onNavigateCases={() => setRoute('cases')}
              />
            )}

            {route === 'alerts' && (
              <AlertsWorkspace
                alerts={alerts}
                aiEnabled={aiEnabled}
                onToggleAi={async () => {
                  const next = !aiEnabled;
                  setAiEnabled(next);
                  await settingsRepo.setAiEnabled(next);
                }}
                onUpdateAlertStatus={async (id, st) => {
                  await alertRepo.updateStatus(id, st, `User (${role})`, role);
                  await refreshData();
                }}
                onPromoteToCase={handlePromoteAlert}
                onOpenCase={(caseId) => {
                  setSelectedCaseId(caseId);
                  setRoute('cases');
                }}
              />
            )}

            {route === 'cases' && (
              <CaseWorkspace
                cases={cases}
                auditEvents={auditEvents}
                role={role}
                aiEnabled={aiEnabled}
                samples={samples}
                selectedCaseId={selectedCaseId}
                onSelectCaseId={setSelectedCaseId}
                onRefresh={refreshData}
              />
            )}

            {route === 'portal' && (
              <PortalWorkspace
                seed={seed}
                role={role}
                onCreated={refreshData}
              />
            )}

            {route === 'admin' && (
              <AdminWorkspace
                role={role}
                onChangeRole={async (r) => {
                  setRole(r);
                  await settingsRepo.setRole(r);
                }}
                segments={segments}
                onToggleSegment={handleToggleSegment}
                aiEnabled={aiEnabled}
                onToggleAi={async () => {
                  const next = !aiEnabled;
                  setAiEnabled(next);
                  await settingsRepo.setAiEnabled(next);
                }}
                themeConfig={themeConfig}
                onOpenThemeStudio={() => setThemeStudioOpen(true)}
                onOpenTutorial={() => {
                  setTutorialStepIndex(0);
                  setTutorialOpen(true);
                }}
                onRefresh={refreshData}
              />
            )}
          </>
        )}
      </main>

      <footer
        className="w-full px-4 sm:px-8 py-4 text-xs flex flex-wrap items-center justify-between gap-4"
        style={{ borderTop: '1px solid var(--t-border)', color: 'var(--t-text-dim)' }}
      >
        <span>KOBOSEC SIEM · Synthetic SOC &amp; Service Desk Training Environment</span>
        <span>Local-first IndexedDB · Seeded deterministic simulation · 6 customizable themes</span>
      </footer>

      <ThemeStudioDrawer
        open={themeStudioOpen}
        onClose={() => setThemeStudioOpen(false)}
        config={themeConfig}
        onChange={handleThemeChange}
      />

      <BuiltInTutorial
        open={tutorialOpen}
        stepIndex={tutorialStepIndex}
        onStepChange={setTutorialStepIndex}
        onClose={() => setTutorialOpen(false)}
        onNavigateRoute={setRoute}
        onInjectScenario={handleInjectScenario}
        onOpenThemeStudio={() => setThemeStudioOpen(true)}
        completedSteps={completedTutorialSteps}
        onMarkStepDone={(stepId) => {
          setCompletedTutorialSteps((prev) => {
            if (prev[stepId]) return prev;
            const next = { ...prev, [stepId]: true };
            try {
              localStorage.setItem('kobosec_tutorial_progress', JSON.stringify(next));
            } catch {
              // ignore storage errors
            }
            return next;
          });
        }}
      />
    </div>
  );
}
