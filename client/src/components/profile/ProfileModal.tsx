import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Ban,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Crown,
  Disc3,
  Hash,
  LogIn,
  Medal,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Quote,
  Rocket,
  Sparkles,
  Sticker,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Avatar from '../Avatar';
import RoomIcon from '../RoomIcon';
import RoomPromo from '../room/RoomPromo';
import { SpotifyLogo } from '../SpotifyBadge';
import { NowPlayingCard, SpotifyAccountCard } from './NowPlaying';
import { useUserActions } from './useUserActions';
import { useCall } from '../../context/call';
import { useToast } from '../../context/toast';
import { useUi } from '../../context/ui';
import { listeningStore, useListening } from '../../lib/listening';
import { fetchProfile, peekProfile } from '../../lib/profileCache';
import { coverBackground } from '../../lib/theme';
import { displayName, presenceLabel } from '../../lib/users';
import type { PublicUser, Room, UserProfile, VisiblePresence } from '../../lib/types';

/** O perfil fica aberto por muito tempo, então recarrega sozinho para a música e a sala não envelhecerem. */
const REFRESH_MS = 45000;

const PRESENCE_COLOR: Record<VisiblePresence, string> = {
  online: 'bg-ok',
  idle: 'bg-warn',
  dnd: 'bg-danger',
  offline: 'bg-faint',
};

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">
        {title}
        {count !== undefined && <span className="rounded bg-surface-4 px-1.5 py-px text-[10px] text-muted">{count}</span>}
      </h4>
      {children}
    </section>
  );
}

