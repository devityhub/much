import { useMemo, type ReactNode } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Compass, Inbox, Phone, Users, Volume2 } from 'lucide-react';
import Avatar from '../Avatar';
import GroupIcon from '../GroupIcon';
import Logo from '../Logo';
import VoicePanel from './VoicePanel';
import UserPanel from './UserPanel';
import { useCall } from '../../context/call';
import { useDms } from '../../context/dms';
import { useFriends } from '../../context/friends';
import { useGroups } from '../../context/groups';
import { useRooms } from '../../context/rooms';
import { useUserTrigger } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { groupName, lastGroupPreview } from '../../lib/groups';
import { useListeningName } from '../../lib/listening';
import { displayName, presenceLabel } from '../../lib/users';
import type { DmMessage, Friend, Group } from '../../lib/types';

function NavItem({ to, icon, label, badge, live }: { to: string; icon: ReactNode; label: string; badge?: number; live?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
          isActive ? 'text-white' : 'text-muted hover:bg-surface-3 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-surface-4" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
          )}
          <span className="relative">{icon}</span>
          <span className="relative flex-1">{label}</span>
          {Boolean(live) && (
            <span className="relative flex items-center gap-1 rounded-md bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold text-danger uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              {live} ao vivo
            </span>
          )}
          {Boolean(badge) && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white"
            >
              {badge}
            </motion.span>
          )}
        </>
      )}
    </NavLink>
  );
}

/** A música do Spotify passa na frente da sala e do status escrito. */
function activityLabel(friend: Friend, song: string | null) {
  if (song) return `Ouvindo ${song}`;
  if (friend.online && friend.activity?.type === 'room') return `Em ${friend.activity.roomName}`;
  if (friend.online && friend.activity?.type === 'call') return 'Em uma chamada';
  if (friend.online && friend.user.customStatus) return friend.user.customStatus;
  return presenceLabel(friend.presence);
}

function lastMessagePreview(message: DmMessage, meId: number | undefined) {
  if (message.kind === 'call') {
    if (message.callDuration !== null) return 'Chamada de voz';
    return message.senderId === meId ? 'Ninguém atendeu' : 'Chamada perdida';
  }
  const mine = message.senderId === meId ? 'Você: ' : '';
  if (message.kind === 'sticker') return `${mine}figurinha`;
  return `${mine}${message.content.replace(/\s+/g, ' ')}`;
}

function FriendRow({ friend }: { friend: Friend }) {
  const { active, callFriend } = useCall();
  const { conversations, typing } = useDms();
  const { user } = useAuth();
  const navigate = useNavigate();
  const trigger = useUserTrigger()(friend.user);
  const song = useListeningName(friend);
  const inCallWith = active?.kind === 'private' && active.friend?.id === friend.user.id;
  const viewing = useMatch('/app/dm/:friendId')?.params.friendId === String(friend.user.id);
  const conversation = conversations[friend.user.id];
  const unread = conversation?.unread ?? 0;
  const subtitle = typing[friend.user.id]
    ? 'digitando...'
    : unread && conversation
      ? lastMessagePreview(conversation.lastMessage, user?.id)
      : activityLabel(friend, song);

  return (
    <motion.div
      layout
      className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
        inCallWith || viewing ? 'bg-surface-4' : 'hover:bg-surface-3'
      } ${friend.online || unread || viewing ? '' : 'opacity-50 hover:opacity-100'}`}
    >
      <button
        onClick={() => navigate(`/app/dm/${friend.user.id}`)}
        onContextMenu={trigger.onContextMenu}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <Avatar nick={friend.user.nick} avatar={friend.user.avatar} image={friend.user.avatarImage} size={32} status={friend.presence} statusBg="var(--color-surface-1)" />
        <span className="min-w-0">
          <span className={`block truncate text-[15px] ${unread ? 'font-bold text-white' : 'font-medium'}`}>{displayName(friend.user)}</span>
          <span className={`block truncate text-xs ${unread ? 'text-white/70' : typing[friend.user.id] ? 'text-ok' : 'text-faint'}`}>{subtitle}</span>
        </span>
      </button>
      {unread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white group-hover:hidden"
        >
          {unread > 99 ? '99+' : unread}
        </motion.span>
      )}
      {!inCallWith && (
        <button
          onClick={() => void callFriend(friend.user)}
          className="hidden rounded-full p-1.5 text-muted transition group-hover:block hover:bg-ok/20 hover:text-ok"
          title={friend.online ? `Ligar para ${displayName(friend.user)}` : `Ligar para ${displayName(friend.user)} (toca quando entrar no Much)`}
          aria-label={`Ligar para ${displayName(friend.user)}`}
        >
          <Phone size={16} />
        </button>
      )}
    </motion.div>
  );
}

function GroupRow({ group }: { group: Group }) {
  const { active, callGroup } = useCall();
  const { typing, people } = useGroups();
  const { user } = useAuth();
  const navigate = useNavigate();
  const viewing = useMatch('/app/group/:groupId')?.params.groupId === String(group.id);
  const inCall = active?.kind === 'group' && active.group?.id === group.id;
  const name = groupName(group, user?.id);
  const authorOf = (id: number) => group.members.find((m) => m.id === id) ?? people[id];
  const typers = (typing[group.id] ?? []).map((id) => authorOf(id)).filter(Boolean);
  const live = group.callMembers.length > 0;
  const subtitle = typers.length
    ? typers.length === 1
      ? `${displayName(typers[0]!)} está digitando...`
      : 'Várias pessoas digitando...'
    : group.unread && group.lastMessage
      ? lastGroupPreview(group.lastMessage, authorOf, user?.id)
      : live
        ? `Chamada em andamento · ${group.callMembers.length}`
        : `${group.members.length} membros`;

  return (
    <motion.div
      layout
      className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${inCall || viewing ? 'bg-surface-4' : 'hover:bg-surface-3'}`}
    >
      <button onClick={() => navigate(`/app/group/${group.id}`)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <GroupIcon group={group} meId={user?.id} size={32} ring={inCall || viewing ? 'var(--color-surface-4)' : 'var(--color-surface-1)'} />
        <span className="min-w-0">
          <span className={`block truncate text-[15px] ${group.unread ? 'font-bold text-white' : 'font-medium'}`}>{name}</span>
          <span className={`flex items-center gap-1 truncate text-xs ${group.unread ? 'text-white/70' : typers.length || live ? 'text-ok' : 'text-faint'}`}>
            {live && !typers.length && !group.unread && <Volume2 size={12} className="shrink-0" />}
            <span className="truncate">{subtitle}</span>
          </span>
        </span>
      </button>
      {group.unread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white group-hover:hidden"
        >
          {group.unread > 99 ? '99+' : group.unread}
        </motion.span>
      )}
      {!inCall && (
        <button
          onClick={() => void callGroup({ id: group.id, name })}
          className="hidden rounded-full p-1.5 text-muted transition group-hover:block hover:bg-ok/20 hover:text-ok"
          title={live ? `Entrar na chamada de ${name}` : `Ligar para ${name}`}
          aria-label={live ? `Entrar na chamada de ${name}` : `Ligar para ${name}`}
        >
          <Phone size={16} />
        </button>
      )}
    </motion.div>
  );
}

