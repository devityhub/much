import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ban, Check, ChevronRight, Clock, Copy, LogIn, LogOut, MessageCircle, MoreHorizontal, Pencil, Phone, UserPlus, X } from 'lucide-react';
import ProfileCard from './ProfileCard';
import Avatar from '../Avatar';
import RoomIcon from '../RoomIcon';
import RoomPromo from '../room/RoomPromo';
import { NowPlayingLine, SpotifyAccountCard } from './NowPlaying';
import { useUserActions } from './useUserActions';
import { useCall } from '../../context/call';
import { useRooms } from '../../context/rooms';
import { useToast } from '../../context/toast';
import { anchorOf, useUi, type Anchor } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { listeningStore, useListening } from '../../lib/listening';
import { fetchProfile, peekProfile } from '../../lib/profileCache';
import { displayName, PRESENCE_INFO, visiblePresence } from '../../lib/users';
import type { Activity, Presence, ProfileListening, PublicUser, UserProfile } from '../../lib/types';

const WIDTH = 320;
const MARGIN = 12;

function MenuItem({ icon, label, onClick, danger = false, trailing }: { icon: ReactNode; label: string; onClick?: () => void; danger?: boolean; trailing?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
        danger ? 'text-danger hover:bg-danger/15' : 'hover:bg-surface-4'
      }`}
    >
      <span className={danger ? '' : 'text-muted'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}

function PresenceMenu({ current, onPick }: { current: Presence; onPick: (p: Presence) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="absolute bottom-0 left-full ml-2 w-64 rounded-2xl border border-line bg-surface-2 p-1.5 shadow-2xl shadow-black/50"
    >
      {(Object.keys(PRESENCE_INFO) as Presence[]).map((p) => (
        <button key={p} onClick={() => onPick(p)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-4">
          <span className="mt-1">
            <PresenceIcon presence={p} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">{PRESENCE_INFO[p].label}</span>
            {PRESENCE_INFO[p].hint && <span className="block text-xs text-muted">{PRESENCE_INFO[p].hint}</span>}
          </span>
          {current === p && <Check size={16} className="mt-0.5 text-ok" />}
        </button>
      ))}
    </motion.div>
  );
}

export function PresenceIcon({ presence }: { presence: Presence }) {
  const color = { online: 'bg-ok', idle: 'bg-warn', dnd: 'bg-danger', invisible: 'bg-faint' }[presence];
  return (
    <span className={`relative block h-3 w-3 overflow-hidden rounded-full ${color}`}>
      {presence === 'idle' && <span className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-surface-2" />}
      {presence === 'dnd' && <span className="absolute top-[5px] left-[2px] h-[2px] w-2 rounded bg-surface-2" />}
      {presence === 'invisible' && <span className="absolute top-[3px] left-[3px] h-1.5 w-1.5 rounded-full bg-surface-2" />}
    </span>
  );
}

function SelfContent({ close }: { close: () => void }) {
  const { user, updateProfile, logout } = useAuth();
  const { active } = useCall();
  const { openSettings, openFullProfile } = useUi();
  const toast = useToast();
  const listening = useListening(user?.id);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [spotify, setSpotify] = useState<UserProfile['spotify']>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const cached = peekProfile(user.id);
    if (cached) {
      setSpotify(cached.spotify);
      listeningStore.prime(user.id, cached.listening);
    }
    fetchProfile(user.id)
      .then((p) => {
        if (cancelled) return;
        setSpotify(p.spotify);
        listeningStore.prime(user.id, p.listening);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const safe = (p: Promise<unknown>): Promise<void> =>
    p.then(
      () => undefined,
      (err: Error) => toast(err.message, 'error'),
    );

  const callActivity = active ? (active.kind === 'room' ? `Na sala ${active.title}` : `Em chamada com ${active.title}`) : null;
  const spotifyActivity = listening
    ? `${listening.isPlaying ? 'Ouvindo' : 'Pausado'} ${listening.track.name}`
    : null;

  return (
    <ProfileCard
      user={user}
      status={visiblePresence(user.presence)}
      activity={spotifyActivity ?? callActivity}
      onSaveStatus={(customStatus) => safe(updateProfile({ customStatus }))}
      onExpand={() => openFullProfile(user)}
      bg="var(--color-surface-2)"
    >
      <SpotifyActivity userId={user.id} close={close} fallback={listening} account={spotify} />
      <div className="rounded-xl bg-black/25 p-1.5">
        <MenuItem icon={<Pencil size={16} />} label="Editar perfil" onClick={() => openSettings('profile')} />
        <div className="relative" onMouseEnter={() => setPresenceOpen(true)} onMouseLeave={() => setPresenceOpen(false)}>
          <MenuItem
            icon={<PresenceIcon presence={user.presence} />}
            label={PRESENCE_INFO[user.presence].label}
            onClick={() => setPresenceOpen((v) => !v)}
            trailing={<ChevronRight size={16} className="text-muted" />}
          />
          <AnimatePresence>
            {presenceOpen && (
              <PresenceMenu
                current={user.presence}
                onPick={(presence) => {
                  setPresenceOpen(false);
                  void safe(updateProfile({ presence }));
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="rounded-xl bg-black/25 p-1.5">
        <MenuItem
          icon={<Copy size={16} />}
          label="Copiar nick"
          onClick={() => {
            void navigator.clipboard?.writeText(user.nick).then(() => toast('Nick copiado', 'success'));
            close();
          }}
        />
        <MenuItem icon={<LogOut size={16} />} label="Sair da conta" danger onClick={logout} />
      </div>
    </ProfileCard>
  );
}

function activityText(activity: Activity) {
  if (activity?.type === 'spotify') {
    return activity.artists ? `Ouvindo ${activity.name} · ${activity.artists}` : `Ouvindo ${activity.name}`;
  }
  if (activity?.type === 'room') return `Na sala ${activity.roomName}`;
  if (activity?.type === 'call') return 'Em uma chamada privada';
  return null;
}

/** O que a pessoa está ouvindo, ao vivo. Só mostra: ninguém controla o Spotify de ninguém por aqui. */
function SpotifyActivity({
  userId,
  close,
  fallback = null,
  account = null,
}: {
  userId: number;
  close: () => void;
  fallback?: ProfileListening | null;
  account?: UserProfile['spotify'];
}) {
  const live = useListening(userId);
  const listening = live ?? fallback;
  const { joinRoom } = useCall();
  if (listening) {
    const room = listening.roomId && listening.roomName ? { id: listening.roomId, name: listening.roomName } : null;
    return (
      <NowPlayingLine
        listening={listening}
        onJoin={
          room
            ? () => {
                close();
                joinRoom(room);
              }
            : undefined
        }
      />
    );
  }
  if (account) return <SpotifyAccountCard name={account.name} premium={account.premium} />;
  return null;
}

function MutualFriends({ mutual }: { mutual: UserProfile['mutualFriends'] }) {
  const { openProfile } = useUi();
  if (!mutual?.total) return null;
  const extra = mutual.total - mutual.users.length;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-black/25 px-2.5 py-2">
      <div className="flex">
        {mutual.users.slice(0, 5).map((friend, i) => (
          <button
            key={friend.id}
            onClick={(e) => openProfile({ kind: 'user', user: friend, anchor: anchorOf(e.currentTarget) })}
            title={displayName(friend)}
            className="-mr-2 rounded-full ring-2 ring-surface-2 transition hover:z-10 hover:-translate-y-0.5"
            style={{ zIndex: 5 - i }}
          >
            <Avatar nick={friend.nick} avatar={friend.avatar} image={friend.avatarImage} size={26} />
          </button>
        ))}
        {extra > 0 && (
          <span className="z-0 -mr-2 flex h-[26px] items-center justify-center rounded-full bg-surface-4 px-1.5 text-[11px] font-bold ring-2 ring-surface-2">
            +{extra}
          </span>
        )}
      </div>
      <span className="ml-2.5 text-xs text-muted">
        {mutual.total === 1 ? '1 amigo em comum' : `${mutual.total} amigos em comum`}
      </span>
    </div>
  );
}

/** Sala onde a pessoa está agora, com atalho para entrar junto. */
function RoomActivityCard({ roomId, roomName, close }: { roomId: string; roomName: string; close: () => void }) {
  const { joinRoom } = useCall();
  const { rooms } = useRooms();
  const room = rooms.find((r) => r.id === roomId);
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-black/25 p-2.5">
      <RoomIcon name={roomName} cover={room?.cover ?? 'cover-1'} image={room?.iconImage} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-wider text-faint uppercase">Está na sala</p>
        <p className="truncate text-sm font-semibold">{roomName}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          close();
          joinRoom({ id: roomId, name: roomName });
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-4 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-5"
      >
        <LogIn size={14} /> Entrar
      </motion.button>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'primary',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'primary' | 'success' | 'secondary';
  disabled?: boolean;
}) {
  const tones = {
    primary: 'bg-gradient-accent text-white',
    success: 'bg-ok text-black',
    secondary: 'bg-surface-4 text-white hover:bg-surface-5',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </motion.button>
  );
}

/** Perfil de outra pessoa. Serve tanto no balão flutuante quanto docado na lateral da conversa. */
export function UserContent({ seed, close, flush = false }: { seed: PublicUser; close: () => void; flush?: boolean }) {
  const actions = useUserActions(seed);
  const { openUserMenu, openFullProfile } = useUi();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { relationship, friend } = actions;

  // Cache compartilhado com o modal/painel: abre na hora se já buscou, senão um fetch só.
  useEffect(() => {
    let cancelled = false;
    const cached = peekProfile(seed.id);
    if (cached) {
      setProfile(cached);
      listeningStore.prime(cached.user.id, cached.listening);
    }
    fetchProfile(seed.id)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        listeningStore.prime(p.user.id, p.listening);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [seed.id, relationship]);

  const user = profile?.user ?? seed;
  const presence = relationship === 'friend' ? (friend?.presence ?? profile?.presence ?? undefined) : (profile?.presence ?? undefined);
  const rawActivity = relationship === 'friend' ? (friend?.activity ?? null) : (profile?.activity ?? null);
  const blocked = relationship === 'blocked';
  // Sala vira um card com atalho para entrar, então sai da linha de atividade.
  const room = !blocked && rawActivity?.type === 'room' ? rawActivity : null;
  const promoted = blocked ? null : (profile?.rooms.promoted ?? null);
  const live = useListening(user.id);
  const listening = live ?? (blocked ? null : profile?.listening ?? null);
  const spotifyActivity = listening
    ? `${listening.isPlaying ? 'Ouvindo' : 'Pausado'} ${listening.track.name}`
    : blocked || room
      ? null
      : activityText(rawActivity);
  const since = profile?.since ? new Date(profile.since.replace(' ', 'T') + 'Z') : null;
  const act = (fn: () => unknown) => () => {
    close();
    fn();
  };

  return (
    <ProfileCard
      user={user}
      status={blocked ? undefined : presence}
      activity={spotifyActivity}
      onExpand={() => openFullProfile(user)}
      bg="var(--color-surface-2)"
      rounded={!flush}
    >
      {blocked && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <Ban size={14} /> Você bloqueou esta pessoa.
        </div>
      )}
      {!blocked && (
        <SpotifyActivity
          userId={user.id}
          close={close}
          fallback={listening}
          account={profile?.spotify ?? null}
        />
      )}
      {room && <RoomActivityCard roomId={room.roomId} roomName={room.roomName} close={close} />}
      {/* A sala divulgada só some quando a pessoa já está nela: aí o card de cima mostra a mesma sala. */}
      {promoted && promoted.id !== room?.roomId && <RoomPromo room={promoted} />}
      {!blocked && profile && <MutualFriends mutual={profile.mutualFriends} />}
      {since && relationship === 'friend' && <p className="text-xs text-faint">Amigos desde {since.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
      <div className="flex gap-2">
        {relationship === 'self' && (
          <ActionButton onClick={act(actions.editProfile)}>
            <Pencil size={16} /> Editar perfil
          </ActionButton>
        )}
        {relationship === 'friend' && (
          <>
            <ActionButton onClick={act(actions.message)}>
              <MessageCircle size={16} /> Mensagem
            </ActionButton>
            <ActionButton tone="success" disabled={actions.inCallWith} onClick={act(actions.call)}>
              <Phone size={16} /> {actions.inCallWith ? 'Em chamada' : 'Ligar'}
            </ActionButton>
          </>
        )}
        {relationship === 'none' && (
          <ActionButton onClick={() => void actions.addFriend()}>
            <UserPlus size={16} /> Adicionar amigo
          </ActionButton>
        )}
        {relationship === 'outgoing' && (
          <ActionButton tone="secondary" onClick={() => void actions.cancelRequest()}>
            <Clock size={16} /> Pedido enviado · cancelar
          </ActionButton>
        )}
        {relationship === 'incoming' && (
          <>
            <ActionButton tone="success" onClick={() => void actions.accept()}>
              <Check size={16} /> Aceitar pedido
            </ActionButton>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => void actions.decline()}
              className="rounded-xl bg-surface-4 px-3 text-muted transition hover:bg-danger/20 hover:text-danger"
              aria-label="Recusar pedido"
              title="Recusar pedido"
            >
              <X size={17} />
            </motion.button>
          </>
        )}
        {relationship === 'blocked' && (
          <ActionButton tone="secondary" onClick={() => void actions.unblock()}>
            <Ban size={16} /> Desbloquear
          </ActionButton>
        )}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openUserMenu({ user, x: r.left, y: r.bottom + 6 });
          }}
          className="rounded-xl bg-surface-4 px-3 text-muted transition hover:bg-surface-5 hover:text-white"
          aria-label="Mais opções"
          title="Mais opções"
        >
          <MoreHorizontal size={18} />
        </motion.button>
      </div>
    </ProfileCard>
  );
}

function usePosition(anchor: Anchor, kind: 'self' | 'user') {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      if (kind === 'self') {
        setStyle({ left: Math.max(MARGIN, anchor.left), bottom: Math.max(MARGIN, vh - anchor.top + 8) });
      } else {
        const fitsRight = anchor.right + 8 + WIDTH < vw - MARGIN;
        const left = fitsRight ? anchor.right + 8 : Math.max(MARGIN, anchor.left - WIDTH - 8);
        const top = Math.min(Math.max(MARGIN, anchor.top), Math.max(MARGIN, vh - h - MARGIN));
        setStyle({ left, top });
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor, kind]);

  return { ref, style };
}

function PopoverPanel({ anchor, kind, children }: { anchor: Anchor; kind: 'self' | 'user'; children: ReactNode }) {
  const { ref, style } = usePosition(anchor, kind);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92, y: kind === 'self' ? 12 : 0, x: kind === 'user' ? -12 : 0 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: kind === 'self' ? 8 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{ ...style, width: WIDTH, transformOrigin: kind === 'self' ? 'bottom left' : 'left center' }}
      className="fixed z-50 max-h-[calc(100vh-24px)] overflow-visible rounded-2xl border border-line shadow-2xl shadow-black/60"
    >
      {children}
    </motion.div>
  );
}

export default function ProfilePopover() {
  const { profile, closeProfile } = useUi();

  useEffect(() => {
    if (!profile) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeProfile();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profile, closeProfile]);

  const key = profile ? (profile.kind === 'self' ? 'self' : `user-${profile.user.id}`) : 'none';

  return (
    <>
      {/* Overlay fora do AnimatePresence: evita camada fixa residual bloqueando cliques. */}
      {profile && (
        <div
          className="fixed inset-0 z-40"
          onMouseDown={closeProfile}
          onContextMenu={(e) => {
            e.preventDefault();
            closeProfile();
          }}
        />
      )}
      <AnimatePresence>
        {profile && (
          <PopoverPanel key={key} anchor={profile.anchor} kind={profile.kind}>
            {profile.kind === 'self' ? <SelfContent close={closeProfile} /> : <UserContent seed={profile.user} close={closeProfile} />}
          </PopoverPanel>
        )}
      </AnimatePresence>
    </>
  );
}
