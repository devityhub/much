import { Link } from 'react-router-dom';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="much-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#much-logo)" />
      <path
        d="M16 44V24c0-2 2.4-3 3.8-1.6L26 28.6l6.2-6.2c1.4-1.4 3.8-.4 3.8 1.6V44"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M44 26v12M50 22v20" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ to = '/', size = 32, className = '' }: { to?: string; size?: number; className?: string }) {
  return (
    <Link to={to} className={`group flex items-center gap-2.5 select-none ${className}`}>
      <span className="transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
        <LogoMark size={size} />
      </span>
      <span className="font-display font-bold tracking-tight text-white" style={{ fontSize: size * 0.72 }}>
        much
      </span>
    </Link>
  );
}
