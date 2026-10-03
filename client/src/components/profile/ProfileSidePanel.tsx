import { motion } from 'motion/react';
import { UserContent } from './ProfilePopover';
import type { PublicUser } from '../../lib/types';

export const SIDE_PANEL_WIDTH = 340;

/** Nada para fechar: aqui o perfil fica fixo na lateral, então as ações só rodam. */
const stay = () => undefined;

/** Perfil docado ao lado da conversa, como no Discord: as mesmas opções do balão, sempre à vista. */
export default function ProfileSidePanel({ user }: { user: PublicUser }) {
  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: SIDE_PANEL_WIDTH, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className="hidden shrink-0 overflow-hidden border-l border-line bg-surface-2 lg:block"
    >
      <div className="h-full overflow-x-hidden overflow-y-auto" style={{ width: SIDE_PANEL_WIDTH }}>
        <UserContent key={user.id} seed={user} close={stay} flush />
      </div>
    </motion.aside>
  );
}