function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysSince(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

interface Badge {
  icon: ReactNode;
  label: string;
  hint: string;
  color: string;
}

/** Insígnias saem dos números do perfil: nada é guardado no banco só para isso. */
function badgesOf(profile: UserProfile): Badge[] {
  const badges: Badge[] = [];
  const days = daysSince(profile.user.createdAt);
  if (profile.user.id <= 5) {
    badges.push({ icon: <Rocket size={14} />, label: 'Pioneiro', hint: 'Uma das primeiras contas do PassTime', color: 'text-accent-2' });
  }
  if (days >= 365) {
    badges.push({ icon: <Medal size={14} />, label: 'Veterano', hint: `${Math.floor(days / 365)} ano(s) de PassTime`, color: 'text-warn' });
  } else if (days <= 7) {
    badges.push({ icon: <Sparkles size={14} />, label: 'Novo por aqui', hint: 'Entrou nos últimos 7 dias', color: 'text-ok' });
  }
  if (profile.listening?.roomName) {
    badges.push({ icon: <Disc3 size={14} />, label: 'DJ no ar', hint: `Tocando música em ${profile.listening.roomName}`, color: 'text-[#1db954]' });
  }
  if (profile.stats.rooms > 0) {
    badges.push({
      icon: <Crown size={14} />,
      label: profile.stats.rooms === 1 ? 'Dono de sala' : `Dono de ${profile.stats.rooms} salas`,
      hint: 'Criou sala para a galera',
      color: 'text-warn',
    });
  }
  if (profile.stats.friends >= 10) {
    badges.push({ icon: <Users size={14} />, label: 'Popular', hint: `${profile.stats.friends} amigos no PassTime`, color: 'text-accent' });
  }
  if (profile.stats.stickers >= 5) {
    badges.push({ icon: <Sticker size={14} />, label: 'Colecionador', hint: `${profile.stats.stickers} figurinhas próprias`, color: 'text-accent-2' });
  }
  return badges;
}

function Badges({ badges }: { badges: Badge[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.label}
          title={badge.hint}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-black/25 px-2 py-1.5 text-xs font-semibold"
        >
          <span className={badge.color}>{badge.icon}</span>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function Stats({ stats }: { stats: UserProfile['stats'] }) {
  const cells = [
    { value: stats.friends, label: stats.friends === 1 ? 'amigo' : 'amigos' },
    { value: stats.rooms, label: stats.rooms === 1 ? 'sala criada' : 'salas criadas' },
    { value: stats.stickers, label: stats.stickers === 1 ? 'figurinha' : 'figurinhas' },
  ];
  return (
    <div className="flex gap-2">
      {cells.map((cell) => (
        <div key={cell.label} className="flex-1 rounded-xl border border-line bg-black/25 px-2 py-2.5 text-center">
          <p className="font-display text-xl leading-none font-bold tabular-nums">{cell.value}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted">{cell.label}</p>
        </div>
      ))}
    </div>
  );
}

function RoomLine({ room, onJoin, highlight = false }: { room: Room; onJoin: () => void; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${highlight ? 'border-accent/40 bg-accent-soft' : 'border-line bg-black/25'}`}>
      <RoomIcon name={room.name} cover={room.cover} image={room.iconImage} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{room.name}</p>
        <p className="truncate text-[11px] text-muted">
          {room.live.participants === 0
            ? 'Vazia agora'
            : `${room.live.participants} ${room.live.participants === 1 ? 'pessoa' : 'pessoas'}${room.live.streaming ? ' · transmitindo' : ''}`}
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onJoin}
        title={`Entrar em ${room.name}`}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-4 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-5"
      >
        <LogIn size={13} /> Entrar
      </motion.button>
    </div>
  );
}

function MutualGrid({ mutual }: { mutual: UserProfile['mutualFriends'] }) {
  const { openFullProfile } = useUi();
  const extra = mutual.total - mutual.users.length;
  return (
    <>
      <div className="grid grid-cols-5 gap-1">
        {mutual.users.map((friend) => (
          <button
            key={friend.id}
            onClick={() => openFullProfile(friend)}
            title={displayName(friend)}
            className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition hover:bg-surface-4"
          >
            <Avatar nick={friend.nick} avatar={friend.avatar} image={friend.avatarImage} size={38} />
            <span className="w-full truncate text-center text-[11px] leading-tight text-muted">{displayName(friend)}</span>
          </button>
        ))}
      </div>
      {extra > 0 && <p className="mt-1.5 text-center text-[11px] text-faint">e mais {extra}</p>}
    </>
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
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </motion.button>
  );
}

function SmallAction({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
        danger ? 'text-muted hover:bg-danger/15 hover:text-danger' : 'text-muted hover:bg-surface-4 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Content({ seed, close }: { seed: PublicUser; close: () => void }) {
  const actions = useUserActions(seed);
  const { relationship, friend } = actions;
  const { openUserMenu } = useUi();
  const { joinRoom } = useCall();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ profile: UserProfile; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = peekProfile(seed.id);
    if (cached) {
      setLoaded({ profile: cached, at: Date.now() });
      listeningStore.prime(cached.user.id, cached.listening);
    }
    const load = (force = false) =>
      fetchProfile(seed.id, { force }).then(
        (profile) => {
          if (cancelled) return;
          setLoaded({ profile, at: Date.now() });
          listeningStore.prime(profile.user.id, profile.listening);
        },
        () => undefined,
      );
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [seed.id, relationship]);

  const profile = loaded?.profile ?? null;
  const user = profile?.user ?? seed;
  const blocked = relationship === 'blocked';
  const presence = blocked
    ? undefined
    : relationship === 'friend'
      ? (friend?.presence ?? profile?.presence ?? undefined)
      : (profile?.presence ?? undefined);
  const badges = profile ? badgesOf(profile) : [];
  const since = dateLabel(profile?.since ?? null);
  const created = dateLabel(user.createdAt);
  const current = profile?.rooms.current ?? null;
  const promoted = blocked ? null : (profile?.rooms.promoted ?? null);
  const owned = (profile?.rooms.owned ?? []).filter((room) => room.id !== current?.id && room.id !== promoted?.id);
  // O que chega pelo socket é mais novo que o perfil carregado, então manda na tela.
  const live = useListening(user.id);
  const listening = live ?? (blocked ? null : profile?.listening ?? null);

  // Duas colunas só quando há o que pôr na segunda, senão sobraria metade do cartão vazia.
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];

  if (user.bio) {
    left.push(
      <Section key="bio" title="Sobre mim">
        <div className="relative overflow-hidden rounded-xl border border-line bg-black/25 p-3">
          <Quote size={38} className="absolute -top-1 -right-1 text-white/5" />
          <p className="relative text-sm whitespace-pre-wrap break-words">{user.bio}</p>
        </div>
      </Section>,
    );
  }
  if (badges.length > 0) {
    left.push(
      <Section key="badges" title="Insígnias" count={badges.length}>
        <Badges badges={badges} />
      </Section>,
    );
  }
  left.push(
    <Section key="timeline" title="Linha do tempo">
      <div className="space-y-1.5 text-xs text-muted">
        {created && (
          <p className="flex items-center gap-2">
            <CalendarDays size={13} className="shrink-0 text-faint" /> No PassTime desde {created}
          </p>
        )}
        {since && (
          <p className="flex items-center gap-2">
            <UserPlus size={13} className="shrink-0 text-faint" /> Amigos desde {since}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Hash size={13} className="shrink-0 text-faint" /> ID {user.id}
        </p>
      </div>
    </Section>,
  );

  if (listening || profile?.spotify) {
    const room = listening?.roomId && listening.roomName ? { id: listening.roomId, name: listening.roomName } : null;
    right.push(
      <Section key="spotify" title="No Spotify">
        <div className="space-y-2">
          {listening ? (
            <NowPlayingCard listening={listening} onJoin={room ? () => joinRoom(room) : undefined} />
          ) : profile?.spotify ? (
            <SpotifyAccountCard name={profile.spotify.name} premium={profile.spotify.premium} />
          ) : null}
        </div>
      </Section>,
    );
  }
  if (promoted) {
    right.push(
      <Section key="promo" title="Sala divulgada">
        <RoomPromo room={promoted} />
      </Section>,
    );
  }
  if (current || owned.length > 0) {
    right.push(
      <Section key="rooms" title="Salas">
        <div className="space-y-1.5">
          {current && <RoomLine highlight room={current} onJoin={() => joinRoom({ id: current.id, name: current.name })} />}
          {owned.map((room) => (
            <RoomLine key={room.id} room={room} onJoin={() => joinRoom({ id: room.id, name: room.name })} />
          ))}
        </div>
      </Section>,
    );
  }
  if (profile && profile.mutualFriends.total > 0) {
    right.push(
      <Section key="mutual" title="Amigos em comum" count={profile.mutualFriends.total}>
        <MutualGrid mutual={profile.mutualFriends} />
      </Section>,
    );
  }

  return (
    <>
      <div className="relative h-36 shrink-0 overflow-hidden" style={{ background: coverBackground(user.banner, user.bannerImage) }}>
        {!user.bannerImage && (
          <>
            <motion.div
              className="soft-glow absolute -top-24 right-2 h-68 w-68 bg-white/25"
              animate={{ x: [0, -28, 0], y: [0, 14, 0] }}
              transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
            />
            <motion.div
              className="soft-glow absolute -bottom-24 left-16 h-60 w-60 bg-black/25"
              animate={{ x: [0, 24, 0], y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
            />
          </>
        )}
        <motion.span
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 -skew-x-12 bg-linear-to-r from-transparent via-white/25 to-transparent"
          animate={{ x: ['0%', '500%'] }}
          transition={{ repeat: Infinity, duration: 2.4, repeatDelay: 5, ease: 'easeInOut' }}
        />
        <span className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-surface-2 to-transparent" />
        <button
          onClick={close}
          aria-label="Fechar perfil"
          title="Fechar perfil"
          className="absolute top-3 right-3 rounded-lg bg-black/45 p-1.5 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* `relative` mantém o avatar acima do banner, que é um elemento posicionado. */}
      <div className="relative flex flex-wrap items-end gap-x-4 gap-y-3 px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="-mt-14 rounded-full p-1.5"
          style={{ background: 'var(--color-bg)', boxShadow: '0 0 0 1px rgba(255,255,255,.07), 0 4px 14px rgba(0,0,0,.45)' }}
        >
          <Avatar nick={user.nick} avatar={user.avatar} image={user.avatarImage} size={96} status={presence} statusBg="var(--color-bg)" />
        </motion.div>

        <div className="min-w-0 flex-1 pb-1">
          <h3 className="font-display text-2xl leading-tight font-semibold break-words">{displayName(user)}</h3>
          <p className="text-sm text-muted">
            @{user.nick}
            {user.pronouns && <span className="text-faint"> · {user.pronouns}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presence && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-muted">
                <span className={`h-2 w-2 rounded-full ${PRESENCE_COLOR[presence]}`} />
                {presenceLabel(presence)}
              </span>
            )}
            {/* A música passa na frente da sala, como no resto do app. */}
            {listening ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#1db954]/15 px-2.5 py-1 text-xs font-medium text-[#1db954]">
                <SpotifyLogo size={11} />
                <span className="truncate">
                  {listening.isPlaying ? 'Ouvindo' : 'Pausado'} · {listening.track.name}
                </span>
              </span>
            ) : (
              current && <span className="inline-flex items-center rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white/80">Na sala {current.name}</span>
            )}
            {user.customStatus && (
              <span className="inline-flex items-center rounded-full border border-line bg-surface-3 px-2.5 py-1 text-xs">{user.customStatus}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pb-1">
          {relationship === 'self' && (
            <ActionButton onClick={() => actions.editProfile()}>
              <Pencil size={16} /> Editar perfil
            </ActionButton>
          )}
          {relationship === 'friend' && (
            <>
              <ActionButton onClick={() => actions.message()}>
                <MessageCircle size={16} /> Mensagem
              </ActionButton>
              <ActionButton tone="success" disabled={actions.inCallWith} onClick={() => actions.call()}>
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
                <Check size={16} /> Aceitar
              </ActionButton>
              <ActionButton tone="secondary" onClick={() => void actions.decline()}>
                <X size={16} /> Recusar
              </ActionButton>
            </>
          )}
          {blocked && (
            <ActionButton tone="secondary" onClick={() => void actions.unblock()}>
              <Ban size={16} /> Desbloquear
            </ActionButton>
          )}
        </div>
      </div>

      {blocked && (
        <p className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <Ban size={14} /> Você bloqueou esta pessoa.
        </p>
      )}

      {/* Os números vão numa faixa larga: assim as duas colunas abaixo ficam com altura parecida. */}
      {profile && !blocked && (
        <div className="mt-4 px-6">
          <Stats stats={profile.stats} />
        </div>
      )}

      <div className={`mt-4 grid gap-x-6 gap-y-4 px-6 ${right.length > 0 ? 'sm:grid-cols-2' : ''}`}>
        <div className="space-y-4">{left}</div>
        {right.length > 0 && <div className="space-y-4">{right}</div>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-line px-4 py-2.5">
        <SmallAction icon={<Copy size={14} />} label="Copiar nick" onClick={actions.copyNick} />
        <SmallAction
          icon={<Hash size={14} />}
          label="Copiar ID"
          onClick={() => void navigator.clipboard?.writeText(String(user.id)).then(() => toast('ID copiado', 'success'))}
        />
        {relationship === 'friend' && <SmallAction icon={<UserMinus size={14} />} label="Remover amigo" danger onClick={actions.removeFriend} />}
        {relationship !== 'self' && !blocked && <SmallAction icon={<Ban size={14} />} label="Bloquear" danger onClick={actions.block} />}
        <SmallAction
          icon={<MoreHorizontal size={14} />}
          label="Mais opções"
          onClick={() => openUserMenu({ user, x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 + 120 })}
        />
      </div>
    </>
  );
}

/** Perfil completo em cartão centralizado, por cima do app. */
export default function ProfileModal() {
  const { fullProfile, closeFullProfile } = useUi();

  useEffect(() => {
    if (!fullProfile) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeFullProfile();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullProfile, closeFullProfile]);

  return (
    <AnimatePresence>
      {fullProfile && (
        <motion.div
          key="full-profile"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={closeFullProfile}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface-2 pb-1 shadow-2xl shadow-black/60"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Content key={fullProfile.id} seed={fullProfile} close={closeFullProfile} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
