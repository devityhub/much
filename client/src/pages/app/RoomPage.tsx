import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Volume2 } from 'lucide-react';
import Avatar from '../../components/Avatar';
import Spinner from '../../components/Spinner';
import { Button } from '../../components/ui';
import CallView from '../../components/room/CallView';
import { useCall } from '../../context/call';
import { useRooms } from '../../context/rooms';
import { useUserTrigger } from '../../context/ui';
import { displayName } from '../../lib/users';
import RoomIcon from '../../components/RoomIcon';
import SpotifyBadge from '../../components/SpotifyBadge';
import { coverBackground } from '../../lib/theme';

export default function RoomPage() {
  const { roomId = '' } = useParams();
  const { active, joinRoom } = useCall();
  const { rooms, loading } = useRooms();
  const trigger = useUserTrigger();

  if (active?.roomId === roomId) return <CallView />;

  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <p>Essa sala não existe mais.</p>
            <Link to="/app/explore" className="font-semibold text-accent hover:underline">
              Ver outras salas
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="absolute inset-0 scale-110 opacity-25 blur-3xl" style={{ background: coverBackground(room.cover, room.coverImage) }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface-1/95 text-center"
      >
        <div className="h-28" style={{ background: coverBackground(room.cover, room.coverImage) }} />
        <div className="px-8 pb-8">
          <div className="-mt-12 mb-4 inline-block rounded-[30px] bg-surface-1 p-1.5">
            <RoomIcon name={room.name} cover={room.cover} image={room.iconImage} size={84} />
          </div>
          <h1 className="font-display text-2xl font-semibold">{room.name}</h1>
          {room.description && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted">{room.description}</p>}
          <p className="mt-1 text-sm text-muted">
            {room.live.participants ? `${room.live.participants} pessoa(s) conversando` : 'Ninguém aqui ainda'}
          </p>
          <div className="my-6 flex justify-center -space-x-2">
            {room.live.members.map((m) => (
              <button key={m.socketId} {...trigger(m.user)} title={displayName(m.user)} className="relative rounded-full transition hover:z-10 hover:-translate-y-1">
                <Avatar nick={m.user.nick} avatar={m.user.avatar} image={m.user.avatarImage} size={40} className="rounded-full ring-4 ring-surface-1" />
                {m.music && <SpotifyBadge size={15} className="absolute -right-0.5 -bottom-0.5" label={`${displayName(m.user)} está tocando música do Spotify`} />}
              </button>
            ))}
          </div>
          <Button size="lg" className="w-full" onClick={() => joinRoom(room)}>
            <Volume2 size={18} /> Entrar na sala
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
