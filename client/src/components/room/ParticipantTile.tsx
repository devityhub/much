import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ban, MicOff, Monitor, Volume2, WifiOff } from 'lucide-react';
import Avatar from '../Avatar';
import SpotifyBadge from '../SpotifyBadge';
import { Slider } from '../ui';
import { VideoView } from './MediaView';
import { useFriends } from '../../context/friends';
import { useUserTrigger } from '../../context/ui';
import { useSpeaking } from '../../hooks/useSpeaking';
import { avatarGradient } from '../../lib/theme';
import { displayName } from '../../lib/users';
import { volumeStore, useVolume } from '../../lib/volumes';
import type { PublicUser } from '../../lib/types';

interface ParticipantTileProps {
  user: PublicUser;
  isSelf?: boolean;
  micOn: boolean;
  sharingScreen: boolean;
  camStream: MediaStream | null;
  micStream: MediaStream | null;
  mirror?: boolean;
  connectionState?: RTCPeerConnectionState;
  compact?: boolean;
  /** Está tocando música do Spotify para a sala (DJ). */
  music?: boolean;
}

export default function ParticipantTile({
  user,
  isSelf = false,
  micOn,
  sharingScreen,
  camStream,
  micStream,
  mirror = false,
  connectionState,
  compact = false,
  music = false,
}: ParticipantTileProps) {
  const speaking = useSpeaking(micOn ? micStream : null);
  const disconnected = connectionState === 'failed' || connectionState === 'disconnected';
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volume = useVolume(user.id, 'voice');
  const trigger = useUserTrigger()(user);
  const blocked = useFriends().isBlocked(user.id);
  const showCam = Boolean(camStream && !blocked);

  return (
    <motion.div
      onContextMenu={trigger.onContextMenu}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className={`group relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-surface-3 ${
        compact ? 'w-44 shrink-0' : ''
      } ${music ? 'ring-2 ring-[#1db954]/60' : 'ring-2 ring-transparent'}`}
    >
      {showCam ? (
        <VideoView stream={camStream!} mirror={mirror} className="h-full w-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 opacity-25" style={{ background: avatarGradient(user.avatar) }} />
          <button
            type="button"
            onClick={trigger.onClick}
            aria-label={`Ver perfil de ${user.nick}`}
            className={`relative z-10 rounded-full ${blocked ? 'opacity-40 grayscale' : ''} ${speaking && !blocked ? 'brightness-110' : ''}`}
          >
            <Avatar nick={user.nick} avatar={user.avatar} image={user.avatarImage} size={compact ? 44 : 84} />
          </button>
        </>
      )}

      {blocked && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-danger/80 px-2 py-1 text-[11px] font-semibold">
          <Ban size={12} /> Bloqueado · silenciado
        </div>
      )}

      <button
        onClick={trigger.onClick}
        className="absolute bottom-2 left-2 z-10 flex max-w-[80%] items-center gap-1.5 rounded-lg bg-black/55 px-2 py-1 text-xs font-medium backdrop-blur hover:bg-black/75"
      >
        {!micOn && <MicOff size={13} className="shrink-0 text-danger" />}
        {sharingScreen && <Monitor size={13} className="shrink-0 text-accent" />}
        <span className="truncate">
          {displayName(user)}
          {isSelf && ' (você)'}
        </span>
        {music && <SpotifyBadge size={14} label={isSelf ? 'Você está tocando música do Spotify' : `${displayName(user)} está tocando música do Spotify`} />}
      </button>

      {!isSelf && !compact && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => setVolumeOpen((v) => !v)}
            className="rounded-lg bg-black/55 p-1.5 opacity-0 backdrop-blur transition group-hover:opacity-100"
            aria-label="Volume do usuário"
          >
            <Volume2 size={15} />
          </button>
          <AnimatePresence>
            {volumeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute top-9 right-0 w-44 rounded-xl border border-line bg-surface-2/95 p-3 text-xs shadow-xl backdrop-blur"
              >
                <div className="mb-2 flex justify-between text-muted">
                  <span>Volume da voz</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <Slider value={volume} onChange={(v) => volumeStore.set(user.id, 'voice', v)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {disconnected && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-2xl bg-black/70 text-xs text-muted">
          <WifiOff size={20} /> Reconectando...
        </div>
      )}
    </motion.div>
  );
}
