import { useState } from 'react';
import { Table2, TrendingUp } from 'lucide-react';
import type { TelemetrySample, ThemeConfig } from '../domain/types';

interface TelemetryChartsProps {
  samples: TelemetrySample[];
  chartStyle: ThemeConfig['chartStyle'];
  metricFilter: 'both' | 'throughput' | 'logins';
  onMetricFilterChange: (f: 'both' | 'throughput' | 'logins') => void;
  selectedSeq: number | null;
  onSelectSample: (sample: TelemetrySample) => void;
}

function formatUtcShort(iso: string): string {
  return iso.slice(11, 19);
}

export function TelemetryCharts({
  samples,
  chartStyle,
  metricFilter,
  onMetricFilterChange,
  selectedSeq,
  onSelectSample,
}: TelemetryChartsProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const w = 520;
  const h = 164;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const getX = (index: number, total: number) => {
    if (total <= 1) return padL + plotW / 2;
    return padL + (index / (total - 1)) * plotW;
  };

  const renderMetricSvg = (
    title: string,
    unit: string,
    maxVal: number,
    thresholdVal: number,
    thresholdDirection: 'below' | 'above',
    strokeColor: string,
    getValue: (s: TelemetrySample) => number
  ) => {
    const pts = samples.map((s, idx) => {
      const val = getValue(s);
      const x = getX(idx, samples.length);
      const ratio = Math.min(1, Math.max(0, val / maxVal));
      const y = padT + plotH - ratio * plotH;
      return { x, y, val, sample: s };
    });

    const linePath =
      pts.length > 0
        ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        : '';

    const areaPath =
      pts.length > 1
        ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
        : '';

    const threshY = padT + plotH - (thresholdVal / maxVal) * plotH;

    return (
      <div className="theme-surface p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold font-display" style={{ color: 'var(--t-text)' }}>
              {title}
            </h3>
            <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
              Alert when {thresholdDirection} {thresholdVal} {unit} · 16-sample window (48s)
            </p>
          </div>
          {pts.length > 0 && (
            <div className="text-right font-mono-tabular">
              <span className="text-lg font-semibold" style={{ color: 'var(--t-text)' }}>
                {pts[pts.length - 1].val}
              </span>
              <span className="text-xs ml-1" style={{ color: 'var(--t-text-muted)' }}>
                {unit}
              </span>
            </div>
          )}
        </div>

        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`${title} telemetry chart`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = padT + plotH - step * plotH;
            const label = Math.round(step * maxVal);
            return (
              <g key={step}>
                <line
                  x1={padL}
                  y1={y}
                  x2={w - padR}
                  y2={y}
                  stroke="var(--t-border)"
                  strokeWidth="1"
                  strokeOpacity="0.65"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--t-text-dim)"
                  fontSize="9"
                  fontFamily="var(--t-font-mono)"
                >
                  {label}
                </text>
              </g>
            );
          })}

          <line
            x1={padL}
            y1={threshY}
            x2={w - padR}
            y2={threshY}
            stroke="var(--t-crit)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={w - padR}
            y={threshY - 4}
            textAnchor="end"
            fill="var(--t-crit)"
            fontSize="8.5"
            fontFamily="var(--t-font-mono)"
          >
            threshold {thresholdVal}
          </text>

          {chartStyle === 'area' && areaPath && (
            <path d={areaPath} fill={strokeColor} fillOpacity="0.14" />
          )}

          {chartStyle === 'area' &&
            pts.map((p) => (
              <rect
                key={`bar-${p.sample.seq}`}
                x={p.x - 4}
                y={p.y}
                width={8}
                height={Math.max(1, padT + plotH - p.y)}
                fill={p.sample.activeScenario ? 'var(--t-crit)' : strokeColor}
                fillOpacity={p.sample.seq === selectedSeq ? 0.65 : 0.28}
              />
            ))}

          {linePath && (
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" />
          )}

          {pts.map((p) => {
            const isAlert =
              thresholdDirection === 'below' ? p.val < thresholdVal : p.val > thresholdVal;
            const isSelected = p.sample.seq === selectedSeq;
            return (
              <g
                key={p.sample.seq}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`Sample ${p.sample.seq} at ${formatUtcShort(p.sample.ts)} UTC: ${p.val} ${unit}`}
                onClick={() => onSelectSample(p.sample)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSample(p.sample);
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 5.5 : isAlert || p.sample.activeScenario ? 4 : 2.5}
                  fill={isAlert ? 'var(--t-crit)' : strokeColor}
                  stroke={isSelected ? 'var(--t-text)' : 'var(--t-bg)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
              </g>
            );
          })}

          {pts.length > 0 && (
            <>
              <text
                x={padL}
                y={h - 6}
                fill="var(--t-text-dim)"
                fontSize="9"
                fontFamily="var(--t-font-mono)"
              >
                {formatUtcShort(pts[0].sample.ts)} UTC
              </text>
              <text
                x={w - padR}
                y={h - 6}
                textAnchor="end"
                fill="var(--t-text-dim)"
                fontSize="9"
                fontFamily="var(--t-font-mono)"
              >
                {formatUtcShort(pts[pts.length - 1].sample.ts)} UTC
              </text>
            </>
          )}
        </svg>
      </div>
    );
  };

  return (
    <section aria-label="Telemetry visualization">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 p-1 theme-surface-alt">
          {(
            [
              ['both', 'Dual Series'],
              ['throughput', 'Throughput'],
              ['logins', 'Failed Logins'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onMetricFilterChange(id)}
              className="px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              style={{
                backgroundColor: metricFilter === id ? 'var(--t-accent)' : 'transparent',
                color: metricFilter === id ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
                borderRadius: 'var(--t-radius-sm)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 theme-surface-alt">
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: viewMode === 'chart' ? 'var(--t-accent)' : 'transparent',
              color: viewMode === 'chart' ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
              borderRadius: 'var(--t-radius-sm)',
            }}
          >
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: viewMode === 'table' ? 'var(--t-accent)' : 'transparent',
              color: viewMode === 'table' ? 'var(--t-accent-contrast)' : 'var(--t-text-muted)',
              borderRadius: 'var(--t-radius-sm)',
            }}
          >
            <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Data Table</span>
          </button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div
          className={`grid gap-4 ${
            metricFilter === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {(metricFilter === 'both' || metricFilter === 'throughput') &&
            renderMetricSvg(
              'WAN Throughput',
              'Mbps',
              110,
              50,
              'below',
              'var(--t-accent)',
              (s) => s.throughputMbps
            )}
          {(metricFilter === 'both' || metricFilter === 'logins') &&
            renderMetricSvg(
              'Failed Logins per Minute',
              'fails/min',
              50,
              10,
              'above',
              'var(--t-secondary)',
              (s) => s.failedLoginsPerMin
            )}
        </div>
      ) : (
        <div className="theme-surface overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}>
                <th className="py-2.5 px-3 font-medium">Seq</th>
                <th className="py-2.5 px-3 font-medium">UTC Timestamp</th>
                <th className="py-2.5 px-3 font-medium text-right">WAN (Mbps)</th>
                <th className="py-2.5 px-3 font-medium text-right">Failed Logins/min</th>
                <th className="py-2.5 px-3 font-medium">Active Scenario</th>
                <th className="py-2.5 px-3 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="font-mono-tabular">
              {[...samples].reverse().map((s) => (
                <tr
                  key={s.seq}
                  style={{
                    borderBottom: '1px solid var(--t-border)',
                    backgroundColor: s.seq === selectedSeq ? 'var(--t-surface-alt)' : 'transparent',
                  }}
                >
                  <td className="py-2 px-3">#{s.seq}</td>
                  <td className="py-2 px-3">{s.ts}</td>
                  <td
                    className="py-2 px-3 text-right"
                    style={{ color: s.throughputMbps < 50 ? 'var(--t-crit)' : 'var(--t-text)' }}
                  >
                    {s.throughputMbps}
                  </td>
                  <td
                    className="py-2 px-3 text-right"
                    style={{ color: s.failedLoginsPerMin > 10 ? 'var(--t-crit)' : 'var(--t-text)' }}
                  >
                    {s.failedLoginsPerMin}
                  </td>
                  <td className="py-2 px-3">{s.activeScenario ?? 'baseline'}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectSample(s)}
                      className="underline cursor-pointer"
                      style={{ color: 'var(--t-accent)' }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
