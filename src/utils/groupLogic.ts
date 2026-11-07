/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GroupTheme {
  colorKey: string;
  label: string;
  glow: string;          // Top-right translucent blur orb (vibrant)
  secondaryGlow: string; // Bottom-left translucent blur orb
  gradient: string;      // Card background translucent gradient overlay
  accentBorder: string;  // Subtle border highlight
  accentBar: string;     // Top-edge translucent accent bar
  pillBg: string;        // Badge background for filter bar
  textAccent: string;    // Text accent color
  dotColor: string;      // Bright dot badge color
}

export const GROUP_COLOR_THEMES: Record<string, GroupTheme> = {
  sky: {
    colorKey: 'sky',
    label: 'Azul Elétrico (Comunicação)',
    glow: 'bg-sky-500/40',
    secondaryGlow: 'bg-indigo-500/25',
    gradient: 'from-sky-500/20 via-sky-950/10 to-transparent',
    accentBorder: 'border-sky-500/40',
    accentBar: 'bg-sky-400',
    pillBg: 'bg-sky-950/90 border-sky-700 text-sky-200',
    textAccent: 'text-sky-300',
    dotColor: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]',
  },
  purple: {
    colorKey: 'purple',
    label: 'Roxo Vibrante (Design)',
    glow: 'bg-purple-500/40',
    secondaryGlow: 'bg-fuchsia-500/25',
    gradient: 'from-purple-500/20 via-purple-950/10 to-transparent',
    accentBorder: 'border-purple-500/40',
    accentBar: 'bg-purple-400',
    pillBg: 'bg-purple-950/90 border-purple-700 text-purple-200',
    textAccent: 'text-purple-300',
    dotColor: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]',
  },
  emerald: {
    colorKey: 'emerald',
    label: 'Verde Neon (Dev & Código)',
    glow: 'bg-emerald-400/40',
    secondaryGlow: 'bg-teal-500/25',
    gradient: 'from-emerald-500/20 via-emerald-950/10 to-transparent',
    accentBorder: 'border-emerald-500/40',
    accentBar: 'bg-emerald-400',
    pillBg: 'bg-emerald-950/90 border-emerald-700 text-emerald-200',
    textAccent: 'text-emerald-300',
    dotColor: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
  amber: {
    colorKey: 'amber',
    label: 'Ouro Intensivo (Utilitários)',
    glow: 'bg-amber-400/45',
    secondaryGlow: 'bg-orange-500/25',
    gradient: 'from-amber-500/22 via-amber-950/10 to-transparent',
    accentBorder: 'border-amber-500/40',
    accentBar: 'bg-amber-400',
    pillBg: 'bg-amber-950/90 border-amber-700 text-amber-200',
    textAccent: 'text-amber-300',
    dotColor: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
  },
  orange: {
    colorKey: 'orange',
    label: 'Laranja Fogo (Finanças)',
    glow: 'bg-orange-500/42',
    secondaryGlow: 'bg-amber-500/25',
    gradient: 'from-orange-500/20 via-orange-950/10 to-transparent',
    accentBorder: 'border-orange-500/40',
    accentBar: 'bg-orange-400',
    pillBg: 'bg-orange-950/90 border-orange-700 text-orange-200',
    textAccent: 'text-orange-300',
    dotColor: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]',
  },
  indigo: {
    colorKey: 'indigo',
    label: 'Índigo Real (Workspace)',
    glow: 'bg-indigo-500/40',
    secondaryGlow: 'bg-blue-600/25',
    gradient: 'from-indigo-500/20 via-indigo-950/10 to-transparent',
    accentBorder: 'border-indigo-500/40',
    accentBar: 'bg-indigo-400',
    pillBg: 'bg-indigo-950/90 border-indigo-700 text-indigo-200',
    textAccent: 'text-indigo-300',
    dotColor: 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]',
  },
  fuchsia: {
    colorKey: 'fuchsia',
    label: 'Fúcsia Hot Pink (IA & Assistentes)',
    glow: 'bg-fuchsia-500/42',
    secondaryGlow: 'bg-purple-600/25',
    gradient: 'from-fuchsia-500/20 via-fuchsia-950/10 to-transparent',
    accentBorder: 'border-fuchsia-500/40',
    accentBar: 'bg-fuchsia-400',
    pillBg: 'bg-fuchsia-950/90 border-fuchsia-700 text-fuchsia-200',
    textAccent: 'text-fuchsia-300',
    dotColor: 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]',
  },
  cyan: {
    colorKey: 'cyan',
    label: 'Ciano Neon (Produtividade)',
    glow: 'bg-cyan-400/42',
    secondaryGlow: 'bg-sky-500/25',
    gradient: 'from-cyan-500/20 via-cyan-950/10 to-transparent',
    accentBorder: 'border-cyan-500/40',
    accentBar: 'bg-cyan-400',
    pillBg: 'bg-cyan-950/90 border-cyan-700 text-cyan-200',
    textAccent: 'text-cyan-300',
    dotColor: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
  },
  rose: {
    colorKey: 'rose',
    label: 'Rubi Rosa (Mídia)',
    glow: 'bg-rose-500/40',
    secondaryGlow: 'bg-pink-600/25',
    gradient: 'from-rose-500/20 via-rose-950/10 to-transparent',
    accentBorder: 'border-rose-500/40',
    accentBar: 'bg-rose-400',
    pillBg: 'bg-rose-950/90 border-rose-700 text-rose-200',
    textAccent: 'text-rose-300',
    dotColor: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]',
  },
  lime: {
    colorKey: 'lime',
    label: 'Verde Limão Elétrico',
    glow: 'bg-lime-400/42',
    secondaryGlow: 'bg-emerald-500/25',
    gradient: 'from-lime-500/20 via-lime-950/10 to-transparent',
    accentBorder: 'border-lime-500/40',
    accentBar: 'bg-lime-400',
    pillBg: 'bg-lime-950/90 border-lime-700 text-lime-200',
    textAccent: 'text-lime-300',
    dotColor: 'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]',
  },
  slate: {
    colorKey: 'slate',
    label: 'Grafite Neutro (Geral)',
    glow: 'bg-neutral-500/22',
    secondaryGlow: 'bg-neutral-700/15',
    gradient: 'from-neutral-700/15 via-neutral-900/10 to-transparent',
    accentBorder: 'border-neutral-700/50',
    accentBar: 'bg-neutral-500',
    pillBg: 'bg-neutral-900 border-neutral-700 text-neutral-300',
    textAccent: 'text-neutral-300',
    dotColor: 'bg-neutral-400',
  },
};

