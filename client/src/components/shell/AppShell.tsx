import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation, useOutlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import IncomingCall from './IncomingCall';
import CallAudio from '../room/CallAudio';
import ScreenShareDialog from '../room/ScreenShareDialog';
import CreateRoomModal from '../CreateRoomModal';
import SettingsModal from '../settings/SettingsModal';
import ProfilePopover from '../profile/ProfilePopover';
import ProfileModal from '../profile/ProfileModal';
import UserContextMenu from '../profile/UserContextMenu';
import { useCall } from '../../context/call';
import { useUi } from '../../context/ui';

/** Mantém a página antiga na tela enquanto ela faz a animação de saída. */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

export default function AppShell() {
  const location = useLocation();
  const { startScreen } = useCall();
  const { createRoomOpen, setCreateRoomOpen, screenShareOpen, setScreenShareOpen, editingRoom, setEditingRoom } = useUi();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full"
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <CallAudio />
      <IncomingCall />
      <ProfilePopover />
      <ProfileModal />
      <UserContextMenu />
      <SettingsModal />
      <AnimatePresence>
        {createRoomOpen && <CreateRoomModal key="create" onClose={() => setCreateRoomOpen(false)} />}
        {editingRoom && <CreateRoomModal key={`edit-${editingRoom.id}`} room={editingRoom} onClose={() => setEditingRoom(null)} />}
        {screenShareOpen && (
          <ScreenShareDialog
            key="screen"
            onClose={() => setScreenShareOpen(false)}
            onStart={(options) => {
              setScreenShareOpen(false);
              void startScreen(options);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
