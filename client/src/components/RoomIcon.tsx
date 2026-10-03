import { useState } from 'react';
import { coverGradient } from '../lib/theme';

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** Ícone da sala: a imagem enviada ou as iniciais sobre a cor da sala, como servidores do Discord. */
export default function RoomIcon({
  name,
  cover,
  image,
  size = 48,
  className = '',
}: {
  name: string;
  cover: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden font-display font-bold text-white select-none ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.3, background: coverGradient(cover), fontSize: size * 0.36 }}
    >
      {image && failed !== image ? (
        <img src={image} alt="" draggable={false} onError={() => setFailed(image)} className="h-full w-full object-cover" />
      ) : (
        <span className="drop-shadow">{initials(name)}</span>
      )}
    </div>
  );
}
