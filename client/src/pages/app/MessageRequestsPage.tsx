import { AnimatePresence, motion } from 'motion/react';
import { Check, Inbox, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import { Button } from '../../components/ui';
import { useDms } from '../../context/dms';
import { useToast } from '../../context/toast';
import { useUserTrigger } from '../../context/ui';
import { displayName } from '../../lib/users';

function previewOf(content: string, kind: string) {
  if (kind === 'sticker') return 'Mandou uma figurinha';
  if (kind === 'call') return 'Chamada de voz';
  return content.replace(/\s+/g, ' ');
}

export default function MessageRequestsPage() {
  const { messageRequests, acceptRequest, ignoreRequest } = useDms();
  const navigate = useNavigate();
  const toast = useToast();
  const trigger = useUserTrigger();

  const safe = (action: Promise<unknown>, ok?: string) =>
    action
      .then(() => {
        if (ok) toast(ok, 'success');
      })
      .catch((err: Error) => toast(err.message, 'error'));

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
        <Inbox size={20} className="text-muted" />
        <span className="font-semibold">Solicitações de mensagens</span>
        {messageRequests.length > 0 && (
          <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white">{messageRequests.length}</span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-muted">
          Mensagens de pessoas que ainda não estão na sua lista de amigos. Aceite para conversar ou ignore para remover.
        </p>

        <AnimatePresence initial={false}>
          {messageRequests.map((request, i) => (
            <motion.div
              key={request.userId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 border-t border-line px-2 py-4 hover:rounded-xl hover:border-transparent hover:bg-surface-2"
            >
              <button {...trigger(request.user)} className="shrink-0">
                <Avatar nick={request.user.nick} avatar={request.user.avatar} image={request.user.avatarImage} size={40} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <button {...trigger(request.user)} className="font-semibold hover:underline">
                    {displayName(request.user)}
                  </button>
                  <span className="text-sm text-muted">@{request.user.nick}</span>
                  {request.unread > 0 && (
                    <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{request.unread}</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted">{previewOf(request.lastMessage.content, request.lastMessage.kind)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void safe(acceptRequest(request.userId).then(() => navigate(`/app/dm/${request.userId}`)), 'Solicitação aceita')
                    }
                  >
                    <Check size={16} />
                    Aceitar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void safe(ignoreRequest(request.userId), 'Solicitação ignorada')}
                  >
                    <X size={16} />
                    Ignorar
                  </Button>
                  <Button variant="ghost" onClick={() => navigate(`/app/dm/${request.userId}`)} title="Ver conversa">
                    <MessageCircle size={16} />
                    Abrir
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!messageRequests.length && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 text-center text-muted">
            <div className="mb-4 rounded-3xl bg-surface-2 p-6">
              <Inbox size={44} className="text-faint" />
            </div>
            <p className="font-semibold text-white">Nenhuma solicitação</p>
            <p className="mt-1 max-w-sm text-sm">Quando alguém te mandar mensagem sem ser amigo, a solicitação aparece aqui.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
