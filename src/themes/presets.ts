import type { ThemeConfig, ThemeId } from '../domain/types';

export interface ThemePreset {
  id: ThemeId;
  name: string;
  subtitle: string;
  sourceLabel: string;
  isLight: boolean;
  tokens: {
    bg: string;
    bgAccent: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textDim: string;
    accent: string;
    accentContrast: string;
    secondary: string;
    crit: string;
    high: string;
    med: string;
    low: string;
    info: string;
    shadow: string;
  };
  defaultRadius: ThemeConfig['radius'];
  defaultTypography: ThemeConfig['typography'];
  defaultChartStyle: ThemeConfig['chartStyle'];
  previewColors: [string, string, string, string];
  accentSwatches: string[];
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  morozov: {
    id: 'morozov',
    name: 'Morozov Editorial',
    subtitle: 'Obsidian monochrome · sharp index numerals',
    sourceLabel: 'Theme 01 · Obsidian Portrait',
    isLight: false,
    tokens: {
      bg: '#131417',
      bgAccent: 'radial-gradient(980px 520px at 78% -8%, rgba(255, 255, 255, 0.055), transparent 62%)',
      surface: '#191b1f',
      surfaceAlt: '#21242a',
      border: '#2b2e35',
      borderStrong: '#434853',
      text: '#f2f1ed',
      textMuted: '#9ea3ad',
      textDim: '#6a707a',
      accent: '#f2f1ed',
      accentContrast: '#131417',
      secondary: '#8d96a5',
      crit: '#e26b58',
      high: '#dba055',
      med: '#cbb75e',
      low: '#74b48b',
      info: '#7aa9d6',
      shadow: '0 14px 36px rgba(0, 0, 0, 0.35)',
    },
    defaultRadius: 'editorial',
    defaultTypography: 'geometric',
    defaultChartStyle: 'line',
    previewColors: ['#131417', '#191b1f', '#f2f1ed', '#7b808a'],
    accentSwatches: ['#f2f1ed', '#cfc8bb', '#93c5fd', '#fca5a5'],
  },
  aerox: {
    id: 'aerox',
    name: 'Aerox Slate Teal',
    subtitle: 'Deep emerald slate · outlined telemetry frames',
    sourceLabel: 'Theme 02 · Emerald Mobility',
    isLight: false,
    tokens: {
      bg: '#0c1817',
      bgAccent:
        'radial-gradient(900px 520px at 72% 10%, rgba(77, 182, 172, 0.14), transparent 64%), radial-gradient(700px 400px at 10% 95%, rgba(46, 125, 117, 0.08), transparent 60%)',
      surface: '#112120',
      surfaceAlt: '#172b29',
      border: '#233f3c',
      borderStrong: '#38635e',
      text: '#edf5f4',
      textMuted: '#94b5b0',
      textDim: '#5c7f7a',
      accent: '#56c2b6',
      accentContrast: '#071312',
      secondary: '#a3c9c4',
      crit: '#ef6e62',
      high: '#e5a74d',
      med: '#d2c25f',
      low: '#58c492',
      info: '#60b5d9',
      shadow: '0 16px 38px rgba(4, 14, 13, 0.42)',
    },
    defaultRadius: 'matte',
    defaultTypography: 'geometric',
    defaultChartStyle: 'area',
    previewColors: ['#0c1817', '#172b29', '#56c2b6', '#edf5f4'],
    accentSwatches: ['#56c2b6', '#80cbc4', '#e5a74d', '#edf5f4'],
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Command',
    subtitle: 'Pitch black · scarlet telemetry & serif headers',
    sourceLabel: 'Theme 03 · Scarlet Globe',
    isLight: false,
    tokens: {
      bg: '#000000',
      bgAccent: 'radial-gradient(840px 440px at 50% 0%, rgba(255, 23, 46, 0.1), transparent 62%)',
      surface: '#08080a',
      surfaceAlt: '#111115',
      border: '#2d2d35',
      borderStrong: '#52525e',
      text: '#ffffff',
      textMuted: '#c0b8bc',
      textDim: '#7a7479',
      accent: '#ff172e',
      accentContrast: '#ffffff',
      secondary: '#fb7185',
      crit: '#ff2b3f',
      high: '#fb923c',
      med: '#facc15',
      low: '#4ade80',
      info: '#fb7185',
      shadow: 'none',
    },
    defaultRadius: 'sharp',
    defaultTypography: 'editorial',
    defaultChartStyle: 'line',
    previewColors: ['#000000', '#08080a', '#ff172e', '#fb7185'],
    accentSwatches: ['#ff172e', '#fb7185', '#f43f5e', '#ffffff'],
  },
  nord: {
    id: 'nord',
    name: 'Nord Stone',
    subtitle: 'Warm alabaster · espresso ink & architectural grids',
    sourceLabel: 'Theme 04 · Stone Editorial',
    isLight: true,
    tokens: {
      bg: '#f2efe9',
      bgAccent: 'radial-gradient(900px 450px at 85% 0%, rgba(180, 170, 152, 0.2), transparent 65%)',
      surface: '#faf8f4',
      surfaceAlt: '#ebe6dc',
      border: '#d6cfc2',
      borderStrong: '#9e9688',
      text: '#141413',
      textMuted: '#524e47',
      textDim: '#7a746a',
      accent: '#141413',
      accentContrast: '#faf8f4',
      secondary: '#6b6357',
      crit: '#b91c1c',
      high: '#b45309',
      med: '#a16207',
      low: '#15803d',
      info: '#1d4ed8',
      shadow: 'none',
    },
    defaultRadius: 'sharp',
    defaultTypography: 'editorial',
    defaultChartStyle: 'line',
    previewColors: ['#f2efe9', '#faf8f4', '#141413', '#b8b0a1'],
    accentSwatches: ['#141413', '#575046', '#991b1b', '#1e3a5f'],
  },
  tura: {
    id: 'tura',
    name: 'Tura Matte',
    subtitle: 'Graphite atelier · recessed matte surfaces',
    sourceLabel: 'Theme 05 · Matte Graphite',
    isLight: false,
    tokens: {
      bg: '#1c1e22',
      bgAccent: 'radial-gradient(880px 460px at 20% 0%, rgba(255, 255, 255, 0.03), transparent 60%)',
      surface: '#23262b',
      surfaceAlt: '#2a2e34',
      border: '#343942',
      borderStrong: '#4b525f',
      text: '#f5f6f8',
      textMuted: '#9ea4b0',
      textDim: '#6e7582',
      accent: '#e2e5ea',
      accentContrast: '#1c1e22',
      secondary: '#93a2b8',
      crit: '#ea6c60',
      high: '#e0a24b',
      med: '#cbb75b',
      low: '#68b98a',
      info: '#6ea8dc',
      shadow: '0 14px 30px rgba(0, 0, 0, 0.28)',
    },
    defaultRadius: 'matte',
    defaultTypography: 'geometric',
    defaultChartStyle: 'area',
    previewColors: ['#1c1e22', '#23262b', '#e2e5ea', '#6e7582'],
    accentSwatches: ['#e2e5ea', '#94a3b8', '#60a5fa', '#f59e0b'],
  },
  stream: {
    id: 'stream',
    name: 'Stream OS Dark',
    subtitle: 'Midnight navy · amber CTA & multi-series cockpit',
    sourceLabel: 'Theme 06 · Navy Telemetry',
    isLight: false,
    tokens: {
      bg: '#080c15',
      bgAccent:
        'radial-gradient(880px 440px at 80% -10%, rgba(56, 189, 248, 0.09), transparent 60%), radial-gradient(760px 400px at 10% 100%, rgba(245, 158, 11, 0.06), transparent 60%)',
      surface: '#0f1523',
      surfaceAlt: '#161f33',
      border: '#222e47',
      borderStrong: '#34466b',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      textDim: '#64748b',
      accent: '#f59e0b',
      accentContrast: '#0b101b',
      secondary: '#38bdf8',
      crit: '#f43f5e',
      high: '#f59e0b',
      med: '#eab308',
      low: '#10b981',
      info: '#38bdf8',
      shadow: '0 12px 32px rgba(3, 7, 18, 0.45)',
    },
    defaultRadius: 'modular',
    defaultTypography: 'geometric',
    defaultChartStyle: 'area',
    previewColors: ['#080c15', '#0f1523', '#f59e0b', '#38bdf8'],
    accentSwatches: ['#f59e0b', '#38bdf8', '#10b981', '#f43f5e'],
  },
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  presetId: 'morozov',
  customAccent: null,
  radius: 'editorial',
  density: 'comfortable',
  typography: 'geometric',
  chartStyle: 'line',
};

