import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { config } from './config';
import { spotifyPresence } from './spotifyPresence';
import { userFromToken } from './auth';
import { hasBlocked, queries, type PublicUser } from './db';
import { postDm } from './dms';
import { groupMemberIds, groupTitle, isGroupMember, MAX_GROUP_MEMBERS, notifyGroupCallChanged, postGroupMessage } from './groups';
import { areFriends, dmRoomId, groupRoomId, hub, isPrivateRoom, parseDmRoom, parseGroupRoom, userChannel } from './hub';
import { music } from './music';
import { EMPTY_MEDIA, presence, type MediaState, type Participant } from './presence';

interface SocketData {
  user: PublicUser;
  roomId?: string;
  /** Sai da sala atual; guardado aqui para o servidor tirar alguém da chamada de fora da conexão. */
  leave?: () => void;
}

type AnyEvents = { [event: string]: (...args: any[]) => void };
type AppSocket = Socket<AnyEvents, AnyEvents, AnyEvents, SocketData>;

const joinSchema = z.object({ roomId: z.string().min(1).max(64) });
const callSchema = z.object({ friendId: z.number().int().positive() });
const callRoomSchema = z.object({ roomId: z.string().min(1).max(64) });

const streamId = z.string().max(128).optional();
const mediaSchema = z.object({
  mic: z.boolean(),
  cam: z.boolean(),
  screen: z.boolean(),
  screenAudio: z.boolean(),
  music: z.boolean().optional().default(false),
  micStreamId: streamId,
  camStreamId: streamId,
  screenStreamId: streamId,
  musicStreamId: streamId,
});

const signalSchema = z.object({
  to: z.string().min(1).max(64),
  data: z.record(z.unknown()),
});

const typingSchema = z.object({ to: z.number().int().positive() });
const groupSchema = z.object({ groupId: z.number().int().positive() });

type Ack = (response: unknown) => void;

const PRIVATE_CALL_LIMIT = 2;

/** Chamada privada tocando ou em andamento, para avisar quem entrar depois e registrar na DM. */
interface PrivateCall {
  caller: PublicUser;
  calleeId: number;
  answeredAt: number | null;
}

/** Chamada de grupo: quem começou e quando a segunda pessoa entrou (aí conta como atendida). */
interface GroupCall {
  starterId: number;
  answeredAt: number | null;
}

