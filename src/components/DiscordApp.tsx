"use client";

import { useMemo, useState } from "react";
import {
  Headphones,
  Mic,
  MicOff,
  Settings,
  Users,
  Inbox,
  Store,
  Sparkles,
  Plus,
  Search,
  MessageCircle,
  MoreVertical,
  Check,
  X,
  UserPlus,
  Menu,
  Trophy,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import {
  activeNow,
  currentUser,
  directMessages,
  friends,
  messageRequests,
  pendingIncoming,
  pendingOutgoing,
  servers,
  type Friend,
  type Presence,
} from "@/data/mock";

type MainView = "friends" | "message-requests" | "nitro" | "shop" | "quests";
type FriendsTab = "online" | "all" | "pending" | "add";

function isAvailable(status: Presence) {
  return status === "online" || status === "idle" || status === "dnd";
}

export function DiscordApp() {
  const [mainView, setMainView] = useState<MainView>("friends");
  const [friendsTab, setFriendsTab] = useState<FriendsTab>("online");
  const [query, setQuery] = useState("");
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [requests, setRequests] = useState(messageRequests);
  const [incoming, setIncoming] = useState(pendingIncoming);
  const [outgoing, setOutgoing] = useState(pendingOutgoing);
  const [addUsername, setAddUsername] = useState("");
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends.filter((friend) => {
      if (q && !friend.name.toLowerCase().includes(q) && !friend.username.toLowerCase().includes(q)) {
        return false;
      }
      if (friendsTab === "online") return isAvailable(friend.status);
      if (friendsTab === "all") return true;
      return false;
    });
  }, [friendsTab, query]);

  const pendingCount = incoming.length + outgoing.length;
  const navItems: {
    id: MainView;
    label: string;
    icon: typeof Users;
    badge?: number;
  }[] = [
    { id: "friends", label: "Amigos", icon: Users },
    {
      id: "message-requests",
      label: "Solicitações de mensagens",
      icon: Inbox,
      badge: requests.length || undefined,
    },
    { id: "nitro", label: "Página do Nitro", icon: Sparkles },
    { id: "shop", label: "Loja", icon: Store },
    { id: "quests", label: "Missões", icon: Trophy },
  ];

  function acceptRequest(id: string) {
    setRequests((prev) => prev.filter((item) => item.id !== id));
  }

  function ignoreRequest(id: string) {
    setRequests((prev) => prev.filter((item) => item.id !== id));
  }

  function acceptFriend(id: string) {
    setIncoming((prev) => prev.filter((item) => item.id !== id));
  }

  function ignoreFriend(id: string) {
    setIncoming((prev) => prev.filter((item) => item.id !== id));
  }

  function cancelOutgoing(id: string) {
    setOutgoing((prev) => prev.filter((item) => item.id !== id));
  }

  function submitAddFriend(e: React.FormEvent) {
    e.preventDefault();
    const value = addUsername.trim();
    if (!value) {
      setAddFeedback("Digite um nome de usuário válido.");
      return;
    }
    setOutgoing((prev) => [
      {
        id: `out-${Date.now()}`,
        name: value,
        username: value.toLowerCase().replace(/\s+/g, ""),
        status: "offline",
        activity: "Pedido de amizade enviado",
        avatarHue: Math.floor(Math.random() * 360),
      },
      ...prev,
    ]);
    setAddFeedback(`Pedido enviado para ${value}.`);
    setAddUsername("");
    setFriendsTab("pending");
  }

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[var(--dc-server)] text-[var(--dc-text)]">
      {/* Server rail */}
      <aside className="hidden w-[72px] shrink-0 flex-col items-center gap-2 bg-[var(--dc-server)] py-3 md:flex">
        <button
          type="button"
          onClick={() => {
            setMainView("friends");
            setMobileNavOpen(false);
          }}
          className="group relative flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--dc-brand)] text-lg font-bold text-white transition-all hover:rounded-[14px]"
          title="Início"
        >
          M
          <span className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r bg-white opacity-100" />
        </button>
        <div className="my-1 h-[2px] w-8 rounded-full bg-[#35363c]" />
        {servers
          .filter((server) => server.id !== "home")
          .map((server) => (
            <button
              key={server.id}
              type="button"
              title={server.name}
              className="group relative flex h-12 w-12 items-center justify-center rounded-[50%] text-sm font-bold text-white transition-all hover:rounded-[16px]"
              style={{
                background: `linear-gradient(145deg, hsl(${server.hue} 55% 46%), hsl(${server.hue} 50% 32%))`,
              }}
            >
              {server.initials}
              {server.unread ? (
                <span className="absolute left-0 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r bg-white" />
              ) : (
                <span className="absolute left-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-r bg-white transition-all group-hover:h-5" />
              )}
            </button>
          ))}
        <button
          type="button"
          className="mt-1 flex h-12 w-12 items-center justify-center rounded-[50%] bg-[var(--dc-sidebar)] text-[#23a559] transition-all hover:rounded-[16px] hover:bg-[#23a559] hover:text-white"
          title="Adicionar servidor"
        >
          <Plus className="h-5 w-5" />
        </button>
      </aside>

      {/* Channel / DM sidebar */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex w-[240px] max-w-[85vw] flex-col bg-[var(--dc-sidebar)] transition-transform md:static md:max-w-none md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-12 shrink-0 items-center border-b border-black/20 px-2 shadow-sm">
          <button
            type="button"
            className="flex h-7 w-full items-center rounded bg-[var(--dc-server)] px-2 text-left text-sm text-[var(--dc-muted)]"
          >
            Encontre ou comece uma conversa
          </button>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = mainView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMainView(item.id);
                  if (item.id === "friends") setFriendsTab("online");
                  setMobileNavOpen(false);
                }}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-[8px] px-2 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-[var(--dc-active)] text-white"
                    : "text-[var(--dc-channel)] hover:bg-[var(--dc-hover)] hover:text-[var(--dc-interactive)]",
                )}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-90" />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-[#f23f43] px-1.5 text-[11px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div className="mt-4 mb-1 flex items-center justify-between px-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--dc-muted)]">
              Mensagens diretas
            </span>
            <button type="button" className="text-[var(--dc-muted)] hover:text-white" title="Criar MD">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {directMessages.map((dm) => (
            <button
              key={dm.id}
              type="button"
              className="group flex h-11 w-full items-center gap-3 rounded-[8px] px-2 text-left text-[15px] text-[var(--dc-channel)] hover:bg-[var(--dc-hover)] hover:text-[var(--dc-interactive)]"
            >
              <Avatar name={dm.name} hue={dm.avatarHue} status={dm.status} size={32} />
              <span className="truncate font-medium">{dm.name}</span>
              {dm.unread ? (
                <span className="ml-auto rounded-full bg-white px-1.5 text-[11px] font-bold text-[#1e1f22]">
                  {dm.unread}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-auto flex h-[52px] items-center gap-2 bg-[var(--dc-user)] px-2">
          <Avatar
            name={currentUser.name}
            hue={currentUser.avatarHue}
            status={currentUser.status}
            size={32}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-white">{currentUser.name}</div>
            <div className="truncate text-xs text-[var(--dc-muted)]">{currentUser.statusLabel}</div>
          </div>
          <div className="flex items-center gap-0.5 text-[var(--dc-interactive)]">
            <IconButton
              label={muted || deafened ? "Ativar microfone" : "Silenciar"}
              onClick={() => setMuted((v) => !v)}
            >
              {muted || deafened ? <MicOff className="h-4 w-4 text-[#f23f43]" /> : <Mic className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label={deafened ? "Ativar áudio" : "Ensurdecer"}
              onClick={() => {
                setDeafened((v) => !v);
                if (!deafened) setMuted(true);
              }}
            >
              <Headphones className={cn("h-4 w-4", deafened && "text-[#f23f43]")} />
            </IconButton>
            <IconButton label="Configurações do usuário">
              <Settings className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--dc-main)]">
        {mainView === "friends" ? (
          <>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-3 shadow-sm">
              <button
                type="button"
                className="mr-1 rounded p-1 text-[var(--dc-interactive)] hover:bg-[var(--dc-hover)] md:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Users className="hidden h-5 w-5 text-[var(--dc-muted)] sm:block" />
              <span className="text-base font-semibold text-white">Amigos</span>
              <div className="mx-2 hidden h-6 w-px bg-[#3f4147] sm:block" />

              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                <FriendsTabButton
                  active={friendsTab === "online"}
                  onClick={() => setFriendsTab("online")}
                >
                  Disponível
                </FriendsTabButton>
                <FriendsTabButton
                  active={friendsTab === "all"}
                  onClick={() => setFriendsTab("all")}
                >
                  Todos
                </FriendsTabButton>
                <FriendsTabButton
                  active={friendsTab === "pending"}
                  onClick={() => setFriendsTab("pending")}
                >
                  Pendentes
                  {pendingCount > 0 ? (
                    <span className="ml-1 rounded-full bg-[#f23f43] px-1.5 text-[11px] font-bold text-white">
                      {pendingCount}
                    </span>
                  ) : null}
                </FriendsTabButton>
                {/* Bloqueados intencionalmente omitido */}
                <button
                  type="button"
                  onClick={() => setFriendsTab("add")}
                  className={cn(
                    "ml-1 shrink-0 rounded-[4px] px-2 py-0.5 text-sm font-medium transition-colors",
                    friendsTab === "add"
                      ? "bg-transparent text-white"
                      : "bg-[var(--dc-brand)] text-white hover:bg-[var(--dc-brand-hover)]",
                  )}
                >
                  Adicionar amigo
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <section className="flex min-w-0 flex-1 flex-col">
                {friendsTab === "add" ? (
                  <AddFriendPanel
                    username={addUsername}
                    feedback={addFeedback}
                    onUsernameChange={setAddUsername}
                    onSubmit={submitAddFriend}
                  />
                ) : friendsTab === "pending" ? (
                  <PendingPanel
                    incoming={incoming}
                    outgoing={outgoing}
                    onAccept={acceptFriend}
                    onIgnore={ignoreFriend}
                    onCancel={cancelOutgoing}
                  />
                ) : (
                  <>
                    <div className="px-5 pb-2 pt-4">
                      <label className="relative block">
                        <span className="sr-only">Buscar</span>
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Buscar"
                          className="h-8 w-full rounded bg-[var(--dc-server)] px-2 pr-8 text-sm text-[var(--dc-text)] outline-none placeholder:text-[var(--dc-muted)]"
                        />
                        <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-muted)]" />
                      </label>
                    </div>

                    <div className="px-5 pb-2 pt-2 text-xs font-bold uppercase tracking-wide text-[var(--dc-muted)]">
                      {friendsTab === "online"
                        ? `Online — ${filteredFriends.length}`
                        : `Todos os amigos — ${filteredFriends.length}`}
                    </div>

                    <ul className="flex-1 overflow-y-auto px-2 pb-4">
                      {filteredFriends.length === 0 ? (
                        <EmptyState
                          title="Ninguém por aqui"
                          body={
                            friendsTab === "online"
                              ? "Nenhum amigo disponível no momento."
                              : "Nenhum amigo corresponde à busca."
                          }
                        />
                      ) : (
                        filteredFriends.map((friend) => (
                          <FriendRow key={friend.id} friend={friend} />
                        ))
                      )}
                    </ul>
                  </>
                )}
              </section>

              <aside className="hidden w-[360px] shrink-0 border-l border-black/20 xl:flex xl:flex-col">
                <div className="px-4 pb-2 pt-4 text-xl font-bold text-white">Ativo agora</div>
                <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                  {activeNow.map((card) => (
                    <article
                      key={card.id}
                      className="rounded-lg border border-[#3f4147] bg-[var(--dc-main)] p-4 transition-colors hover:bg-[var(--dc-hover)]"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={card.title} hue={card.avatarHue} size={40} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">{card.title}</div>
                          <div className="truncate text-sm text-[var(--dc-muted)]">{card.subtitle}</div>
                          <div className="mt-1 truncate text-xs text-[var(--dc-muted)]">{card.detail}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                  {activeNow.length === 0 ? (
                    <EmptyState
                      title="Por enquanto está quieto..."
                      body="Quando um amigo começar uma atividade, ela aparece aqui."
                    />
                  ) : null}
                </div>
              </aside>
            </div>
          </>
        ) : null}

        {mainView === "message-requests" ? (
          <MessageRequestsView
            requests={requests}
            onOpenMenu={() => setMobileNavOpen(true)}
            onAccept={acceptRequest}
            onIgnore={ignoreRequest}
          />
        ) : null}

        {mainView === "nitro" || mainView === "shop" || mainView === "quests" ? (
          <PlaceholderView
            title={
              mainView === "nitro"
                ? "Página do Nitro"
                : mainView === "shop"
                  ? "Loja"
                  : "Missões"
            }
            body="Esta seção está pronta no menu, no mesmo lugar do Discord."
            onOpenMenu={() => setMobileNavOpen(true)}
          />
        ) : null}
      </main>
    </div>
  );
}

function FriendsTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center rounded-[4px] px-2 py-0.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--dc-active)] text-white"
          : "text-[var(--dc-interactive)] hover:bg-[var(--dc-hover)] hover:text-[var(--dc-hover-text)]",
      )}
    >
      {children}
    </button>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  return (
    <li>
      <div className="group mx-2 flex h-[62px] items-center gap-3 border-t border-[#3f4147] px-2 hover:rounded-lg hover:border-transparent hover:bg-[var(--dc-hover)]">
        <Avatar name={friend.name} hue={friend.avatarHue} status={friend.status} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{friend.name}</div>
          <div className="truncate text-sm text-[var(--dc-muted)]">
            {friend.activity ?? friend.status}
          </div>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-server)] text-[var(--dc-interactive)] opacity-100 transition group-hover:text-white"
          title="Mensagem"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-server)] text-[var(--dc-interactive)] transition hover:text-white"
          title="Mais"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function PendingPanel({
  incoming,
  outgoing,
  onAccept,
  onIgnore,
  onCancel,
}: {
  incoming: Friend[];
  outgoing: Friend[];
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        title="Sem pedidos pendentes"
        body="Quando alguém te enviar um pedido de amizade, ele aparece aqui."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-4 pt-4">
      {incoming.length > 0 ? (
        <>
          <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-[var(--dc-muted)]">
            Recebidos — {incoming.length}
          </div>
          {incoming.map((friend) => (
            <div
              key={friend.id}
              className="mx-2 flex h-[62px] items-center gap-3 border-t border-[#3f4147] px-2 hover:rounded-lg hover:border-transparent hover:bg-[var(--dc-hover)]"
            >
              <Avatar name={friend.name} hue={friend.avatarHue} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{friend.name}</div>
                <div className="truncate text-sm text-[var(--dc-muted)]">Pedido de amizade recebido</div>
              </div>
              <button
                type="button"
                onClick={() => onAccept(friend.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-server)] text-[#23a559] hover:bg-[#23a559] hover:text-white"
                title="Aceitar"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onIgnore(friend.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-server)] text-[var(--dc-muted)] hover:bg-[#f23f43] hover:text-white"
                title="Ignorar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </>
      ) : null}

      {outgoing.length > 0 ? (
        <>
          <div className="px-3 pb-2 pt-6 text-xs font-bold uppercase tracking-wide text-[var(--dc-muted)]">
            Enviados — {outgoing.length}
          </div>
          {outgoing.map((friend) => (
            <div
              key={friend.id}
              className="mx-2 flex h-[62px] items-center gap-3 border-t border-[#3f4147] px-2 hover:rounded-lg hover:border-transparent hover:bg-[var(--dc-hover)]"
            >
              <Avatar name={friend.name} hue={friend.avatarHue} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{friend.name}</div>
                <div className="truncate text-sm text-[var(--dc-muted)]">Pedido de amizade enviado</div>
              </div>
              <button
                type="button"
                onClick={() => onCancel(friend.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-server)] text-[var(--dc-muted)] hover:bg-[#f23f43] hover:text-white"
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function AddFriendPanel({
  username,
  feedback,
  onUsernameChange,
  onSubmit,
}: {
  username: string;
  feedback: string | null;
  onUsernameChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="px-6 py-5">
      <h2 className="text-xl font-bold uppercase tracking-wide text-white">Adicionar amigo</h2>
      <p className="mt-2 text-sm text-[var(--dc-muted)]">
        Você pode adicionar amigos com o nome de usuário Discord deles.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-4 flex flex-col gap-3 rounded-lg bg-[var(--dc-server)] p-3 sm:flex-row sm:items-center"
      >
        <input
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Digite um nome de usuário"
          className="h-12 flex-1 rounded bg-transparent px-2 text-white outline-none placeholder:text-[var(--dc-muted)]"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded bg-[var(--dc-brand)] px-4 text-sm font-medium text-white hover:bg-[var(--dc-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!username.trim()}
        >
          Enviar pedido de amizade
        </button>
      </form>
      {feedback ? <p className="mt-3 text-sm text-[#23a559]">{feedback}</p> : null}
    </div>
  );
}

function MessageRequestsView({
  requests,
  onOpenMenu,
  onAccept,
  onIgnore,
}: {
  requests: typeof messageRequests;
  onOpenMenu: () => void;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
}) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-3 shadow-sm">
        <button
          type="button"
          className="mr-1 rounded p-1 text-[var(--dc-interactive)] hover:bg-[var(--dc-hover)] md:hidden"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Inbox className="h-5 w-5 text-[var(--dc-muted)]" />
        <span className="text-base font-semibold text-white">Solicitações de mensagens</span>
        {requests.length > 0 ? (
          <span className="rounded-full bg-[#f23f43] px-1.5 text-[11px] font-bold text-white">
            {requests.length}
          </span>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <p className="px-4 pb-4 text-sm text-[var(--dc-muted)]">
          Mensagens de pessoas que não estão na sua lista de amigos. Aceite para conversar ou ignore
          para remover.
        </p>

        {requests.length === 0 ? (
          <EmptyState
            title="Nenhuma solicitação"
            body="Quando alguém te mandar mensagem sem ser amigo, a solicitação aparece aqui."
          />
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="mx-2 flex items-start gap-3 border-t border-[#3f4147] px-3 py-4 hover:rounded-lg hover:border-transparent hover:bg-[var(--dc-hover)]"
            >
              <Avatar name={request.name} hue={request.avatarHue} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-white">{request.name}</span>
                  <span className="text-sm text-[var(--dc-muted)]">@{request.username}</span>
                  <span className="text-xs text-[var(--dc-muted)]">{request.receivedAt}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--dc-interactive)]">{request.preview}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAccept(request.id)}
                    className="rounded bg-[var(--dc-brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dc-brand-hover)]"
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    onClick={() => onIgnore(request.id)}
                    className="rounded bg-[var(--dc-server)] px-3 py-1.5 text-sm font-medium text-[var(--dc-interactive)] hover:bg-[#f23f43] hover:text-white"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function PlaceholderView({
  title,
  body,
  onOpenMenu,
}: {
  title: string;
  body: string;
  onOpenMenu: () => void;
}) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-3 shadow-sm">
        <button
          type="button"
          className="mr-1 rounded p-1 text-[var(--dc-interactive)] hover:bg-[var(--dc-hover)] md:hidden"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-white">{title}</span>
      </header>
      <EmptyState title={title} body={body} />
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <UserPlus className="mb-2 h-10 w-10 text-[var(--dc-muted)]" />
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="max-w-md text-sm text-[var(--dc-muted)]">{body}</p>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded hover:bg-black/20"
    >
      {children}
    </button>
  );
}
