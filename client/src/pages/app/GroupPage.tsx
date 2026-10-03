import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Crown, Image as ImageIcon, LogOut, Pencil, Phone, PhoneMissed, UserMinus, UserPlus, Users, Video, Volume2 } from 'lucide-react';
import Avatar from '../../components/Avatar';
import GroupIcon from '../../components/GroupIcon';
import Spinner from '../../components/Spinner';
import AddPeopleButton from '../../components/chat/AddPeopleButton';
import ChatView, { EventLine, formatCallDuration, type Jump } from '../../components/chat/ChatView';
import { HeaderIcon, PinsButton, SearchBox, type ChatSource } from '../../components/chat/ChatTools';
import { GROUP_ICON_CROP, useImagePicker } from '../../components/media/ImagePicker';
import CallView from '../../components/room/CallView';
import { Button } from '../../components/ui';
import { useCall } from '../../context/call';
import { useFriends } from '../../context/friends';
import { useGroups } from '../../context/groups';
import { useUserTrigger } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { MAX_GROUP_MEMBERS, groupName, parseSystemEvent, systemAction } from '../../lib/groups';
import type { Group, GroupMessage, GroupSystemEvent, PublicUser, VisiblePresence } from '../../lib/types';
import { displayName } from '../../lib/users';

const EMPTY_THREAD = { messages: [] as GroupMessage[], hasMore: false, loading: true, loaded: false };

/** O painel de membros segue aberto ou fechado de um grupo para outro. */
const MEMBERS_KEY = 'much.groupMembers';

const unknownUser = (id: number): PublicUser => ({ id, nick: 'alguém', avatar: 'violet', displayName: 'Alguém' });

/** Autores de mensagens: membros atuais, quem já saiu (cache do contexto) e, por último, um "Alguém". */
function useAuthorOf(group: Group) {
  const { people } = useGroups();
  return (id: number) => group.members.find((m) => m.id === id) ?? people[id] ?? unknownUser(id);
}

function GroupNameEditor({ group, meId }: { group: Group; meId: number }) {
  const { updateGroup } = useGroups();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const shown = groupName(group, meId);

  const save = () => {
    setEditing(false);
    const name = draft.trim();
    if (name !== group.name) void updateGroup(group.id, { name }).catch(() => undefined);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder={groupName({ ...group, name: '' }, meId)}
        className="w-full max-w-sm rounded-md border border-white/20 bg-bg px-2 py-0.5 leading-tight font-semibold outline-none placeholder:font-normal placeholder:text-faint"
      />
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(group.name);
        setEditing(true);
      }}
      className="group/name flex max-w-full items-center gap-1.5 rounded-md px-1 text-left hover:bg-surface-3"
      title="Mudar o nome do grupo"
    >
      <span className="truncate leading-tight font-semibold">{shown}</span>
      <Pencil size={12} className="shrink-0 text-faint opacity-0 group-hover/name:opacity-100" />
    </button>
  );
}

