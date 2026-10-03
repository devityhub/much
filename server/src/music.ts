import type { PublicUser } from './db';
import { hub } from './hub';
import { currentlyPlaying, type SpotifyTrack } from './spotifyApi';

const POLL_INTERVAL_MS = 3000;
const SEEK_TOLERANCE_MS = 2500;

interface RoomMusicState {
  roomId: string;
  djSocketId: string;
  dj: PublicUser;
  track: SpotifyTrack | null;
  progressMs: number;
  isPlaying: boolean;
  updatedAt: number;
  error: string | null;
  polling: boolean;
}

export interface RoomMusic {
  dj: PublicUser;
  djSocketId: string;
  track: SpotifyTrack | null;
  progressMs: number;
  isPlaying: boolean;
  error: string | null;
}

const rooms = new Map<string, RoomMusicState>();

function serialize(state: RoomMusicState): RoomMusic {
  const elapsed = state.isPlaying ? Date.now() - state.updatedAt : 0;
  const duration = state.track?.durationMs ?? Infinity;
  return {
    dj: state.dj,
    djSocketId: state.djSocketId,
    track: state.track,
    progressMs: Math.min(state.progressMs + elapsed, duration),
    isPlaying: state.isPlaying,
    error: state.error,
  };
}

function broadcast(state: RoomMusicState) {
  hub.emitToRoom(state.roomId, 'music:now', serialize(state));
}

async function poll(state: RoomMusicState) {
  if (state.polling) return;
  state.polling = true;
  try {
    const now = await currentlyPlaying(state.dj.id);
    if (rooms.get(state.roomId) !== state) return;
    const expected = state.progressMs + (state.isPlaying ? Date.now() - state.updatedAt : 0);
    const changed =
      now.track?.id !== state.track?.id ||
      now.isPlaying !== state.isPlaying ||
      Math.abs(now.progressMs - expected) > SEEK_TOLERANCE_MS ||
      state.error !== null;
    state.track = now.track;
    state.isPlaying = now.isPlaying;
    state.progressMs = now.progressMs;
    state.updatedAt = Date.now();
    state.error = null;
    if (changed) broadcast(state);
  } catch (err) {
    if (rooms.get(state.roomId) !== state) return;
    const message = (err as Error).message || 'Erro ao ler o Spotify';
    if (state.error !== message) {
      state.error = message;
      broadcast(state);
    }
  } finally {
    state.polling = false;
  }
}

setInterval(() => {
  for (const state of rooms.values()) void poll(state);
}, POLL_INTERVAL_MS).unref();

export const music = {
  get(roomId: string): RoomMusic | null {
    const state = rooms.get(roomId);
    return state ? serialize(state) : null;
  },

  djSocketOf(roomId: string): string | null {
    return rooms.get(roomId)?.djSocketId ?? null;
  },

  /** Sala em que este usuário é o DJ agora. */
  roomOfDj(userId: number): string | null {
    for (const state of rooms.values()) if (state.dj.id === userId) return state.roomId;
    return null;
  },

  start(roomId: string, socketId: string, dj: PublicUser): { ok: true; music: RoomMusic } | { ok: false; error: string } {
    const current = rooms.get(roomId);
    if (current && current.djSocketId !== socketId) {
      return { ok: false, error: `${current.dj.displayName || current.dj.nick} já está tocando música nesta sala` };
    }
    const state: RoomMusicState = current ?? {
      roomId,
      djSocketId: socketId,
      dj,
      track: null,
      progressMs: 0,
      isPlaying: false,
      updatedAt: Date.now(),
      error: null,
      polling: false,
    };
    rooms.set(roomId, state);
    broadcast(state);
    void poll(state);
    return { ok: true, music: serialize(state) };
  },

  /** Para a música se quem pediu (ou saiu) for o DJ. Retorna true se parou. */
  stop(roomId: string, socketId: string): boolean {
    const state = rooms.get(roomId);
    if (!state || state.djSocketId !== socketId) return false;
    rooms.delete(roomId);
    hub.emitToRoom(roomId, 'music:now', null);
    return true;
  },

  deleteRoom(roomId: string) {
    rooms.delete(roomId);
  },

  /** Lê o Spotify logo após um comando do DJ, sem esperar o próximo ciclo. */
  refreshSoon(roomId: string) {
    const state = rooms.get(roomId);
    if (state) setTimeout(() => void poll(state), 500);
  },

  updateUser(user: PublicUser) {
    for (const state of rooms.values()) if (state.dj.id === user.id) state.dj = user;
  },
};
