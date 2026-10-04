import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, MessageCircle, Phone, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { Button } from '../../components/ui';
import { useCall } from '../../context/call';
import { useFriends } from '../../context/friends';
import { useToast } from '../../context/toast';
import { useUserTrigger } from '../../context/ui';
import { listeningStore, useListeningName, useListeningVersion } from '../../lib/listening';
import { displayName, presenceLabel } from '../../lib/users';
import type { Friend, PublicUser } from '../../lib/types';

type Tab = 'online' | 'all' | 'pending' | 'add';

/** A música do Spotify passa na frente da sala e do status escrito. */
function ActivityText({ friend }: { friend: Friend }) {
  const song = useListeningName(friend);
  if (!friend.online) return <span>Offline</span>;
  if (song) return <span className="text-[#1db954]">Ouvindo {song}</span>;
  if (friend.activity?.type === 'room') return <span>Na sala {friend.activity.roomName}</span>;
  if (friend.activity?.type === 'call') return <span>Em uma chamada privada</span>;
  return <span>{friend.user.customStatus || presenceLabel(friend.presence)}</span>;
}

function RowAction({ label, onClick, tone = 'default', children }: { label: string; onClick: () => void; tone?: 'default' | 'ok' | 'danger'; children: ReactNode }) {
  const hover = tone === 'ok' ? 'hover:text-ok' : tone === 'danger' ? 'hover:text-danger' : 'hover:text-white';
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-muted transition-colors ${hover}`}
    >
      {children}
    </motion.button>
  );
}

function AddFriend() {
  const { sendRequest } = useFriends();
  const toast = useToast();
  const [nick, setNick] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const result = await sendRequest(nick.trim());
      const message = result === 'accepted' ? `Agora você e ${nick} são amigos!` : `Pedido enviado para ${nick}.`;
      setStatus({ ok: true, message });
      toast(message, 'success');
      setNick('');
    } catch (err) {
      setStatus({ ok: false, message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl font-semibold">Adicionar amigo</h2>
      <p className="mt-1 text-sm text-muted">Digite o nick exato da pessoa. Quando ela aceitar, vocês podem se ligar.</p>
      <form
        onSubmit={submit}
        className={`mt-4 flex items-center gap-2 rounded-2xl border bg-surface-1 p-2 pl-4 transition-colors ${
          status && !status.ok ? 'border-danger' : status?.ok ? 'border-ok' : 'border-line focus-within:border-accent'
        }`}
      >
        <UserPlus size={18} className="text-muted" />
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="nick_do_amigo"
          className="flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-faint"
          maxLength={20}
          autoFocus
        />
        <Button type="submit" disabled={!nick.trim() || busy}>
          Enviar pedido
        </Button>
      </form>
      <AnimatePresence>
        {status && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-2 text-sm ${status.ok ? 'text-ok' : 'text-danger'}`}>
            {status.message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-16 flex flex-col items-center text-center text-muted">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }} className="mb-4 flex -space-x-4">
          {['red', 'blue', 'green'].map((color, i) => (
            <Avatar key={color} nick={['M', 'U', 'C'][i]} avatar={color} size={56} className="ring-4 ring-bg rounded-full" />
          ))}
        </motion.div>
        <p className="text-sm">Chame a galera para o Much e transmitam juntos.</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 text-center text-muted">
      <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="mb-4 rounded-3xl bg-surface-2 p-6">
        <Users size={44} className="text-faint" />
      </motion.div>
      <p>{text}</p>
    </motion.div>
  );
}

/** Avatar + nome clicáveis: clique abre o perfil, botão direito abre o menu do usuário. */
function UserButton({ user, className, children }: { user: PublicUser; className: string; children: ReactNode }) {
  const trigger = useUserTrigger()(user);
  return (
    <button {...trigger} className={className}>
      {children}
    </button>
  );
}

