import { AnimatePresence, motion } from 'motion/react';
import { Phone, PhoneOff } from 'lucide-react';
import Avatar from '../Avatar';
import { useCall } from '../../context/call';
import { displayName } from '../../lib/users';

export default function IncomingCall() {
  const { incoming, active, acceptIncoming, declineIncoming } = useCall();

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          key={incoming.roomId}
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="fixed top-5 left-1/2 z-[60] w-80 -translate-x-1/2 overflow-hidden rounded-3xl border border-line bg-surface-2 p-6 text-center shadow-2xl shadow-black/60"
        >
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-accent/20 to-transparent" />
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            {[0, 0.6].map((delay) => (
              <span key={delay} className="ring-pulse absolute inset-0 rounded-full border-2 border-ok/60" style={{ animationDelay: `${delay}s` }} />
            ))}
            <motion.div animate={{ rotate: [0, -6, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 1.2, repeatDelay: 0.6 }}>
              {incoming.group?.iconImage ? (
                <img src={incoming.group.iconImage} alt="" draggable={false} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <Avatar nick={incoming.from.nick} avatar={incoming.from.avatar} image={incoming.from.avatarImage} size={80} />
              )}
            </motion.div>
          </div>
          {incoming.group ? (
            <>
              <p className="relative mt-4 truncate font-display text-xl font-semibold">{incoming.group.name}</p>
              <p className="relative text-sm text-muted">
                {displayName(incoming.from)} começou uma chamada no grupo{active ? ' (você sairá da chamada atual)' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="relative mt-4 font-display text-xl font-semibold">{incoming.from.nick}</p>
              <p className="relative text-sm text-muted">está te ligando{active ? ' (você sairá da chamada atual)' : ''}</p>
            </>
          )}
          <div className="relative mt-6 flex justify-center gap-6">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={declineIncoming}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-danger shadow-lg shadow-danger/30"
              aria-label="Recusar"
              title="Recusar"
            >
              <PhoneOff size={22} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              animate={{ y: [0, -3, 0] }}
              transition={{ y: { repeat: Infinity, duration: 0.8 } }}
              onClick={acceptIncoming}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-ok text-black shadow-lg shadow-ok/30"
              aria-label="Atender"
              title="Atender"
            >
              <Phone size={22} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
