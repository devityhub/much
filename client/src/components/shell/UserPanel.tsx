import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Headphones, HeadphoneOff, Mic, MicOff, Settings } from 'lucide-react';
import Avatar from '../Avatar';
import { SpotifyLogo } from '../SpotifyBadge';
import { useCall, useCallSnapshot } from '../../context/call';
import { anchorOf, useUi } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { Cover } from '../profile/NowPlaying';
import { useListening } from '../../lib/listening';
import { displayName, PRESENCE_INFO, visiblePresence } from '../../lib/users';

function IconButton({ label, onClick, danger = false, disabled = false, children }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${danger ? 'text-danger hover:bg-danger/15' : 'text-muted hover:bg-surface-4 hover:text-white'}`}
    >
      {children}
    </motion.button>
  );
}

export default function UserPanel() {
  const { user } = useAuth();
  const { active, deafened, busy, toggleMic, toggleDeafen } = useCall();
  const snapshot = useCallSnapshot();
  const { openSettings, openProfile, closeProfile, profile } = useUi();
  const listening = useListening(user?.id);
  if (!user) return null;

  const micOn = Boolean(snapshot?.media.mic);
  const open = profile?.kind === 'self';
  const track = listening?.track ?? null;
  const song = track ? `${listening?.isPlaying ? 'Ouvindo' : 'Pausado'} ${track.name}` : null;
  const subtitle = active ? 'Em chamada' : user.customStatus || PRESENCE_INFO[user.presence].label;

  return (
    <div className="border-t border-line bg-surface-2/60">
      {track && (
        <a
          href={track.url || 'https://open.spotify.com'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 text-left transition hover:bg-surface-3"
          title="Abrir no Spotify"
        >
          <Cover track={track} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{track.name}</span>
            <span className="flex items-center gap-1 truncate text-[11px] text-[#1db954]">
              <SpotifyLogo size={10} />
              {listening?.isPlaying ? 'Ouvindo no Spotify' : 'Pausado no Spotify'}
            </span>
          </span>
          <ExternalLink size={12} className="shrink-0 text-faint" />
        </a>
      )}
      <div className="flex items-center gap-1 px-2 py-2">
      <button
        onClick={(e) => (open ? closeProfile() : openProfile({ kind: 'self', anchor: anchorOf(e.currentTarget) }))}
        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition ${open ? 'bg-surface-4' : 'hover:bg-surface-4'}`}
      >
        <span className="relative shrink-0">
          <Avatar nick={user.nick} avatar={user.avatar} image={user.avatarImage} size={34} status={visiblePresence(user.presence)} statusBg="var(--color-surface-2)" />
          {track && (
            <span className="absolute -right-0.5 -bottom-0.5">
              <SpotifyLogo size={12} />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{displayName(user)}</span>
          <span className={`block truncate text-xs ${song && !active ? 'text-[#1db954]' : 'text-faint'}`}>{subtitle}</span>
        </span>
      </button>
      <IconButton
        label={!active ? 'Entre em uma sala para usar o microfone' : micOn ? 'Silenciar' : 'Ativar microfone'}
        onClick={() => void toggleMic()}
        danger={Boolean(active) && !micOn}
        disabled={!active || busy}
      >
        {active && micOn ? <Mic size={18} /> : <MicOff size={18} />}
      </IconButton>
      <IconButton label={deafened ? 'Voltar a ouvir' : 'Ensurdecer'} onClick={() => void toggleDeafen()} danger={deafened}>
        {deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
      </IconButton>
      <IconButton label="Configurações" onClick={() => openSettings('voice')}>
        <motion.span className="block" whileHover={{ rotate: 90 }} transition={{ type: 'spring', stiffness: 300 }}>
          <Settings size={18} />
        </motion.span>
      </IconButton>
      </div>
    </div>
  );
}
