export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}
