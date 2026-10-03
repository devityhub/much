import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ban, Check, Clock, Copy, MessageCircle, Pencil, Phone, User, UserMinus, UserPlus, Volume2, X } from 'lucide-react';
import Avatar from '../Avatar';
import { Slider } from '../ui';
import { useUserActions } from './useUserActions';
import { useCallSnapshot } from '../../context/call';
import { useUi, type UserMenuTarget } from '../../context/ui';
import { displayName } from '../../lib/users';
import { volumeStore, useVolume } from '../../lib/volumes';

const MARGIN = 8;

function Item({ icon, label, onClick, danger = false, disabled = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors disabled:opacity-40 ${
        danger ? 'text-danger hover:bg-danger hover:text-white' : 'hover:bg-accent hover:text-white'
      }`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

const Divider = () => <div className="my-1 h-px bg-line" />;

function VoiceVolume({ userId }: { userId: number }) {
  const volume = useVolume(userId, 'voice');
  return (
    <div className="px-2.5 py-2">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Volume2 size={13} /> Volume da voz
        </span>
        <span>{Math.round(volume * 100)}%</span>
      </div>
      <Slider value={volume} onChange={(v) => volumeStore.set(userId, 'voice', v)} />
    </div>
  );
}

function Menu({ target, close }: { target: UserMenuTarget; close: () => void }) {
  const { user } = target;
  const actions = useUserActions(user);
  const { openFullProfile } = useUi();
  const snapshot = useCallSnapshot();
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ left: target.x, top: target.y, visibility: 'hidden' });
  const inSameCall = Boolean(snapshot?.peers.some((p) => p.user.id === user.id));
  const { relationship } = actions;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const left = Math.min(target.x, window.innerWidth - el.offsetWidth - MARGIN);
    const top = target.y + el.offsetHeight > window.innerHeight - MARGIN ? Math.max(MARGIN, target.y - el.offsetHeight) : target.y;
    setStyle({ left: Math.max(MARGIN, left), top });
  }, [target]);

  const act = (fn: () => unknown) => () => {
    close();
    fn();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      style={{ ...style, transformOrigin: 'top left' }}
      className="fixed z-[55] w-60 rounded-xl border border-line bg-surface-2 p-1.5 shadow-2xl shadow-black/60"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <Avatar nick={user.nick} avatar={user.avatar} image={user.avatarImage} size={28} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName(user)}</p>
          <p className="truncate text-xs text-faint">@{user.nick}</p>
        </div>
      </div>
      <Divider />
      <Item icon={<User size={16} />} label="Ver perfil" onClick={() => openFullProfile(user)} />
      {relationship === 'self' && <Item icon={<Pencil size={16} />} label="Editar perfil" onClick={act(actions.editProfile)} />}
      {relationship === 'friend' && (
        <>
          <Item icon={<MessageCircle size={16} />} label="Mensagem" onClick={act(actions.message)} />
          <Item icon={<Phone size={16} />} label={actions.inCallWith ? 'Em chamada' : 'Ligar'} disabled={actions.inCallWith} onClick={act(actions.call)} />
        </>
      )}
      {relationship === 'none' && <Item icon={<UserPlus size={16} />} label="Adicionar amigo" onClick={act(actions.addFriend)} />}
      {relationship === 'outgoing' && <Item icon={<Clock size={16} />} label="Cancelar pedido de amizade" onClick={act(actions.cancelRequest)} />}
      {relationship === 'incoming' && (
        <>
          <Item icon={<Check size={16} />} label="Aceitar pedido" onClick={act(actions.accept)} />
          <Item icon={<X size={16} />} label="Recusar pedido" onClick={act(actions.decline)} />
        </>
      )}
      {relationship === 'friend' && <Item icon={<UserMinus size={16} />} label="Remover amigo" onClick={act(actions.removeFriend)} />}

      {inSameCall && relationship !== 'self' && (
        <>
          <Divider />
          <VoiceVolume userId={user.id} />
        </>
      )}

      <Divider />
      <Item icon={<Copy size={16} />} label="Copiar nick" onClick={act(actions.copyNick)} />
      {relationship !== 'self' &&
        (relationship === 'blocked' ? (
          <Item icon={<Ban size={16} />} label="Desbloquear" onClick={act(actions.unblock)} />
        ) : (
          <Item icon={<Ban size={16} />} label="Bloquear" danger onClick={act(actions.block)} />
        ))}
    </motion.div>
  );
}

/** Menu do botão direito sobre qualquer usuário. Fica montado no layout do app. */
export default function UserContextMenu() {
  const { userMenu, closeUserMenu } = useUi();

  useEffect(() => {
    if (!userMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeUserMenu();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', closeUserMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeUserMenu);
    };
  }, [userMenu, closeUserMenu]);

  return (
    <>
      {/* Overlay fora do AnimatePresence: evita “fantasma” fixo que bloqueia cliques até o F5. */}
      {userMenu && (
        <div
          className="fixed inset-0 z-[54]"
          onMouseDown={closeUserMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeUserMenu();
          }}
        />
      )}
      <AnimatePresence>
        {userMenu && <Menu key={`menu-${userMenu.user.id}-${userMenu.x}-${userMenu.y}`} target={userMenu} close={closeUserMenu} />}
      </AnimatePresence>
    </>
  );
}
