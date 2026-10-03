import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Check, Search, UserPlus, X } from 'lucide-react';
import Avatar from '../Avatar';
import { Button } from '../ui';
import { Dropdown, HeaderIcon, useDismiss } from './ChatTools';
import { useFriends } from '../../context/friends';
import { displayName } from '../../lib/users';

interface AddPeopleButtonProps {
  /** Quem já está na conversa (não aparece na lista). */
  excludeIds: number[];
  /** Quantas pessoas ainda cabem. */
  slots: number;
  title: string;
  confirmLabel: string;
  /** Mínimo de amigos marcados para liberar o botão. */
  minimum?: number;
  onConfirm: (userIds: number[]) => Promise<void>;
}

/** Escolher amigos para criar um grupo a partir da DM ou para entrar num grupo que já existe. */
export default function AddPeopleButton({ excludeIds, slots, title, confirmLabel, minimum = 1, onConfirm }: AddPeopleButtonProps) {
  const { friends } = useFriends();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  const candidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return friends
      .filter((f) => !excludeIds.includes(f.user.id))
      .filter((f) => !term || displayName(f.user).toLowerCase().includes(term) || f.user.nick.toLowerCase().includes(term))
      .sort((a, b) => Number(b.online) - Number(a.online) || displayName(a.user).localeCompare(displayName(b.user)));
  }, [friends, excludeIds, query]);

  const left = slots - selected.length;
  const toggle = (id: number) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : left > 0 ? [...list, id] : list));

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(selected);
      setSelected([]);
      setQuery('');
      setOpen(false);
    } catch {
      // o contexto já mostrou o erro
    } finally {
      setBusy(false);
    }
  };

  const chosen = friends.filter((f) => selected.includes(f.user.id));

  return (
    <div ref={ref} className="relative">
      <HeaderIcon label={title} active={open} onClick={() => setOpen((v) => !v)}>
        <UserPlus size={19} />
      </HeaderIcon>
      <AnimatePresence>
        {open && (
          <Dropdown
            title={title}
            extra={
              <span className={`ml-auto text-xs ${left > 0 ? 'text-faint' : 'text-warn'}`}>
                {left > 0 ? `Cabem mais ${left} ${left === 1 ? 'pessoa' : 'pessoas'}` : 'Grupo cheio'}
              </span>
            }
            footer={
              <Button onClick={() => void confirm()} disabled={busy || selected.length < minimum} className="w-full">
                {busy ? 'Aguarde...' : confirmLabel}
              </Button>
            }
          >
            <label className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm focus-within:border-white/20">
              {chosen.map((f) => (
                <span key={f.user.id} className="flex items-center gap-1 rounded bg-surface-4 py-0.5 pr-1 pl-1.5 text-xs">
                  {displayName(f.user)}
                  <button onClick={() => toggle(f.user.id)} className="text-muted hover:text-white" aria-label={`Tirar ${displayName(f.user)}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={chosen.length ? '' : 'Digite o nome de um amigo'}
                className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-faint"
              />
              <Search size={15} className="shrink-0 text-faint" />
            </label>
            {candidates.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                {query.trim() ? 'Nenhum amigo com esse nome.' : 'Todos os seus amigos já estão aqui.'}
              </p>
            ) : (
              <ul>
                {candidates.map((f) => {
                  const on = selected.includes(f.user.id);
                  const disabled = !on && left <= 0;
                  return (
                    <li key={f.user.id}>
                      <button
                        onClick={() => toggle(f.user.id)}
                        disabled={disabled}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-3 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <Avatar nick={f.user.nick} avatar={f.user.avatar} image={f.user.avatarImage} size={32} status={f.presence} statusBg="var(--color-surface-2)" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{displayName(f.user)}</span>
                          <span className="block truncate text-xs text-faint">@{f.user.nick}</span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                            on ? 'border-accent bg-accent text-white' : 'border-white/25'
                          }`}
                        >
                          {on && <Check size={14} strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Dropdown>
        )}
      </AnimatePresence>
    </div>
  );
}
