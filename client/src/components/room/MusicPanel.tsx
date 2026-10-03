import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Loader2, Music2, Pause, Play, Search, SkipBack, SkipForward, Square, Volume2, VolumeX, X } from 'lucide-react';
import { Slider } from '../ui';
import SpotifyBadge, { SpotifyLogo, SPOTIFY_GREEN } from '../SpotifyBadge';
import { useCall, useCallSnapshot } from '../../context/call';
import { useUserTrigger } from '../../context/ui';
import { desktop } from '../../lib/desktop';
import type { RoomMusicView } from '../../lib/roomClient';
import { settingsStore, useSettings } from '../../lib/settings';
import { formatDuration, searchSpotify } from '../../lib/spotify';
import type { SpotifyTrack } from '../../lib/types';
import { displayName } from '../../lib/users';

/** Progresso estimado entre uma atualização do servidor e outra. */
function useMusicProgress(music: RoomMusicView | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!music?.isPlaying) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [music?.isPlaying]);
  if (!music?.track) return 0;
  const elapsed = music.isPlaying ? Math.max(0, now - music.receivedAt) : 0;
  return Math.min(music.progressMs + elapsed, music.track.durationMs);
}

function Cover({ track, size }: { track: SpotifyTrack | null; size: number }) {
  return track?.image ? (
    <img src={track.image} alt="" width={size} height={size} className="shrink-0 rounded-lg object-cover shadow-lg shadow-black/40" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-[#1db954] to-[#0b5f2a]" style={{ width: size, height: size }}>
      <Music2 size={size * 0.45} className="text-black/70" />
    </div>
  );
}

function IconButton({ label, onClick, children, big = false, disabled = false }: { label: string; onClick: () => void; children: ReactNode; big?: boolean; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center rounded-full transition disabled:opacity-40 ${
        big ? 'h-10 w-10 bg-white text-black hover:scale-105' : 'h-8 w-8 text-muted hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </motion.button>
  );
}

export function MusicVolume({ compact = false }: { compact?: boolean }) {
  const settings = useSettings();
  const muted = settings.musicMuted;
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'w-44'}`}>
      <IconButton label={muted ? 'Ouvir a música' : 'Mutar a música'} onClick={() => settingsStore.set({ musicMuted: !muted })}>
        {muted ? <VolumeX size={17} className="text-danger" /> : <Volume2 size={17} />}
      </IconButton>
      {!compact && (
        <div className={`flex-1 ${muted ? 'opacity-40' : ''}`}>
          <Slider value={settings.musicVolume} onChange={(v) => settingsStore.set({ musicVolume: v, musicMuted: false })} />
        </div>
      )}
    </div>
  );
}

function TrackSearch({ onClose }: { onClose: () => void }) {
  const { playTrack } = useCall();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults((await searchSpotify(query.trim())).tracks);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <form onSubmit={submit} className="mt-3 flex items-center gap-2 rounded-xl bg-black/30 px-3">
        <Search size={15} className="text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar música no Spotify"
          className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-faint"
        />
        {loading && <Loader2 size={15} className="animate-spin text-muted" />}
        <button type="button" onClick={onClose} className="text-faint hover:text-white" aria-label="Fechar busca">
          <X size={15} />
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {results && (
        <div className="mt-2 max-h-60 space-y-0.5 overflow-y-auto pr-1">
          {results.map((track) => (
            <button
              key={track.id}
              onClick={() => void playTrack(track.uri)}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
            >
              <Cover track={track} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{track.name}</span>
                <span className="block truncate text-xs text-muted">{track.artists}</span>
              </span>
              <span className="text-xs text-faint group-hover:hidden">{formatDuration(track.durationMs)}</span>
              <Play size={15} className="hidden text-white group-hover:block" />
            </button>
          ))}
          {!results.length && <p className="px-2 py-3 text-center text-xs text-muted">Nada encontrado.</p>}
        </div>
      )}
    </motion.div>
  );
}

/** Card "Tocando agora" no topo da chamada. */
export default function MusicPanel() {
  const { stopMusic, spotifyControl } = useCall();
  const snapshot = useCallSnapshot();
  const trigger = useUserTrigger();
  const music = snapshot?.music ?? null;
  const progress = useMusicProgress(music);
  const [searching, setSearching] = useState(false);
  if (!snapshot || !music) return null;

  const isDj = music.djSocketId === snapshot.selfId;
  const track = music.track;
  const capture = snapshot.musicCapture;
  // No navegador, "sem fonte" significa aba muda, o que é normal com a música pausada.
  const spotifyMissing = isDj && capture.active && snapshot.media.music && capture.sources.length === 0 && (Boolean(desktop) || music.isPlaying);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative mx-auto w-full max-w-3xl shrink-0 overflow-hidden rounded-2xl border border-[#1db954]/30 bg-surface-2"
    >
      {track?.image && <div className="absolute inset-0 scale-125 opacity-25 blur-3xl" style={{ backgroundImage: `url(${track.image})`, backgroundSize: 'cover' }} />}
      <div className="relative p-3.5">
        <div className="flex items-center gap-3.5">
          <Cover track={track} size={64} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase" style={{ color: SPOTIFY_GREEN }}>
              <SpotifyLogo size={13} /> {music.isPlaying ? 'Tocando agora' : track ? 'Pausado' : 'Música da sala'}
            </p>
            <p className="truncate font-semibold">
              {track ? (
                track.url ? (
                  <a href={track.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {track.name}
                  </a>
                ) : (
                  track.name
                )
              ) : (
                <span className="text-muted">{isDj ? 'Dê play em alguma música no Spotify' : 'Aguardando o DJ dar play...'}</span>
              )}
            </p>
            <p className="truncate text-sm text-muted">{track?.artists}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isDj ? (
              <>
                <IconButton label="Anterior" onClick={() => void spotifyControl('previous')}>
                  <SkipBack size={17} />
                </IconButton>
                <IconButton big label={music.isPlaying ? 'Pausar' : 'Tocar'} onClick={() => void spotifyControl(music.isPlaying ? 'pause' : 'play')}>
                  {music.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </IconButton>
                <IconButton label="Próxima" onClick={() => void spotifyControl('next')}>
                  <SkipForward size={17} />
                </IconButton>
                <IconButton label="Buscar música" onClick={() => setSearching((v) => !v)}>
                  <Search size={16} />
                </IconButton>
                <IconButton label="Parar de tocar para a sala" onClick={stopMusic}>
                  <Square size={15} fill="currentColor" />
                </IconButton>
              </>
            ) : (
              <MusicVolume />
            )}
          </div>
        </div>

        {track && (
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-faint tabular-nums">
            <span>{formatDuration(progress)}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full transition-[width] duration-500 ease-linear" style={{ width: `${(progress / track.durationMs) * 100}%`, background: SPOTIFY_GREEN }} />
            </div>
            <span>{formatDuration(track.durationMs)}</span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <SpotifyBadge size={14} />
          <span>
            DJ:{' '}
            <button {...trigger(music.dj)} className="font-semibold text-white/90 hover:underline">
              {isDj ? 'você' : displayName(music.dj)}
            </button>
          </span>
          {track?.url && (
            <a href={track.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 hover:text-white">
              Abrir no Spotify <ExternalLink size={12} />
            </a>
          )}
        </div>

        {spotifyMissing && (
          <p className="mt-2 rounded-lg bg-warn/15 px-2.5 py-1.5 text-xs text-warn">
            {desktop
              ? 'Não achamos o Spotify tocando no seu PC. Abra o app do Spotify (não o site) e dê play para a sala ouvir.'
              : 'A aba compartilhada está sem som. Confira se escolheu a aba do open.spotify.com com "Compartilhar áudio da aba" ligado. Se continuar mudo, o Spotify bloqueou a captura neste navegador: use o app desktop do Much.'}
          </p>
        )}
        {music.error && <p className="mt-2 rounded-lg bg-danger/15 px-2.5 py-1.5 text-xs text-danger">{music.error}</p>}

        <AnimatePresence>{isDj && searching && <TrackSearch onClose={() => setSearching(false)} />}</AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Versão compacta para o painel de voz da barra lateral. */
export function MusicMini() {
  const snapshot = useCallSnapshot();
  const music = snapshot?.music ?? null;
  if (!snapshot || !music) return null;
  const isDj = music.djSocketId === snapshot.selfId;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-3 p-1.5">
      <Cover track={music.track} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{music.track?.name ?? 'Música da sala'}</p>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted">
          <SpotifyLogo size={10} /> {isDj ? 'Você é o DJ' : displayName(music.dj)}
        </p>
      </div>
      {!isDj && <MusicVolume compact />}
    </div>
  );
}
