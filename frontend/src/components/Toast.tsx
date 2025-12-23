import { useEffect } from "react";

export type ToastState =
  | { type: "success" | "error" | "info"; title: string; message?: string }
  | null;

export function Toast({
  toast,
  onClose,
  durationMs = 3500,
}: {
  toast: ToastState;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [toast, onClose, durationMs]);

  if (!toast) return null;

  const styles =
    toast.type === "success"
      ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-100"
      : toast.type === "error"
      ? "border-rose-700/60 bg-rose-950/40 text-rose-100"
      : "border-zinc-700/60 bg-zinc-950/40 text-zinc-100";

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))]">
      <div className={`rounded-2xl border p-4 shadow-2xl backdrop-blur ${styles}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{toast.title}</div>
            {toast.message && (
              <div className="mt-1 text-xs text-zinc-200/90 whitespace-pre-wrap break-words">
                {toast.message}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
