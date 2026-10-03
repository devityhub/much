import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { mediaErrorMessage } from '../lib/mediaErrors';
import { RoomClient, type RoomSnapshot, type ScreenShareOptions } from '../lib/roomClient';
import { settingsStore } from '../lib/settings';
import { getSocket } from '../lib/socket';
import { sounds, startRingtone } from '../lib/sounds';
import { useAuth } from '../lib/auth';
import { notify } from '../lib/notify';
import type { PublicUser } from '../lib/types';
import { displayName } from '../lib/users';
import { useToast } from './toast';

export interface CallGroup {
  id: number;
  name: string;
}

export interface ActiveCall {
  roomId: string;
  kind: 'room' | 'private' | 'group';
  title: string;
  friend?: PublicUser;
  group?: CallGroup;
  client: RoomClient;
}

interface IncomingCall {
  roomId: string;
  from: PublicUser;
  /** Chamada de grupo: quem começou está em `from`. */
  group?: CallGroup & { iconImage: string | null };
}

interface CallContextValue {
  active: ActiveCall | null;
  ringing: boolean;
  /** O amigo estava offline quando você ligou: toca até ele entrar no Much. */
  ringingOffline: boolean;
  incoming: IncomingCall | null;
  deafened: boolean;
  busy: boolean;
  joinRoom: (room: { id: string; name: string }) => void;
  /** Com `video`, a câmera já sai ligada. */
  callFriend: (friend: PublicUser, options?: { video?: boolean }) => Promise<void>;
  /** Começa a chamada do grupo, ou entra nela se já estiver rolando. */
  callGroup: (group: CallGroup, options?: { video?: boolean }) => Promise<void>;
  acceptIncoming: () => void;
  declineIncoming: () => void;
  leave: () => void;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  startScreen: (options: ScreenShareOptions) => Promise<void>;
  stopScreen: () => void;
  musicBusy: boolean;
  /** Vira o DJ da sala e manda o áudio do Spotify. */
  startMusic: () => Promise<void>;
  stopMusic: () => void;
  spotifyControl: (action: SpotifyAction) => Promise<void>;
  playTrack: (uri: string) => Promise<void>;
}

export type SpotifyAction = 'play' | 'pause' | 'next' | 'previous';

const CallContext = createContext<CallContextValue | null>(null);

const RING_TIMEOUT_MS = 30_000;
const OFFLINE_RING_TIMEOUT_MS = 120_000;
const noopSubscribe = () => () => undefined;
const nullSnapshot = () => null;

