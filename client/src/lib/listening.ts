import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import type { Friend, ProfileListening } from './types';

/**
 * O que cada pessoa está ouvindo no Spotify agora, mantido pelo evento `spotify:presence`.
 * O servidor manda o estado de todos os amigos ao conectar e depois só o que muda.
 */
const listening = new Map<number, ProfileListening>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(userId: number, next: ProfileListening | null) {
  const current = listening.get(userId);
  if (!next) {
    if (!current) return;
    listening.delete(userId);
  } else {
    if (
      current &&
      current.track.id === next.track.id &&
      current.isPlaying === next.isPlaying &&
      current.roomId === next.roomId &&
      Math.abs(current.progressMs - next.progressMs) < 1500
    ) {
      return;
    }
    listening.set(userId, { ...next, receivedAt: Date.now() });
  }
  emit();
}

export const listeningStore = {
  set,
  get: (userId: number) => listening.get(userId) ?? null,
  /** Alimenta a loja com o que veio no perfil, para a tela não esperar a próxima troca de faixa. */
  prime(userId: number, next: ProfileListening | null) {
    if (!next && listening.has(userId)) return;
    set(userId, next);
  },
  clear() {
    if (!listening.size) return;
    listening.clear();
    emit();
  },
};

export function attachListening(socket: Socket) {
  socket.on('spotify:presence', (payload: { userId: number; listening: ProfileListening | null }) => {
    if (typeof payload?.userId === 'number') set(payload.userId, payload.listening ?? null);
  });
}

/** Música da pessoa, ao vivo. */
export function useListening(userId: number | undefined): ProfileListening | null {
  return useSyncExternalStore(subscribe, () => (userId === undefined ? null : listening.get(userId) ?? null));
}

/** Muda a cada novidade na loja: serve para listas que leem vários usuários de uma vez. */
export function useListeningVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

/**
 * Nome da música para as listas de amigos. O estado ao vivo manda; a atividade que veio
 * na lista é a reserva para o primeiro desenho da tela.
 */
export function useListeningName(friend: Friend): string | null {
  const live = useListening(friend.user.id);
  if (!friend.online) return null;
  if (live) return live.track.name;
  return friend.activity?.type === 'spotify' ? friend.activity.name : null;
}