function GroupHeader({
  group,
  meId,
  membersOpen,
  onToggleMembers,
  onJump,
}: {
  group: Group;
  meId: number;
  membersOpen: boolean;
  onToggleMembers: () => void;
  onJump: (id: number) => void;
}) {
  const { callGroup } = useCall();
  const { pin, updateGroup, addMembers } = useGroups();
  const authorOf = useAuthorOf(group);
  const picker = useImagePicker(GROUP_ICON_CROP, (url) => void updateGroup(group.id, { iconImage: url }).catch(() => undefined));
  const name = groupName(group, meId);
  const callTarget = { id: group.id, name };
  const source: ChatSource = {
    path: `/groups/${group.id}`,
    name,
    authorOf,
    unpin: (messageId) => void pin(group.id, messageId, false),
    events: ['group:pinned', 'group:deleted'],
    isMine: ({ groupId }) => groupId === group.id,
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
      {picker.element}
      <button
        onClick={picker.open}
        disabled={picker.uploading}
        className="group/icon relative shrink-0 rounded-full"
        title="Mudar o ícone do grupo"
        aria-label="Mudar o ícone do grupo"
      >
        <GroupIcon group={group} meId={meId} size={30} ring="var(--color-bg)" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition group-hover/icon:opacity-100">
          {picker.uploading ? <Spinner /> : <Camera size={14} />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <GroupNameEditor group={group} meId={meId} />
        <p className="truncate px-1 text-xs text-faint">{group.members.length} membros</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <HeaderIcon label="Começar chamada de voz" onClick={() => void callGroup(callTarget)}>
          <Phone size={19} />
        </HeaderIcon>
        <HeaderIcon label="Começar chamada de vídeo" onClick={() => void callGroup(callTarget, { video: true })}>
          <Video size={20} />
        </HeaderIcon>
        <PinsButton source={source} onJump={onJump} />
        <AddPeopleButton
          excludeIds={group.members.map((m) => m.id)}
          slots={MAX_GROUP_MEMBERS - group.members.length}
          title="Adicionar amigos ao grupo"
          confirmLabel="Adicionar ao grupo"
          onConfirm={(ids) => addMembers(group.id, ids)}
        />
        <HeaderIcon label={membersOpen ? 'Esconder os membros' : 'Mostrar os membros'} active={membersOpen} onClick={onToggleMembers}>
          <Users size={19} />
        </HeaderIcon>
        <span className="ml-1.5">
          <SearchBox source={source} onJump={onJump} />
        </span>
      </div>
    </header>
  );
}

/** Faixa que aparece quando a chamada do grupo já está rolando e você não entrou. */
function CallBanner({ group, meId }: { group: Group; meId: number }) {
  const { callGroup } = useCall();
  const inCall = group.members.filter((m) => group.callMembers.includes(m.id));
  const count = group.callMembers.length;
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="shrink-0 overflow-hidden border-b border-line bg-ok/[0.07]"
    >
      <div className="flex items-center gap-3 px-5 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ok/20 text-ok">
          <Volume2 size={14} />
        </span>
        <span className="text-sm">
          <span className="font-semibold text-ok">Chamada em andamento</span>
          <span className="text-muted"> · {count === 1 ? '1 pessoa' : `${count} pessoas`}</span>
        </span>
        <span className="flex -space-x-1.5">
          {inCall.slice(0, 5).map((m) => (
            <span key={m.id} className="rounded-full" style={{ boxShadow: '0 0 0 2px var(--color-bg)' }}>
              <Avatar nick={m.nick} avatar={m.avatar} image={m.avatarImage} size={22} />
            </span>
          ))}
        </span>
        <Button size="sm" variant="success" className="ml-auto" onClick={() => void callGroup({ id: group.id, name: groupName(group, meId) })}>
          <Phone size={14} /> Entrar
        </Button>
      </div>
    </motion.div>
  );
}

const SYSTEM_ICONS: Record<GroupSystemEvent['type'], ReactNode> = {
  create: <Users size={15} />,
  add: <UserPlus size={15} />,
  remove: <UserMinus size={15} />,
  leave: <LogOut size={15} />,
  rename: <Pencil size={14} />,
  icon: <ImageIcon size={15} />,
  owner: <Crown size={15} />,
};

function SystemLine({ message, author }: { message: GroupMessage; author: PublicUser }) {
  const event = parseSystemEvent(message);
  const tone = event?.type === 'add' || event?.type === 'create' ? 'ok' : event?.type === 'remove' || event?.type === 'leave' ? 'danger' : 'muted';
  return (
    <EventLine icon={event ? SYSTEM_ICONS[event.type] : <Users size={15} />} tone={tone} time={message.createdAt}>
      <span className="font-semibold text-white">{displayName(author)}</span> {systemAction(event)}
    </EventLine>
  );
}

function GroupCallLine({ message, author }: { message: GroupMessage; author: PublicUser }) {
  const missed = message.callDuration === null;
  return (
    <EventLine icon={missed ? <PhoneMissed size={15} /> : <Phone size={15} />} tone={missed ? 'danger' : 'ok'} time={message.createdAt}>
      <span className="font-semibold text-white">{displayName(author)}</span>{' '}
      {missed ? 'começou uma chamada, mas ninguém entrou' : `começou uma chamada que durou ${formatCallDuration(message.callDuration!)}`}
    </EventLine>
  );
}

