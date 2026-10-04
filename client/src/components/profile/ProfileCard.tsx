import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, Maximize2, Plus, Quote, X } from 'lucide-react';
import Avatar from '../Avatar';
import SpotifyBadge, { SpotifyLogo } from '../SpotifyBadge';
import { useCallSnapshot } from '../../context/call';
import { useListening } from '../../lib/listening';
import { coverBackground } from '../../lib/theme';
import { displayName, presenceLabel } from '../../lib/users';
import type { PublicUser, VisiblePresence } from '../../lib/types';

interface ProfileCardProps {
  user: PublicUser;
  status?: VisiblePresence;
  activity?: string | null;
  /** Quando presente, o balão de status vira editável (perfil próprio). */
  onSaveStatus?: (text: string) => Promise<void> | void;
  /** Quando presente, clicar na foto abre o perfil completo. */
  onExpand?: () => void;
  children?: ReactNode;
  bg?: string;
  /** No painel lateral o cartão encosta nas bordas, então perde os cantos arredondados. */
  rounded?: boolean;
}

const PRESENCE_COLOR: Record<VisiblePresence, string> = {
  online: 'bg-ok',
  idle: 'bg-warn',
  dnd: 'bg-danger',
  offline: 'bg-faint',
};

function StatusBubble({ text, onSave }: { text: string; onSave?: ProfileCardProps['onSaveStatus'] }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(text), [text]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  if (!text && !onSave) return null;

  const save = async (next: string) => {
    setEditing(false);
    if (next.trim() !== text) await onSave?.(next.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: -6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
      className="relative ml-3.5 max-w-[168px] origin-left"
    >
      <span className="absolute top-1/2 -left-2 h-3 w-3 -translate-y-[90%] rounded-full border border-line bg-surface-3" />
      <span className="absolute top-1/2 -left-[17px] h-1.5 w-1.5 translate-y-1 rounded-full border border-line bg-surface-3" />
      {editing ? (
        <input
          ref={input}
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void save(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save(value);
            if (e.key === 'Escape') {
              setValue(text);
              setEditing(false);
            }
          }}
          placeholder="No que você está pensando?"
          className="w-full rounded-2xl border border-accent/60 bg-surface-3 px-3 py-2 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={!onSave}
          onClick={() => setEditing(true)}
          className="group/bubble relative flex w-full items-start gap-1.5 rounded-2xl border border-line bg-surface-3 px-3 py-2 text-left text-sm transition enabled:hover:border-white/20"
        >
          {!text && <Plus size={15} className="mt-0.5 shrink-0 text-muted" />}
          <span className={`line-clamp-3 break-words ${text ? '' : 'text-muted italic'}`}>{text || 'Definir um status'}</span>
          {text && onSave && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                void save('');
              }}
              className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-surface-5 p-0.5 group-hover/bubble:block"
              aria-label="Limpar status"
            >
              <X size={11} />
            </span>
          )}
        </button>
      )}
    </motion.div>
  );
}

/** Brilho que atravessa o banner de vez em quando. */
function Sheen() {
  return (
    <motion.span
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/25 to-transparent"
      animate={{ x: ['0%', '500%'] }}
      transition={{ repeat: Infinity, duration: 2.4, repeatDelay: 4.5, ease: 'easeInOut' }}
    />
  );
}

