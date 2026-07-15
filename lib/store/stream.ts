'use client';

import { create } from 'zustand';

export type StreamKind = 'new' | 'regen' | 'continue';
export type StreamPhase = 'idle' | 'loading' | 'streaming' | 'error';

interface StreamState {
  chatId: string | null;
  text: string;
  running: boolean;
  phase: StreamPhase;
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
  phase: 'idle',
  kind: null,
  targetMessageId: null,
  error: null,
  controller: null,

  begin: (chatId, kind, targetMessageId, controller, seed = '') =>
    set({ chatId, kind, targetMessageId, controller, text: seed, running: true, phase: 'loading', error: null }),
  append: (delta) => set((s) => ({ text: s.text + delta, phase: 'streaming' })),
  fail: (message) => set({ running: false, phase: 'error', error: message, controller: null }),
  finish: () =>
    set({ running: false, phase: 'idle', text: '', kind: null, targetMessageId: null, controller: null, chatId: null }),
  abort: () => {
    const c = get().controller;
    if (c) c.abort();
    set({ running: false });
  },
}));

export function streamStatus(phase: StreamPhase, kind: StreamKind | null): string {
  if (phase === 'loading') return 'Loading';
  if (phase === 'streaming')
    return kind === 'regen' ? 'Regenerating' : kind === 'continue' ? 'Continuing' : 'Generating';
  return '';
}
