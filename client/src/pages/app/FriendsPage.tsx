import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Compass, MessageCircle, Phone, Search, UserMinus, Users, X } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { useCall } from '../../context/call';
import { useDms } from '../../context/dms';
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

function FriendMascot() {
  return (
    <svg width="104" height="96" viewBox="0 0 104 96" aria-hidden className="shrink-0">
      <ellipse cx="50" cy="90" rx="24" ry="4.5" fill="#000" opacity="0.32" />
      <path d="M48 10c0-6 8-10 12-4 2 3-1 6-4 6" fill="#4ade80" />
      <path d="M56 12c3-6 11-5 12 1 1 4-4 6-7 4" fill="#86efac" />
      <ellipse cx="50" cy="52" rx="28" ry="30" fill="#7c3aed" />
      <ellipse cx="50" cy="56" rx="21" ry="20" fill="#8b5cf6" />
      <circle cx="40" cy="46" r="5" fill="#0c0d11" />
      <circle cx="60" cy="46" r="5" fill="#0c0d11" />
      <circle cx="41.6" cy="44.4" r="1.6" fill="#fff" />
      <circle cx="61.6" cy="44.4" r="1.6" fill="#fff" />
      <path d="M42 64c5 6 12 6 18 0" fill="none" stroke="#0c0d11" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M76 44c10-2 18 6 16 16-1 6-7 10-13 8" fill="#6d28d9" />
      <circle cx="90" cy="64" r="6.5" fill="#c4b5fd" />
      <path d="M88 61.5c2 0 3.4 1.4 3.4 3" fill="none" stroke="#4c1d95" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AddFriend() {
  const { sendRequest } = useFriends();
  const { send } = useDms();
  const toast = useToast();
  const navigate = useNavigate();
  const [nick, setNick] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const who = nick.trim();
    if (!who) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await sendRequest(who);
      const message = result.status === 'accepted' ? `Agora você e ${who} são amigos!` : `Pedido enviado para ${who}.`;
      const extra = note.trim();
      if (extra) await send(result.user.id, extra).catch(() => undefined);
      setStatus({ ok: true, message });
      toast(message, 'success');
      setNick('');
      setNote('');
    } catch (err) {
      setStatus({ ok: false, message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const border = status && !status.ok ? 'border-danger' : status?.ok ? 'border-ok' : 'border-white/10';

  return (
    <div className="relative px-8 pt-6 pb-10">
      <div className="pointer-events-none absolute top-2 right-8 hidden sm:block">
        <FriendMascot />
      </div>

      <h2 className="text-xl font-semibold tracking-tight">Adicionar amigo</h2>
      <p className="mt-1 text-sm text-muted">Você pode adicionar amigos com o nick deles no PassTime.</p>

      <form onSubmit={(e) => void submit(e)} className={`mt-5 overflow-hidden rounded-xl border ${border}`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <input
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              if (status) setStatus(null);
            }}
            placeholder="Insira um nome de usuário"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            maxLength={20}
            autoComplete="off"
            autoFocus
          />
          <button
            type="submit"
            disabled={!nick.trim() || busy}
            className="h-8 shrink-0 rounded-md bg-accent px-3 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent/40 disabled:opacity-70"
          >
            {busy ? 'Enviando...' : 'Enviar pedido de amizade'}
          </button>
        </div>
        <div className="border-t border-white/8 px-4 pt-2.5 pb-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 120))}
            placeholder="Personalize sua solicitação (opcional)"
            rows={2}
            maxLength={120}
            className="w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-faint"
          />
          <p className="text-right text-xs tabular-nums text-faint">{120 - note.length}</p>
        </div>
      </form>
      <p className="mt-2 text-xs text-faint">
        O que você escrever aqui também aparece nas mensagens diretas se vocês se tornarem amigos.
      </p>
      <AnimatePresence>
        {status && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-3 text-sm ${status.ok ? 'text-ok' : 'text-danger'}`}
          >
            {status.message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-xl font-semibold tracking-tight">Outros lugares para fazer amigos</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Ninguém vem à cabeça? Confira nossa lista de salas públicas: jogos, filmes, música, anime e muito mais.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/explore')}
          className="mt-4 flex w-full max-w-[440px] items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left transition hover:bg-white/3"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ok text-black">
            <Compass size={18} />
          </span>
          <span className="flex-1 font-medium">Explorar salas públicas</span>
          <ChevronRight size={18} className="text-muted" />
        </button>
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
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-4">
        <Users size={18} className="text-muted" />
        <span className="mr-2 font-semibold">Amigos</span>
        <div className="mx-2 h-5 w-px bg-line" />
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white/6 text-white' : 'text-muted hover:bg-white/4 hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            {Boolean(t.badge) && <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold leading-4">{t.badge}</span>}
          </button>
        ))}
        <button
          onClick={() => setTab('add')}
          className={`ml-1 rounded-md px-2.5 py-1 text-sm font-semibold transition ${
            tab === 'add' ? 'bg-accent text-white' : 'bg-ok text-black hover:brightness-110'
          }`}
        >
          Adicionar amigo
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {tab === 'add' ? (
          <div className="min-w-0 flex-1 overflow-y-auto">
            <AddFriend />
          </div>
        ) : (
          <>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {tab === 'pending' ? (
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
                      label={friend.online ? 'Chamada privada' : 'Chamada privada (toca quando entrar no PassTime)'}
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
                <EmptyState text={friends.length ? 'Ninguém online agora.' : 'Você ainda não tem amigos no PassTime. Adicione alguém pelo nick!'} />
              )}
            </div>
          )}
        </div>
        <ActiveNow friends={friends} />
          </>
        )}
      </div>
    </div>
  );
}
