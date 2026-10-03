import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { MonitorOff, MonitorUp, PhoneOff, Signal, Video, VideoOff } from 'lucide-react';
import { useCall } from '../../context/call';
import { useUi } from '../../context/ui';
import { MusicMini } from '../room/MusicPanel';

function PanelButton({ label, onClick, active = false, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors ${
        active ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-muted hover:bg-surface-4 hover:text-white'
      }`}
    >
      {children}
    </motion.button>
  );
}

export default function VoicePanel() {
  const { active, snapshot, ringing, busy, leave, toggleCam, stopScreen } = useCall();
  const { setScreenShareOpen } = useUi();
  const navigate = useNavigate();
  const media = snapshot?.media;

  const status = !snapshot || snapshot.status === 'connecting' ? 'Conectando...' : ringing ? 'Chamando...' : 'Voz conectada';
  const color = snapshot?.status === 'joined' && !ringing ? 'text-ok' : 'text-warn';
  const target = !active
    ? ''
    : active.kind === 'room'
      ? `/app/room/${active.roomId}`
      : active.kind === 'group'
        ? `/app/group/${active.group?.id}`
        : `/app/dm/${active.friend?.id}`;

  return (
    <AnimatePresence>
      {active && media && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="overflow-hidden border-t border-line bg-surface-2"
        >
          <div className="space-y-2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(target)} className="min-w-0 flex-1 text-left">
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                  <Signal size={15} />
                  {status}
                </span>
                <span className="block truncate text-xs text-muted hover:underline">
                  {active.kind === 'room' ? active.title : active.kind === 'group' ? `Grupo ${active.group?.name ?? active.title}` : `Chamada com ${active.title}`}
                </span>
              </button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={leave}
                className="rounded-lg p-2 text-muted transition hover:bg-danger/15 hover:text-danger"
                title="Desconectar"
                aria-label="Desconectar"
              >
                <PhoneOff size={18} />
              </motion.button>
            </div>
            <MusicMini />
            <div className="flex gap-1.5">
              <PanelButton label={media.cam ? 'Desligar câmera' : 'Ligar câmera'} active={media.cam} onClick={() => !busy && void toggleCam()}>
                {media.cam ? <Video size={17} /> : <VideoOff size={17} />}
              </PanelButton>
              <PanelButton
                label={media.screen ? 'Parar transmissão' : 'Transmitir tela'}
                active={media.screen}
                onClick={() => (media.screen ? stopScreen() : setScreenShareOpen(true))}
              >
                {media.screen ? <MonitorOff size={17} /> : <MonitorUp size={17} />}
              </PanelButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
