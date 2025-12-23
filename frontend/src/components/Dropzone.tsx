import { useCallback, useMemo, useState } from "react";

export function Dropzone({
  onPick,
  accept = ".csv,text/csv",
  disabled = false,
}: {
  onPick: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState(false);

  const border = useMemo(() => {
    if (disabled) return "border-zinc-800";
    return drag ? "border-emerald-500/70" : "border-zinc-800";
  }, [drag, disabled]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onPick(f);
    },
    [onPick, disabled]
  );

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        setDrag(false);
      }}
      onDrop={onDrop}
      className={`rounded-2xl border ${border} bg-zinc-950/40 p-4 transition`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Drop CSV here</div>
          <div className="mt-1 text-xs text-zinc-400">
            or click to choose a file (logon.csv / http.csv / etc.)
          </div>
        </div>
        <label className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold
          ${disabled ? "bg-zinc-800 text-zinc-400 cursor-not-allowed" : "bg-white text-zinc-950 hover:bg-zinc-100"}`}>
          Choose file
          <input
            type="file"
            accept={accept}
            disabled={disabled}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}
