"use client";

import { cn } from "@/lib/cn";
import type { Presence } from "@/data/mock";

const statusColor: Record<Presence, string> = {
  online: "bg-[#23a559]",
  idle: "bg-[#f0b232]",
  dnd: "bg-[#f23f43]",
  offline: "bg-[#80848e]",
};

export function Avatar({
  name,
  hue,
  status,
  size = 32,
  className,
}: {
  name: string;
  hue: number;
  status?: Presence;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const ring = Math.max(10, Math.round(size * 0.34));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 62% 48%), hsl(${hue} 55% 34%))`,
          fontSize: Math.max(10, size * 0.34),
        }}
        aria-hidden
      >
        {initials}
      </div>
      {status ? (
        <span
          className={cn(
            "absolute bottom-[-1px] right-[-1px] rounded-full border-[3px] border-[var(--dc-sidebar)]",
            statusColor[status],
          )}
          style={{ width: ring, height: ring }}
          title={status}
        />
      ) : null}
    </div>
  );
}
