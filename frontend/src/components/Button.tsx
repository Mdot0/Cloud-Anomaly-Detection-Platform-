export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "bg-white text-zinc-950 hover:bg-zinc-100"
      : variant === "danger"
      ? "bg-rose-500 text-zinc-950 hover:bg-rose-400"
      : "bg-zinc-950/70 text-zinc-100 border border-zinc-800 hover:bg-zinc-900";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}
