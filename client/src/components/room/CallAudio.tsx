import { useCall, useCallSnapshot } from '../../context/call';
import { useFriends } from '../../context/friends';
import { useSettings } from '../../lib/settings';
import { useVolume } from '../../lib/volumes';
import type { PeerView } from '../../lib/roomClient';
import { AudioSink } from './MediaView';

function PeerAudio({ peer, sinkId, master, muted }: { peer: PeerView; sinkId: string; master: number; muted: boolean }) {
  const voice = useVolume(peer.user.id, 'voice');
  const screen = useVolume(peer.user.id, 'screen');
  const blocked = useFriends().isBlocked(peer.user.id);
  const settings = useSettings();
  return (
    <>
      <AudioSink stream={peer.micStream} volume={voice * master} sinkId={sinkId} muted={muted || blocked} />
      {peer.media.screenAudio && <AudioSink stream={peer.screenStream} volume={screen * master} sinkId={sinkId} muted={muted} />}
      {peer.media.music && (
        <AudioSink
          stream={peer.musicStream}
          volume={settings.musicVolume * master}
          sinkId={sinkId}
          muted={muted || blocked || settings.musicMuted}
        />
      )}
    </>
  );
}

/** Fica montado no layout do app para o som continuar ao trocar de página. */
export default function CallAudio() {
  const { deafened } = useCall();
  const snapshot = useCallSnapshot();
  const settings = useSettings();
  if (!snapshot) return null;
  return (
    <>
      {snapshot.peers.map((peer) => (
        <PeerAudio key={peer.socketId} peer={peer} sinkId={settings.audioOutputId} master={settings.outputVolume} muted={deafened} />
      ))}
    </>
  );
}