export const DEFAULT_GROUP_COLORS: Record<string, string> = {
  'Comunicação': 'sky',
  'Design & Criatividade': 'purple',
  'Dev & Código': 'emerald',
  'Ferramentas & Utilitários': 'amber',
  'Finanças & Negócios': 'orange',
  'Google Workspace': 'indigo',
  'IA & Assistentes': 'fuchsia',
  'Produtividade': 'cyan',
  'Geral': 'slate',
  'Outros': 'slate',
};

const COLOR_KEYS = Object.keys(GROUP_COLOR_THEMES);

const STORAGE_KEY = 'chrome_pwa_hub_group_colors_v2';

export function loadGroupColors(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_GROUP_COLORS, ...parsed };
      }
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_GROUP_COLORS };
}

export function saveGroupColors(colors: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // fallback
  }
}

export function getGroupColorKey(groupName: string, customColors?: Record<string, string>): string {
  if (!groupName) return 'slate';
  if (customColors && customColors[groupName] && GROUP_COLOR_THEMES[customColors[groupName]]) {
    return customColors[groupName];
  }
  if (DEFAULT_GROUP_COLORS[groupName]) {
    return DEFAULT_GROUP_COLORS[groupName];
  }
  // Deterministic fallback based on string char code sum
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash += groupName.charCodeAt(i);
  }
  return COLOR_KEYS[hash % (COLOR_KEYS.length - 1)] || 'slate';
}

export function getGroupTheme(groupName: string, customColors?: Record<string, string>): GroupTheme {
  const key = getGroupColorKey(groupName, customColors);
  return GROUP_COLOR_THEMES[key] || GROUP_COLOR_THEMES.slate;
}

// Backward compatibility helpers for group configs
export const DEFAULT_GROUP_SYMBOLS: Record<string, string> = {
  'Comunicação': '💬',
  'Design & Criatividade': '🎨',
  'Dev & Código': '💻',
  'Ferramentas & Utilitários': '🛠️',
  'Finanças & Negócios': '📊',
  'Google Workspace': '💼',
  'IA & Assistentes': '🤖',
  'Produtividade': '⚡',
  'Geral': '📦',
  'Outros': '📁',
};

export function loadGroupConfigs(): Record<string, string> {
  return { ...DEFAULT_GROUP_SYMBOLS };
}

export function saveGroupConfigs(_configs: Record<string, string>): void {
  // no-op
}

export function getGroupSymbol(groupName: string, _configs?: Record<string, string>): string {
  return DEFAULT_GROUP_SYMBOLS[groupName] || '📁';
}
