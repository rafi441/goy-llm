'use client';

import { create } from 'zustand';

export type ThemePref = 'system' | 'light' | 'dark';

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

function apply(pref: ThemePref) {
  const mode = resolve(pref);
  document.documentElement.dataset.theme = mode === 'dark' ? 'goy-dark' : 'goy-light';
}

interface ThemeState {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (pref: ThemePref) => void;
  init: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  pref: 'system',
  resolved: 'dark',
  setPref: (pref) => {
    localStorage.setItem('goy-theme', pref);
    apply(pref);
    set({ pref, resolved: resolve(pref) });
  },
  init: () => {
    const stored = (localStorage.getItem('goy-theme') as ThemePref) || 'system';
    apply(stored);
    set({ pref: stored, resolved: resolve(stored) });
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (get().pref === 'system') {
          apply('system');
          set({ resolved: resolve('system') });
        }
      });
  },
}));
