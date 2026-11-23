import { useEffect, useRef } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { ThemeConfig, ThemeId } from '../domain/types';
import { DEFAULT_THEME_CONFIG, THEME_PRESETS } from '../themes/presets';

interface ThemeStudioDrawerProps {
  open: boolean;
  onClose: () => void;
  config: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
}

const PRESET_ORDER: ThemeId[] = ['morozov', 'aerox', 'crimson', 'nord', 'tura', 'stream'];

export function ThemeStudioDrawer({
  open,
  onClose,
  config,
  onChange,
}: ThemeStudioDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activePreset = THEME_PRESETS[config.presetId];

  const selectPreset = (presetId: ThemeId) => {
    const p = THEME_PRESETS[presetId];
    onChange({
      ...config,
      presetId,
      customAccent: null,
      radius: p.defaultRadius,
      typography: p.defaultTypography,
      chartStyle: p.defaultChartStyle,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-studio-title"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative z-10 w-full max-w-[520px] h-full overflow-y-auto p-6 flex flex-col gap-6"
        style={{
          backgroundColor: 'var(--t-surface)',
          borderLeft: '1px solid var(--t-border-strong)',
          color: 'var(--t-text)',
        }}
      >
        <div className="flex items-start justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div>
            <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-text-muted)' }}>
              Theme Studio · 6 Visual Presets
            </p>
            <h2 id="theme-studio-title" className="text-xl font-semibold font-display mt-1">
              Customize Console Appearance
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close Theme Studio"
            className="p-2 theme-btn-secondary cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 6 Theme Cards modeled after the 6 attached reference images */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
              Select Base Theme
            </span>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_THEME_CONFIG)}
              className="inline-flex items-center gap-1.5 text-xs hover:underline cursor-pointer"
              style={{ color: 'var(--t-text-muted)' }}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset default</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESET_ORDER.map((id) => {
              const p = THEME_PRESETS[id];
              const isSelected = config.presetId === id;
              const [cBg, cSurf, cAcc, cSub] = p.previewColors;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectPreset(id)}
                  className="text-left p-3 transition-all cursor-pointer flex flex-col gap-2.5"
                  style={{
                    backgroundColor: 'var(--t-surface-alt)',
                    border: isSelected
                      ? '2px solid var(--t-accent)'
                      : '1px solid var(--t-border)',
                    borderRadius: 'var(--t-radius)',
                  }}
                >
                  {/* Mini visual schematic preview matching each reference image */}
                  <div
                    className="w-full h-20 p-2.5 flex flex-col justify-between overflow-hidden"
                    style={{
                      backgroundColor: cBg,
                      border: `1px solid ${p.tokens.border}`,
                      borderRadius: 'var(--t-radius-sm)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-mono-tabular font-semibold"
                        style={{ color: p.tokens.text }}
                      >
                        {id === 'morozov' && '01 · MOROZOV'}
                        {id === 'aerox' && 'AEROX · SLATE'}
                        {id === 'crimson' && 'OVERVIEW · 03'}
                        {id === 'nord' && 'NORD · STONE'}
                        {id === 'tura' && 'TURA · MATTE'}
                        {id === 'stream' && 'STREAM OS'}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5" style={{ color: cAcc }} />
                      )}
                    </div>

                    <div className="flex items-end gap-1.5">
                      <div
                        className="h-7 flex-1 p-1.5 flex flex-col justify-between"
                        style={{
                          backgroundColor: cSurf,
                          border: `1px solid ${p.tokens.border}`,
                        }}
                      >
                        <div className="w-8 h-1" style={{ backgroundColor: cAcc }} />
                        <div className="w-14 h-1 opacity-50" style={{ backgroundColor: cSub }} />
                      </div>
                      <div
                        className="h-7 w-10 flex items-center justify-center text-[9px] font-mono-tabular font-bold"
                        style={{
                          backgroundColor: cAcc,
                          color: p.tokens.accentContrast,
                        }}
                      >
                        SOC
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--t-text)' }}>
                        {p.name}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
                      {p.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Granular User Customization */}
        <div className="space-y-4 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>
          <h3 className="text-sm font-semibold font-display">Fine-Tune Tokens</h3>

          {/* Accent color */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="custom-accent-picker" className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>
                Primary Accent Color
              </label>
              {config.customAccent && (
                <button
                  type="button"
                  onClick={() => onChange({ ...config, customAccent: null })}
                  className="text-xs underline cursor-pointer"
                  style={{ color: 'var(--t-text-muted)' }}
                >
                  Use preset default
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activePreset.accentSwatches.map((hex) => {
                const active = (config.customAccent || activePreset.tokens.accent).toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Select accent color ${hex}`}
                    onClick={() => onChange({ ...config, customAccent: hex })}
                    className="w-8 h-8 cursor-pointer flex items-center justify-center"
                    style={{
                      backgroundColor: hex,
                      borderRadius: 'var(--t-radius-sm)',
                      border: active ? '2px solid var(--t-text)' : '1px solid var(--t-border-strong)',
                    }}
                  >
                    {active && <Check className="w-3.5 h-3.5" style={{ color: activePreset.tokens.accentContrast }} />}
                  </button>
                );
              })}
              <input
                id="custom-accent-picker"
                type="color"
                value={config.customAccent || activePreset.tokens.accent}
                onChange={(e) => onChange({ ...config, customAccent: e.target.value })}
                aria-label="Custom accent color picker"
                className="w-10 h-8 p-0.5 cursor-pointer theme-input"
              />
            </div>
          </div>

          {/* Corner Geometry */}
          <div>
            <span className="block text-xs font-medium mb-2" style={{ color: 'var(--t-text-muted)' }}>
              Corner Geometry
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['sharp', 'Sharp 0px'],
                  ['editorial', 'Editorial 3px'],
                  ['matte', 'Matte 8px'],
                  ['modular', 'Modular 12px'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange({ ...config, radius: val })}
                  className="py-2 px-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: config.radius === val ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                    color: config.radius === val ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                    border: '1px solid var(--t-border)',
                    borderRadius: 'var(--t-radius-sm)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Typography Pairing */}
          <div>
            <span className="block text-xs font-medium mb-2" style={{ color: 'var(--t-text-muted)' }}>
              Display Typography
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['geometric', 'Geometric Sans'],
                  ['editorial', 'Editorial Serif'],
                  ['technical', 'Technical Mono'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange({ ...config, typography: val })}
                  className="py-2 px-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: config.typography === val ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                    color: config.typography === val ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                    border: '1px solid var(--t-border)',
                    borderRadius: 'var(--t-radius-sm)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Style & Density */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-medium mb-2" style={{ color: 'var(--t-text-muted)' }}>
                Telemetry Chart Style
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['line', 'Line'],
                    ['area', 'Area + Bar'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChange({ ...config, chartStyle: val })}
                    className="py-2 px-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: config.chartStyle === val ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                      color: config.chartStyle === val ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                      border: '1px solid var(--t-border)',
                      borderRadius: 'var(--t-radius-sm)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium mb-2" style={{ color: 'var(--t-text-muted)' }}>
                Layout Density
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['comfortable', 'Standard'],
                    ['compact', 'Compact'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChange({ ...config, density: val })}
                    className="py-2 px-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: config.density === val ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                      color: config.density === val ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                      border: '1px solid var(--t-border)',
                      borderRadius: 'var(--t-radius-sm)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