export default function ProfileCard({
  user,
  status,
  activity,
  onSaveStatus,
  onExpand,
  children,
  bg = 'var(--color-surface-1)',
  rounded = true,
}: ProfileCardProps) {
  const snapshot = useCallSnapshot();
  const listening = useListening(user.id);
  // Anel mais escuro que o cartão: assim a borda do avatar aparece inteira, tanto sobre o banner quanto sobre o fundo.
  const ring = 'var(--color-bg)';
  const since = user.createdAt ? new Date(user.createdAt.replace(' ', 'T') + 'Z') : null;
  const isDj = snapshot?.music?.dj.id === user.id;
  const spotifyLive = Boolean(listening?.track);
  const spotifyActivity =
    listening?.track
      ? `${listening.isPlaying ? 'Ouvindo' : 'Pausado'} ${listening.track.name}`
      : activity?.startsWith('Ouvindo')
        ? activity
        : null;
  const otherActivity = spotifyActivity ? null : activity;

  return (
    <div className={`overflow-hidden ${rounded ? 'rounded-2xl' : ''}`} style={{ background: bg }}>
      <div className="relative h-[120px] overflow-hidden" style={{ background: coverBackground(user.banner, user.bannerImage) }}>
        {!user.bannerImage && (
          <>
            <motion.div
              className="soft-glow absolute -top-16 -right-14 h-48 w-48 bg-white/25"
              animate={{ x: [0, -22, 0], y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
            />
            <motion.div
              className="soft-glow absolute -bottom-18 -left-12 h-44 w-44 bg-black/25"
              animate={{ x: [0, 18, 0], y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }}
            />
          </>
        )}
        <Sheen />
        <span className="absolute inset-x-0 top-0 h-px bg-white/15" />
        <span className="absolute inset-x-0 bottom-0 h-20" style={{ background: `linear-gradient(to top, ${bg} 10%, transparent)` }} />
      </div>

      {/* `relative` tira o conteúdo de baixo do banner: sem isso o degradê do banner cobre o anel do avatar. */}
      <div className="relative px-4 pb-4">
        <div className="-mt-12 flex items-end">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="relative rounded-full p-1.5"
            style={{ background: ring, boxShadow: '0 0 0 1px rgba(255,255,255,.07), 0 4px 14px rgba(0,0,0,.45)' }}
          >
            <Avatar nick={user.nick} avatar={user.avatar} image={user.avatarImage} size={84} status={status} statusBg={ring} />
            {/* A foto é o atalho para o perfil completo, como no Discord. */}
            {onExpand && (
              <button
                onClick={onExpand}
                title="Ver perfil completo"
                aria-label="Ver perfil completo"
                className="group absolute inset-1.5 flex items-center justify-center rounded-full transition-colors hover:bg-black/55"
              >
                <Maximize2 size={22} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
            {(isDj || spotifyLive) && (
              <span className="absolute right-0 bottom-0">
                <SpotifyBadge
                  size={20}
                  label={isDj ? 'Tocando música do Spotify para a sala' : 'Ouvindo no Spotify'}
                />
              </span>
            )}
          </motion.div>
          <div className="min-w-0 flex-1 pb-1">
            <StatusBubble text={user.customStatus ?? ''} onSave={onSaveStatus} />
          </div>
        </div>

        <div className="mt-2.5 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[22px] leading-tight font-semibold break-words">{displayName(user)}</h3>
            <p className="text-sm text-muted">
              @{user.nick}
              {user.pronouns && <span className="text-faint"> · {user.pronouns}</span>}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {(status || spotifyActivity || otherActivity) && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 flex flex-wrap gap-1.5">
              {status && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-muted">
                  <span className={`h-2 w-2 rounded-full ${PRESENCE_COLOR[status]}`} />
                  {presenceLabel(status)}
                </span>
              )}
              {spotifyActivity && (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#1db954]/15 px-2.5 py-1 text-xs font-medium text-[#1db954]">
                  <SpotifyLogo size={11} />
                  <span className="truncate">{spotifyActivity}</span>
                </span>
              )}
              {otherActivity && (
                <span className="inline-flex items-center rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white/80">{otherActivity}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {user.bio && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-line bg-black/25 p-3">
            <Quote size={38} className="absolute -top-1 -right-1 text-white/5" />
            <p className="mb-1 text-[11px] font-bold tracking-wider text-faint uppercase">Sobre mim</p>
            <p className="relative text-sm whitespace-pre-wrap break-words">{user.bio}</p>
          </div>
        )}

        {since && !Number.isNaN(since.getTime()) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
            <CalendarDays size={13} />
            No Much desde {since.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}

        {children && <div className="mt-3 space-y-2">{children}</div>}
      </div>
    </div>
  );
}
