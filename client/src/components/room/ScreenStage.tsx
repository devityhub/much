import { useRef } from 'react';
import { motion } from 'motion/react';
import { Maximize, Volume2, VolumeX } from 'lucide-react';
import { VideoView } from './MediaView';
import { Slider } from '../ui';
import { volumeStore, useVolume } from '../../lib/volumes';
import type { PublicUser } from '../../lib/types';

export interface ScreenSource {
  id: string;
  user: PublicUser;
  stream: MediaStream;
  isSelf: boolean;
  hasAudio: boolean;
}

export function LiveBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-danger font-bold tracking-wide text-white uppercase ${
        small ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[11px]'
      }`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      ao vivo
    </span>
  );
}

export default function ScreenStage({ screen }: { screen: ScreenSource }) {
  const container = useRef<HTMLDivElement>(null);
  const volume = useVolume(screen.user.id, 'screen');

  const fullscreen = () => {
    const el = container.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  return (
    <motion.div
      ref={container}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group/stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black"
    >
      <VideoView stream={screen.stream} className="h-full w-full object-contain" onDoubleClick={fullscreen} />

      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-linear-to-b from-black/70 to-transparent px-4 py-3 opacity-0 transition group-hover/stage:opacity-100">
        <LiveBadge />
        <span className="font-semibold">{screen.isSelf ? 'Você está transmitindo' : `Tela de ${screen.user.nick}`}</span>
        {!screen.hasAudio && <span className="text-xs text-muted">(sem áudio)</span>}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-3 bg-linear-to-t from-black/70 to-transparent px-4 py-3 opacity-0 transition group-hover/stage:opacity-100">
        {!screen.isSelf && screen.hasAudio && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => volumeStore.set(screen.user.id, 'screen', volume > 0 ? 0 : 1)}
              aria-label={volume > 0 ? 'Silenciar transmissão' : 'Ativar som da transmissão'}
            >
              {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <div className="w-28">
              <Slider value={volume} onChange={(v) => volumeStore.set(screen.user.id, 'screen', v)} />
            </div>
          </div>
        )}
        <button onClick={fullscreen} aria-label="Tela cheia" className="rounded-lg p-1 hover:bg-white/10">
          <Maximize size={20} />
        </button>
      </div>
    </motion.div>
  );
}
