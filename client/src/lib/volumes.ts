import { useSyncExternalStore } from 'react';

/** Volume por usuário (0..1), separado para voz e para o áudio da tela. */
export type VolumeKind = 'voice' | 'screen';

const STORAGE_KEY = 'much.volumes';

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

let volumes: Record<string, number> = load();
const listeners = new Set<() => void>();

const keyOf = (userId: number, kind: VolumeKind) => `${userId}:${kind}`;

export const volumeStore = {
  get: (userId: number, kind: VolumeKind) => volumes[keyOf(userId, kind)] ?? 1,
  set(userId: number, kind: VolumeKind, value: number) {
    volumes = { ...volumes, [keyOf(userId, kind)]: value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useVolume(userId: number, kind: VolumeKind) {
  return useSyncExternalStore(volumeStore.subscribe, () => volumeStore.get(userId, kind));
}
