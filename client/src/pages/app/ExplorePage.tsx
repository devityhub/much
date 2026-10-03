import { motion } from 'motion/react';
import { Compass, Megaphone, MicOff, MonitorUp, Pencil, Plus, Trash2, Video, Volume2 } from 'lucide-react';
import RoomIcon from '../../components/RoomIcon';
import SpotifyBadge, { SpotifyLogo, SPOTIFY_GREEN } from '../../components/SpotifyBadge';
import { displayName } from '../../lib/users';
import Avatar from '../../components/Avatar';
import Spinner from '../../components/Spinner';
import { Button } from '../../components/ui';
import { LiveBadge } from '../../components/room/ScreenStage';
import { useCall } from '../../context/call';
import { useRooms } from '../../context/rooms';
import { useToast } from '../../context/toast';
import { useUi, useUserTrigger } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { coverBackground } from '../../lib/theme';
import type { Room, RoomMember } from '../../lib/types';

function MemberChip({ member }: { member: RoomMember }) {
  const trigger = useUserTrigger()(member.user);
  return (
    <button
      type="button"
      {...trigger}
      className="flex items-center gap-2 rounded-lg bg-surface-3 py-1 pr-2 pl-1 text-xs transition-colors hover:bg-surface-4"
    >
      <Avatar nick={member.user.nick} avatar={member.user.avatar} image={member.user.avatarImage} size={20} />
      <span className="max-w-24 truncate text-muted">{displayName(member.user)}</span>
      {member.music && <SpotifyBadge size={12} label={`${displayName(member.user)} está tocando música do Spotify`} />}
      {member.cam && <Video size={12} className="text-muted" />}
      {member.screen && <MonitorUp size={12} className="text-accent" />}
      {!member.mic && <MicOff size={12} className="text-danger/80" />}
    </button>
  );
}

function RoomCard({ room }: { room: Room }) {
  const { active, joinRoom } = useCall();
  const { deleteRoom, updateRoom } = useRooms();
  const { setEditingRoom } = useUi();
  const trigger = useUserTrigger();
  const { user } = useAuth();
  const toast = useToast();
  const current = active?.roomId === room.id;
  const full = room.live.participants >= room.maxParticipants;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-lg shadow-black/20 transition hover:-translate-y-1 hover:border-white/10">
      <div className="relative h-32 overflow-hidden" style={{ background: coverBackground(room.cover, room.coverImage) }}>
        {!room.coverImage && <div className="soft-glow absolute -top-16 -right-16 h-52 w-52 bg-white/15" />}
        <div className="absolute inset-0 bg-linear-to-t from-surface-1 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          {room.live.streaming && <LiveBadge />}
          {room.live.members.some((m) => m.music) && (
            <span className="flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-bold backdrop-blur" style={{ color: SPOTIFY_GREEN }}>
              <SpotifyLogo size={12} /> MÚSICA
            </span>
          )}
        </div>
        {user?.id === room.owner.id && (
          <div className={`absolute top-3 right-3 flex gap-1.5 transition group-hover:opacity-100 ${room.promoted ? '' : 'opacity-0'}`}>
            <button
              onClick={() => void updateRoom(room.id, { promoted: !room.promoted }).catch((err: Error) => toast(err.message, 'error'))}
              className={`rounded-lg p-1.5 backdrop-blur ${room.promoted ? 'bg-accent text-white' : 'bg-black/40 hover:bg-black/70'}`}
              aria-label={room.promoted ? 'Parar de divulgar no perfil' : 'Divulgar no meu perfil'}
              title={room.promoted ? 'Parar de divulgar no perfil' : 'Divulgar no meu perfil'}
            >
              <Megaphone size={15} />
            </button>
            <button
              onClick={() => setEditingRoom(room)}
              className="rounded-lg bg-black/40 p-1.5 backdrop-blur hover:bg-black/70"
              aria-label="Editar sala"
              title="Editar sala"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Apagar a sala ${room.name}?`)) void deleteRoom(room.id).catch((err: Error) => toast(err.message, 'error'));
              }}
              className="rounded-lg bg-black/40 p-1.5 backdrop-blur hover:bg-danger"
              aria-label="Apagar sala"
              title="Apagar sala"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      <div className="relative px-4 pb-4">
        <div className="-mt-8 mb-2 inline-block rounded-[22px] bg-surface-1 p-1">
          <RoomIcon name={room.name} cover={room.cover} image={room.iconImage} size={56} />
        </div>
        <h3 className="truncate font-display text-lg font-semibold">{room.name}</h3>
        <p className="text-xs text-muted">
          criada por{' '}
          <button {...trigger(room.owner)} className="font-medium text-white/80 hover:text-white hover:underline">
            {displayName(room.owner)}
          </button>
        </p>
        {room.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{room.description}</p>}
        <div className="mt-3 flex min-h-[28px] flex-wrap gap-1.5">
          {room.live.members.map((m) => (
            <MemberChip key={m.socketId} member={m} />
          ))}
          {!room.live.members.length && <span className="self-center text-xs text-faint">Ninguém aqui ainda</span>}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted">
            {room.live.participants}/{room.maxParticipants} pessoas
          </span>
          <Button size="sm" variant={current ? 'success' : 'secondary'} disabled={full && !current} onClick={() => joinRoom(room)}>
            <Volume2 size={15} /> {current ? 'Conectado' : full ? 'Cheia' : 'Entrar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { rooms, loading } = useRooms();
  const { setCreateRoomOpen } = useUi();
  const { user } = useAuth();
  const liveCount = rooms.filter((r) => r.live.streaming).length;

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex h-14 items-center gap-2 border-b border-line px-5">
        <Compass size={20} className="text-muted" />
        <span className="font-semibold">Explorar salas</span>
      </header>

      <div className="p-6">
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-line bg-surface-1 p-8">
          <div className="blob -top-40 -left-32 h-[26rem] w-[26rem] bg-accent" />
          <div className="blob -right-32 -bottom-44 h-[28rem] w-[28rem] bg-accent-2" style={{ animationDelay: '-6s' }} />
          <div className="grain" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold text-accent">
                Olá, {user?.nick}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-1 font-display text-3xl font-bold md:text-4xl"
              >
                Entre numa sala e <span className="text-gradient">transmita junto</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-2 text-muted">
                {rooms.length} salas · {liveCount} ao vivo agora
              </motion.p>
            </div>
            <Button size="lg" onClick={() => setCreateRoomOpen(true)}>
              <Plus size={18} /> Criar sala
            </Button>
          </div>
        </section>

        {loading && !rooms.length ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : rooms.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-muted">Nenhuma sala ainda. Crie a primeira!</div>
        )}
      </div>
    </div>
  );
}