function GroupChat({ group, meId, jump }: { group: Group; meId: number; jump: Jump | null }) {
  const { threads, typing, openThread, loadOlder, remove, pin, loadUntil, send, notifyTyping } = useGroups();
  const authorOf = useAuthorOf(group);
  const thread = threads[group.id] ?? EMPTY_THREAD;
  const name = groupName(group, meId);

  useEffect(() => openThread(group.id), [group.id, openThread]);

  return (
    <ChatView<GroupMessage>
      convoKey={`group-${group.id}`}
      thread={thread}
      meId={meId}
      authorOf={authorOf}
      intro={
        <div className="px-5 pt-10 pb-2">
          <GroupIcon group={group} meId={meId} size={80} ring="var(--color-bg)" />
          <h2 className="mt-3 font-display text-3xl font-semibold">{name}</h2>
          <p className="mt-3 text-muted">
            Este é o começo do grupo <span className="font-semibold text-white">{name}</span>. Todo mundo aqui vê as mensagens e pode entrar na chamada
            do grupo.
          </p>
        </div>
      }
      renderEvent={(message) =>
        message.kind === 'system' ? (
          <SystemLine message={message} author={authorOf(message.senderId)} />
        ) : message.kind === 'call' ? (
          <GroupCallLine message={message} author={authorOf(message.senderId)} />
        ) : null
      }
      onLoadOlder={() => void loadOlder(group.id)}
      loadUntil={(id) => loadUntil(group.id, id)}
      onDelete={(message) => {
        if (window.confirm('Apagar esta mensagem para todo mundo do grupo?')) void remove(group.id, message.id);
      }}
      onPin={(message) => void pin(group.id, message.id, message.pinnedAt === null)}
      jump={jump}
      typingNames={(typing[group.id] ?? []).map((id) => displayName(authorOf(id)))}
      placeholder={`Conversar em ${name}`}
      onSend={(content, kind) => send(group.id, content, kind)}
      onTyping={() => notifyTyping(group.id)}
    />
  );
}

