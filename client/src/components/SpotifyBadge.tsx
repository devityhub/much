export const SPOTIFY_GREEN = '#1db954';

export function SpotifyLogo({ size = 16, className = '', color = SPOTIFY_GREEN }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill={color} />
      <path
        d="M17.5 16.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.2a.75.75 0 1 1-.33-1.46c4.5-1 8.4-.56 11.5 1.4.35.2.46.67.24 1Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.2-1.97-8.08-2.54-11.87-1.39a.94.94 0 1 1-.55-1.8c4.33-1.31 9.7-.68 13.4 1.6.44.27.58.85.31 1.28Zm.13-3.4C15.26 7.35 8.9 7.14 5.22 8.26a1.12 1.12 0 1 1-.65-2.15c4.22-1.28 11.24-1.03 15.67 1.6a1.12 1.12 0 1 1-1.14 1.93Z"
        fill="#000"
      />
    </svg>
  );
}

/** Insígnia de quem está tocando música do Spotify na sala. */
export default function SpotifyBadge({ size = 16, className = '', label = 'Tocando música do Spotify' }: { size?: number; className?: string; label?: string }) {
  return (
    <span title={label} aria-label={label} role="img" className={`inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-black/40 ${className}`}>
      <SpotifyLogo size={size} />
    </span>
  );
}