export function CallProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [ringing, setRinging] = useState(false);
  const [ringingOffline, setRingingOffline] = useState(false);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [deafened, setDeafened] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef<ActiveCall | null>(null);
  const ringingRef = useRef(false);
  const micBeforeDeafen = useRef(false);
  const hadPeer = useRef(false);

  const deafenedRef = useRef(false);
  const dndRef = useRef(false);
  dndRef.current = user?.presence === 'dnd';
  activeRef.current = active;
  ringingRef.current = ringing;
  deafenedRef.current = deafened;

  const snapshot = useSyncExternalStore(
    active ? active.client.subscribe : noopSubscribe,
    active ? active.client.getSnapshot : nullSnapshot,
  );

  const endActive = useCallback((notifyCancel: boolean) => {
    const current = activeRef.current;
    if (!current) return;
    if (notifyCancel && ringingRef.current) getSocket().emit('call:cancel', { roomId: current.roomId });
    current.client.destroy();
    activeRef.current = null;
    hadPeer.current = false;
    setActive(null);
    setRinging(false);
    sounds.leave();
  }, []);

  const start = useCallback(
    (roomId: string, kind: ActiveCall['kind'], title: string, friend?: PublicUser, group?: CallGroup) => {
      if (activeRef.current?.roomId === roomId) return activeRef.current;
      endActive(true);
      const client = new RoomClient(roomId, getSocket());
      const call: ActiveCall = { roomId, kind, title, friend, group, client };
      activeRef.current = call;
      setActive(call);
      void client.start();
      sounds.join();
      if (deafenedRef.current) {
        micBeforeDeafen.current = true;
      } else {
        client.setMic(true).catch((err) => {
          const message = mediaErrorMessage(err, 'microfone');
          if (message) toast(message, 'error');
        });
      }
      return call;
    },
    [endActive, toast],
  );

  const joinRoom = useCallback(
    (room: { id: string; name: string }) => {
      start(room.id, 'room', room.name);
      navigate(`/app/room/${room.id}`);
    },
    [start, navigate],
  );

  const callFriend = useCallback(
    async (friend: PublicUser, options?: { video?: boolean }) => {
      const res = (await getSocket().emitWithAck('call:start', { friendId: friend.id })) as
        | { ok: true; roomId: string; online?: boolean }
        | { ok: false; error: string };
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      const call = start(res.roomId, 'private', friend.nick, friend);
      setRinging(true);
      setRingingOffline(res.online === false);
      navigate(`/app/dm/${friend.id}`);
      if (options?.video && call && !call.client.getSnapshot().media.cam) {
        call.client.toggleCam().catch((err) => {
          const message = mediaErrorMessage(err, 'câmera');
          if (message) toast(message, 'error');
        });
      }
    },
    [start, navigate, toast],
  );

  const callGroup = useCallback(
    async (group: CallGroup, options?: { video?: boolean }) => {
      const res = (await getSocket().emitWithAck('group:call', { groupId: group.id })) as
        | { ok: true; roomId: string; title: string }
        | { ok: false; error: string };
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      const info = { id: group.id, name: res.title };
      const call = start(res.roomId, 'group', res.title, undefined, info);
      navigate(`/app/group/${group.id}`);
      if (options?.video && call && !call.client.getSnapshot().media.cam) {
        call.client.toggleCam().catch((err) => {
          const message = mediaErrorMessage(err, 'câmera');
          if (message) toast(message, 'error');
        });
      }
    },
    [start, navigate, toast],
  );

  const acceptIncoming = useCallback(() => {
    if (!incoming) return;
    if (incoming.group) {
      start(incoming.roomId, 'group', incoming.group.name, undefined, { id: incoming.group.id, name: incoming.group.name });
      navigate(`/app/group/${incoming.group.id}`);
    } else {
      start(incoming.roomId, 'private', incoming.from.nick, incoming.from);
      navigate(`/app/dm/${incoming.from.id}`);
    }
    setIncoming(null);
  }, [incoming, start, navigate]);

  const declineIncoming = useCallback(() => {
    if (!incoming) return;
    getSocket().emit('call:decline', { roomId: incoming.roomId });
    setIncoming(null);
  }, [incoming]);

  const leave = useCallback(() => endActive(true), [endActive]);

  const run = useCallback(
    async (action: () => Promise<void>, device: string) => {
      setBusy(true);
      try {
        await action();
      } catch (err) {
        const message = mediaErrorMessage(err, device);
        if (message) toast(message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const toggleMic = useCallback(async () => {
    const call = activeRef.current;
    if (!call) return;
    const turningOn = !call.client.getSnapshot().media.mic;
    if (turningOn && deafened) setDeafened(false);
    await run(() => call.client.setMic(turningOn), 'microfone');
    (turningOn ? sounds.unmute : sounds.mute)();
  }, [deafened, run]);

  const toggleCam = useCallback(async () => {
    const call = activeRef.current;
    if (call) await run(() => call.client.toggleCam(), 'câmera');
  }, [run]);

  const toggleDeafen = useCallback(async () => {
    const call = activeRef.current;
    if (!deafened) {
      micBeforeDeafen.current = call?.client.getSnapshot().media.mic ?? false;
      setDeafened(true);
      sounds.mute();
      if (call && micBeforeDeafen.current) await run(() => call.client.setMic(false), 'microfone');
    } else {
      setDeafened(false);
      sounds.unmute();
      if (call && micBeforeDeafen.current) await run(() => call.client.setMic(true), 'microfone');
    }
  }, [deafened, run]);

  const startScreen = useCallback(
    async (options: ScreenShareOptions) => {
      const call = activeRef.current;
      if (call) await run(() => call.client.startScreen(options), 'tela');
    },
    [run],
  );

  const stopScreen = useCallback(() => activeRef.current?.client.stopScreen(), []);

  const [musicBusy, setMusicBusy] = useState(false);
  const startMusic = useCallback(async () => {
    const call = activeRef.current;
    if (!call) return;
    setMusicBusy(true);
    try {
      await call.client.startMusic();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setMusicBusy(false);
    }
  }, [toast]);

  const stopMusic = useCallback(() => activeRef.current?.client.stopMusic(), []);

  const spotifyControl = useCallback(
    async (action: SpotifyAction) => {
      try {
        await api(`/spotify/player/${action}`, { method: 'POST' });
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    },
    [toast],
  );

  const playTrack = useCallback(
    async (uri: string) => {
      try {
        await api('/spotify/play', { method: 'POST', body: { uri } });
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    },
    [toast],
  );

  // Eventos de chamada privada vindos do servidor.
  useEffect(() => {
    const socket = getSocket();
    const onIncoming = (payload: IncomingCall) => {
      if (activeRef.current?.roomId === payload.roomId) return;
      setIncoming(payload);
    };
    const onDeclined = ({ roomId, by }: { roomId: string; by: PublicUser }) => {
      if (activeRef.current?.roomId !== roomId || !ringingRef.current) return;
      toast(`${by.nick} recusou a chamada`, 'info');
      endActive(false);
    };
    const onCancelled = ({ roomId }: { roomId: string }) => {
      setIncoming((current) => (current?.roomId === roomId ? null : current));
    };
    socket.on('call:incoming', onIncoming);
    socket.on('call:declined', onDeclined);
    socket.on('call:cancelled', onCancelled);
    socket.on('call:dismissed', onCancelled);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:declined', onDeclined);
      socket.off('call:cancelled', onCancelled);
      socket.off('call:dismissed', onCancelled);
    };
  }, [endActive, toast]);

  useEffect(() => {
    if (!incoming) return;
    const stop = dndRef.current ? () => undefined : startRingtone();
    if (!dndRef.current) {
      const title = incoming.group ? `${displayName(incoming.from)} começou uma chamada em ${incoming.group.name}` : `${displayName(incoming.from)} está te ligando`;
      notify(title, 'Abra o Much para atender.');
    }
    const timer = window.setTimeout(() => setIncoming(null), RING_TIMEOUT_MS);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [incoming]);

  useEffect(() => {
    if (!ringing || !active) return;
    const timer = window.setTimeout(
      () => {
        toast(`${active.title} não atendeu`, 'info');
        endActive(true);
      },
      ringingOffline ? OFFLINE_RING_TIMEOUT_MS : RING_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [ringing, ringingOffline, active, endActive, toast]);

  // Sons de entrada/saída e fim automático da chamada privada.
  const peerCount = snapshot?.peers.length ?? 0;
  const lastPeerCount = useRef(0);
  useEffect(() => {
    const previous = lastPeerCount.current;
    lastPeerCount.current = peerCount;
    if (!active) return;
    if (peerCount > previous) {
      sounds.join();
      hadPeer.current = true;
      if (ringingRef.current) setRinging(false);
    } else if (peerCount < previous) {
      if (active.kind === 'private' && hadPeer.current && peerCount === 0) {
        toast('A chamada foi encerrada', 'info');
        endActive(false);
      } else {
        sounds.leave();
      }
    }
  }, [peerCount, active, endActive, toast]);

  useEffect(() => {
    if (snapshot?.status === 'error' && snapshot.error) {
      toast(snapshot.error, 'error');
      endActive(false);
    }
  }, [snapshot?.status, snapshot?.error, endActive, toast]);

  useEffect(() => {
    if (snapshot?.systemAudio.error) toast(snapshot.systemAudio.error, 'error');
  }, [snapshot?.systemAudio.error, toast]);

  useEffect(() => {
    if (snapshot?.musicCapture.error) toast(snapshot.musicCapture.error, 'error');
  }, [snapshot?.musicCapture.error, toast]);

  useEffect(
    () =>
      settingsStore.subscribe((next, prev) => {
        activeRef.current?.client.applySettings(next, prev).catch((err) => {
          const message = mediaErrorMessage(err, 'dispositivo');
          if (message) toast(message, 'error');
        });
      }),
    [toast],
  );

  useEffect(() => () => activeRef.current?.client.destroy(), []);

  // Snapshot NÃO entra no contexto: cada emit WebRTC recriava o value e
  // re-renderizava a sidebar inteira até a UI travar.
  const value = useMemo<CallContextValue>(
    () => ({
      active,
      ringing,
      ringingOffline,
      incoming,
      deafened,
      busy,
      joinRoom,
      callFriend,
      callGroup,
      acceptIncoming,
      declineIncoming,
      leave,
      toggleMic,
      toggleCam,
      toggleDeafen,
      startScreen,
      stopScreen,
      musicBusy,
      startMusic,
      stopMusic,
      spotifyControl,
      playTrack,
    }),
    [
      musicBusy,
      startMusic,
      stopMusic,
      spotifyControl,
      playTrack,
      active,
      ringing,
      ringingOffline,
      incoming,
      deafened,
      busy,
      joinRoom,
      callFriend,
      callGroup,
      acceptIncoming,
      declineIncoming,
      leave,
      toggleMic,
      toggleCam,
      toggleDeafen,
      startScreen,
      stopScreen,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall precisa estar dentro de CallProvider');
  return ctx;
}

/** Só quem precisa do áudio/vídeo da chamada — não puxa re-render na sidebar. */
export function useCallSnapshot(): RoomSnapshot | null {
  const { active } = useCall();
  return useSyncExternalStore(active ? active.client.subscribe : noopSubscribe, active ? active.client.getSnapshot : nullSnapshot);
}
