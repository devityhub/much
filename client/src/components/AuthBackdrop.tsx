export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-bg" />
      <div className="blob -top-56 -left-56 h-[40rem] w-[40rem] bg-accent" />
      <div className="blob -right-64 -bottom-64 h-[46rem] w-[46rem] bg-accent-2" style={{ animationDelay: '-7s' }} />
      <div className="blob top-1/4 left-1/3 h-[28rem] w-[28rem] bg-indigo-600" style={{ animationDelay: '-12s', opacity: 0.25 }} />
      <div className="grain" />
    </div>
  );
}
