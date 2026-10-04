import type { Socket } from 'socket.io-client';
import { api } from './api';
import { canCaptureSpotify, desktop, type SystemAudioStatus } from './desktop';
import {
  cameraConstraints,
  micConstraints,
  SCREEN_BITRATES,
  SCREEN_HEIGHTS,
  settingsStore,
  type ScreenAudioMode,
  type Settings,
} from './settings';
import { startSystemAudio, type SystemAudioHandle } from './systemAudio';
import type { MediaState, Participant, PublicUser, RoomMusic } from './types';

type TrackKey = 'mic' | 'cam' | 'screenVideo' | 'screenAudio' | 'music';
type StreamKey = 'mic' | 'cam' | 'screen' | 'music';

const STREAM_OF: Record<TrackKey, StreamKey> = {
  mic: 'mic',
  cam: 'cam',
  screenVideo: 'screen',
  screenAudio: 'screen',
  music: 'music',
};

const SCREEN_AUDIO_BITRATE = 128_000;
const MUSIC_BITRATE = 160_000;

type JoinReply = { ok: true; selfId: string; peers: Participant[]; music?: RoomMusic | null } | { ok: false; error: string };
type Ack = { ok: true } | { ok: false; error: string };

interface Connection {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  senders: Map<TrackKey, RTCRtpSender>;
}

interface RemotePeer {
  socketId: string;
  user: PublicUser;
  media: MediaState;
  joinedAt: number;
  streams: Map<string, MediaStream>;
  connectionState: RTCPeerConnectionState;
}