function getContrastText(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#111111';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#111215' : '#ffffff';
}

export function applyThemeConfig(config: ThemeConfig): void {
  const preset = THEME_PRESETS[config.presetId] ?? THEME_PRESETS.morozov;
  const root = document.documentElement;
  const t = preset.tokens;

  const activeAccent = config.customAccent || t.accent;
  const activeContrast = config.customAccent ? getContrastText(config.customAccent) : t.accentContrast;

  root.style.setProperty('--t-bg', t.bg);
  root.style.setProperty('--t-bg-accent', t.bgAccent);
  root.style.setProperty('--t-surface', t.surface);
  root.style.setProperty('--t-surface-alt', t.surfaceAlt);
  root.style.setProperty('--t-border', t.border);
  root.style.setProperty('--t-border-strong', t.borderStrong);
  root.style.setProperty('--t-text', t.text);
  root.style.setProperty('--t-text-muted', t.textMuted);
  root.style.setProperty('--t-text-dim', t.textDim);
  root.style.setProperty('--t-accent', activeAccent);
  root.style.setProperty('--t-accent-contrast', activeContrast);
  root.style.setProperty('--t-secondary', t.secondary);
  root.style.setProperty('--t-crit', t.crit);
  root.style.setProperty('--t-high', t.high);
  root.style.setProperty('--t-med', t.med);
  root.style.setProperty('--t-low', t.low);
  root.style.setProperty('--t-info', t.info);
  root.style.setProperty('--t-shadow', t.shadow);

  const radiusMap: Record<ThemeConfig['radius'], [string, string]> = {
    sharp: ['0px', '0px'],
    editorial: ['3px', '2px'],
    matte: ['8px', '6px'],
    modular: ['12px', '8px'],
  };
  const [rLg, rSm] = radiusMap[config.radius] ?? radiusMap.editorial;
  root.style.setProperty('--t-radius', rLg);
  root.style.setProperty('--t-radius-sm', rSm);

  if (config.typography === 'editorial') {
    root.style.setProperty('--t-font-display', '"Playfair Display", Georgia, serif');
    root.style.setProperty('--t-font-body', '"DM Sans", system-ui, sans-serif');
  } else if (config.typography === 'technical') {
    root.style.setProperty('--t-font-display', '"JetBrains Mono", ui-monospace, monospace');
    root.style.setProperty('--t-font-body', '"DM Sans", system-ui, sans-serif');
  } else {
    root.style.setProperty('--t-font-display', '"Plus Jakarta Sans", system-ui, sans-serif');
    root.style.setProperty('--t-font-body', '"DM Sans", system-ui, sans-serif');
  }

  root.style.setProperty('--t-pad-scale', config.density === 'compact' ? '0.82' : '1');
  root.dataset.theme = preset.id;
  root.dataset.light = preset.isLight ? 'true' : 'false';
}
