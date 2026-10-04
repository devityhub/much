import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Headphones, HeadphoneOff, Loader2, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Settings, Video, VideoOff, VolumeX } from 'lucide-react';
import { SpotifyLogo } from '../SpotifyBadge';
import { useCall, useCallSnapshot } from '../../context/call';
import { useUi } from '../../context/ui';
import { settingsStore, useSettings } from '../../lib/settings';
import { displayName } from '../../lib/users';

function ControlButton({
  on,
  tone = 'default',
  label,
  onClick,
  disabled = false,
  children,
}: {
  on?: boolean;
  tone?: 'default' | 'danger' | 'accent' | 'spotify';
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const color =
    tone === 'danger'
      ? 'bg-danger text-white hover:brightness-110'
      : tone === 'accent'
        ? 'bg-gradient-accent text-white'
        : tone === 'spotify'
          ? 'bg-[#1db954] text-black hover:brightness-110'
          : on
          ? 'bg-white text-black hover:bg-white/85'
          : 'bg-surface-4 text-white hover:bg-surface-5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition-[transform,background-color,filter] select-none hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 ${color}`}
    >
      {children}
      <span className="pointer-events-none absolute -top-9 rounded-md bg-black/90 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function SpotifyButton() {
  const { musicBusy, startMusic, stopMusic } = useCall();
  const snapshot = useCallSnapshot();
  const settings = useSettings();
  if (!snapshot) return null;

  const music = snapshot.music;
  const isDj = Boolean(music) && music?.djSocketId === snapshot.selfId;

  if (music && !isDj) {
    const muted = settings.musicMuted;
    return (
      <ControlButton
        on={!muted}
        label={muted ? 'Ouvir a música da sala' : `Mutar a música de ${displayName(music.dj)}`}
        onClick={() => settingsStore.set({ musicMuted: !muted })}
      >
        {muted ? <VolumeX size={20} className="text-danger" /> : <SpotifyLogo size={22} />}
      </ControlButton>
    );
  }

  if (isDj) {
    return (
      <ControlButton tone="spotify" label="Parar de compartilhar a música" onClick={stopMusic}>
        <SpotifyLogo size={22} color="#000" />
      </ControlButton>
    );
  }

  return (
    <ControlButton
      label="Compartilhar o que estou ouvindo"
      onClick={() => void startMusic()}
      disabled={musicBusy}
    >
      {musicBusy ? <Loader2 size={20} className="animate-spin" /> : <SpotifyLogo size={22} />}
    </ControlButton>
  );
}

export default function ControlBar() {
  const { busy, deafened, toggleMic, toggleCam, toggleDeafen, stopScreen, leave } = useCall();
  const snapshot = useCallSnapshot();
  const { openSettings, setScreenShareOpen } = useUi();
  const media = snapshot?.media;
  if (!media) return null;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
      className="flex items-center gap-2 rounded-3xl border border-line bg-surface-2/95 p-2 shadow-2xl shadow-black/50"
    >
      <ControlButton on={media.mic} label={media.mic ? 'Desligar microfone' : 'Ligar microfone'} onClick={() => void toggleMic()} disabled={busy}>
        {media.mic ? <Mic size={20} /> : <MicOff size={20} className="text-danger" />}
      </ControlButton>
      <ControlButton on={!deafened} label={deafened ? 'Voltar a ouvir' : 'Ensurdecer'} onClick={() => void toggleDeafen()}>
        {deafened ? <HeadphoneOff size={20} className="text-danger" /> : <Headphones size={20} />}
      </ControlButton>
      <ControlButton on={media.cam} label={media.cam ? 'Desligar câmera' : 'Ligar câmera'} onClick={() => void toggleCam()} disabled={busy}>
        {media.cam ? <Video size={20} /> : <VideoOff size={20} />}
      </ControlButton>
      <ControlButton
        tone={media.screen ? 'accent' : 'default'}
        label={media.screen ? 'Parar transmissão' : 'Transmitir tela'}
        onClick={() => (media.screen ? stopScreen() : setScreenShareOpen(true))}
        disabled={busy}
      >
        {media.screen ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
      </ControlButton>
      <SpotifyButton />
      <ControlButton label="Configurações de áudio e vídeo" onClick={() => openSettings('voice')}>
        <Settings size={20} />
      </ControlButton>
      <div className="mx-1 h-8 w-px bg-line" />
      <ControlButton tone="danger" label="Desconectar" onClick={leave}>
        <PhoneOff size={20} />
      </ControlButton>
    </motion.div>
  );
}
