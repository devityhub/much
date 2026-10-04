import { motion } from 'motion/react';
import { LogIn, Megaphone, Users } from 'lucide-react';
import CoverPhoto from '../CoverPhoto';
import RoomIcon from '../RoomIcon';
import { LiveBadge } from './ScreenStage';
import { SpotifyLogo, SPOTIFY_GREEN } from '../SpotifyBadge';
import { useCall } from '../../context/call';
import type { Room } from '../../lib/types';

/** A propaganda da sala no perfil do dono: banner, ícone, nome, descrição e um atalho para entrar. */
export default function RoomPromo({ room, ring = 'var(--color-surface-2)' }: { room: Room; ring?: string }) {
  const { active, joinRoom } = useCall();
  const inside = active?.roomId === room.id;
  const music = room.live.members.some((m) => m.music);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-black/25">
      <CoverPhoto cover={room.cover} image={room.coverImage} className="h-20">
        {!room.coverImage && (
          <motion.div
            className="soft-glow absolute -top-14 -right-12 h-40 w-40 bg-white/20"
            animate={{ x: [0, -16, 0], y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
          />
        )}
        <span className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute top-2 left-2 flex gap-1.5">
          {room.live.streaming && <LiveBadge small />}
          {music && (
            <span className="flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-px text-[9px] font-bold backdrop-blur" style={{ color: SPOTIFY_GREEN }}>
              <SpotifyLogo size={9} /> MÚSICA
            </span>
          )}
        </span>
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/90 uppercase backdrop-blur">
          <Megaphone size={10} /> divulgando
        </span>
      </CoverPhoto>

      {/* `relative` tira o conteúdo de baixo do banner, que é posicionado e cobriria o ícone. */}
      <div className="relative px-3 pb-3">
        <div className="-mt-7 mb-1.5 inline-block rounded-[18px] p-1" style={{ background: ring }}>
          <RoomIcon name={room.name} cover={room.cover} image={room.iconImage} size={46} />
        </div>
        <p className="truncate font-display text-base leading-tight font-semibold">{room.name}</p>
        {room.description && <p className="mt-1 line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap text-muted">{room.description}</p>}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <Users size={12} />
            {room.live.participants ? `${room.live.participants} online agora` : 'Vazia agora'}
          </span>
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={inside}
            onClick={() => joinRoom(room)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-4 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-5 disabled:opacity-50 disabled:hover:bg-surface-4"
          >
            <LogIn size={13} /> {inside ? 'Você está aqui' : 'Entrar'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
