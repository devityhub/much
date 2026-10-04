import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, UserRound, Video } from 'lucide-react';
import Avatar from '../../components/Avatar';
import Spinner from '../../components/Spinner';
import AddPeopleButton from '../../components/chat/AddPeopleButton';
import ChatView, { EventLine, formatCallDuration, type Jump } from '../../components/chat/ChatView';
import { HeaderIcon, PinsButton, SearchBox, type ChatSource } from '../../components/chat/ChatTools';
import ProfileSidePanel from '../../components/profile/ProfileSidePanel';
import CallView from '../../components/room/CallView';
import { useCall } from '../../context/call';
import { useDms, type DmThread } from '../../context/dms';
import { useFriends } from '../../context/friends';
import { useGroups } from '../../context/groups';
import { useUserTrigger } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { MAX_GROUP_MEMBERS } from '../../lib/groups';
import { useListeningName } from '../../lib/listening';
import type { DmMessage, Friend, PublicUser } from '../../lib/types';
import { displayName, presenceLabel } from '../../lib/users';

const EMPTY_THREAD: DmThread = { messages: [], hasMore: false, loading: true, loaded: false };

/** A música do Spotify passa na frente da sala e do status escrito. */
function activityLabel(friend: Friend, song: string | null) {
  if (song) return `Ouvindo ${song}`;
  if (friend.online && friend.activity?.type === 'room') return `Na sala ${friend.activity.roomName}`;
  if (friend.online && friend.activity?.type === 'call') return 'Em uma chamada';
  if (friend.online && friend.user.customStatus) return friend.user.customStatus;
  return presenceLabel(friend.presence);
}

function DmHeader({
  friend,
  profileOpen,
  onToggleProfile,
  onJump,
}: {
  friend: Friend;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onJump: (id: number) => void;
}) {
  const { user } = useAuth();
  const { pin } = useDms();
  const { callFriend } = useCall();
  const { createGroup } = useGroups();
  const navigate = useNavigate();
  const trigger = useUserTrigger();
  const song = useListeningName(friend);
  const name = displayName(friend.user);
  const later = friend.online ? '' : ' (toca quando entrar no Much)';
  if (!user) return null;
  const peer = friend.user;
  const source: ChatSource = {
    path: `/dms/${peer.id}`,
    name,
    authorOf: (id) => (id === user.id ? user : peer),
    unpin: (messageId) => void pin(peer.id, messageId, false),
    events: ['dm:pinned', 'dm:deleted'],
    isMine: ({ userId }) => userId === peer.id,
  };
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
      <button {...trigger(friend.user)} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-0.5 text-left hover:bg-surface-3">
        <Avatar nick={friend.user.nick} avatar={friend.user.avatar} image={friend.user.avatarImage} size={28} status={friend.presence} statusBg="var(--color-bg)" />
        <span className="min-w-0">
          <span className="block truncate leading-tight font-semibold">{name}</span>
          <span className={`block truncate text-xs ${song ? 'text-[#1db954]' : 'text-faint'}`}>{activityLabel(friend, song)}</span>
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <HeaderIcon label={`Ligar para ${name}${later}`} onClick={() => void callFriend(friend.user)}>
          <Phone size={19} />
        </HeaderIcon>
        <HeaderIcon label={`Chamada de vídeo com ${name}${later}`} onClick={() => void callFriend(friend.user, { video: true })}>
          <Video size={20} />
        </HeaderIcon>
        <PinsButton source={source} onJump={onJump} />
        <AddPeopleButton
          excludeIds={[friend.user.id]}
          slots={MAX_GROUP_MEMBERS - 2}
          title="Adicionar amigos à DM"
          confirmLabel="Criar grupo"
          onConfirm={async (ids) => {
            const group = await createGroup([friend.user.id, ...ids]);
            navigate(`/app/group/${group.id}`);
          }}
        />
        <span className="hidden lg:block">
          <HeaderIcon label={profileOpen ? 'Esconder o perfil' : 'Mostrar o perfil'} active={profileOpen} onClick={onToggleProfile}>
            <UserRound size={19} />
          </HeaderIcon>
        </span>
        <span className="ml-1.5">
          <SearchBox source={source} onJump={onJump} />
        </span>
      </div>
    </header>
  );
}

