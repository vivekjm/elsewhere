/**
 * Trips Loom 3.0: one dark theme taken from GymSync. The page is near-black; panes are warm charcoal tiles that
 * touch. A photo appears only where it says something (a trip's hero, its cover), toned to sepia. Khaki is what's
 * live (the one live tile, the primary button), orange is only ever a mark (now, the selected day, a needle), and
 * sand is AI's colour for words it suggested.
 *
 * The older role names (card, stone, ember…) still exist so every screen reads the new values.
 */
export const colors = {
  // The page
  ground: '#0d0c09',
  canvas: '#0d0c09',
  veil: 'rgba(13, 12, 9, 0.54)',
  scrim: 'rgba(13, 12, 9, 0.80)',
  sheetBackdrop: '#0d0c09',

  // Panes: solid warm charcoal on the page. `glass` and `glassStrong` are the only see-through ones, for labels and
  // keys over a photo or a map.
  surface: '#2a2823',
  surfaceRaised: '#36322b',
  card: '#2a2823',
  controlGlass: '#1f1d19',
  controlPressed: '#171612',
  sheet: '#141310',
  glass: 'rgba(33, 31, 26, 0.42)',
  glassStrong: 'rgba(27, 25, 21, 0.84)',
  mist: 'rgba(251, 248, 241, 0.08)',

  // Live: khaki glass. Text on it is always ink.
  khaki: '#706959',
  khakiDeep: '#655e4f',
  khakiRule: 'rgba(251, 248, 241, 0.22)',
  /** Selected fills (a chosen chip, a day, a toggle that's on): khaki. */
  inkButton: '#6c6555',

  // Text
  ink: '#fbf8f1',
  stone: '#b0a99b',
  inkMuted: '#b0a99b',
  inkFaint: '#a39c8e',
  placeholder: '#a39c8e',
  onLight: '#15130f',

  // Lines
  rule: 'rgba(251, 248, 241, 0.12)',
  hairline: 'rgba(251, 248, 241, 0.12)',
  hairlineStrong: 'rgba(251, 248, 241, 0.20)',
  dashed: 'rgba(251, 248, 241, 0.24)',
  track: 'rgba(251, 248, 241, 0.18)',
  control: '#7d776b',
  border: '#7d776b',

  // Marks
  ember: '#f2602a',
  accent: '#f2602a',
  accentGlow: 'rgba(242, 96, 42, 0.55)',
  sand: '#c2a86e',

  // Status
  success: '#4fc48d',
  successFill: '#28795e',
  warning: '#e2b04f',
  danger: '#ff9aa8',
} as const;

/** Place kinds: six muted earth colours for pins and marks, with `onLight` numbers on them. */
export const kinds = {
  heritage: '#e0906f', nature: '#93b98d', food: '#d9ae62', culture: '#ab9fd4', water: '#83b6c6', nightlife: '#cf92bd',
} as const;

/** Tinted labels and icon tiles: a faint wash of the colour on glass, the colour itself for the text. */
export type Tint = 'peach' | 'rose' | 'mint' | 'lavender' | 'grey';
export const tints: Record<Tint, { bg: string; fg: string }> = {
  peach: { bg: 'rgba(224, 144, 111, 0.16)', fg: '#e8a283' },
  rose: { bg: 'rgba(255, 154, 168, 0.14)', fg: '#ff9aa8' },
  mint: { bg: 'rgba(79, 196, 141, 0.14)', fg: '#6fd0a2' },
  lavender: { bg: 'rgba(171, 159, 212, 0.16)', fg: '#bdb3e0' },
  grey: { bg: 'rgba(251, 248, 241, 0.08)', fg: '#c9c2b4' },
};

/** Nearly square, as GymSync's glass is. Only people and dots are round. */
export const radii = { hero: 4, card: 4, tile: 3, button: 4, field: 4, iconTile: 3, check: 2, chip: 3, sheet: 8, round: 999 } as const;
export const space = { gap: 2, gutter: 16, section: 24, card: 16, row: 12 } as const;

/** Depth is frost, not shadow: a hairline edge on panes, a real shadow only for what floats. */
export const shadows = {
  rest: 'inset 0px 0px 0px 1px rgba(251, 248, 241, 0.12)',
  button: 'inset 0px 0px 0px 1px rgba(251, 248, 241, 0.12)',
  dark: 'inset 0px 0px 0px 1px rgba(251, 248, 241, 0.26)',
  lift: '0px 20px 44px rgba(0, 0, 0, 0.60)',
  tabBar: '0px -12px 40px rgba(0, 0, 0, 0.45)',
  glow: '0px 0px 14px rgba(242, 96, 42, 0.55)',
} as const;

/** Outfit, light and geometric. Sentences are light; names are medium; the key words in a sentence are semibold. */
export const fonts = {
  thin: 'Outfit_200ExtraLight',
  light: 'Outfit_300Light',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
} as const;

/** Frost under see-through glass over photos and maps, and under bars content scrolls beneath (expo-blur intensities). */
export const blur = { heavy: 60, glass: 36 } as const;

export const TAB_BAR_HEIGHT = 88;
