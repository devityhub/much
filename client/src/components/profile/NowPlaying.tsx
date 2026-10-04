import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Disc3, ExternalLink, Headphones, Pause } from 'lucide-react';
import { SPOTIFY_GREEN, SpotifyLogo } from '../SpotifyBadge';
import { useToast } from '../../context/toast';
import { useUi } from '../../context/ui';
import { formatDuration, listenAlongTo, useSpotifyAccount } from '../../lib/spotify';
import type { ProfileListening, SpotifyTrack } from '../../lib/types';

/**
 * Cartão do Spotify no perfil. É só vitrine: o PassTime mostra o que a pessoa está ouvindo
 * e nunca manda comandos para o Spotify dela.
 */

/** A leitura chega com o progresso de um instante; daí para frente o relógio corre aqui. */
function useProgress(listening: ProfileListening) {
  const base = useRef({ listening, at: Date.now() });
  if (base.current.listening !== listening) base.current = { listening, at: Date.now() };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!listening.isPlaying) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  const elapsed = listening.isPlaying ? Math.max(0, now - base.current.at) : 0;
  return Math.min(listening.progressMs + elapsed, listening.track.durationMs);
}

export function useListenAlongAction() {
  const account = useSpotifyAccount();
  const { openSettings } = useUi();
  const toast = useToast();
  return useCallback(
    async (listening: ProfileListening) => {
      if (!account?.linked) {
        toast('Conecte o Spotify em Configurações para ouvir junto', 'info');
        openSettings('connections');
        return;
      }
      try {
        await listenAlongTo(listening);
        toast(`Tocando ${listening.track.name} no seu Spotify`, 'success');
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    },
    [account?.linked, openSettings, toast],
  );
}

export function Cover({ track, size }: { track: SpotifyTrack; size: number }) {
  if (track.image) {
    return <img src={track.image} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-lg object-cover shadow-lg shadow-black/50" />;
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-[#1db954] to-[#0b5f2a]"
    >
      <Disc3 size={size * 0.4} className="text-black/70" />
    </div>
  );
}

function Header({ listening }: { listening: ProfileListening }) {
  const label = !listening.isPlaying
    ? 'Pausado no Spotify'
    : listening.roomName
      ? `Tocando para a sala ${listening.roomName}`
      : 'Ouvindo no Spotify';
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase" style={{ color: SPOTIFY_GREEN }}>
      {listening.isPlaying ? <SpotifyLogo size={12} /> : <Pause size={12} />}
      <span className="truncate">{label}</span>
    </p>
  );
}

function Progress({ listening, times = false }: { listening: ProfileListening; times?: boolean }) {
  const progress = useProgress(listening);
  const bar = (
    <div className="h-1 overflow-hidden rounded-full bg-white/15">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-linear"
        style={{ width: `${(progress / listening.track.durationMs) * 100}%`, background: SPOTIFY_GREEN }}
      />
    </div>
  );
  if (!times) return bar;
  return (
    <div className="flex items-center gap-2 text-[11px] text-faint tabular-nums">
      <span>{formatDuration(progress)}</span>
      <div className="flex-1">{bar}</div>
      <span>{formatDuration(listening.track.durationMs)}</span>
    </div>
  );
}

function AlongButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1db954] py-2 text-xs font-bold text-black transition hover:brightness-110"
    >
      <Headphones size={14} /> {label}
    </motion.button>
  );
}

function ActivityAction({ listening, onJoin, onAlong }: { listening: ProfileListening; onJoin?: () => void; onAlong?: () => void }) {
  if (listening.roomId && listening.roomName && onJoin) {
    return (
      <div className="mt-2.5">
        <AlongButton label={`Ouvir junto em ${listening.roomName}`} onClick={onJoin} />
      </div>
    );
  }
  if (onAlong) {
    return (
      <div className="mt-2.5">
        <AlongButton label="Ouvir junto" onClick={onAlong} />
      </div>
    );
  }
  return null;
}

/** Conta Spotify no perfil (quando “Exibir no perfil” está ligado), mesmo sem música no ar. */
export function SpotifyAccountCard({ name, premium }: { name: string; premium?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#1db954]/25 bg-black/25 px-3 py-2.5">
      <SpotifyLogo size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted">{premium ? 'Spotify Premium' : 'Spotify'}</p>
      </div>
    </div>
  );
}

/** Versão grande, do perfil completo. */
export function NowPlayingCard({ listening, onJoin, onAlong }: { listening: ProfileListening; onJoin?: () => void; onAlong?: () => void }) {
  const { track } = listening;
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1db954]/30 bg-black/30 p-3">
      {track.image && (
        <div className="absolute inset-0 scale-125 opacity-25 blur-2xl" style={{ backgroundImage: `url(${track.image})`, backgroundSize: 'cover' }} />
      )}
      <div className="relative">
        <div className="mb-2.5">
          <Header listening={listening} />
        </div>
        <div className="flex gap-3">
          <Cover track={track} size={80} />
          <div className="min-w-0 flex-1">
            {track.url ? (
              <a href={track.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold hover:underline">
                {track.name}
              </a>
            ) : (
              <p className="line-clamp-2 text-sm font-semibold">{track.name}</p>
            )}
            <p className="truncate text-xs text-muted">{track.artists}</p>
            <p className="mt-1 truncate text-[11px] text-faint">{track.album}</p>
          </div>
        </div>
        <div className="mt-2.5">
          <Progress listening={listening} times />
        </div>
        <ActivityAction listening={listening} onJoin={onJoin} onAlong={onAlong} />
      </div>
    </div>
  );
}

/** Versão estreita, do cartão rápido do perfil. */
export function NowPlayingLine({ listening, onJoin, onAlong }: { listening: ProfileListening; onJoin?: () => void; onAlong?: () => void }) {
  const { track } = listening;
  return (
    <div className="rounded-xl border border-[#1db954]/25 bg-black/25 p-2.5">
      <div className="mb-2">
        <Header listening={listening} />
      </div>
      <div className="flex items-center gap-2.5">
        <Cover track={track} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track.name}</p>
          <p className="truncate text-xs text-muted">{track.artists}</p>
        </div>
        {track.url && (
          <a
            href={track.url}
            target="_blank"
            rel="noreferrer"
            title="Abrir no Spotify"
            className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-surface-4 hover:text-white"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      <div className="mt-2">
        <Progress listening={listening} />
      </div>
      <ActivityAction listening={listening} onJoin={onJoin} onAlong={onAlong} />
    </div>
  );
}
