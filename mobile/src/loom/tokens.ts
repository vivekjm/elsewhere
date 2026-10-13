/** Loom design tokens. Mirrors the "Design system" board on the canvas (version 24). */

export const colors = {
  canvas: '#EEEDEB',
  card: '#FFFFFF',
  ink: '#1E1E1E',
  inkButton: '#2A2A2A',
  stone: '#7A7A7A',
  ember: '#FF6A2B',
  mist: '#F1F0EE',
  rule: '#E6E5E2',
  track: '#DAD8D4',
  control: '#D4D2CE',
  placeholder: '#B5B3AF',
  dashed: '#CFCDC8',
  danger: '#9A2F3B',
  sheetBackdrop: '#D9D7D3',
} as const;

export type Tint = 'peach' | 'rose' | 'mint' | 'lavender' | 'grey';

/** Pastel chip tints: background and a text colour that meets 4.5:1 on it. */
export const tints: Record<Tint, { bg: string; fg: string }> = {
  peach: { bg: '#FBD9C4', fg: '#9A3F13' },
  rose: { bg: '#F9D4D8', fg: '#9A2F3B' },
  mint: { bg: '#D6F0E3', fg: '#1C6B45' },
  lavender: { bg: '#E3E6F5', fg: '#3B4A8F' },
  grey: { bg: '#E8E8E6', fg: '#555555' },
};

/** Tighter shape language: no pills for controls, no card inside a card. */
export const radii = {
  hero: 20,
  card: 16,
  tile: 12,
  button: 12,
  field: 12,
  iconTile: 10,
  check: 7,
  chip: 6,
  sheet: 20,
  round: 999,
} as const;

export const space = { gutter: 16, section: 22, card: 16, row: 14 } as const;

export const shadows = {
  rest: '0px 8px 24px rgba(30, 30, 30, 0.06)',
  lift: '0px 16px 40px rgba(30, 30, 30, 0.10)',
  button: '0px 6px 16px rgba(30, 30, 30, 0.08)',
  dark: '0px 10px 24px rgba(30, 30, 30, 0.18)',
  tabBar: '0px -12px 40px rgba(30, 30, 30, 0.08)',
} as const;

export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

/** The one warm hero gradient. */
export const ember = {
  from: '#FF8A4A',
  mid: '#FF6A2B',
  to: '#F2A98A',
  glowLight: '#FFB98A',
  glowHot: '#FF3F0A',
  glowSoft: '#FFD3BE',
} as const;

export const TAB_BAR_HEIGHT = 88;
