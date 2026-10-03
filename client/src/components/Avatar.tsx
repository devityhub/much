import { useState } from 'react';
import { avatarGradient } from '../lib/theme';
import type { VisiblePresence } from '../lib/types';

export type Status = VisiblePresence;

interface AvatarProps {
  nick: string;
  avatar: string;
  image?: string | null;
  size?: number;
  status?: Status;
  speaking?: boolean;
  statusBg?: string;
  className?: string;
}

/** Bolinha de presença. `offset` afasta do canto para encostar na borda de avatares com anel. */
export function StatusDot({ status, size, bg, offset = -2 }: { status: Status; size: number; bg: string; offset?: number }) {
  const box = { width: size, height: size, right: offset, bottom: offset, boxShadow: `0 0 0 3px ${bg}` };
  const base = 'absolute rounded-full';
  if (status === 'idle') {
    return (
      <span className={`${base} overflow-hidden bg-warn`} style={box}>
        <span className="absolute rounded-full" style={{ width: size * 0.62, height: size * 0.62, top: -size * 0.08, left: -size * 0.08, background: bg }} />
      </span>
    );
  }
  if (status === 'dnd') {
    return (
      <span className={`${base} flex items-center justify-center bg-danger`} style={box}>
        <span className="rounded-full" style={{ width: size * 0.55, height: Math.max(2, size * 0.18), background: bg }} />
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className={`${base} flex items-center justify-center bg-faint`} style={box}>
        <span className="rounded-full" style={{ width: size * 0.42, height: size * 0.42, background: bg }} />
      </span>
    );
  }
  return <span className={`${base} bg-ok`} style={box} />;
}

export default function Avatar({
  nick,
  avatar,
  image,
  size = 32,
  status,
  speaking = false,
  statusBg = 'var(--color-surface-1)',
  className = '',
}: AvatarProps) {
  // Avatares grandes pedem uma bolinha proporcionalmente menor, senão ela cobre o rosto.
  const dot = Math.max(10, Math.round(size * (size > 48 ? 0.22 : 0.3)));
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = image && failed !== image;
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold text-white uppercase select-none transition-shadow ${
          speaking ? 'speaking' : ''
        }`}
        style={{ background: avatarGradient(avatar), fontSize: size * 0.42 }}
        title={nick}
      >
        {showImage ? (
          <img src={image} alt="" draggable={false} onError={() => setFailed(image)} className="h-full w-full object-cover" />
        ) : (
          nick.slice(0, 1)
        )}
      </div>
      {status && <StatusDot status={status} size={dot} bg={statusBg} />}
    </div>
  );
}
