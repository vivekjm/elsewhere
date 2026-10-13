import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { fonts, iconSizes, motion, opacity, radii, shadows, spacing, themeColors, touch, typography } from './tokens';
import type { PaletteName, ThemeColors, ThemeMode } from './tokens';

export type ThemePreferences = { palette: PaletteName; mode: ThemeMode | 'system' };

export type Theme = {
  colors: ThemeColors;
  palette: PaletteName;
  mode: ThemeMode;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  iconSizes: typeof iconSizes;
  touch: typeof touch;
  motion: typeof motion;
  opacity: typeof opacity;
  shadows: typeof shadows;
  fonts: typeof fonts;
  modePreference: ThemeMode | 'system';
  setPalette: (name: PaletteName) => void;
  setMode: (mode: ThemeMode | 'system') => void;
};

export function createTheme(palette: PaletteName = 'coast', mode: ThemeMode = 'light'): Theme {
  return {
    colors: themeColors[mode][palette], palette, mode, spacing, radii, typography, iconSizes, touch, motion, opacity, shadows, fonts,
    modePreference: mode, setPalette: () => {}, setMode: () => {},
  };
}

const ThemeContext = createContext<Theme>(createTheme());

export function ThemeProvider({
  children,
  palette,
  mode,
  initialPalette = 'coast',
  initialMode = 'system',
  onPreferencesChange,
}: {
  children: React.ReactNode;
  palette?: PaletteName;
  mode?: ThemeMode | 'system';
  initialPalette?: PaletteName;
  initialMode?: ThemeMode | 'system';
  onPreferencesChange?: (preferences: ThemePreferences) => void;
}) {
  const [currentPalette, setCurrentPalette] = useState<PaletteName>(palette ?? initialPalette);
  const [currentMode, setCurrentMode] = useState<ThemeMode | 'system'>(mode ?? initialMode);
  useEffect(() => { if (palette) setCurrentPalette(palette); }, [palette]);
  useEffect(() => { if (mode) setCurrentMode(mode); }, [mode]);

  const changePalette = useCallback((next: PaletteName) => {
    setCurrentPalette(next);
    onPreferencesChange?.({ palette: next, mode: currentMode });
  }, [currentMode, onPreferencesChange]);
  const changeMode = useCallback((next: ThemeMode | 'system') => {
    setCurrentMode(next);
    onPreferencesChange?.({ palette: currentPalette, mode: next });
  }, [currentPalette, onPreferencesChange]);

  const systemMode = useColorScheme();
  const resolvedMode: ThemeMode = currentMode === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : currentMode;
  const theme = useMemo(() => ({
    ...createTheme(currentPalette, resolvedMode),
    modePreference: currentMode,
    setPalette: changePalette,
    setMode: changeMode,
  }), [currentPalette, resolvedMode, currentMode, changePalette, changeMode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