function ActiveNow({ friends }: { friends: Friend[] }) {
  const trigger = useUserTrigger();
  // Quem acabou de dar play entra aqui pela loja, sem esperar a lista de amigos recarregar.
  useListeningVersion();
  const active = friends.filter((f) => f.online && (f.activity || listeningStore.get(f.user.id)));
  return (
    <aside className="hidden w-80 shrink-0 border-l border-line p-5 xl:block">
      <h3 className="font-display text-lg font-semibold">Ativo agora</h3>
      <div className="mt-4 space-y-3">
        {active.map((friend, i) => (
          <motion.div
            key={friend.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="cursor-pointer rounded-2xl border border-line bg-surface-1 p-4 transition-colors hover:bg-surface-2"
            {...trigger(friend.user)}
          >
            <div className="flex items-center gap-3">
              <Avatar nick={friend.user.nick} avatar={friend.user.avatar} image={friend.user.avatarImage} size={36} status={friend.presence} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{displayName(friend.user)}</p>
                <p className="truncate text-xs text-muted">
                  <ActivityText friend={friend} />
                </p>
              </div>
            </div>
          </motion.div>
        ))}
        {!active.length && (
          <div className="rounded-2xl border border-line bg-surface-1 p-5 text-center">
            <p className="font-semibold">Tudo quieto por enquanto...</p>
            <p className="mt-1 text-sm text-muted">Quando um amigo ouvir Spotify, entrar numa sala ou chamada, aparece aqui.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function FriendsPage() {
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: Tab = rawTab === 'all' || rawTab === 'pending' || rawTab === 'add' ? rawTab : 'online';
  const setTab = (next: Tab) => setParams(next === 'online' ? {} : { tab: next });
  const { friends, incoming, outgoing, accept, decline, removeFriend } = useFriends();
  const { callFriend } = useCall();
  const navigate = useNavigate();
  const trigger = useUserTrigger();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const base = tab === 'online' ? friends.filter((f) => f.online) : friends;
    return base
      .filter((f) => f.user.nick.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.user.nick.localeCompare(b.user.nick));
  }, [friends, tab, query]);

  // Como no Discord: Disponível / Todos / Pendentes. Sem aba de bloqueados.
  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: 'online', label: 'Disponível' },
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendentes', badge: incoming.length + outgoing.length || undefined },
  ];

  const safe = (action: Promise<unknown>) => action.catch((err: Error) => toast(err.message, 'error'));

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
        <Users size={20} className="text-muted" />
        <span className="mr-3 font-semibold">Amigos</span>
        <div className="h-6 w-px bg-line" />
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1 text-[15px] font-medium transition-colors ${
              tab === t.id ? 'text-white' : 'text-muted hover:text-white'
            }`}
          >
            {tab === t.id && <motion.span layoutId="friends-tab" className="absolute inset-0 rounded-lg bg-surface-4" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{t.label}</span>
            {Boolean(t.badge) && <span className="relative rounded-full bg-danger px-1.5 text-xs font-bold">{t.badge}</span>}
          </button>
        ))}
        <button
          onClick={() => setTab('add')}
          className={`ml-2 rounded-lg px-3 py-1 text-[15px] font-semibold transition ${tab === 'add' ? 'text-ok' : 'bg-ok text-black hover:brightness-110'}`}
        >
          Adicionar amigo
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {tab === 'add' ? (
            <AddFriend />
          ) : tab === 'pending' ? (
            <div>
              <p className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">Pendentes — {incoming.length + outgoing.length}</p>
              <AnimatePresence initial={false}>
                {[...incoming.map((r) => ({ ...r, dir: 'in' as const })), ...outgoing.map((r) => ({ ...r, dir: 'out' as const }))].map((request) => (
                  <motion.div
                    key={`${request.dir}-${request.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-3 border-t border-line px-2 py-3 hover:rounded-xl hover:bg-surface-2"
                  >
                    <UserButton user={request.user} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Avatar nick={request.user.nick} avatar={request.user.avatar} image={request.user.avatarImage} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{displayName(request.user)}</span>
                        <span className="block text-xs text-muted">{request.dir === 'in' ? 'Pedido de amizade recebido' : 'Pedido enviado'}</span>
                      </span>
                    </UserButton>
                    {request.dir === 'in' && (
                      <RowAction label="Aceitar" tone="ok" onClick={() => void safe(accept(request.id))}>
                        <Check size={18} />
                      </RowAction>
                    )}
                    <RowAction label={request.dir === 'in' ? 'Recusar' : 'Cancelar'} tone="danger" onClick={() => void safe(decline(request.id))}>
                      <X size={18} />
                    </RowAction>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!incoming.length && !outgoing.length && <EmptyState text="Nenhum pedido pendente." />}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-surface-1 px-3">
                <Search size={16} className="text-faint" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-faint" />
              </div>
              <p className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">
                {tab === 'online' ? 'Online' : 'Todos os amigos'} — {list.length}
              </p>
              <AnimatePresence initial={false}>
                {list.map((friend, i) => (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group flex items-center gap-3 border-t border-line px-2 py-3 hover:rounded-xl hover:border-transparent hover:bg-surface-2"
                  >
                    <button
                      {...trigger(friend.user)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar nick={friend.user.nick} avatar={friend.user.avatar} image={friend.user.avatarImage} size={38} status={friend.presence} statusBg="var(--color-bg)" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {displayName(friend.user)}
                          <span className="ml-1.5 text-sm font-normal text-faint opacity-0 transition group-hover:opacity-100">{friend.user.nick}</span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          <ActivityText friend={friend} />
                        </span>
                      </span>
                    </button>
                    <RowAction label="Mensagem" onClick={() => navigate(`/app/dm/${friend.user.id}`)}>
                      <MessageCircle size={17} />
                    </RowAction>
                    <RowAction
                      label={friend.online ? 'Chamada privada' : 'Chamada privada (toca quando entrar no Much)'}
                      tone="ok"
                      onClick={() => void callFriend(friend.user)}
                    >
                      <Phone size={17} />
                    </RowAction>
                    <RowAction
                      label="Remover amigo"
                      tone="danger"
                      onClick={() => {
                        if (window.confirm(`Remover ${friend.user.nick} dos amigos?`)) void safe(removeFriend(friend.user.id));
                      }}
                    >
                      <UserMinus size={17} />
                    </RowAction>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!list.length && (
                <EmptyState text={friends.length ? 'Ninguém online agora.' : 'Você ainda não tem amigos no Much. Adicione alguém pelo nick!'} />
              )}
            </div>
          )}
        </div>
        <ActiveNow friends={friends} />
      </div>
    </div>
  );
}
