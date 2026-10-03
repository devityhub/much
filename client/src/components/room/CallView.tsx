import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Hash, ShieldCheck, Users } from 'lucide-react';
import Avatar from '../Avatar';
import Spinner from '../Spinner';
import ControlBar from './ControlBar';
import MusicPanel from './MusicPanel';
import ParticipantTile from './ParticipantTile';
import ScreenStage, { LiveBadge, type ScreenSource } from './ScreenStage';
import { useCall } from '../../context/call';
import { useFriends } from '../../context/friends';
import { useUserTrigger } from '../../context/ui';
import { useAuth } from '../../lib/auth';
import { useSettings } from '../../lib/settings';
import { displayName } from '../../lib/users';

function RingingView() {
  const { active } = useCall();
  const { friends } = useFriends();
  const friend = active?.friend;
  if (!friend) return null;
  const offline = friends.find((f) => f.user.id === friend.id)?.online === false;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 pb-20">
      <div className="relative flex items-center justify-center">
        {[0, 0.5, 1].map((delay) => (
          <span
            key={delay}
            className="ring-pulse absolute h-32 w-32 rounded-full border-2 border-accent/60"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
          <Avatar nick={friend.nick} avatar={friend.avatar} image={friend.avatarImage} size={128} />
        </motion.div>
      </div>
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold">{displayName(friend)}</h2>
        <p className="mt-1 flex items-center justify-center gap-1 text-muted">
          Chamando
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.4 }}>
            ...
          </motion.span>
        </p>
        {offline && <p className="mx-auto mt-2 max-w-xs text-sm text-faint">Está offline agora. Vai tocar para essa pessoa assim que ela abrir o Much.</p>}
      </div>
    </div>
  );
}

export default function CallView() {
  const { active, snapshot, ringing, deafened } = useCall();
  const { user } = useAuth();
  const settings = useSettings();
  const trigger = useUserTrigger();
  const [focusedScreen, setFocusedScreen] = useState<string | null>(null);

  const screens = useMemo<ScreenSource[]>(() => {
    if (!snapshot || !user) return [];
    const list: ScreenSource[] = [];
    if (snapshot.media.screen && snapshot.local.screen) {
      list.push({ id: 'self', user, stream: snapshot.local.screen, isSelf: true, hasAudio: snapshot.media.screenAudio });
    }
    for (const peer of snapshot.peers) {
      if (peer.media.screen && peer.screenStream) {
        list.push({ id: peer.socketId, user: peer.user, stream: peer.screenStream, isSelf: false, hasAudio: peer.media.screenAudio });
      }
    }
    return list;
  }, [snapshot, user]);

  if (!active || !snapshot || !user) return null;

  const stage = screens.find((s) => s.id === focusedScreen) ?? screens[0];
  const total = snapshot.peers.length + 1;
  const compact = Boolean(stage);
  const gridCols = compact ? '' : total <= 1 ? 'grid-cols-1 max-w-3xl' : total <= 4 ? 'grid-cols-2 max-w-5xl' : 'grid-cols-3 max-w-6xl';

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
        {active.kind === 'private' && active.friend ? (
          <>
            <button {...trigger(active.friend)} className="flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-surface-3">
              <Avatar nick={active.friend.nick} avatar={active.friend.avatar} image={active.friend.avatarImage} size={26} />
              <span className="font-semibold">{displayName(active.friend)}</span>
            </button>
            <span className="text-sm text-muted">· Chamada privada</span>
          </>
        ) : active.kind === 'group' ? (
          <>
            <Users size={20} className="text-muted" />
            <span className="truncate font-semibold">{active.group?.name ?? active.title}</span>
            <span className="shrink-0 text-sm text-muted">· Chamada do grupo</span>
          </>
        ) : (
          <>
            <Hash size={20} className="text-muted" />
            <span className="font-semibold">{active.title}</span>
          </>
        )}
        {screens.length > 0 && <LiveBadge />}
        <div className="ml-auto flex items-center gap-4 text-sm text-muted">
          {snapshot.systemAudio.active && (
            <span className="flex items-center gap-1.5 text-ok" title={snapshot.systemAudio.sources.join(', ')}>
              <ShieldCheck size={16} /> Som do PC sem Discord
            </span>
          )}
          {deafened && <span className="text-danger">Ensurdecido</span>}
          <span className="flex items-center gap-1.5">
            <Users size={16} /> {total}
          </span>
        </div>
      </header>

      {snapshot.status === 'connecting' ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : ringing && snapshot.peers.length === 0 ? (
        <RingingView />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pb-24">
          <AnimatePresence>{snapshot.music && <MusicPanel key="music" />}</AnimatePresence>
          {stage && <ScreenStage key={stage.id} screen={stage} />}

          {screens.length > 1 && (
            <div className="flex justify-center gap-2">
              {screens.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => setFocusedScreen(screen.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    screen.id === stage?.id ? 'bg-white text-black' : 'bg-surface-4 text-muted hover:text-white'
                  }`}
                >
                  {screen.isSelf ? 'Sua tela' : screen.user.nick}
                </button>
              ))}
            </div>
          )}

          <div className={compact ? 'flex shrink-0 justify-center gap-3 overflow-x-auto no-scrollbar px-1 py-2' : 'flex flex-1 items-center justify-center overflow-y-auto px-1 py-2'}>
            <div className={compact ? 'flex gap-3' : `grid w-full gap-4 ${gridCols}`}>
              <AnimatePresence>
                <ParticipantTile
                  key="self"
                  user={user}
                  isSelf
                  micOn={snapshot.media.mic}
                  sharingScreen={snapshot.media.screen}
                  camStream={snapshot.media.cam ? snapshot.local.cam : null}
                  micStream={snapshot.local.mic}
                  mirror={settings.mirrorCamera}
                  compact={compact}
                  music={Boolean(snapshot.media.music)}
                />
                {snapshot.peers.map((peer) => (
                  <ParticipantTile
                    key={peer.socketId}
                    user={peer.user}
                    micOn={peer.media.mic}
                    sharingScreen={peer.media.screen}
                    camStream={peer.camStream}
                    micStream={peer.micStream}
                    connectionState={peer.connectionState}
                    compact={compact}
                    music={Boolean(peer.media.music)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {snapshot.peers.length === 0 && !stage && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center text-sm text-muted">
              {active.kind === 'room' ? 'Você está sozinho aqui. Chame seus amigos!' : 'Aguardando...'}
            </motion.p>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
        <div className="pointer-events-auto">
          <ControlBar />
        </div>
      </div>
    </div>
  );
}
