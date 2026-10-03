import Avatar from './Avatar';
import type { Group } from '../lib/types';

interface GroupIconProps {
  group: Pick<Group, 'iconImage' | 'members'>;
  meId: number | undefined;
  size?: number;
  /** Cor do fundo atrás do ícone, para o recorte entre os dois avatares. */
  ring?: string;
}

/** Ícone escolhido para o grupo ou, sem ele, dois membros sobrepostos como no Discord. */
export default function GroupIcon({ group, meId, size = 32, ring = 'var(--color-surface-1)' }: GroupIconProps) {
  if (group.iconImage) {
    return <img src={group.iconImage} alt="" draggable={false} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const others = group.members.filter((m) => m.id !== meId);
  const [a, b] = others.length >= 2 ? others : group.members;
  if (!a) return <span className="block shrink-0 rounded-full bg-surface-4" style={{ width: size, height: size }} />;
  if (!b) return <Avatar nick={a.nick} avatar={a.avatar} image={a.avatarImage} size={size} />;
  const small = Math.round(size * 0.7);
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <Avatar nick={a.nick} avatar={a.avatar} image={a.avatarImage} size={small} className="absolute top-0 left-0" />
      <span className="absolute right-0 bottom-0 rounded-full" style={{ boxShadow: `0 0 0 2px ${ring}` }}>
        <Avatar nick={b.nick} avatar={b.avatar} image={b.avatarImage} size={small} />
      </span>
    </span>
  );
}