export function setupSignaling(io: Server) {
  hub.attach(io);
  const calls = new Map<string, PrivateCall>();
  const groupCalls = new Map<string, GroupCall>();

  /** Chamada do grupo esvaziou: grava no chat e para de tocar para quem não atendeu. */
  const finishGroupCall = (roomId: string, groupId: number) => {
    const call = groupCalls.get(roomId);
    if (!call || presence.count(roomId) > 0) return;
    groupCalls.delete(roomId);
    const duration = call.answeredAt ? Math.max(1, Math.round((Date.now() - call.answeredAt) / 1000)) : null;
    if (queries.groupById.get(groupId)) postGroupMessage(groupId, call.starterId, 'call', '', duration);
    for (const id of groupMemberIds(groupId)) hub.emitToUser(id, 'call:cancelled', { roomId });
  };

  /** Sala da DM esvaziou: grava "chamada perdida" ou a duração da conversa. */
  const finishCall = (roomId: string) => {
    const call = calls.get(roomId);
    if (!call || presence.count(roomId) > 0) return;
    calls.delete(roomId);
    const duration = call.answeredAt ? Math.max(1, Math.round((Date.now() - call.answeredAt) / 1000)) : null;
    postDm(call.caller.id, call.calleeId, 'call', '', duration);
  };

  let changeTimer: NodeJS.Timeout | null = null;
  const notifyRoomsChanged = () => {
    if (changeTimer) return;
    changeTimer = setTimeout(() => {
      changeTimer = null;
      io.emit('rooms:changed');
    }, 250);
  };

  const kickRoom = (roomId: string) => {
    music.deleteRoom(roomId);
    io.to(roomId).emit('room:closed');
    for (const p of presence.participants(roomId)) {
      const s = io.sockets.sockets.get(p.socketId) as AppSocket | undefined;
      if (s) {
        s.leave(roomId);
        s.data.roomId = undefined;
      }
    }
    presence.deleteRoom(roomId);
    notifyRoomsChanged();
  };

  io.use((socket, next) => {
    const user = userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    (socket as AppSocket).data.user = user;
    next();
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AppSocket;
    const me = socket.data.user;
    socket.join(userChannel(me.id));
    if (hub.connect(me.id)) {
      hub.notifyFriendsChanged(me.id);
      spotifyPresence.watch(me.id);
    }
    // O evento de música só sai quando algo muda, então quem chega agora recebe o estado de uma vez.
    for (const entry of spotifyPresence.snapshotFor(me.id)) socket.emit('spotify:presence', entry);

    // Alguém ligou enquanto você estava offline e ainda está esperando na chamada.
    for (const [roomId, call] of calls) {
      if (call.calleeId === me.id && !call.answeredAt && presence.count(roomId) > 0) {
        socket.emit('call:incoming', { roomId, from: call.caller });
      }
    }

    const otherMemberOf = (roomId: string) => {
      const pair = parseDmRoom(roomId);
      if (!pair || !pair.includes(me.id)) return null;
      return pair[0] === me.id ? pair[1] : pair[0];
    };

    const leave = () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.data.roomId = undefined;
      music.stop(roomId, socket.id);
      presence.remove(roomId, socket.id);
      socket.leave(roomId);
      socket.to(roomId).emit('peer:left', { socketId: socket.id });
      const groupId = parseGroupRoom(roomId);
      if (parseDmRoom(roomId)) finishCall(roomId);
      else if (groupId !== null) {
        finishGroupCall(roomId, groupId);
        notifyGroupCallChanged(groupId);
      } else notifyRoomsChanged();
      hub.notifyFriendsChanged(me.id);
    };
    socket.data.leave = leave;

    socket.on('room:join', (payload: unknown, ack: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'Sala inválida' });
      const { roomId } = parsed.data;

      const isPrivate = roomId.startsWith('dm-');
      const groupId = parseGroupRoom(roomId);
      if (isPrivate) {
        const other = otherMemberOf(roomId);
        if (other === null || !areFriends(me.id, other)) {
          return reply({ ok: false, error: 'Você não tem acesso a esta chamada' });
        }
      } else if (groupId !== null) {
        if (!isGroupMember(groupId, me.id)) return reply({ ok: false, error: 'Você não está neste grupo' });
      } else if (!queries.roomById.get(roomId)) {
        return reply({ ok: false, error: 'Sala não encontrada' });
      }

      if (socket.data.roomId === roomId) {
        const peers = presence.participants(roomId).filter((p) => p.socketId !== socket.id);
        return reply({ ok: true, selfId: socket.id, peers, music: music.get(roomId) });
      }
      leave();

      const limit = isPrivate ? PRIVATE_CALL_LIMIT : groupId !== null ? MAX_GROUP_MEMBERS : config.maxPeersPerRoom;
      if (presence.count(roomId) >= limit) {
        return reply({ ok: false, error: `A sala está cheia (máximo de ${limit} pessoas)` });
      }

      const peers = presence.participants(roomId);
      const participant: Participant = {
        socketId: socket.id,
        user: socket.data.user,
        media: { ...EMPTY_MEDIA },
        joinedAt: Date.now(),
      };
      presence.add(roomId, participant);
      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.to(roomId).emit('peer:joined', participant);
      reply({ ok: true, selfId: socket.id, peers, music: music.get(roomId) });

      if (isPrivate) {
        // Outras abas do mesmo usuário param de tocar.
        socket.to(userChannel(me.id)).emit('call:dismissed', { roomId });
        const call = calls.get(roomId);
        if (call && !call.answeredAt && call.calleeId === me.id) call.answeredAt = Date.now();
      } else if (groupId !== null) {
        socket.to(userChannel(me.id)).emit('call:dismissed', { roomId });
        // Entrou sem ninguém ter tocado (ex.: voltou para a chamada): passa a valer como chamada nova.
        if (!groupCalls.has(roomId)) groupCalls.set(roomId, { starterId: me.id, answeredAt: null });
        const call = groupCalls.get(roomId)!;
        if (!call.answeredAt && new Set(presence.participants(roomId).map((p) => p.user.id)).size >= 2) call.answeredAt = Date.now();
        notifyGroupCallChanged(groupId);
      } else {
        notifyRoomsChanged();
      }
      hub.notifyFriendsChanged(me.id);
    });

    socket.on('room:leave', leave);

    socket.on('media:state', (payload: unknown) => {
      const roomId = socket.data.roomId;
      const parsed = mediaSchema.safeParse(payload);
      if (!roomId || !parsed.success) return;
      const participant = presence.get(roomId, socket.id);
      if (!participant) return;
      const media = parsed.data as MediaState;
      // Só o DJ da sala pode mandar a faixa de música.
      if (media.music && music.djSocketOf(roomId) !== socket.id) {
        media.music = false;
        media.musicStreamId = undefined;
      }
      participant.media = media;
      socket.to(roomId).emit('peer:media', { socketId: socket.id, media: participant.media });
      if (!isPrivateRoom(roomId)) notifyRoomsChanged();
    });

    socket.on('signal', (payload: unknown) => {
      const roomId = socket.data.roomId;
      const parsed = signalSchema.safeParse(payload);
      if (!roomId || !parsed.success) return;
      if (!presence.get(roomId, parsed.data.to)) return;
      io.to(parsed.data.to).emit('signal', { from: socket.id, data: parsed.data.data });
    });

    socket.on('music:start', (_payload: unknown, ack: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      const roomId = socket.data.roomId;
      if (!roomId) return reply({ ok: false, error: 'Entre numa sala ou chamada primeiro' });
      // Só reserva o slot de DJ — o áudio vem da aba/app do Spotify do usuário, sem OAuth.
      const result = music.start(roomId, socket.id, socket.data.user);
      if (!result.ok) return reply(result);
      reply({ ok: true, music: result.music });
    });

    socket.on('music:stop', () => {
      const roomId = socket.data.roomId;
      if (!roomId || !music.stop(roomId, socket.id)) return;
      const participant = presence.get(roomId, socket.id);
      if (participant?.media.music) {
        participant.media = { ...participant.media, music: false, musicStreamId: undefined };
        socket.to(roomId).emit('peer:media', { socketId: socket.id, media: participant.media });
        if (!isPrivateRoom(roomId)) notifyRoomsChanged();
      }
    });

    socket.on('call:start', (payload: unknown, ack: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      const parsed = callSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'Amigo inválido' });
      const { friendId } = parsed.data;
      if (!areFriends(me.id, friendId)) return reply({ ok: false, error: 'Vocês não são amigos' });
      const friend = queries.userById.get(friendId);
      if (!friend) return reply({ ok: false, error: 'Amigo não encontrado' });

      const roomId = dmRoomId(me.id, friendId);
      const friendInCall = presence.participants(roomId).some((p) => p.user.id === friendId);
      if (!friendInCall && (!calls.has(roomId) || presence.count(roomId) === 0)) {
        calls.set(roomId, { caller: me, calleeId: friendId, answeredAt: null });
      }
      // Offline recebe a chamada quando conectar, se você ainda estiver esperando.
      if (!friendInCall) hub.emitToUser(friendId, 'call:incoming', { roomId, from: me });
      reply({ ok: true, roomId, online: hub.isOnline(friendId) && friend.presence !== 'invisible' });
    });

    /** Começa (ou entra na) chamada do grupo. Só toca para os outros quando a chamada é nova. */
    socket.on('group:call', (payload: unknown, ack: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      const parsed = groupSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'Grupo inválido' });
      const { groupId } = parsed.data;
      const group = queries.groupById.get(groupId);
      if (!group || !isGroupMember(groupId, me.id)) return reply({ ok: false, error: 'Você não está neste grupo' });
      const roomId = groupRoomId(groupId);
      const fresh = presence.count(roomId) === 0;
      if (fresh) {
        groupCalls.set(roomId, { starterId: me.id, answeredAt: null });
        const info = { id: groupId, name: groupTitle(groupId), iconImage: group.icon_image };
        for (const id of groupMemberIds(groupId)) {
          if (id !== me.id) hub.emitToUser(id, 'call:incoming', { roomId, from: me, group: info });
        }
      }
      reply({ ok: true, roomId, title: groupTitle(groupId) });
    });

    socket.on('group:typing', (payload: unknown) => {
      const parsed = groupSchema.safeParse(payload);
      if (!parsed.success || !isGroupMember(parsed.data.groupId, me.id)) return;
      for (const id of groupMemberIds(parsed.data.groupId)) {
        if (id !== me.id) hub.emitToUser(id, 'group:typing', { groupId: parsed.data.groupId, from: me.id });
      }
    });

    socket.on('dm:typing', (payload: unknown) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;
      const { to } = parsed.data;
      if (to === me.id || !areFriends(me.id, to) || hasBlocked(to, me.id)) return;
      hub.emitToUser(to, 'dm:typing', { from: me.id });
    });

    socket.on('call:decline', (payload: unknown) => {
      const parsed = callRoomSchema.safeParse(payload);
      if (!parsed.success) return;
      // Recusar chamada de grupo só para de tocar aqui; a chamada segue para os outros.
      if (parseGroupRoom(parsed.data.roomId) !== null) {
        socket.to(userChannel(me.id)).emit('call:dismissed', { roomId: parsed.data.roomId });
        return;
      }
      const other = otherMemberOf(parsed.data.roomId);
      if (other === null) return;
      hub.emitToUser(other, 'call:declined', { roomId: parsed.data.roomId, by: me });
      socket.to(userChannel(me.id)).emit('call:dismissed', { roomId: parsed.data.roomId });
    });

    socket.on('call:cancel', (payload: unknown) => {
      const parsed = callRoomSchema.safeParse(payload);
      if (!parsed.success) return;
      const other = otherMemberOf(parsed.data.roomId);
      if (other === null) return;
      hub.emitToUser(other, 'call:cancelled', { roomId: parsed.data.roomId, by: me });
    });

    socket.on('disconnect', () => {
      leave();
      if (hub.disconnect(me.id)) {
        hub.notifyFriendsChanged(me.id);
        spotifyPresence.unwatch(me.id);
      }
    });
  });

  /** Tira uma pessoa da chamada (todas as abas dela), como quando sai ou é expulsa do grupo. */
  const removeFromCall = (roomId: string, userId: number) => {
    for (const p of presence.participants(roomId)) {
      if (p.user.id !== userId) continue;
      const s = io.sockets.sockets.get(p.socketId) as AppSocket | undefined;
      if (!s) continue;
      s.data.leave?.();
      s.emit('room:closed', { reason: 'Você não faz mais parte deste grupo.' });
    }
  };

  hub.onRoomsChanged(notifyRoomsChanged);
  return { notifyRoomsChanged, kickRoom, removeFromCall };
}