type DirectRow = { kind: 'friend'; friend: Friend } | { kind: 'group'; group: Group };

export default function Sidebar() {
  const { rooms } = useRooms();
  const { friends, incoming } = useFriends();
  const { conversations, messageRequests } = useDms();
  const { groups } = useGroups();
  const liveRooms = rooms.filter((r) => r.live.streaming).length;
  const requestBadge = messageRequests.length;

  // Não lidas primeiro, depois a conversa mais recente (DM ou grupo), depois quem está online.
  const rows = useMemo(() => {
    const list: DirectRow[] = [
      ...friends.map((friend) => ({ kind: 'friend' as const, friend })),
      ...Object.values(groups).map((group) => ({ kind: 'group' as const, group })),
    ];
    const unread = (r: DirectRow) => Number((r.kind === 'group' ? r.group.unread : (conversations[r.friend.user.id]?.unread ?? 0)) > 0);
    const lastAt = (r: DirectRow) =>
      r.kind === 'group' ? (r.group.lastMessage?.createdAt ?? r.group.createdAt) : (conversations[r.friend.user.id]?.lastMessage.createdAt ?? 0);
    const online = (r: DirectRow) => Number(r.kind === 'group' || r.friend.online);
    const name = (r: DirectRow) => (r.kind === 'group' ? r.group.name : displayName(r.friend.user));
    return list.sort((a, b) => unread(b) - unread(a) || lastAt(b) - lastAt(a) || online(b) - online(a) || name(a).localeCompare(name(b)));
  }, [friends, groups, conversations]);
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface-1">
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <Logo to="/app" size={28} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <nav className="space-y-0.5">
          <NavItem to="/app/friends" icon={<Users size={19} />} label="Amigos" badge={incoming.length} />
          <NavItem
            to="/app/message-requests"
            icon={<Inbox size={19} />}
            label="Solicitações de mensagens"
            badge={requestBadge}
          />
          <NavItem to="/app/explore" icon={<Compass size={19} />} label="Explorar salas" live={liveRooms} />
        </nav>

        <div className="mt-5 mb-1 flex items-center justify-between px-2">
          <span className="text-[11px] font-bold tracking-wider text-faint uppercase">Mensagens diretas</span>
          {friends.length > 0 && <span className="text-[11px] text-faint">{onlineCount} online</span>}
        </div>
        <div className="space-y-0.5">
          {rows.map((row) =>
            row.kind === 'group' ? <GroupRow key={`g${row.group.id}`} group={row.group} /> : <FriendRow key={`f${row.friend.id}`} friend={row.friend} />,
          )}
          {!rows.length && (
            <NavLink to="/app/friends?tab=add" className="block rounded-lg border border-dashed border-line px-3 py-3 text-center text-sm text-faint hover:text-white">
              Adicione amigos para conversar
            </NavLink>
          )}
        </div>
      </div>

      <VoicePanel />
      <UserPanel />
    </aside>
  );
}
