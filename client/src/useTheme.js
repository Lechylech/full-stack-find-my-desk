import { useEffect, useState, useCallback } from 'react';

export const THEMES = ['dark', 'light', 'high-contrast'];
const STORAGE_KEY = 'fmd:theme';

function detectInitial() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored && THEMES.includes(stored)) return stored;
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-contrast: more)').matches) return 'high-contrast';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  }
  return 'dark';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState(detectInitial);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}

// One-shot, no React: call from main.jsx to set the attribute before first paint.
export function bootstrapTheme() {
  applyTheme(detectInitial());
}
