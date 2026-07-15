'use client';

import { create } from 'zustand';
import type { PlayMode } from '../types';

export type DrawerTab = 'notes' | 'model' | 'persona' | 'memory';

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
}

interface UiState {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  playMode: PlayMode;
  settingsOpen: boolean;
  settingsSection: string;
  inspectorOpen: boolean;
  characterEditorId: string | 'new' | null;
  importOpen: boolean;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarMobile: (open: boolean) => void;
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  setPlayMode: (mode: PlayMode) => void;
  openSettings: (section?: string) => void;
  closeSettings: () => void;
  setInspectorOpen: (open: boolean) => void;
  openCharacterEditor: (id: string | 'new') => void;
  closeCharacterEditor: () => void;
  setImportOpen: (open: boolean) => void;
  pushToast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 1;

export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  drawerOpen: false,
  drawerTab: 'notes',
  playMode: 'as_user',
  settingsOpen: false,
  settingsSection: 'connections',
  inspectorOpen: false,
  characterEditorId: null,
  importOpen: false,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarMobile: (open) => set({ sidebarMobileOpen: open }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setDrawerTab: (tab) => set({ drawerTab: tab, drawerOpen: true }),
  setPlayMode: (mode) => set({ playMode: mode }),
  openSettings: (section) =>
    set((s) => ({ settingsOpen: true, settingsSection: section ?? s.settingsSection })),
  closeSettings: () => set({ settingsOpen: false }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  openCharacterEditor: (id) => set({ characterEditorId: id }),
  closeCharacterEditor: () => set({ characterEditorId: null }),
  setImportOpen: (open) => set({ importOpen: open }),
  pushToast: (message, kind = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: toastSeq++, message, kind }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