function MemberRow({ member, group, meId, presence }: { member: PublicUser; group: Group; meId: number; presence: VisiblePresence | undefined }) {
  const trigger = useUserTrigger();
  const { removeMember } = useGroups();
  const isOwner = member.id === group.ownerId;
  const canKick = group.ownerId === meId && member.id !== meId;
  const talking = group.callMembers.includes(member.id);
  return (
    <li className="group/member relative">
      <button
        {...trigger(member)}
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-3 ${presence === 'offline' ? 'opacity-50 hover:opacity-100' : ''}`}
      >
        <Avatar nick={member.nick} avatar={member.avatar} image={member.avatarImage} size={32} status={presence} statusBg="var(--color-surface-1)" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{displayName(member)}</span>
          {isOwner && (
            <span title="Dono do grupo" className="shrink-0 text-warn">
              <Crown size={13} />
            </span>
          )}
          {talking && (
            <span title="Na chamada do grupo" className="shrink-0 text-ok">
              <Volume2 size={13} />
            </span>
          )}
        </span>
      </button>
      {canKick && (
        <button
          onClick={() => {
            if (window.confirm(`Tirar ${displayName(member)} do grupo?`)) void removeMember(group.id, member.id).catch(() => undefined);
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted opacity-0 transition group-hover/member:opacity-100 hover:bg-surface-4 hover:text-danger"
          title="Tirar do grupo"
          aria-label={`Tirar ${displayName(member)} do grupo`}
        >
          <UserMinus size={15} />
        </button>
      )}
    </li>
  );
}

function MembersPanel({ group, meId }: { group: Group; meId: number }) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const { removeMember, updateGroup } = useGroups();
  const navigate = useNavigate();
  const presenceOf = (id: number): VisiblePresence | undefined => {
    if (id === meId) return user?.presence === 'invisible' ? 'offline' : user?.presence;
    return friends.find((f) => f.user.id === id)?.presence;
  };
  const rank = (p: VisiblePresence | undefined) => (p === 'offline' ? 1 : 0);
  const members = [...group.members].sort(
    (a, b) => rank(presenceOf(a.id)) - rank(presenceOf(b.id)) || Number(b.id === group.ownerId) - Number(a.id === group.ownerId) || displayName(a).localeCompare(displayName(b)),
  );

  const leave = async () => {
    const last = group.members.length === 1;
    const text = last ? 'Você é o último membro. Sair apaga o grupo e as mensagens. Continuar?' : 'Sair do grupo? Você só volta se alguém te adicionar de novo.';
    if (!window.confirm(text)) return;
    try {
      await removeMember(group.id, meId);
      navigate('/app/friends');
    } catch {
      // o contexto já mostrou o erro
    }
  };

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 240, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      className="hidden shrink-0 overflow-hidden border-l border-line bg-surface-1 md:block"
    >
      <div className="flex h-full w-60 flex-col">
        <p className="px-4 pt-5 pb-2 text-xs font-semibold tracking-wide text-faint uppercase">
          Membros — {group.members.length}/{MAX_GROUP_MEMBERS}
        </p>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} group={group} meId={meId} presence={presenceOf(member.id)} />
          ))}
        </ul>
        <div className="space-y-1 border-t border-line p-2">
          {group.iconImage && (
            <button
              onClick={() => void updateGroup(group.id, { iconImage: null }).catch(() => undefined)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-surface-3 hover:text-white"
            >
              <ImageIcon size={15} /> Tirar o ícone do grupo
            </button>
          )}
          <button
            onClick={() => void leave()}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-danger transition hover:bg-danger/10"
          >
            <LogOut size={15} /> Sair do grupo
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

export default function GroupPage() {
  const groupId = Number(useParams().groupId);
  const { user } = useAuth();
  const { groups, loaded } = useGroups();
  const { active } = useCall();
  const group = groups[groupId];
  const inCall = active?.kind === 'group' && active.group?.id === groupId;
  const [membersOpen, setMembersOpen] = useState(() => localStorage.getItem(MEMBERS_KEY) !== 'off');
  const [jump, setJump] = useState<Jump | null>(null);
  // Guarda se o grupo já existiu nesta tela: sumir depois é sinal de que você saiu ou foi tirado.
  const seen = useRef<number | null>(null);
  if (group) seen.current = groupId;

  const toggleMembers = () =>
    setMembersOpen((open) => {
      localStorage.setItem(MEMBERS_KEY, open ? 'off' : 'on');
      return !open;
    });

  if (!group || !user) {
    if (inCall) return <CallView />;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
        {!loaded ? (
          <Spinner />
        ) : (
          <>
            <p>{seen.current === groupId ? 'Você não faz mais parte deste grupo.' : 'Este grupo não existe ou você não faz parte dele.'}</p>
            <Link to="/app/friends" className="font-semibold text-accent hover:underline">
              Voltar para os amigos
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {inCall ? (
        <div className="h-[60%] min-h-[380px] shrink-0 border-b border-line">
          <CallView />
        </div>
      ) : (
        <GroupHeader
          key={group.id}
          group={group}
          meId={user.id}
          membersOpen={membersOpen}
          onToggleMembers={toggleMembers}
          onJump={(id) => setJump({ key: `group-${group.id}`, id, at: Date.now() })}
        />
      )}
      <AnimatePresence initial={false}>{!inCall && group.callMembers.length > 0 && <CallBanner group={group} meId={user.id} />}</AnimatePresence>
      <div className="flex min-h-0 flex-1">
        <GroupChat key={group.id} group={group} meId={user.id} jump={jump} />
        <AnimatePresence initial={false}>{membersOpen && !inCall && <MembersPanel key={group.id} group={group} meId={user.id} />}</AnimatePresence>
      </div>
    </div>
  );
}
