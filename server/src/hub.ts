import type { Server } from 'socket.io';
import { queries, type PublicUser } from './db';
import { presence } from './presence';

const onlineSockets = new Map<number, number>();
let io: Server | null = null;
let roomsChanged: () => void = () => undefined;

export const userChannel = (userId: number) => `user:${userId}`;

export function dmRoomId(a: number, b: number) {
  return `dm-${Math.min(a, b)}-${Math.max(a, b)}`;
}

export function parseDmRoom(roomId: string): [number, number] | null {
  const match = /^dm-(\d+)-(\d+)$/.exec(roomId);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a < b ? [a, b] : null;
}

export const groupRoomId = (groupId: number) => `group-${groupId}`;

export function parseGroupRoom(roomId: string): number | null {
  const match = /^group-(\d+)$/.exec(roomId);
  return match ? Number(match[1]) : null;
}

/** Chamadas que não são salas públicas: DM e grupo. Não aparecem no Explorar. */
export const isPrivateRoom = (roomId: string) => parseDmRoom(roomId) !== null || parseGroupRoom(roomId) !== null;

export function areFriends(a: number, b: number) {
  const row = queries.friendshipBetween.get(a, b, b, a);
  return row?.status === 'accepted';
}

export function friendIds(userId: number): number[] {
  return queries.acceptedFriendIds.all(userId, userId, userId).map((r) => r.id);
}

export type Activity =
  | { type: 'room'; roomId: string; roomName: string }
  | { type: 'call' }
  | { type: 'spotify'; name: string; artists: string }
  | null;

/** Quem sabe da música é o spotifyPresence; ele se registra aqui para o hub não depender dele. */
let spotifyActivity: (userId: number) => Activity = () => null;
export function setSpotifyActivity(provider: (userId: number) => Activity) {
  spotifyActivity = provider;
}

/** Sala ou chamada em que a pessoa está agora. */
export function roomActivityOf(userId: number): Activity {
  const roomId = presence.roomOfUser(userId);
  if (!roomId) return null;
  if (isPrivateRoom(roomId)) return { type: 'call' };
  const room = queries.roomById.get(roomId);
  return room ? { type: 'room', roomId, roomName: room.name } : null;
}

/** Atividade que aparece no perfil e nas listas: a música do Spotify passa na frente da sala. */
export function activityOf(userId: number): Activity {
  return spotifyActivity(userId) ?? roomActivityOf(userId);
}

export const hub = {
  attach(server: Server) {
    io = server;
  },

  /** Retorna true quando é a primeira conexão do usuário (ficou online). */
  connect(userId: number) {
    const count = (onlineSockets.get(userId) ?? 0) + 1;
    onlineSockets.set(userId, count);
    return count === 1;
  },

  /** Retorna true quando era a última conexão do usuário (ficou offline). */
  disconnect(userId: number) {
    const count = (onlineSockets.get(userId) ?? 1) - 1;
    if (count <= 0) onlineSockets.delete(userId);
    else onlineSockets.set(userId, count);
    return count <= 0;
  },

  isOnline(userId: number) {
    return onlineSockets.has(userId);
  },

  onRoomsChanged(listener: () => void) {
    roomsChanged = listener;
  },

  notifyRoomsChanged() {
    roomsChanged();
  },

  /** Troca os dados do usuário guardados nas conexões abertas (nome, fotos). */
  refreshUser(user: PublicUser) {
    const ids = io?.sockets.adapter.rooms.get(userChannel(user.id));
    for (const id of ids ?? []) {
      const socket = io?.sockets.sockets.get(id);
      if (socket) socket.data.user = user;
    }
  },

  emitToUser(userId: number, event: string, payload?: unknown) {
    io?.to(userChannel(userId)).emit(event, payload);
  },

  emitToRoom(roomId: string, event: string, payload?: unknown) {
    io?.to(roomId).emit(event, payload);
  },

  notifyFriendsChanged(userId: number) {
    hub.emitToUser(userId, 'friends:changed');
    for (const id of friendIds(userId)) {
      if (hub.isOnline(id)) hub.emitToUser(id, 'friends:changed');
    }
  },
};