interface SignalData {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface MicPipeline {
  raw: MediaStreamTrack;
  ctx: AudioContext;
  gain: GainNode;
  output: MediaStreamTrack;
}

export interface PeerView {
  socketId: string;
  user: PublicUser;
  media: MediaState;
  connectionState: RTCPeerConnectionState;
  micStream: MediaStream | null;
  camStream: MediaStream | null;
  screenStream: MediaStream | null;
  musicStream: MediaStream | null;
}

export interface SystemAudioState {
  active: boolean;
  sources: string[];
  error: string | null;
}

/** Música da sala, com o horário local em que o progresso foi recebido. */
export interface RoomMusicView extends RoomMusic {
  receivedAt: number;
}

export interface RoomSnapshot {
  status: 'connecting' | 'joined' | 'error';
  error: string | null;
  selfId: string | null;
  media: MediaState;
  local: Record<StreamKey, MediaStream | null>;
  peers: PeerView[];
  systemAudio: SystemAudioState;
  /** Captura do Spotify quando você é o DJ. */
  musicCapture: SystemAudioState;
  music: RoomMusicView | null;
}

export interface ScreenShareOptions {
  /** Id da fonte do desktopCapturer (apenas no app desktop). */
  sourceId?: string;
  audio: ScreenAudioMode;
}

const EMPTY_MEDIA: MediaState = { mic: false, cam: false, screen: false, screenAudio: false, music: false };
const IDLE_CAPTURE: SystemAudioState = { active: false, sources: [], error: null };

/**
 * Faz o Opus enviar em estéreo e com mais bitrate. Ajustamos a descrição remota
 * porque ela diz ao nosso encoder o que o outro lado aceita receber.
 */
function withStereoOpus(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
  const sdp = description.sdp;
  if (!sdp) return description;
  const match = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!match) return description;
  const pt = match[1];
  const munged = sdp.replace(new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`, 'g'), (line, params: string) =>
    params.includes('stereo=1') ? line : `a=fmtp:${pt} ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=${SCREEN_AUDIO_BITRATE}`,
  );
  return { type: description.type, sdp: munged };
}

async function getUserMediaWithFallback(kind: 'audio' | 'video', constraints: MediaTrackConstraints) {
  try {
    return await navigator.mediaDevices.getUserMedia({ [kind]: constraints });
  } catch (err) {
    // Dispositivo salvo foi desconectado: tenta o padrão do sistema.
    if ((err as DOMException).name === 'OverconstrainedError' && constraints.deviceId) {
      return navigator.mediaDevices.getUserMedia({ [kind]: { ...constraints, deviceId: undefined } });
    }
    throw err;
  }
}

function screenBitrate(s: Settings) {
  const base = SCREEN_BITRATES[s.screenQuality];
  return s.screenFps === 60 ? Math.round(base * 1.5) : base;
}

export class RoomClient {
  private conns = new Map<string, Connection>();
  private peers = new Map<string, RemotePeer>();
  private listeners = new Set<() => void>();
  private tracks = new Map<TrackKey, MediaStreamTrack>();
  private streams: Record<StreamKey, MediaStream> = {
    mic: new MediaStream(),
    cam: new MediaStream(),
    screen: new MediaStream(),
    music: new MediaStream(),
  };
  private localPreview: Record<StreamKey, MediaStream | null> = { mic: null, cam: null, screen: null, music: null };
  private mic: MicPipeline | null = null;
  private iceServers: RTCIceServer[] = [];
  private systemAudio: SystemAudioHandle | null = null;
  private systemAudioState: SystemAudioState = IDLE_CAPTURE;
  private musicCapture: SystemAudioHandle | null = null;
  private musicCaptureState: SystemAudioState = IDLE_CAPTURE;
  private music: RoomMusicView | null = null;
  private status: RoomSnapshot['status'] = 'connecting';
  private error: string | null = null;
  private selfId: string | null = null;
  private destroyed = false;
  private socketHandlers: Array<[string, (...args: any[]) => void]> = [];
  private snapshot: RoomSnapshot;

  constructor(
    readonly roomId: string,
    private readonly socket: Socket,
  ) {
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  async start() {
    try {
      const { iceServers } = await api<{ iceServers: RTCIceServer[] }>('/ice');
      this.iceServers = iceServers;
    } catch (err) {
      this.fail((err as Error).message);
      return;
    }
    if (this.destroyed) return;

    this.on('connect', () => this.join());
    this.on('disconnect', () => {
      this.closeAllConnections();
      if (this.status === 'joined') this.status = 'connecting';
      this.emit();
    });
    this.on('peer:joined', (participant: Participant) => {
      this.upsertPeer(participant);
      this.ensureConnection(participant.socketId);
      this.emit();
    });
    this.on('peer:left', ({ socketId }: { socketId: string }) => this.removePeer(socketId));
    this.on('peer:media', ({ socketId, media }: { socketId: string; media: MediaState }) => {
      const peer = this.peers.get(socketId);
      if (!peer) return;
      peer.media = media;
      this.emit();
    });
    this.on('signal', ({ from, data }: { from: string; data: SignalData }) => {
      void this.handleSignal(from, data);
    });
    this.on('room:closed', (payload?: { reason?: string }) => {
      this.fail(payload?.reason ?? 'Esta sala foi apagada pelo dono.');
      this.stopAllMedia();
    });
    this.on('music:now', (music: RoomMusic | null) => this.setRoomMusic(music));

    if (this.socket.connected) this.join();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAllMedia();
    this.closeAllConnections();
    for (const [event, handler] of this.socketHandlers) this.socket.off(event, handler);
    this.socketHandlers = [];
    if (this.status === 'joined') this.socket.emit('room:leave');
    this.listeners.clear();
  }

  get peerCount() {
    return this.peers.size;
  }

  async setMic(enabled: boolean) {
    if (this.destroyed || enabled === this.tracks.has('mic')) return;
    if (enabled) await this.acquireMic();
    else this.releaseMic();
    if (this.destroyed) {
      this.releaseMic();
      return;
    }
    this.publishMedia();
  }

  toggleMic() {
    return this.setMic(!this.tracks.has('mic'));
  }

  async toggleCam() {
    if (this.tracks.has('cam')) {
      this.setTrack('cam', null);
    } else {
      const stream = await getUserMediaWithFallback('video', cameraConstraints(settingsStore.get()));
      this.setTrack('cam', stream.getVideoTracks()[0]);
    }
    this.publishMedia();
  }

  async startScreen(options: ScreenShareOptions) {
    const s = settingsStore.get();
    const maxHeight = s.screenResolution === 'native' ? undefined : SCREEN_HEIGHTS[s.screenResolution];
    const video: MediaTrackConstraints = {
      frameRate: { ideal: s.screenFps, max: s.screenFps },
      ...(maxHeight ? { height: { max: maxHeight } } : {}),
    };

    let display: MediaStream;
    if (desktop) {
      if (options.sourceId) await desktop.selectSource(options.sourceId);
      display = await navigator.mediaDevices.getDisplayMedia({ video, audio: false });
    } else {
      const rawAudio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      display = await navigator.mediaDevices.getDisplayMedia({
        video,
        audio: options.audio === 'none' ? false : { ...rawAudio, restrictOwnAudio: true, suppressLocalAudioPlayback: false },
        systemAudio: options.audio === 'system' ? 'include' : 'exclude',
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'include',
      } as DisplayMediaStreamOptions);
    }

    this.stopScreen(false);

    const videoTrack = display.getVideoTracks()[0];
    videoTrack.contentHint = s.screenContent;
    videoTrack.addEventListener('ended', () => {
      if (this.tracks.get('screenVideo') === videoTrack) this.stopScreen();
    });
    this.setTrack('screenVideo', videoTrack);

    const browserAudio = display.getAudioTracks()[0];
    if (browserAudio) {
      this.setTrack('screenAudio', browserAudio);
    } else if (desktop && options.audio === 'system') {
      try {
        this.systemAudioState = { active: true, sources: [], error: null };
        this.emit();
        const handle = await startSystemAudio((status) => this.onSystemAudioStatus(status));
        if (this.tracks.get('screenVideo') !== videoTrack || this.destroyed) {
          handle.stop();
          return;
        }
        this.systemAudio = handle;
        this.setTrack('screenAudio', handle.track);
      } catch (err) {
        this.systemAudioState = { active: false, sources: [], error: (err as Error).message };
      }
    }
    this.publishMedia();
  }

  stopScreen(publish = true) {
    this.setTrack('screenVideo', null);
    this.setTrack('screenAudio', null);
    if (this.systemAudio) {
      this.systemAudio.stop();
      this.systemAudio = null;
    }
    this.systemAudioState = IDLE_CAPTURE;
    if (publish) this.publishMedia();
  }

  /**
   * Vira o DJ: mostra o que está tocando e manda o áudio na call.
   * No app desktop captura o Spotify do PC. No navegador, quem tem Spotify ouve no próprio app.
   */
  async startMusic() {
    if (this.destroyed || this.musicCapture || this.music?.djSocketId === this.selfId) return;

    const onStatus = (status: SystemAudioStatus) => this.onMusicCaptureStatus(status);
    this.musicCaptureState = { active: true, sources: ['Spotify'], error: null };
    this.emit();
    let handle: SystemAudioHandle | null = null;
    let reserved = false;
    try {
      const reply = await this.request('music:start');
      if (!reply.ok) throw new Error(reply.error);
      reserved = true;
      if (reply.music) this.setRoomMusic(reply.music);

      if (desktop && canCaptureSpotify) {
        handle = await startSystemAudio(onStatus, 'spotify');
        if (this.destroyed || this.music?.djSocketId !== this.selfId) {
          handle.stop();
          this.musicCaptureState = IDLE_CAPTURE;
          this.emit();
          return;
        }
        this.musicCapture = handle;
        this.setTrack('music', handle.track);
      }
      this.publishMedia();
    } catch (err) {
      handle?.stop();
      this.musicCaptureState = IDLE_CAPTURE;
      if (reserved) this.socket.emit('music:stop');
      this.emit();
      throw err;
    }
  }

  stopMusic() {
    const wasDj = Boolean(this.musicCapture) || this.music?.djSocketId === this.selfId;
    this.releaseMusic();
    if (wasDj) this.socket.emit('music:stop');
    this.publishMedia();
  }

  private releaseMusic() {
    this.setTrack('music', null);
    this.musicCapture?.stop();
    this.musicCapture = null;
    this.musicCaptureState = IDLE_CAPTURE;
  }

  private setRoomMusic(music: RoomMusic | null) {
    this.music = music ? { ...music, receivedAt: Date.now() } : null;
    // O servidor tirou o DJ (outra aba, reconexão): para de mandar a faixa.
    if (this.musicCapture && music?.djSocketId !== this.selfId) {
      this.releaseMusic();
      this.publishMedia();
      return;
    }
    this.emit();
  }

  private request(event: string, payload?: unknown): Promise<Ack & { music?: RoomMusic }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        resolve({ ok: false, error: 'Sem conexão com o servidor' });
        return;
      }
      this.socket.timeout(8000).emit(event, payload ?? {}, (err: Error | null, res: Ack & { music?: RoomMusic }) => {
        resolve(err ? { ok: false, error: 'O servidor não respondeu' } : res);
      });
    });
  }

  /** Aplica mudanças das configurações no meio da chamada. */
  async applySettings(next: Settings, prev: Settings) {
    if (this.mic && next.inputVolume !== prev.inputVolume) {
      this.mic.gain.gain.value = next.inputVolume;
    }
    const micChanged =
      next.audioInputId !== prev.audioInputId ||
      next.echoCancellation !== prev.echoCancellation ||
      next.noiseSuppression !== prev.noiseSuppression ||
      next.autoGainControl !== prev.autoGainControl;
    if (micChanged && this.tracks.has('mic')) {
      this.releaseMic();
      await this.acquireMic();
    }

    const camChanged = next.videoInputId !== prev.videoInputId || next.videoResolution !== prev.videoResolution;
    if (camChanged && this.tracks.has('cam')) {
      const stream = await getUserMediaWithFallback('video', cameraConstraints(next));
      this.setTrack('cam', stream.getVideoTracks()[0]);
    }

    const screenTrack = this.tracks.get('screenVideo');
    if (screenTrack) {
      screenTrack.contentHint = next.screenContent;
      if (next.screenFps !== prev.screenFps) {
        void screenTrack.applyConstraints({ frameRate: { ideal: next.screenFps, max: next.screenFps } }).catch(() => undefined);
      }
      for (const conn of this.conns.values()) this.tuneSenders(conn);
    }
    this.publishMedia();
  }

  private on(event: string, handler: (...args: any[]) => void) {
    this.socket.on(event, handler);
    this.socketHandlers.push([event, handler]);
  }

  private async acquireMic() {
    const s = settingsStore.get();
    const stream = await getUserMediaWithFallback('audio', micConstraints(s));
    const raw = stream.getAudioTracks()[0];
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([raw]));
    const gain = ctx.createGain();
    gain.gain.value = s.inputVolume;
    const destination = ctx.createMediaStreamDestination();
    source.connect(gain).connect(destination);
    const output = destination.stream.getAudioTracks()[0];
    this.mic = { raw, ctx, gain, output };
    this.setTrack('mic', output);
  }

  private releaseMic() {
    this.setTrack('mic', null);
    if (this.mic) {
      this.mic.raw.stop();
      void this.mic.ctx.close();
      this.mic = null;
    }
  }

  private get media(): MediaState {
    return {
      mic: this.tracks.has('mic'),
      cam: this.tracks.has('cam'),
      screen: this.tracks.has('screenVideo'),
      screenAudio: this.tracks.has('screenAudio'),
      music: this.tracks.has('music'),
      micStreamId: this.streams.mic.id,
      camStreamId: this.streams.cam.id,
      screenStreamId: this.streams.screen.id,
      musicStreamId: this.streams.music.id,
    };
  }

  private publishMedia() {
    if (this.status === 'joined') this.socket.emit('media:state', this.media);
    this.emit();
  }

  private join() {
    if (this.destroyed) return;
    this.socket.emit(
      'room:join',
      { roomId: this.roomId },
      (res: JoinReply) => {
        if (this.destroyed) return;
        if (!res.ok) {
          this.fail(res.error);
          return;
        }
        this.selfId = res.selfId;
        this.status = 'joined';
        this.error = null;
        for (const participant of res.peers) {
          this.upsertPeer(participant);
          this.ensureConnection(participant.socketId);
        }
        this.music = res.music ? { ...res.music, receivedAt: Date.now() } : null;
        if (this.musicCapture) void this.reclaimMusic();
        this.publishMedia();
      },
    );
  }

  /** Depois de reconectar, o servidor esqueceu o DJ: pede a vaga de novo. */
  private async reclaimMusic() {
    const reply = await this.request('music:start');
    if (this.destroyed) return;
    if (reply.ok && reply.music) {
      this.setRoomMusic(reply.music);
      this.publishMedia();
    } else if (!reply.ok) {
      this.releaseMusic();
      this.musicCaptureState = { ...IDLE_CAPTURE, error: reply.error };
      this.publishMedia();
    }
  }

  private fail(message: string) {
    this.status = 'error';
    this.error = message;
    this.emit();
  }

  private upsertPeer(participant: Participant) {
    const existing = this.peers.get(participant.socketId);
    if (existing) {
      existing.user = participant.user;
      existing.media = participant.media;
      existing.joinedAt = participant.joinedAt;
      return existing;
    }
    const peer: RemotePeer = {
      socketId: participant.socketId,
      user: participant.user,
      media: participant.media,
      joinedAt: participant.joinedAt,
      streams: new Map(),
      connectionState: 'new',
    };
    this.peers.set(participant.socketId, peer);
    return peer;
  }

  private removePeer(socketId: string) {
    this.conns.get(socketId)?.pc.close();
    this.conns.delete(socketId);
    this.peers.delete(socketId);
    this.emit();
  }

  private closeAllConnections() {
    for (const conn of this.conns.values()) conn.pc.close();
    this.conns.clear();
    this.peers.clear();
  }

  private stopAllMedia() {
    this.systemAudio?.stop();
    this.systemAudio = null;
    this.musicCapture?.stop();
    this.musicCapture = null;
    this.musicCaptureState = IDLE_CAPTURE;
    this.releaseMic();
    for (const key of [...this.tracks.keys()]) this.setTrack(key, null);
  }

  private signal(to: string, data: SignalData) {
    this.socket.emit('signal', { to, data });
  }

  private ensureConnection(socketId: string): Connection {
    const existing = this.conns.get(socketId);
    if (existing) return existing;

    if (!this.peers.has(socketId)) {
      this.upsertPeer({
        socketId,
        user: { id: -1, nick: '...', avatar: 'red' },
        media: { ...EMPTY_MEDIA },
        joinedAt: Date.now(),
      });
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const selfId = this.selfId ?? this.socket.id ?? '';
    const conn: Connection = { pc, polite: selfId < socketId, makingOffer: false, ignoreOffer: false, senders: new Map() };
    this.conns.set(socketId, conn);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.signal(socketId, { candidate: candidate.toJSON() });
    };

    pc.onnegotiationneeded = async () => {
      try {
        conn.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) this.signal(socketId, { description: pc.localDescription.toJSON() });
      } catch (err) {
        console.error('[webrtc] falha ao negociar', err);
      } finally {
        conn.makingOffer = false;
      }
    };

    pc.ontrack = ({ track, streams }) => {
      const peer = this.peers.get(socketId);
      if (!peer) return;
      const stream = streams[0] ?? new MediaStream([track]);
      if (!peer.streams.has(stream.id)) {
        peer.streams.set(stream.id, stream);
        stream.addEventListener('addtrack', () => this.emit());
        stream.addEventListener('removetrack', () => this.emit());
      }
      track.addEventListener('unmute', () => this.emit());
      this.emit();
    };

    pc.onconnectionstatechange = () => {
      const peer = this.peers.get(socketId);
      if (peer) peer.connectionState = pc.connectionState;
      if (pc.connectionState === 'failed') pc.restartIce();
      this.emit();
    };

    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable') this.tuneSenders(conn);
    };

    for (const key of this.tracks.keys()) this.applyTrack(conn, key);
    return conn;
  }

  private async handleSignal(from: string, data: SignalData) {
    if (this.status !== 'joined') return;
    const conn = this.ensureConnection(from);
    const { pc } = conn;
    try {
      if (data.description) {
        const description = withStereoOpus(data.description);
        const offerCollision = description.type === 'offer' && (conn.makingOffer || pc.signalingState !== 'stable');
        conn.ignoreOffer = !conn.polite && offerCollision;
        if (conn.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) this.signal(from, { description: pc.localDescription.toJSON() });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          if (!conn.ignoreOffer) console.warn('[webrtc] candidato ICE rejeitado', err);
        }
      }
    } catch (err) {
      console.error('[webrtc] erro de sinalização', err);
    }
  }

  private setTrack(key: TrackKey, track: MediaStreamTrack | null) {
    const streamKey = STREAM_OF[key];
    const stream = this.streams[streamKey];
    const old = this.tracks.get(key);
    if (old === track) return;
    if (old) {
      stream.removeTrack(old);
      old.stop();
      this.tracks.delete(key);
    }
    if (track) {
      stream.addTrack(track);
      this.tracks.set(key, track);
    }
    const current = stream.getTracks();
    this.localPreview = { ...this.localPreview, [streamKey]: current.length ? new MediaStream(current) : null };
    for (const conn of this.conns.values()) this.applyTrack(conn, key);
  }

  private applyTrack(conn: Connection, key: TrackKey) {
    const track = this.tracks.get(key) ?? null;
    const sender = conn.senders.get(key);
    if (sender) {
      sender
        .replaceTrack(track)
        .then(() => this.tuneSenders(conn))
        .catch((err) => console.error('[webrtc] replaceTrack falhou', err));
    } else if (track) {
      conn.senders.set(key, conn.pc.addTrack(track, this.streams[STREAM_OF[key]]));
    }
  }

  private tuneSenders(conn: Connection) {
    const s = settingsStore.get();
    const limits: Partial<Record<TrackKey, number>> = {
      screenVideo: screenBitrate(s),
      screenAudio: SCREEN_AUDIO_BITRATE,
      music: MUSIC_BITRATE,
    };
    for (const [key, maxBitrate] of Object.entries(limits) as Array<[TrackKey, number]>) {
      const sender = conn.senders.get(key);
      if (!sender?.track) continue;
      const params = sender.getParameters();
      const encoding = params.encodings?.[0];
      if (!encoding) continue;
      if (encoding.maxBitrate === maxBitrate && (key !== 'screenVideo' || encoding.maxFramerate === s.screenFps)) continue;
      encoding.maxBitrate = maxBitrate;
      if (key === 'screenVideo') {
        encoding.maxFramerate = s.screenFps;
        params.degradationPreference = s.screenContent === 'detail' ? 'maintain-resolution' : 'maintain-framerate';
      }
      sender.setParameters(params).catch(() => undefined);
    }
  }

  private onSystemAudioStatus(status: SystemAudioStatus) {
    if (status.event === 'sources') {
      this.systemAudioState = { ...this.systemAudioState, sources: (status.sources ?? []).map((s) => s.name) };
    } else if (status.event === 'error') {
      this.systemAudioState = { ...this.systemAudioState, error: status.message ?? 'Erro na captura de áudio' };
    } else if (status.event === 'exit' && this.systemAudioState.active) {
      this.systemAudioState = {
        active: false,
        sources: [],
        error: this.systemAudioState.error ?? `A captura de áudio parou (código ${status.code ?? '?'})`,
      };
    }
    this.emit();
  }

  private onMusicCaptureStatus(status: SystemAudioStatus) {
    if (status.event === 'sources') {
      this.musicCaptureState = { ...this.musicCaptureState, sources: (status.sources ?? []).map((s) => s.name) };
    } else if (status.event === 'error') {
      this.musicCaptureState = { ...this.musicCaptureState, error: status.message ?? 'Erro ao capturar o Spotify' };
    } else if (status.event === 'exit' && this.musicCapture) {
      const error = this.musicCaptureState.error ?? `A captura do Spotify parou (código ${status.code ?? '?'})`;
      this.stopMusic();
      this.musicCaptureState = { ...IDLE_CAPTURE, error };
    }
    this.emit();
  }

  private buildSnapshot(): RoomSnapshot {
    const pick = (peer: RemotePeer, enabled: boolean, id?: string) => (enabled && id ? (peer.streams.get(id) ?? null) : null);
    const peers = [...this.peers.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map<PeerView>((peer) => ({
        socketId: peer.socketId,
        user: peer.user,
        media: peer.media,
        connectionState: peer.connectionState,
        micStream: pick(peer, peer.media.mic, peer.media.micStreamId),
        camStream: pick(peer, peer.media.cam, peer.media.camStreamId),
        screenStream: pick(peer, peer.media.screen, peer.media.screenStreamId),
        musicStream: pick(peer, Boolean(peer.media.music), peer.media.musicStreamId),
      }));

    return {
      status: this.status,
      error: this.error,
      selfId: this.selfId,
      media: this.media,
      local: this.localPreview,
      peers,
      systemAudio: this.systemAudioState,
      musicCapture: this.musicCaptureState,
      music: this.music,
    };
  }

  private emitQueued = false;

  /** Agrupa vários eventos WebRTC no mesmo tick para não inundar o React. */
  private emit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    queueMicrotask(() => {
      this.emitQueued = false;
      if (this.destroyed) return;
      this.snapshot = this.buildSnapshot();
      for (const listener of this.listeners) listener();
    });
  }
}
