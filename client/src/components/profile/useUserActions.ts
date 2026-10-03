import { useNavigate } from 'react-router-dom';
import { useCall } from '../../context/call';
import { useFriends } from '../../context/friends';
import { useToast } from '../../context/toast';
import { useUi } from '../../context/ui';
import { displayName } from '../../lib/users';
import type { PublicUser } from '../../lib/types';

/** Ações sobre outro usuário, com confirmação e avisos, usadas pelo card de perfil e pelo menu do botão direito. */
export function useUserActions(user: PublicUser) {
  const friends = useFriends();
  const { callFriend, active } = useCall();
  const { openSettings } = useUi();
  const navigate = useNavigate();
  const toast = useToast();
  const name = displayName(user);
  const { relationship, requestId } = friends.relationshipOf(user.id);
  const friend = friends.friends.find((f) => f.user.id === user.id);

  const run = (action: Promise<unknown>, success?: string) =>
    action.then(
      () => success && toast(success, 'success'),
      (err: Error) => toast(err.message, 'error'),
    );

  return {
    relationship,
    friend,
    inCallWith: active?.kind === 'private' && active.friend?.id === user.id,
    /** Dá para ligar mesmo offline: toca quando a pessoa abrir o Much. */
    canCall: relationship === 'friend',
    call: () => void callFriend(user),
    message: () => navigate(`/app/dm/${user.id}`),
    addFriend: () => run(friends.sendRequest(user.nick), `Pedido enviado para ${name}`),
    accept: () => requestId && run(friends.accept(requestId), `Agora você e ${name} são amigos`),
    decline: () => requestId && run(friends.decline(requestId)),
    cancelRequest: () => requestId && run(friends.decline(requestId), 'Pedido cancelado'),
    removeFriend: () => {
      if (!window.confirm(`Remover ${name} dos amigos?`)) return;
      void run(friends.removeFriend(user.id), `${name} foi removido dos amigos`);
    },
    block: () => {
      if (!window.confirm(`Bloquear ${name}?\n\nVocês deixam de ser amigos, ${name} não poderá te mandar pedidos nem te ligar, e a voz dessa pessoa fica silenciada para você nas salas.`)) return;
      void run(friends.block(user.id), `${name} foi bloqueado`);
    },
    unblock: () => run(friends.unblock(user.id), `${name} foi desbloqueado`),
    copyNick: () => void navigator.clipboard?.writeText(user.nick).then(() => toast('Nick copiado', 'success')),
    editProfile: () => openSettings('profile'),
  };
}
