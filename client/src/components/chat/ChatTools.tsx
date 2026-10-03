import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownRight, Pin, PinOff, Search, X } from 'lucide-react';
import Avatar from '../Avatar';
import Spinner from '../Spinner';
import type { ChatMessage } from './ChatView';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { displayName } from '../../lib/users';
import type { PublicUser } from '../../lib/types';

const SEARCH_DEBOUNCE_MS = 300;

/** Grupos mandam junto quem escreveu e já saiu, para o nome e a foto aparecerem. */
interface MessageList {
  messages: ChatMessage[];
  formerMembers?: PublicUser[];
}

function authorLookup(source: ChatSource, list: MessageList | null) {
  return (id: number) => list?.formerMembers?.find((u) => u.id === id) ?? source.authorOf(id);
}

/** De onde vêm as fixadas e a busca de uma conversa (DM ou grupo). */
export interface ChatSource {
  /** Caminho da conversa na API, ex.: `/dms/2` ou `/groups/5`. */
  path: string;
  /** Aparece na caixa de busca: "Buscar {name}". */
  name: string;
  authorOf: (id: number) => PublicUser;
  unpin: (messageId: number) => void;
  /** Eventos do socket que mexem nas fixadas: `[fixou, apagou]`. */
  events: [string, string];
  /** Diz se o evento é desta conversa. */
  isMine: (payload: { userId?: number; groupId?: number }) => boolean;
}

const whenOf = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Fecha ao clicar fora ou apertar Esc. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function Dropdown({ title, extra, children, footer }: { title: string; extra?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      className="absolute top-full right-0 z-30 mt-2 flex max-h-[65vh] w-[420px] origin-top-right flex-col overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl shadow-black/60"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="font-semibold">{title}</span>
        {extra}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </motion.div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-accent/35 px-0.5 text-white">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function MessagePreview({ message, author, query = '', actions }: { message: ChatMessage; author: PublicUser; query?: string; actions: ReactNode }) {
  return (
    <div className="group relative flex gap-3 rounded-lg border border-line bg-black/20 p-3 transition hover:border-white/15">
      <Avatar nick={author.nick} avatar={author.avatar} image={author.avatarImage} size={32} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold">{displayName(author)}</span>
          <span className="shrink-0 text-[11px] text-faint">{whenOf(message.createdAt)}</span>
        </p>
        {message.kind === 'sticker' ? (
          <img src={message.content} alt="Figurinha" draggable={false} className="mt-1 h-20 w-20 object-contain" />
        ) : (
          <p className="mt-0.5 line-clamp-4 text-sm break-words whitespace-pre-wrap text-white/85">
            <Highlighted text={message.content} query={query} />
          </p>
        )}
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100">{actions}</div>
    </div>
  );
}

function ToolAction({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md border border-line bg-surface-3 p-1.5 text-muted transition ${danger ? 'hover:text-danger' : 'hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export function HeaderIcon({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-lg p-1.5 transition ${active ? 'bg-surface-4 text-white' : 'text-muted hover:bg-surface-3 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

/** Mensagens fixadas da conversa. Atualiza sozinho enquanto está aberto, se alguém fixar ou apagar. */
export function PinsButton({ source, onJump }: { source: ChatSource; onJump: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<MessageList | null>(null);
  const pins = list?.messages ?? null;
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });
  const { path } = source;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = () =>
      api<MessageList>(`${path}/pins`).then(
        (data) => !cancelled && setList(data),
        () => !cancelled && setList({ messages: [] }),
      );
    void load();
    const socket = getSocket();
    const [pinned, deleted] = sourceRef.current.events;
    const onChange = (payload: { userId?: number; groupId?: number }) => sourceRef.current.isMine(payload) && void load();
    socket.on(pinned, onChange);
    socket.on(deleted, onChange);
    return () => {
      cancelled = true;
      socket.off(pinned, onChange);
      socket.off(deleted, onChange);
    };
  }, [open, path]);

  const authorOf = authorLookup(source, list);
  return (
    <div ref={ref} className="relative">
      <HeaderIcon label="Mensagens fixadas" active={open} onClick={() => setOpen((v) => !v)}>
        <Pin size={19} />
      </HeaderIcon>
      <AnimatePresence>
        {open && (
          <Dropdown title="Mensagens fixadas" extra={pins && pins.length > 0 && <span className="rounded bg-surface-4 px-1.5 text-[11px] text-muted">{pins.length}</span>}>
            {!pins ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : pins.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-4 text-muted">
                  <Pin size={22} />
                </span>
                <p className="font-semibold">Nenhuma mensagem fixada</p>
                <p className="mt-1 text-sm text-muted">Passe o mouse numa mensagem e clique no alfinete para guardá-la aqui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pins.map((message) => (
                  <MessagePreview
                    key={message.id}
                    message={message}
                    author={authorOf(message.senderId)}
                    actions={
                      <>
                        <ToolAction
                          label="Ir até a mensagem"
                          onClick={() => {
                            close();
                            onJump(message.id);
                          }}
                        >
                          <CornerDownRight size={14} />
                        </ToolAction>
                        <ToolAction
                          label="Desafixar"
                          danger
                          onClick={() => {
                            setList((current) => current && { ...current, messages: current.messages.filter((m) => m.id !== message.id) });
                            source.unpin(message.id);
                          }}
                        >
                          <PinOff size={14} />
                        </ToolAction>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </Dropdown>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Busca no texto da conversa. Os resultados abrem embaixo da caixa, e clicar leva até a mensagem. */
export function SearchBox({ source, onJump }: { source: ChatSource; onJump: (id: number) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<MessageList | null>(null);
  const results = found?.messages ?? null;
  const [error, setError] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const term = query.trim();
  const { path } = source;

  useEffect(() => {
    setFound(null);
    setError('');
    if (!term) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<MessageList>(`${path}/search?q=${encodeURIComponent(term)}`).then(
        (data) => !cancelled && setFound(data),
        (err: Error) => !cancelled && setError(err.message),
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, path]);

  const authorOf = authorLookup(source, found);
  return (
    <div ref={ref} className="relative">
      <label className="flex h-8 w-44 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-sm transition-[width,border-color] focus-within:w-60 focus-within:border-white/20">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => term && setOpen(true)}
          placeholder={`Buscar ${source.name}`}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            className="text-muted hover:text-white"
            aria-label="Limpar busca"
            title="Limpar busca"
          >
            <X size={15} />
          </button>
        ) : (
          <Search size={15} className="shrink-0 text-faint" />
        )}
      </label>
      <AnimatePresence>
        {open && term && (
          <Dropdown
            title={results ? (results.length === 1 ? '1 resultado' : `${results.length} resultados`) : 'Buscando...'}
            extra={results && results.length >= 50 && <span className="text-xs text-faint">mostrando os 50 mais novos</span>}
          >
            {error ? (
              <p className="px-3 py-8 text-center text-sm text-danger">{error}</p>
            ) : !results ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-4 text-muted">
                  <Search size={22} />
                </span>
                <p className="font-semibold">Nada encontrado</p>
                <p className="mt-1 text-sm text-muted">Nenhuma mensagem com &quot;{term}&quot; nesta conversa.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => {
                      close();
                      onJump(message.id);
                    }}
                    className="block w-full text-left"
                  >
                    <MessagePreview message={message} author={authorOf(message.senderId)} query={term} actions={null} />
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
        )}
      </AnimatePresence>
    </div>
  );
}
