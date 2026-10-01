import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { THEMES } from '../themes';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('default');
  const previousThemeRef = useRef('default');

  // Memoised so consumers can safely list setTheme/resetTheme in effect deps
  // without re-running the effect on every provider render.
  const setTheme = useCallback((themeKey) => {
    if (THEMES[themeKey]) {
      setCurrentTheme((prev) => {
        previousThemeRef.current = prev;
        return themeKey;
      });
    }
  }, []);

  const resetTheme = useCallback(() => {
    setCurrentTheme((prev) => {
      previousThemeRef.current = prev;
      return 'default';
    });
  }, []);

  useEffect(() => {
    const theme = THEMES[currentTheme];
    const root = document.documentElement;

    root.style.setProperty('--acv-bg', theme.bg);
    root.style.setProperty('--acv-bg-panel', theme.bgPanel);
    root.style.setProperty('--acv-bg-elevated', theme.bgElevated);
    root.style.setProperty('--acv-text', theme.text);
    root.style.setProperty('--acv-text-muted', theme.textMuted);
    root.style.setProperty('--acv-text-dim', theme.textDim);
    root.style.setProperty('--acv-border', theme.border);
    root.style.setProperty('--acv-border-bright', theme.borderBright);
    root.style.setProperty('--acv-accent', theme.accent);
    root.style.setProperty('--acv-accent-secondary', theme.accentSecondary);
    root.style.setProperty('--acv-danger', theme.danger);
    root.style.setProperty('--acv-warning', theme.warning);
    root.style.setProperty('--acv-font', theme.font);
    root.style.setProperty('--acv-font-mono', theme.fontMono);
    root.style.setProperty('--acv-radius', theme.radius);
    root.style.setProperty('--acv-shadow', theme.shadow);
    root.style.setProperty('--acv-bg-image', theme.bgImage);
    root.style.setProperty('--acv-bg-size', theme.bgSize);

    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
    document.body.style.fontFamily = theme.font;
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, resetTheme, previousTheme: previousThemeRef.current }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
