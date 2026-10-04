import type { HTMLAttributes, ReactNode } from 'react';
import { coverGradient } from '../lib/theme';

/** Capa/banner: a foto fica num <img> estável. URL no `background-image` do CSS pisca a cada re-render. */
export default function CoverPhoto({
  cover,
  image,
  className = '',
  children,
  style,
  ...rest
}: {
  cover?: string;
  image?: string | null;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: coverGradient(cover ?? 'cover-1'), ...style }}
      {...rest}
    >
      {image ? (
        <img src={image} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {children}
    </div>
  );
}
