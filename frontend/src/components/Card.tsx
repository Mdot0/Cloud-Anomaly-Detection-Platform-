export function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4 ${className}`}>{children}</section>;
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3 ${className}`}>{children}</div>;
}
