import { Platform } from 'react-native';

/**
 * Trips Loom design system tokens (Sand / Night themes).
 * Reference: https://claude.ai/artifact/Cy8kxub66qcb8w3L7MNcE7
 *
 * Every palette shares the warm Sand (light) and Night (dark) neutrals; the palette
 * chosen in Settings only changes the brand roles: primary, accent and accentSoft.
 * Coast is the design system's default.
 */
export type PaletteName = 'olive' | 'coast' | 'terracotta' | 'lavender';
export type ThemeMode = 'light' | 'dark';
export type Mood = 'coast' | 'olive' | 'terracotta' | 'lavender' | 'sand';

export type ThemeColors = {
  /** Page background (design token `canvas`). */
  background: string;
  /** Soft peach bloom behind hero headers. Decoration only. */
  canvasGlow: string;
  surface: string;
  surfaceAlt: string;
  field: string;
  /** Design token `ink`. */
  text: string;
  /** Design token `ink-muted`; also 1px control outlines. */
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  /** Floating chrome over canvas or imagery: back button, weather chip, tab bar. */
  glass: string;
  glassEdge: string;
  /** Pills and round buttons sitting on a photo card, always over a mood scrim. */
  glassOnImage: string;
  glassOnImageEdge: string;
  onImage: string;
  moods: Record<Mood, string>;
  danger: string;
  onDanger: string;
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  scrim: string;
  /** Shadow colour for shadow-card, shadow-float and shadow-photo. */
  shadow: string;
};

type Neutrals = Omit<ThemeColors, 'primary' | 'onPrimary' | 'accent' | 'onAccent' | 'accentSoft'>;
type Brand = Pick<ThemeColors, 'primary' | 'onPrimary' | 'accent' | 'onAccent' | 'accentSoft'>;

const sand: Neutrals = {
  background: '#F4F0EA', canvasGlow: '#F7DCCB', surface: '#FFFFFF', surfaceAlt: '#EBE5DC', field: '#FFFFFF',
  text: '#1A2227', textMuted: '#565E65', border: '#E2DBD0',
  glass: 'rgba(255, 255, 255, 0.72)', glassEdge: 'rgba(255, 255, 255, 0.9)',
  glassOnImage: 'rgba(24, 24, 24, 0.36)', glassOnImageEdge: 'rgba(255, 255, 255, 0.22)', onImage: '#FFFFFF',
  moods: { coast: '#1F5568', olive: '#46593B', terracotta: '#83452A', lavender: '#57426F', sand: '#6A5728' },
  danger: '#954B3B', onDanger: '#FFFFFF', success: '#2F6D58', onSuccess: '#FFFFFF',
  warning: '#825A1E', onWarning: '#FFFFFF', scrim: 'rgba(12, 32, 41, 0.52)', shadow: '#1A2227',
};

const night: Neutrals = {
  background: '#111719', canvasGlow: '#2B1F19', surface: '#1A2226', surfaceAlt: '#232D32', field: '#1F292E',
  text: '#F4F0EA', textMuted: '#B4BCC1', border: '#33403F',
  glass: 'rgba(30, 38, 42, 0.72)', glassEdge: 'rgba(255, 255, 255, 0.12)',
  glassOnImage: 'rgba(20, 20, 20, 0.38)', glassOnImageEdge: 'rgba(255, 255, 255, 0.16)', onImage: '#FFFFFF',
  moods: { coast: '#1A4757', olive: '#3B4C32', terracotta: '#713A22', lavender: '#4A3763', sand: '#5A4A22' },
  danger: '#F0A99A', onDanger: '#3A1713', success: '#A1D7C2', onSuccess: '#123729',
  warning: '#F0CE92', onWarning: '#3E2A0B', scrim: 'rgba(0, 0, 0, 0.62)', shadow: '#000000',
};

const lightBrand: Record<PaletteName, Brand> = {
  coast: { primary: '#183B4A', onPrimary: '#FFFFFF', accent: '#287D94', onAccent: '#FFFFFF', accentSoft: '#D9EEF3' },
  olive: { primary: '#293126', onPrimary: '#FFFFFF', accent: '#647B4F', onAccent: '#FFFFFF', accentSoft: '#E4EBD9' },
  terracotta: { primary: '#4B2F27', onPrimary: '#FFFFFF', accent: '#A65337', onAccent: '#FFFFFF', accentSoft: '#F3DDD0' },
  lavender: { primary: '#392D4D', onPrimary: '#FFFFFF', accent: '#765496', onAccent: '#FFFFFF', accentSoft: '#E8DCF3' },
};

const darkBrand: Record<PaletteName, Brand> = {
  coast: { primary: '#DCEFF5', onPrimary: '#14323D', accent: '#83CDDD', onAccent: '#10313C', accentSoft: '#264D59' },
  olive: { primary: '#E8F0E1', onPrimary: '#1C2A1D', accent: '#B0CC91', onAccent: '#20351E', accentSoft: '#364A35' },
  terracotta: { primary: '#FFE8D9', onPrimary: '#46271E', accent: '#E8A78C', onAccent: '#482115', accentSoft: '#684334' },
  lavender: { primary: '#EFE2FA', onPrimary: '#30203F', accent: '#D1A9EC', onAccent: '#351C48', accentSoft: '#513B68' },
};

const palettes = Object.keys(lightBrand) as PaletteName[];
const build = (neutrals: Neutrals, brand: Record<PaletteName, Brand>) =>
  Object.fromEntries(palettes.map((name) => [name, { ...neutrals, ...brand[name] }])) as Record<PaletteName, ThemeColors>;

export const themeColors = { light: build(sand, lightBrand), dark: build(night, darkBrand) } as const;

export const spacing = {
  zero: 0, xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, huge: 48,
} as const;

/** `xxl` (26) is for photo cards; buttons, chips and round buttons use `pill`. */
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, xxl: 26, pill: 999 } as const;
export const iconSizes = { sm: 18, md: 22, lg: 28 } as const;
export const touch = { min: 48 } as const;
export const motion = { fast: 150, normal: 220, slow: 300 } as const;
export const opacity = { pressed: 0.72, disabled: 0.48 } as const;

export const shadows = {
  card: { shadowOffset: { width: 0, height: 22 }, shadowRadius: 30, shadowOpacity: 0.11, elevation: 6 },
  float: { shadowOffset: { width: 0, height: 10 }, shadowRadius: 15, shadowOpacity: 0.12, elevation: 8 },
  photo: { shadowOffset: { width: 0, height: 18 }, shadowRadius: 20, shadowOpacity: 0.18, elevation: 10 },
} as const;

/** Outfit weights loaded in App.tsx; custom fonts need one family per weight on Android. */
export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

export const typography = {
  wordmark: { fontFamily: serif, fontStyle: 'italic' as const, fontSize: 36, lineHeight: 40, letterSpacing: -1.8 },
  display: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  section: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
  cardMeta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  chip: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  tab: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, letterSpacing: 2 },
} as const;

export type TextVariant = keyof typeof typography;

/** Which card scrim suits each landscape illustration. */
export const moodForLandscape: Record<string, Mood> = {
  coast: 'coast', island: 'coast', lake: 'coast', forest: 'olive', mountains: 'olive',
  city: 'terracotta', aurora: 'lavender', desert: 'sand',
};
