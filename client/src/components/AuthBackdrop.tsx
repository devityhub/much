const STARS = Array.from({ length: 72 }, (_, i) => ({
  left: `${(i * 53) % 97}%`,
  top: `${(i * 37 + 11) % 96}%`,
  size: 1 + (i % 3),
  kind: i % 6 === 0 ? 'plus' : i % 8 === 0 ? 'diamond' : 'dot',
  delay: `${(i % 9) * 0.4}s`,
}));

import type { CSSProperties } from 'react';

function Planet({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`auth-planet ${className ?? ''}`} style={style} />;
}

export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 820px at 12% 8%, #6d5cff 0%, transparent 46%), radial-gradient(900px 720px at 88% 92%, #3b1d8c 0%, transparent 48%), linear-gradient(165deg, #4b3adf 0%, #2a1a86 42%, #1c0f55 100%)',
        }}
      />
      <Planet
        className="left-[-4%] top-[12%] h-52 w-52"
        style={{
          background:
            'radial-gradient(circle at 32% 30%, rgba(196,181,253,0.55), rgba(91,33,182,0.2) 42%, rgba(15,10,50,0.1) 70%, transparent 72%)',
        }}
      />
      <Planet
        className="right-[8%] top-[6%] h-28 w-28"
        style={{
          background:
            'radial-gradient(circle at 38% 32%, rgba(233,213,255,0.5), rgba(109,40,217,0.25) 46%, transparent 70%)',
        }}
      />
      <Planet
        className="bottom-[4%] left-[38%] h-40 w-40"
        style={{
          background:
            'radial-gradient(circle at 40% 30%, rgba(167,139,250,0.45), rgba(76,29,149,0.35) 50%, transparent 72%)',
          animationDelay: '-8s',
        }}
      />
      <Planet
        className="right-[18%] bottom-[18%] h-24 w-24"
        style={{
          background:
            'radial-gradient(circle at 30% 28%, rgba(251,191,36,0.18), rgba(124,58,237,0.28) 40%, transparent 68%)',
          animationDelay: '-14s',
        }}
      />
      {STARS.map((star, i) =>
        star.kind === 'plus' ? (
          <span
            key={i}
            className="auth-star absolute text-[11px] leading-none text-white/70"
            style={{ left: star.left, top: star.top, animationDelay: star.delay }}
          >
            +
          </span>
        ) : star.kind === 'diamond' ? (
          <span
            key={i}
            className="auth-star absolute rotate-45 bg-white/80"
            style={{
              left: star.left,
              top: star.top,
              width: star.size + 1,
              height: star.size + 1,
              animationDelay: star.delay,
            }}
          />
        ) : (
          <span
            key={i}
            className="auth-star absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: 0.55 + (i % 4) * 0.1,
              animationDelay: star.delay,
            }}
          />
        ),
      )}
      <div className="grain" />
    </div>
  );
}
