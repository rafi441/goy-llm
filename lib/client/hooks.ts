'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend, apiUpload } from './fetcher';
import type {
  Character,
  Chat,
  GenConfig,
  Lorebook,
  LorebookEntry,
  MaskedConnection,
  Message,
  Persona,
  PickerModel,
  Preset,
} from '../types';
import type { ChatListItem } from '../db/repos/chats';
import type { BehaviorSettings } from '../db/repos/settings';

export const qk = {
  connections: ['connections'] as const,
  models: ['models'] as const,
  connectionModels: (id: string) => ['connection-models', id] as const,
  characters: ['characters'] as const,
  character: (id: string) => ['character', id] as const,
  personas: ['personas'] as const,
  presets: ['presets'] as const,
  chats: ['chats'] as const,
  chat: (id: string) => ['chat', id] as const,
  messages: (id: string) => ['messages', id] as const,
  behavior: ['behavior'] as const,
  promptOrder: ['prompt-order'] as const,
  lorebooks: ['lorebooks'] as const,
  lorebook: (id: string) => ['lorebook', id] as const,
  documents: (chatId: string) => ['documents', chatId] as const,
  trash: ['trash'] as const,
};

export function useConnections() {
  return useQuery({
    queryKey: qk.connections,
    queryFn: () => apiGet<{ connections: MaskedConnection[] }>('/api/connections').then((d) => d.connections),
  });
}

export function useModels() {
  return useQuery({
    queryKey: qk.models,
    queryFn: () => apiGet<{ models: PickerModel[] }>('/api/models').then((d) => d.models),
  });
}

export function useConnectionModels(id: string | null, refresh = false) {
  return useQuery({
    queryKey: qk.connectionModels(id ?? ''),
    enabled: !!id,
    queryFn: () =>
      apiGet<{ models: PickerModel[]; capabilities: unknown; error?: string }>(
        `/api/connections/${id}/models${refresh ? '?refresh=1' : ''}`,
      ),
  });
}

export function useCharacters() {
  return useQuery({
    queryKey: qk.characters,
    queryFn: () => apiGet<{ characters: Character[] }>('/api/characters').then((d) => d.characters),
  });
}

export function useCharacter(id: string | null) {
  return useQuery({
    queryKey: qk.character(id ?? ''),
    enabled: !!id,
    queryFn: () => apiGet<{ character: Character }>(`/api/characters/${id}`).then((d) => d.character),
  });
}

export function usePersonas() {
  return useQuery({
    queryKey: qk.personas,
    queryFn: () => apiGet<{ personas: Persona[] }>('/api/personas').then((d) => d.personas),
  });
}

export function usePresets() {
  return useQuery({
    queryKey: qk.presets,
    queryFn: () => apiGet<{ presets: Preset[] }>('/api/presets').then((d) => d.presets),
  });
}

export function useChats(archived = false) {
  return useQuery({
    queryKey: [...qk.chats, archived],
    queryFn: () =>
      apiGet<{ chats: ChatListItem[] }>(`/api/chats${archived ? '?archived=1' : ''}`).then((d) => d.chats),
  });
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: qk.chat(id ?? ''),
    enabled: !!id,
    queryFn: () => apiGet<{ chat: Chat; messages: Message[] }>(`/api/chats/${id}`),
  });
}

export function useBehavior() {
  return useQuery({
    queryKey: qk.behavior,
    queryFn: () => apiGet<{ behavior: BehaviorSettings }>('/api/settings/behavior').then((d) => d.behavior),
  });
}

export function usePromptOrder() {
  return useQuery({
    queryKey: qk.promptOrder,
    queryFn: () => apiGet<{ order: string[] }>('/api/settings/prompt-order').then((d) => d.order),
  });
}

export function useLorebooks() {
  return useQuery({
    queryKey: qk.lorebooks,
    queryFn: () => apiGet<{ lorebooks: Lorebook[] }>('/api/lorebooks').then((d) => d.lorebooks),
  });
}

export function useLorebook(id: string | null) {
  return useQuery({
    queryKey: qk.lorebook(id ?? ''),
    enabled: !!id,
    queryFn: () => apiGet<{ lorebook: Lorebook; entries: LorebookEntry[] }>(`/api/lorebooks/${id}`),
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: readonly (readonly unknown[])[]) => {
    for (const key of keys) qc.invalidateQueries({ queryKey: key });
  };
}

export function useMutate<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  invalidate: readonly (readonly unknown[])[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of invalidate) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export const api = { apiGet, apiSend, apiUpload };
export type { GenConfig, BehaviorSettings, ChatListItem };
