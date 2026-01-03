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
    const copy = [...rows];
    copy.sort((r1, r2) => compareValues(r1?.[sortKey], r2?.[sortKey], sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  function onHeaderClick(col: string) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      // sensible default: anomaly_score sorts high->low first
      setSortDir(col === "anomaly_score" ? "desc" : "asc");
    }
  }

  if (!rows?.length) {
    return <div className="text-sm text-zinc-500">No rows to display.</div>;
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
          >
            Toggle sort ({sortDir})
          </button>
          <div className="text-xs text-zinc-400">
            Sorting by <span className="font-semibold text-zinc-200">{sortKey}</span>
          </div>
        </div>

        <div className="text-xs text-zinc-500">Click a column header to sort</div>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-auto rounded-2xl border border-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-zinc-950/80 backdrop-blur text-zinc-300">
            <tr>
              {columns.map((col) => {
                const active = sortKey === col;
                return (
                  <th
                    key={col}
                    onClick={() => onHeaderClick(col)}
                    className={`px-3 py-2 text-left whitespace-nowrap select-none cursor-pointer ${
                      active ? "text-zinc-100" : ""
                    }`}
                    title="Click to sort"
                  >
                    {col}
                    {active ? (
                      <span className="ml-1 text-zinc-400">{sortDir === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-900">
            {sortedRows.map((row, idx) => {
              const isAnom =
                "is_anomaly" in row &&
                (row["is_anomaly"] === 1 ||
                  row["is_anomaly"] === "1" ||
                  row["is_anomaly"] === true ||
                  row["is_anomaly"] === "true");

              return (
                <tr key={idx} className={isAnom ? "bg-emerald-950/20" : "hover:bg-zinc-900/30"}>
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-xs text-zinc-200 whitespace-nowrap">
                      {String(row?.[col] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
