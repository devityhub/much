import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pin, PinOff, SendHorizontal, Smile, Sticker, Trash2 } from 'lucide-react';
import Avatar from '../Avatar';
import Spinner from '../Spinner';
import ChatPicker from './ChatPicker';
import { useUserTrigger } from '../../context/ui';
import { displayName } from '../../lib/users';
import type { PublicUser } from '../../lib/types';

const MAX_LENGTH = 2000;
const GROUP_GAP_MS = 7 * 60 * 1000;

/** O que DM e grupo têm em comum numa mensagem. */
export interface ChatMessage {
  id: number;
  senderId: number;
  kind: string;
  content: string;
  callDuration: number | null;
  createdAt: number;
  pinnedAt: number | null;
}

export interface ChatThread<M extends ChatMessage> {
  messages: M[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

/** Pedido para rolar até uma mensagem. `at` deixa pular de novo para a mesma; `key` prende o pulo à conversa certa. */
export interface Jump {
  key: string;
  id: number;
  at: number;
}

export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function dayLabel(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatCallDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Linha de evento no meio da conversa (chamada, alguém entrou no grupo...). */
export function EventLine({ icon, tone = 'muted', children, time }: { icon: ReactNode; tone?: 'ok' | 'danger' | 'muted'; children: ReactNode; time: number }) {
  const tones = { ok: 'bg-ok/15 text-ok', danger: 'bg-danger/15 text-danger', muted: 'bg-surface-4 text-muted' };
  return (
    <div className="flex items-center gap-3 px-5 py-1.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
      <span className="text-sm text-muted">{children}</span>
      <span className="text-xs text-faint">{timeOf(time)}</span>
    </div>
  );
}

function MessageRow({
  message,
  author,
  isMine,
  groupStart,
  highlight,
  onDelete,
  onPin,
}: {
  message: ChatMessage;
  author: PublicUser;
  isMine: boolean;
  groupStart: boolean;
  highlight: boolean;
  onDelete: () => void;
  onPin: () => void;
}) {
  const trigger = useUserTrigger();
  const pending = message.id < 0;
  const pinned = message.pinnedAt !== null;
  return (
    <div
      data-mid={message.id}
      className={`group relative flex gap-3 px-5 transition-colors duration-700 ${
        highlight ? 'bg-accent/15' : pinned ? 'bg-warn/[0.04] hover:bg-warn/[0.07]' : 'hover:bg-white/[0.025]'
      } ${groupStart ? 'mt-3 pt-1' : ''} ${pending ? 'opacity-55' : ''}`}
    >
      <div className="w-10 shrink-0">
        {groupStart ? (
          <button {...trigger(author)} className="block rounded-full">
            <Avatar nick={author.nick} avatar={author.avatar} image={author.avatarImage} size={40} />
          </button>
        ) : (
          <span className="block pt-1 text-right text-[10px] leading-5 text-faint opacity-0 group-hover:opacity-100">{timeOf(message.createdAt)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        {groupStart && (
          <p className="flex items-baseline gap-2">
            <button {...trigger(author)} className="font-semibold hover:underline">
              {displayName(author)}
            </button>
            <span className="text-xs text-faint">{timeOf(message.createdAt)}</span>
          </p>
        )}
        {message.kind === 'sticker' ? (
          <img src={message.content} alt="Figurinha" draggable={false} className="mt-0.5 h-32 w-32 object-contain" />
        ) : (
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-white/90">
            <Linkified text={message.content} />
          </p>
        )}
      </div>
      {pinned && (
        <span className="absolute top-1 right-5 text-warn/70 group-hover:hidden" title="Mensagem fixada">
          <Pin size={13} />
        </span>
      )}
      {!pending && (
        <div className="absolute -top-3 right-5 flex overflow-hidden rounded-md border border-line bg-surface-2 opacity-0 shadow-lg transition group-hover:opacity-100">
          <button
            onClick={onPin}
            className={`p-1.5 transition hover:bg-surface-4 ${pinned ? 'text-warn hover:text-white' : 'text-muted hover:text-white'}`}
            title={pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
            aria-label={pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          {isMine && (
            <button
              onClick={onDelete}
              className="p-1.5 text-muted transition hover:bg-surface-4 hover:text-danger"
              title="Apagar mensagem"
              aria-label="Apagar mensagem"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 0.15, 0.3].map((delay) => (
        <motion.span
          key={delay}
          className="h-1 w-1 rounded-full bg-muted"
          animate={{ y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay }}
        />
      ))}
    </span>
  );
}

function typingText(names: string[]) {
  if (names.length === 1) return { who: names[0], verb: 'está digitando...' };
  if (names.length === 2) return { who: `${names[0]} e ${names[1]}`, verb: 'estão digitando...' };
  return { who: 'Várias pessoas', verb: 'estão digitando...' };
}

interface ComposerProps {
  placeholder: string;
  /** Muda quando troca de conversa: o foco volta para o campo. */
  focusKey: string;
  onSend: (content: string, kind: 'text' | 'sticker') => Promise<boolean>;
  onTyping: () => void;
}

function Composer({ placeholder, focusKey, onSend, onTyping }: ComposerProps) {
  const [text, setText] = useState('');
  const [picker, setPicker] = useState<'emoji' | 'sticker' | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    ref.current?.focus();
  }, [focusKey]);

  const submit = async () => {
    const content = text.trim();
    if (!content || content.length > MAX_LENGTH) return;
    setText('');
    const ok = await onSend(content, 'text');
    if (!ok) setText((current) => current || content);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  // O emoji entra onde o cursor está, não no fim do texto.
  const insertEmoji = (char: string) => {
    const el = ref.current;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? at;
    setText(`${text.slice(0, at)}${char}${text.slice(end)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + char.length, at + char.length);
    });
  };

  const tooLong = text.length > MAX_LENGTH;
  return (
    <div className="relative flex items-end gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-2.5 focus-within:border-white/20">
      <AnimatePresence>
        {picker && (
          <ChatPicker
            tab={picker}
            onTab={setPicker}
            onEmoji={insertEmoji}
            onSticker={(url) => {
              setPicker(null);
              void onSend(url, 'sticker');
            }}
            onClose={() => setPicker(null)}
          />
        )}
      </AnimatePresence>
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) onTyping();
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="max-h-[200px] min-h-6 flex-1 resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-faint"
      />
      {text.length > MAX_LENGTH - 200 && <span className={`pb-0.5 text-xs ${tooLong ? 'text-danger' : 'text-faint'}`}>{MAX_LENGTH - text.length}</span>}
      <button
        onClick={() => setPicker((p) => (p === 'sticker' ? null : 'sticker'))}
        className={`rounded-lg p-1 transition hover:bg-surface-4 ${picker === 'sticker' ? 'text-accent' : 'text-muted hover:text-white'}`}
        title="Figurinhas"
        aria-label="Figurinhas"
      >
        <Sticker size={20} />
      </button>
      <button
        onClick={() => setPicker((p) => (p === 'emoji' ? null : 'emoji'))}
        className={`rounded-lg p-1 transition hover:bg-surface-4 ${picker === 'emoji' ? 'text-accent' : 'text-muted hover:text-white'}`}
        title="Emojis"
        aria-label="Emojis"
      >
        <Smile size={20} />
      </button>
      <button
        onClick={() => void submit()}
        disabled={!text.trim() || tooLong}
        className="rounded-lg p-1 text-accent transition hover:bg-surface-4 disabled:text-faint disabled:hover:bg-transparent"
        title="Enviar"
        aria-label="Enviar"
      >
        <SendHorizontal size={20} />
      </button>
    </div>
  );
}

interface ChatViewProps<M extends ChatMessage> {
  /** Identifica a conversa (ex.: `dm-2`, `group-5`). */
  convoKey: string;
  thread: ChatThread<M>;
  meId: number;
  authorOf: (id: number) => PublicUser;
  /** Começo da conversa, quando já não há mais histórico para carregar. */
  intro: ReactNode;
  /** Linhas que não são mensagem comum (chamadas, avisos). Devolve null para cair na mensagem normal. */
  renderEvent?: (message: M) => ReactNode | null;
  onLoadOlder: () => void;
  loadUntil: (messageId: number) => Promise<void>;
  onDelete: (message: M) => void;
  onPin: (message: M) => void;
  jump: Jump | null;
  typingNames: string[];
  placeholder: string;
  onSend: (content: string, kind: 'text' | 'sticker') => Promise<boolean>;
  onTyping: () => void;
}

export default function ChatView<M extends ChatMessage>({
  convoKey,
  thread,
  meId,
  authorOf,
  intro,
  renderEvent,
  onLoadOlder,
  loadUntil,
  onDelete,
  onPin,
  jump,
  typingNames,
  placeholder,
  onSend,
  onTyping,
}: ChatViewProps<M>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const edges = useRef({ first: 0, last: 0, height: 0 });
  const [highlightId, setHighlightId] = useState<number | null>(null);
  // `loadUntil` costuma chegar como função nova a cada render; o pulo só deve rodar quando o pedido muda.
  const loadUntilRef = useRef(loadUntil);
  useEffect(() => {
    loadUntilRef.current = loadUntil;
  });

  // Pular até uma mensagem (busca ou fixadas): carrega o histórico até ela e espera aparecer na tela.
  useEffect(() => {
    if (!jump || jump.key !== convoKey) return;
    let cancelled = false;
    let frame = 0;
    let clear = 0;
    void loadUntilRef.current(jump.id).then(() => {
      let tries = 0;
      const find = () => {
        if (cancelled) return;
        const el = scrollRef.current?.querySelector<HTMLElement>(`[data-mid="${jump.id}"]`);
        if (el) {
          atBottom.current = false;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setHighlightId(jump.id);
          clear = window.setTimeout(() => setHighlightId(null), 2200);
        } else if (++tries < 60) {
          frame = requestAnimationFrame(find);
        }
      };
      find();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [jump, convoKey]);

  // Mensagem nova desce a conversa (se você já estava no fim); página antiga mantém a posição.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = thread.messages[0]?.id ?? 0;
    const last = thread.messages.at(-1)?.id ?? 0;
    const prev = edges.current;
    const mine = thread.messages.at(-1)?.senderId === meId && last !== prev.last;
    if (prev.first && first !== prev.first && last === prev.last) {
      el.scrollTop += el.scrollHeight - prev.height;
    } else if (atBottom.current || mine || !prev.last) {
      el.scrollTop = el.scrollHeight;
    }
    edges.current = { first, last, height: el.scrollHeight };
  }, [thread.messages, meId]);

  // A área da conversa encolhe quando a chamada abre em cima ou a faixa de chamada aparece: quem estava no fim continua no fim.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    edges.current.height = el.scrollHeight;
    if (el.scrollTop < 150 && thread.hasMore && !thread.loading) onLoadOlder();
  };

  const rows: ReactNode[] = [];
  let previous: M | null = null;
  let previousWasEvent = false;
  for (const message of thread.messages) {
    const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
    if (newDay) {
      rows.push(
        <div key={`day-${message.id}`} className="my-4 flex items-center gap-3 px-5 text-xs font-semibold text-faint">
          <span className="h-px flex-1 bg-line" />
          {dayLabel(message.createdAt)}
          <span className="h-px flex-1 bg-line" />
        </div>,
      );
    }
    const event = renderEvent?.(message) ?? null;
    if (event) {
      rows.push(
        <div key={message.id} data-mid={message.id}>
          {event}
        </div>,
      );
      previousWasEvent = true;
    } else {
      const groupStart =
        newDay || !previous || previousWasEvent || previous.senderId !== message.senderId || message.createdAt - previous.createdAt > GROUP_GAP_MS;
      rows.push(
        <MessageRow
          key={message.id}
          message={message}
          author={authorOf(message.senderId)}
          isMine={message.senderId === meId}
          groupStart={groupStart}
          highlight={highlightId === message.id}
          onDelete={() => onDelete(message)}
          onPin={() => onPin(message)}
        />,
      );
      previousWasEvent = false;
    }
    previous = message;
  }

  const typing = typingNames.length ? typingText(typingNames) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pb-4">
        {thread.loaded && !thread.hasMore && intro}
        {thread.loading && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
        {rows}
      </div>
      <div className="shrink-0 px-4 pb-4">
        <div className="flex h-6 items-center gap-1.5 px-1 text-xs text-muted">
          {typing && (
            <>
              <TypingDots /> <span className="font-semibold text-white/80">{typing.who}</span> {typing.verb}
            </>
          )}
        </div>
        <Composer placeholder={placeholder} focusKey={convoKey} onSend={onSend} onTyping={onTyping} />
      </div>
    </div>
  );
}
