import React, { useMemo, useState } from "react";

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

  // Numeric compare if both parse to numbers
  if (!Number.isNaN(an) && !Number.isNaN(bn)) {
    return dir === "asc" ? an - bn : bn - an;
  }

  // Fallback string compare
  const as = String(a ?? "");
  const bs = String(b ?? "");
  return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
}

export default function ResultsTable({ rows, defaultSortKey = "anomaly_score" }: Props) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const columns = useMemo(() => {
    if (!rows?.length) return [];
    // Prefer a stable column order: known keys first, then the rest
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
    return <div style={{ opacity: 0.8 }}>No rows to display.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          style={{ padding: "6px 10px", borderRadius: 8 }}
        >
          Toggle sort ({sortDir})
        </button>

        <div style={{ opacity: 0.8 }}>
          Sorting by <b>{sortKey}</b>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => onHeaderClick(col)}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    whiteSpace: "nowrap",
                  }}
                  title="Click to sort"
                >
                  {col}
                  {sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, i) => {
              const isAnom = String(row?.is_anomaly) === "1" || row?.is_anomaly === 1;
              return (
                <tr
                  key={i}
                  style={{
                    background: isAnom ? "rgba(0, 255, 150, 0.08)" : "transparent",
                  }}
                >
                  {columns.map((col) => (
                    <td key={col} style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
