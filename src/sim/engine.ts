import type {
  ActiveThreat,
  ScenarioKey,
  SegmentName,
  SegmentState,
  SimEvent,
  TelemetrySample,
} from '../domain/types';
import { createUuid, SeededRng } from './rng';
import { SCENARIOS } from './scenarios';

export interface SimTickOutput {
  sample: TelemetrySample;
  events: SimEvent[];
  threats: ActiveThreat[];
  triggeredAlerts: {
    scenarioKey: ScenarioKey;
    segment: SegmentName;
    srcIp: string;
    metric: 'auth.failed' | 'net.throughput';
  }[];
}

export class SimulationEngine {
  private rng: SeededRng;
  private seq = 0;
  private threats: ActiveThreat[] = [];
  private loginAlertArmed = true;
  private speedAlertArmed = true;

  constructor(seed: number) {
    this.rng = new SeededRng(seed);
  }

  reseed(seed: number): void {
    this.rng = new SeededRng(seed);
    this.seq = 0;
    this.threats = [];
    this.loginAlertArmed = true;
    this.speedAlertArmed = true;
  }

  getThreats(): ActiveThreat[] {
    return [...this.threats];
  }

  injectThreat(scenarioKey: ScenarioKey, segments: SegmentState[]): ActiveThreat | null {
    const scenario = SCENARIOS[scenarioKey];
    const seg = segments.find((s) => s.name === scenario.segment);
    if (seg && seg.status === 'contained') {
      return null;
    }
    const threat: ActiveThreat = {
      id: createUuid(),
      scenarioKey,
      segment: scenario.segment,
      srcIp: scenario.defaultSourceIp,
      startedAtMs: Date.now(),
      ttlMs: 90_000,
    };
    this.threats.push(threat);
    return threat;
  }

  purgeSegmentThreats(segment: SegmentName): void {
    this.threats = this.threats.filter((t) => t.segment !== segment);
  }

  clearThreats(): void {
    this.threats = [];
  }

  step(segments: SegmentState[], autoInject: boolean): SimTickOutput {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.seq += 1;

    // Drop expired threats (90s TTL)
    this.threats = this.threats.filter((t) => nowMs - t.startedAtMs <= t.ttlMs);

    let loginPressure = 0;
    let speedDrop = 0;
    let primaryScenario: ScenarioKey | null = null;
    let primarySegment: SegmentName | null = null;

    for (const t of this.threats) {
      const seg = segments.find((s) => s.name === t.segment);
      if (seg?.status === 'contained') continue;

      const age = Math.max(0, nowMs - t.startedAtMs);
      const decay = Math.max(0, 1 - age / t.ttlMs);
      const sc = SCENARIOS[t.scenarioKey];
      if (!primaryScenario) {
        primaryScenario = t.scenarioKey;
        primarySegment = t.segment;
      }

      if (sc.metric === 'auth.failed') {
        loginPressure += 38 * decay;
      } else {
        speedDrop += (t.scenarioKey === 'slow' ? 58 : 44) * decay;
      }
    }

    const failedLoginsPerMin = Math.round(1 + this.rng.int(0, 3) + loginPressure);
    const throughputMbps = Math.max(5, Math.round(92 + this.rng.int(0, 8) - speedDrop));

    const sample: TelemetrySample = {
      seq: this.seq,
      ts: nowIso,
      throughputMbps,
      failedLoginsPerMin,
      activeScenario: primaryScenario,
      activeSegment: primarySegment,
    };

    const upSegments = segments.filter((s) => s.status === 'up');
    const allowSegment = upSegments.length > 0 ? this.rng.pick(upSegments).name : 'WAN';
    const events: SimEvent[] = [
      {
        id: createUuid(),
        ts: nowIso,
        segment: allowSegment,
        srcIp: `10.20.${this.rng.int(1, 14)}.${this.rng.int(10, 220)}`,
        port: this.rng.pick([443, 8443, 22, 53]),
        action: 'ALLOW',
        severity: 'low',
        scenarioKey: null,
        message: `Nominal flow · ${throughputMbps} Mbps · ${failedLoginsPerMin} fails/min`,
      },
    ];

    const triggeredAlerts: SimTickOutput['triggeredAlerts'] = [];

    for (const t of this.threats) {
      const seg = segments.find((s) => s.name === t.segment);
      if (seg?.status === 'contained') continue;
      const sc = SCENARIOS[t.scenarioKey];
      events.unshift({
        id: createUuid(),
        ts: nowIso,
        segment: t.segment,
        srcIp: t.srcIp,
        port: sc.metric === 'auth.failed' ? 443 : 443,
        action: 'ALERT',
        severity: sc.severity,
        scenarioKey: t.scenarioKey,
        message: `${sc.title} · ${sc.metric === 'auth.failed' ? `${failedLoginsPerMin}/min` : `${throughputMbps} Mbps`}`,
      });
    }

    // Thresholds with hysteresis (from Dossier Model 04)
    if (failedLoginsPerMin > 10 && this.loginAlertArmed) {
      this.loginAlertArmed = false;
      const authThreat = this.threats.find((t) => SCENARIOS[t.scenarioKey].metric === 'auth.failed');
      if (authThreat) {
        triggeredAlerts.push({
          scenarioKey: authThreat.scenarioKey,
          segment: authThreat.segment,
          srcIp: authThreat.srcIp,
          metric: 'auth.failed',
        });
      }
    } else if (failedLoginsPerMin < 7) {
      this.loginAlertArmed = true;
    }

    if (throughputMbps < 50 && this.speedAlertArmed) {
      this.speedAlertArmed = false;
      const netThreat = this.threats.find((t) => SCENARIOS[t.scenarioKey].metric === 'net.throughput');
      if (netThreat) {
        triggeredAlerts.push({
          scenarioKey: netThreat.scenarioKey,
          segment: netThreat.segment,
          srcIp: netThreat.srcIp,
          metric: 'net.throughput',
        });
      }
    } else if (throughputMbps > 70) {
      this.speedAlertArmed = true;
    }

    // Seeded auto-injection when quiet
    if (autoInject && this.threats.length === 0 && this.rng.next() < 0.04) {
      const key = this.rng.pick(['bf', 'slow', 'lat'] as const);
      this.injectThreat(key, segments);
    }

    return {
      sample,
      events,
      threats: [...this.threats],
      triggeredAlerts,
    };
  }
}
