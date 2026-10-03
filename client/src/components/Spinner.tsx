export default function Spinner({ fullscreen = false, size = 40 }: { fullscreen?: boolean; size?: number }) {
  const spinner = (
    <div
      className="animate-spin rounded-full border-[3px] border-white/10 border-t-accent"
      style={{ width: size, height: size }}
    />
  );
  if (!fullscreen) return spinner;
  return <div className="flex h-full min-h-screen items-center justify-center bg-bg">{spinner}</div>;
}
