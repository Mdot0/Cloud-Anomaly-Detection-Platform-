import { useMemo, useState } from "react";

type Row = Record<string, any>;

type Props = {
  rows: Row[];
  defaultSortKey?: string;
};

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function compareValues(a: any, b: any, dir: "asc" | "desc") {
  const an = toNumber(a);
  const bn = toNumber(b);

  if (!Number.isNaN(an) && !Number.isNaN(bn)) {
    return dir === "asc" ? an - bn : bn - an;
  }

  const as = String(a ?? "");
  const bs = String(b ?? "");
  return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
}

function isProbablyIdCol(col: string) {
  const c = col.toLowerCase();
  return c.includes("id") || c.includes("hash") || c.includes("guid") || c.includes("uuid");
}

export default function ResultsTable({ rows, defaultSortKey = "anomaly_score" }: Props) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const columns = useMemo(() => {
    if (!rows?.length) return [];
    const preferred = ["user", "pc", "activity", "anomaly_score", "is_anomaly", "model_version", "scored_at"];
    const keys = Object.keys(rows[0]);
    const rest = keys.filter((k) => !preferred.includes(k));
    return [...preferred.filter((k) => keys.includes(k)), ...rest];
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...(rows || [])];
    copy.sort((r1, r2) => compareValues(r1?.[sortKey], r2?.[sortKey], sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  function onHeaderClick(col: string) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir(col === "anomaly_score" ? "desc" : "asc");
    }
  }

  if (!rows?.length) {
    return <div className="text-sm text-zinc-400">No rows to display.</div>;
  }

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
        >
          Toggle sort ({sortDir})
        </button>

        <div className="text-xs text-zinc-400">
          Sorting by <span className="font-semibold text-zinc-200">{sortKey}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-900 bg-zinc-950/30">
        <table className="min-w-[900px] w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => {
                const active = sortKey === col;
                const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
                return (
                  <th
                    key={col}
                    onClick={() => onHeaderClick(col)}
                    title="Click to sort"
                    className={[
                      "select-none cursor-pointer whitespace-nowrap",
                      "border-b border-zinc-800 bg-zinc-950/80 backdrop-blur",
                      "px-3 py-2 text-left font-semibold text-zinc-200",
                      "hover:bg-zinc-900/60",
                      active ? "text-white" : "text-zinc-300",
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      <span className="text-zinc-400">{arrow}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-900">
            {sortedRows.map((row, i) => {
              const isAnom = String(row?.is_anomaly) === "1" || row?.is_anomaly === 1;
              return (
                <tr
                  key={i}
                  className={[
                    "transition",
                    "hover:bg-zinc-900/35",
                    isAnom ? "bg-emerald-500/10" : "bg-transparent",
                  ].join(" ")}
                >
                  {columns.map((col) => {
                    const v = row?.[col];
                    const text = String(v ?? "");

                    const mono = isProbablyIdCol(col) || text.length > 28;
                    return (
                      <td
                        key={col}
                        className={[
                          "px-3 py-2 align-top",
                          "text-zinc-100",
                          "max-w-[260px] whitespace-nowrap overflow-hidden text-ellipsis",
                          mono ? "font-mono text-[11px] text-zinc-200" : "text-xs",
                        ].join(" ")}
                        title={text}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Optional helper note */}
      <div className="mt-2 text-[11px] text-zinc-500">
        Tip: click headers to sort. Long values are truncated — hover to see full value.
      </div>
    </div>
  );
}
