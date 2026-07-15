'use client';

import { create } from 'zustand';

export type StreamKind = 'new' | 'regen' | 'continue';

interface StreamState {
  chatId: string | null;
  text: string;
  running: boolean;
  kind: StreamKind | null;
  targetMessageId: string | null;
  error: string | null;
  controller: AbortController | null;

  begin: (chatId: string, kind: StreamKind, targetMessageId: string | null, controller: AbortController, seed?: string) => void;
  append: (delta: string) => void;
  fail: (message: string) => void;
  finish: () => void;
  abort: () => void;
}

export const useStream = create<StreamState>((set, get) => ({
  chatId: null,
  text: '',
  running: false,
  kind: null,
  targetMessageId: null,
  error: null,
  controller: null,

  begin: (chatId, kind, targetMessageId, controller, seed = '') =>
    set({ chatId, kind, targetMessageId, controller, text: seed, running: true, error: null }),
  append: (delta) => set((s) => ({ text: s.text + delta })),
  fail: (message) => set({ running: false, error: message, controller: null }),
  finish: () =>
    set({ running: false, text: '', kind: null, targetMessageId: null, controller: null, chatId: null }),
  abort: () => {
    const c = get().controller;
    if (c) c.abort();
    set({ running: false });
  },
}));