function CallLine({ message, meId, friend }: { message: DmMessage; meId: number; friend: PublicUser }) {
  const outgoing = message.senderId === meId;
  const missed = message.callDuration === null;
  const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
  const text = missed
    ? outgoing
      ? `Você ligou para ${displayName(friend)}, mas ninguém atendeu`
      : `Chamada perdida de ${displayName(friend)}`
    : `Chamada de voz · ${formatCallDuration(message.callDuration!)}`;
  return (
    <EventLine icon={<Icon size={15} />} tone={missed ? 'danger' : 'ok'} time={message.createdAt}>
      {text}
    </EventLine>
  );
}

function DmChat({ friend, jump }: { friend: Friend; jump: Jump | null }) {
  const { user } = useAuth();
  const { threads, typing, openThread, loadOlder, remove, pin, loadUntil, send, notifyTyping } = useDms();
  const peer = friend.user;
  const thread = threads[peer.id] ?? EMPTY_THREAD;

  useEffect(() => openThread(peer.id), [peer.id, openThread]);

  if (!user) return null;
  return (
    <ChatView<DmMessage>
      convoKey={`dm-${peer.id}`}
      thread={thread}
      meId={user.id}
      authorOf={(id) => (id === user.id ? user : peer)}
      intro={
        <div className="px-5 pt-10 pb-2">
          <Avatar nick={peer.nick} avatar={peer.avatar} image={peer.avatarImage} size={80} />
          <h2 className="mt-3 font-display text-3xl font-semibold">{displayName(peer)}</h2>
          <p className="text-sm text-muted">@{peer.nick}</p>
          <p className="mt-3 text-muted">
            Este é o começo da sua conversa com <span className="font-semibold text-white">{displayName(peer)}</span>. As mensagens ficam salvas,
            então dá para escrever mesmo se a pessoa estiver offline.
          </p>
        </div>
      }
      renderEvent={(message) => (message.kind === 'call' ? <CallLine message={message} meId={user.id} friend={peer} /> : null)}
      onLoadOlder={() => void loadOlder(peer.id)}
      loadUntil={(id) => loadUntil(peer.id, id)}
      onDelete={(message) => {
        if (window.confirm('Apagar esta mensagem para os dois?')) void remove(peer.id, message.id);
      }}
      onPin={(message) => void pin(peer.id, message.id, message.pinnedAt === null)}
      jump={jump}
      typingNames={typing[peer.id] ? [displayName(peer)] : []}
      placeholder={`Conversar com @${peer.nick}`}
      onSend={(content, kind) => send(peer.id, content, kind)}
      onTyping={() => notifyTyping(peer.id)}
    />
  );
}

/** O painel lateral segue aberto ou fechado de uma conversa para outra. */
const PANEL_KEY = 'much.dmProfile';

export default function DmPage() {
  const friendId = Number(useParams().friendId);
  const { active } = useCall();
  const { friends, loading } = useFriends();
  const friend = friends.find((f) => f.user.id === friendId);
  const inCall = active?.kind === 'private' && active.friend?.id === friendId;
  const [profileOpen, setProfileOpen] = useState(() => localStorage.getItem(PANEL_KEY) !== 'off');
  const [jump, setJump] = useState<Jump | null>(null);

  const toggleProfile = () =>
    setProfileOpen((open) => {
      localStorage.setItem(PANEL_KEY, open ? 'off' : 'on');
      return !open;
    });

  if (!friend) {
    if (inCall) return <CallView />;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <p>Vocês não são amigos no Much.</p>
            <Link to="/app/friends?tab=add" className="font-semibold text-accent hover:underline">
              Adicionar amigo
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
        <DmHeader
          key={friend.user.id}
          friend={friend}
          profileOpen={profileOpen}
          onToggleProfile={toggleProfile}
          onJump={(id) => setJump({ key: `dm-${friend.user.id}`, id, at: Date.now() })}
        />
      )}
      <div className="flex min-h-0 flex-1">
        <DmChat key={friend.user.id} friend={friend} jump={jump} />
        <AnimatePresence initial={false}>{profileOpen && !inCall && <ProfileSidePanel key={friend.user.id} user={friend.user} />}</AnimatePresence>
      </div>
    </div>
  );
}
