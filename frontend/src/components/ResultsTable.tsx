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

function isAnomalyRow(row: Row) {
  const v = row?.is_anomaly;
  return v === 1 || v === "1" || v === true || v === "true";
}

function formatCell(col: string, v: any) {
  if (v == null) return "";

  // nicer number formatting for anomaly_score
  if (col === "anomaly_score") {
    const n = Number(v);
    if (Number.isFinite(n)) return n.toFixed(6);
  }

  // if it looks like a number, keep it as-is (but stringify safely)
  return String(v);
}

function isNarrowCol(col: string) {
  const c = col.toLowerCase();
  return c === "is_anomaly" || c.includes("flag") || c.includes("bool");
}

function isNumericCol(col: string) {
  const c = col.toLowerCase();
  return c.includes("score") || c.includes("count") || c.includes("num") || c.includes("pct");
}

export default function ResultsTable({ rows, defaultSortKey = "anomaly_score" }: Props) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [q, setQ] = useState("");

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const columns = useMemo(() => {
    if (!rows?.length) return [];
    const preferred = ["user", "pc", "activity", "anomaly_score", "is_anomaly", "model_version", "scored_at"];
    const keys = Object.keys(rows[0]);
    const rest = keys.filter((k) => !preferred.includes(k));
    return [...preferred.filter((k) => keys.includes(k)), ...rest];
  }, [rows]);

  const stickyCol = useMemo(() => {
    // Make "user" sticky if present, otherwise first column
    if (!columns.length) return null;
    return columns.includes("user") ? "user" : columns[0];
  }, [columns]);

  const filteredRows = useMemo(() => {
    let out = rows || [];

    if (onlyAnomalies) out = out.filter((r) => isAnomalyRow(r));

    const query = q.trim().toLowerCase();
    if (query) {
      out = out.filter((r) => {
        // search across all columns
        for (const col of columns) {
          const v = r?.[col];
          if (v == null) continue;
          const s = String(v).toLowerCase();
          if (s.includes(query)) return true;
        }
        return false;
      });
    }

    return out;
  }, [rows, onlyAnomalies, q, columns]);

  const sortedRows = useMemo(() => {
    const copy = [...(filteredRows || [])];
    copy.sort((r1, r2) => compareValues(r1?.[sortKey], r2?.[sortKey], sortDir));
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  function onHeaderClick(col: string) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir(col === "anomaly_score" ? "desc" : "asc");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore (no toast here; keep table fast)
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

        <button
          onClick={() => setOnlyAnomalies((v) => !v)}
          className={[
            "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
            onlyAnomalies
              ? "border-emerald-700 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
              : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900",
          ].join(" ")}
        >
          {onlyAnomalies ? "Showing anomalies" : "Only anomalies"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rows…"
            className="w-[260px] rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />
          <button
            onClick={() => setQ("")}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
            disabled={!q}
          >
            Clear
          </button>
        </div>

        <div className="w-full text-xs text-zinc-400">
          Sorting by <span className="font-semibold text-zinc-200">{sortKey}</span> •{" "}
          <span className="text-zinc-500">{sortedRows.length.toLocaleString()} rows</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-900 bg-zinc-950/30">
        <table className="min-w-[900px] w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20">
            <tr>
              {columns.map((col) => {
                const active = sortKey === col;
                const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";

                const sticky = stickyCol === col;
                return (
                  <th
                    key={col}
                    onClick={() => onHeaderClick(col)}
                    title="Click to sort"
                    className={[
                      "select-none cursor-pointer whitespace-nowrap",
                      "border-b border-zinc-800 bg-zinc-950/85 backdrop-blur",
                      "px-3 py-2 text-left font-semibold",
                      "hover:bg-zinc-900/60",
                      active ? "text-white" : "text-zinc-300",
                      isNarrowCol(col) ? "w-[110px]" : "",
                      sticky ? "sticky left-0 z-30 shadow-[1px_0_0_0_rgba(255,255,255,0.06)]" : "",
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      <span className="text-zinc-500">{arrow}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-900">
            {sortedRows.map((row, i) => {
              const anom = isAnomalyRow(row);

              return (
                <tr
                  key={i}
                  onClick={() => setSelectedRow(row)}
                  className={[
                    "group cursor-pointer transition",
                    "hover:bg-zinc-900/35",
                    anom ? "bg-emerald-500/10" : "bg-transparent",
                  ].join(" ")}
                >
                  {columns.map((col) => {
                    const sticky = stickyCol === col;
                    const raw = row?.[col];
                    const text = formatCell(col, raw);

                    const right = isNumericCol(col) || col === "anomaly_score";
                    return (
                      <td
                        key={col}
                        className={[
                          "relative px-3 py-2 align-top",
                          "max-w-[280px] whitespace-nowrap overflow-hidden text-ellipsis",
                          right ? "text-right tabular-nums" : "text-left",
                          sticky
                            ? "sticky left-0 z-10 bg-inherit shadow-[1px_0_0_0_rgba(255,255,255,0.06)]"
                            : "",
                          col === "is_anomaly" && anom ? "text-emerald-200 font-semibold" : "text-zinc-100",
                        ].join(" ")}
                        title={text}
                      >
                        <span>{text}</span>

                        {/* copy button appears on hover */}
                        {text && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copy(text);
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:inline-flex rounded-md border border-zinc-800 bg-zinc-950/70 px-1.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-900"
                            title="Copy cell"
                          >
                            Copy
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-zinc-500">
        Tip: click a row for details. Hover a cell to copy its value.
      </div>

      {/* Row details drawer */}
      {selectedRow && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedRow(null)} />

          {/* panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-[560px] border-l border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">Row details</div>
                <div className="mt-1 text-xs text-zinc-500">Full JSON for the selected row</div>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => copy(JSON.stringify(selectedRow, null, 2))}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
              >
                Copy JSON
              </button>
            </div>

            <pre className="mt-3 h-[calc(100%-84px)] overflow-auto rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3 text-[11px] leading-relaxed text-zinc-200">
{JSON.stringify(selectedRow, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
