import type { PublicUser } from './db';

export interface MediaState {
  mic: boolean;
  cam: boolean;
  screen: boolean;
  screenAudio: boolean;
  music: boolean;
  micStreamId?: string;
  camStreamId?: string;
  screenStreamId?: string;
  musicStreamId?: string;
}

export interface Participant {
  socketId: string;
  user: PublicUser;
  media: MediaState;
  joinedAt: number;
}

export const EMPTY_MEDIA: MediaState = { mic: false, cam: false, screen: false, screenAudio: false, music: false };

const rooms = new Map<string, Map<string, Participant>>();

export const presence = {
  participants(roomId: string): Participant[] {
    return [...(rooms.get(roomId)?.values() ?? [])];
  },

  count(roomId: string): number {
    return rooms.get(roomId)?.size ?? 0;
  },

  get(roomId: string, socketId: string): Participant | undefined {
    return rooms.get(roomId)?.get(socketId);
  },

  add(roomId: string, participant: Participant) {
    let room = rooms.get(roomId);
    if (!room) {
      room = new Map();
      rooms.set(roomId, room);
    }
    room.set(participant.socketId, participant);
  },

  remove(roomId: string, socketId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.delete(socketId);
    if (room.size === 0) rooms.delete(roomId);
  },

  deleteRoom(roomId: string) {
    rooms.delete(roomId);
  },

  /** Atualiza nome e fotos de quem já está em sala. Retorna true se a pessoa estava em alguma. */
  updateUser(user: PublicUser): boolean {
    let found = false;
    for (const room of rooms.values()) {
      for (const p of room.values()) {
        if (p.user.id === user.id) {
          p.user = user;
          found = true;
        }
      }
    }
    return found;
  },

  roomOfUser(userId: number): string | undefined {
    for (const [roomId, room] of rooms) {
      for (const p of room.values()) if (p.user.id === userId) return roomId;
    }
    return undefined;
  },

  summary(roomId: string) {
    const list = presence.participants(roomId).sort((a, b) => a.joinedAt - b.joinedAt);
    return {
      participants: list.length,
      streaming: list.some((p) => p.media.screen),
      streamers: list.filter((p) => p.media.screen).map((p) => p.user.nick),
      members: list.map((p) => ({
        socketId: p.socketId,
        user: p.user,
        mic: p.media.mic,
        cam: p.media.cam,
        screen: p.media.screen,
        music: p.media.music,
      })),
    };
  },
};
