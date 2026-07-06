import { useMemo } from "react";
import type { AnalyzeSummary } from "../types";
import type { AnalysisStatus } from "../hooks/useAnalysis";
import { Button } from "./Button";
import { Card, Section } from "./Card";
import { Pill } from "./Pill";
import ResultsTable from "./ResultsTable";

type Props = {
  status: AnalysisStatus;
  summary: AnalyzeSummary | null;
  rows: Record<string, any>[] | null;
  rawText: string | null;
  resultsLimit: number;
  onResultsLimitChange: (n: number) => void;
  onLoadResults: () => void;
  busy: string | null;
  selectedUploadId: string;
};

export function ResultsSection({
  status,
  summary,
  rows,
  rawText,
  resultsLimit,
  onResultsLimitChange,
  onLoadResults,
  busy,
  selectedUploadId,
}: Props) {
  const previewCols = useMemo(() => {
    if (!rows?.length) return [];
    return Object.keys(rows[0]).slice(0, 14);
  }, [rows]);

  const anomaliesCountInPreview = useMemo(() => {
    if (!rows?.length) return null;
    if (!("is_anomaly" in rows[0])) return null;
    let c = 0;
    for (const r of rows) {
      const v = r["is_anomaly"];
      if (v === 1 || v === "1" || v === true || v === "true") c++;
    }
    return c;
  }, [rows]);

  return (
    <>
      <Section>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Results</div>
            <div className="text-xs text-zinc-400">Uploads are analyzed automatically in the background</div>
          </div>
          {status === "processing" && <Pill>Processing…</Pill>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Load results</div>
            <div className="text-xs text-zinc-400">GET /api/results?limit=…</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <span className="text-xs text-zinc-400">rows</span>
              <input
                type="number"
                min={1}
                max={5000}
                value={resultsLimit}
                onChange={(e) => onResultsLimitChange(parseInt(e.target.value || "100", 10))}
                className="w-24 bg-transparent text-sm outline-none"
              />
            </div>
            <Button variant="secondary" onClick={onLoadResults} disabled={!!busy || !selectedUploadId}>
              Load
            </Button>
          </div>
        </div>

        {status === "processing" && (
          <div className="mt-4 rounded-2xl border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-200">
            Still processing — this can take a few seconds for large files. It'll update automatically for a
            freshly uploaded file, or click Load to check an older one again.
          </div>
        )}
      </Section>

      {summary && summary.subjects && summary.subjects.length > 0 && (
        <Section>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Subject Risk Summary</div>
              <div className="text-xs text-zinc-400">Was this person's behavior unusual? Sorted by risk.</div>
            </div>
            <Pill>
              {summary.subjects.length} subject{summary.subjects.length === 1 ? "" : "s"}
            </Pill>
          </div>

          <div className="mt-4 space-y-3">
            {summary.subjects.map((s) => (
              <Card key={s.user}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold font-mono">{s.user}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {s.event_count} events • {s.distinct_pcs} PC{s.distinct_pcs === 1 ? "" : "s"}
                      {s.new_pcs.length > 0 && (
                        <>
                          {" "}
                          • <span className="text-amber-300">{s.new_pcs.length} never seen before</span>
                        </>
                      )}
                      {" • "}
                      {s.off_hours_pct}% off-hours
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-zinc-400">Risk score</div>
                    <div className={`text-lg font-semibold ${s.risk_score > 0.05 ? "text-rose-300" : "text-zinc-100"}`}>
                      {s.risk_score.toFixed(3)}
                    </div>
                  </div>
                </div>

                {s.new_pcs.length > 0 && (
                  <div className="mt-2 text-xs text-zinc-400">
                    New machines: <span className="font-mono text-zinc-200">{s.new_pcs.join(", ")}</span>
                  </div>
                )}

                {s.flagged_events.length > 0 && (
                  <div className="mt-3 border-t border-zinc-900 pt-2">
                    <div className="text-xs font-semibold text-zinc-400">Top flagged events</div>
                    <ul className="mt-1 space-y-1">
                      {s.flagged_events.slice(0, 5).map((e, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                          <span className="truncate">
                            {e.date} • {e.pc} • {e.activity}
                          </span>
                          <span className="font-mono tabular-nums text-zinc-400 shrink-0">
                            {e.anomaly_score.toFixed(4)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Section>
      )}

      {summary && (
        <Section>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Summary</div>
              <div className="text-xs text-zinc-400">Latest analysis output</div>
            </div>
            <Pill>{summary.model_version}</Pill>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Card>
              <div className="text-xs text-zinc-400">Rows</div>
              <div className="mt-1 text-lg font-semibold">{summary.rows}</div>
            </Card>

            <Card>
              <div className="text-xs text-zinc-400">Anomalies</div>
              <div className="mt-1 text-lg font-semibold">{summary.anomalies}</div>
            </Card>

            <Card>
              <div className="text-xs text-zinc-400">Scored at</div>
              <div className="mt-1 text-xs text-zinc-200 break-all">{summary.scored_at}</div>
            </Card>

            <Card>
              <div className="text-xs text-zinc-400">Output blob</div>
              <div className="mt-1 text-xs text-zinc-200 break-all">{summary.output_blob}</div>
            </Card>
          </div>
        </Section>
      )}

      {rows && rows.length > 0 && (
        <Section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Rows (preview)</div>
              <div className="text-xs text-zinc-400">
                Showing {rows.length} rows • {previewCols.length} columns
                {anomaliesCountInPreview !== null && (
                  <>
                    {" "}
                    • <span className="text-emerald-300">{anomaliesCountInPreview} anomalies in preview</span>
                  </>
                )}
              </div>
            </div>
            <Pill>Auto-highlight anomalies</Pill>
          </div>

          <div className="mt-4">
            <ResultsTable rows={rows} />
          </div>
        </Section>
      )}

      {rawText && (
        <section className="rounded-3xl border border-amber-800/50 bg-amber-950/20 p-4">
          <div className="text-sm font-semibold text-amber-200">Backend returned non-JSON</div>
          <div className="mt-2 text-xs text-amber-300">
            /api/results is returning text/plain. Fix it to return JSON and the table will render automatically.
          </div>
          <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-amber-800/40 bg-zinc-950/60 p-3 text-xs text-zinc-200">
            {rawText.slice(0, 4000)}
          </pre>
        </section>
      )}
    </>
  );
}
