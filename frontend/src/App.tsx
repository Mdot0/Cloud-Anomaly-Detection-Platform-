import { useEffect, useMemo, useState } from "react";
import { analyzeUpload, getResults, listUploads, uploadLogs } from "./api";
import type { AnalyzeSummary, UploadItem } from "./types";
import { Dropzone } from "./components/Dropzone";
import { Toast, type ToastState } from "./components/Toast";

function uploadIdFromBlob(blob: string) {
  return blob?.endsWith(".csv") ? blob.slice(0, -4) : blob;
}

function fmtBytes(n: number) {
  if (!Number.isFinite(n)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}

function Button({
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

export default function App() {
  const [toast, setToast] = useState<ToastState>(null);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [selectedUploadId, setSelectedUploadId] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);

  const [resultsLimit, setResultsLimit] = useState(100);

  async function refreshUploads() {
    setBusy("Refreshing uploads…");
    try {
      const data = await listUploads(limit);
      const items = (data.items ?? []).slice();

      // newest first
      items.sort((a: UploadItem, b: UploadItem) => {
        const ad = Date.parse(a.uploaded_at ?? a.last_modified ?? "") || 0;
        const bd = Date.parse(b.uploaded_at ?? b.last_modified ?? "") || 0;
        return bd - ad;
      });

      setUploads(items);
      if (!selectedUploadId && items[0]?.blob) {
        setSelectedUploadId(uploadIdFromBlob(items[0].blob));
      }
    } catch (e: any) {
      setToast({
        type: "error",
        title: "Failed to load uploads",
        message: e?.message ?? String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    refreshUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filteredUploads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uploads;
    return uploads.filter((u) => {
      const id = uploadIdFromBlob(u.blob).toLowerCase();
      const name = (u.original_filename ?? "").toLowerCase();
      return id.includes(q) || name.includes(q);
    });
  }, [uploads, search]);

  const selectedItem = useMemo(() => {
    return uploads.find((u) => uploadIdFromBlob(u.blob) === selectedUploadId) ?? null;
  }, [uploads, selectedUploadId]);

  const step = useMemo(() => {
    // 1: file picked, 2: analyzed, 3: results loaded
    if (rows?.length) return 3;
    if (summary) return 2;
    if (file) return 1;
    return 0;
  }, [file, summary, rows]);

  async function onUpload() {
    if (!file) return;
    setBusy("Uploading…");
    setSummary(null);
    setRows(null);
    setRawText(null);

    try {
      const res = await uploadLogs(file);
      const uploadId = res.upload_id ?? (res.blob ? uploadIdFromBlob(res.blob) : "");
      setToast({
        type: "success",
        title: "Upload complete",
        message: uploadId ? `upload_id: ${uploadId}` : undefined,
      });

      await refreshUploads();
      if (uploadId) setSelectedUploadId(uploadId);
      setFile(null);
    } catch (e: any) {
      setToast({ type: "error", title: "Upload failed", message: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function onAnalyze() {
    if (!selectedUploadId) return;

    setBusy("Analyzing… big CSVs can take a while");
    setSummary(null);
    setRows(null);
    setRawText(null);

    try {
      const s = await analyzeUpload(selectedUploadId);
      setSummary(s);
      setToast({
        type: "success",
        title: "Analyze complete",
        message: `rows: ${s.rows} • model: ${s.model_version}`,
      });
    } catch (e: any) {
      setToast({ type: "error", title: "Analyze failed", message: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function onLoadResults() {
    if (!selectedUploadId) return;

    setBusy("Loading results…");
    setRows(null);
    setRawText(null);

    try {
      const r: any = await getResults(selectedUploadId, resultsLimit);

      if (r?.summary) setSummary(r.summary);
      if (Array.isArray(r?.rows)) setRows(r.rows);

      if (r?._raw) setRawText(String(r._raw));

      setToast({ type: "success", title: "Results loaded" });
    } catch (e: any) {
      setToast({ type: "error", title: "Results failed", message: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  }

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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: "success", title: "Copied to clipboard" });
    } catch {
      setToast({ type: "error", title: "Copy failed" });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="border-b border-zinc-900 bg-gradient-to-b from-zinc-950 to-zinc-950/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white text-zinc-950 flex items-center justify-center font-black">
              CG
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">CloudGuard</div>
              <div className="text-xs text-zinc-400">Upload → Analyze → Review anomalies</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Pill>Step {step}/3</Pill>
            {busy ? <Pill>{busy}</Pill> : <Pill>Ready</Pill>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid gap-6 lg:grid-cols-12">
        {/* Upload list */}
        <aside className="lg:col-span-4 rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Uploads</div>
              <div className="text-xs text-zinc-400">Pick an upload_id to analyze</div>
            </div>
            <Button variant="secondary" onClick={refreshUploads} disabled={!!busy}>
              Refresh
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename or upload_id…"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-zinc-600"
            />
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-zinc-900">
            {filteredUploads.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">No uploads found.</div>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {filteredUploads.map((u) => {
                  const id = uploadIdFromBlob(u.blob);
                  const active = id === selectedUploadId;
                  return (
                    <li key={u.blob}>
                      <button
                        onClick={() => {
                          setSelectedUploadId(id);
                          setSummary(null);
                          setRows(null);
                          setRawText(null);
                        }}
                        className={`w-full text-left p-3 transition ${
                          active ? "bg-zinc-900/60" : "hover:bg-zinc-900/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{u.original_filename ?? u.blob}</div>
                            <div className="mt-1 text-xs text-zinc-500 font-mono break-all">{id}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-400">{fmtBytes(u.size)}</div>
                            <div className="text-[11px] text-zinc-600">
                              {(u.uploaded_at ?? u.last_modified ?? "").toString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedItem && (
            <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-400">Selected upload_id</div>
                  <div className="mt-1 font-mono text-xs text-zinc-200 break-all">{selectedUploadId}</div>
                </div>
                <Button variant="secondary" onClick={() => copy(selectedUploadId)}>
                  Copy
                </Button>
              </div>
            </div>
          )}
        </aside>

        {/* Main flow */}
        <main className="lg:col-span-8 space-y-6">
          {/* Upload */}
          <section className="rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Upload</div>
                <div className="text-xs text-zinc-400">POST /api/upload-logs</div>
              </div>
              <Pill>CSV</Pill>
            </div>

            <div className="mt-4">
              <Dropzone
                disabled={!!busy}
                onPick={(f) => {
                  setFile(f);
                  setToast({
                    type: "info",
                    title: "File selected",
                    message: `${f.name} • ${fmtBytes(f.size)}`,
                  });
                }}
              />
            </div>

            {file && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                <div>
                  <div className="text-sm font-semibold">{file.name}</div>
                  <div className="text-xs text-zinc-400">{fmtBytes(file.size)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setFile(null)} disabled={!!busy}>
                    Clear
                  </Button>
                  <Button onClick={onUpload} disabled={!!busy}>
                    Upload
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Analyze + Results */}
          <section className="rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Analyze selected upload</div>
                <div className="text-xs text-zinc-400">POST /api/analyze?upload_id=…</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedUploadId("")}
                  disabled={!!busy || !selectedUploadId}
                >
                  Unselect
                </Button>
                <Button onClick={onAnalyze} disabled={!!busy || !selectedUploadId}>
                  Analyze
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Load results preview</div>
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
                    onChange={(e) => setResultsLimit(parseInt(e.target.value || "100", 10))}
                    className="w-24 bg-transparent text-sm outline-none"
                  />
                </div>
                <Button variant="secondary" onClick={onLoadResults} disabled={!!busy || !selectedUploadId}>
                  Load
                </Button>
              </div>
            </div>
          </section>

          {/* Summary */}
          {summary && (
            <section className="rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Summary</div>
                  <div className="text-xs text-zinc-400">Latest analyze output</div>
                </div>
                <Pill>{summary.model_version}</Pill>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                  <div className="text-xs text-zinc-400">Rows</div>
                  <div className="mt-1 text-lg font-semibold">{summary.rows}</div>
                </div>

                <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                  <div className="text-xs text-zinc-400">Anomalies</div>
                  <div className="mt-1 text-lg font-semibold">{summary.anomalies}</div>
                </div>

                <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                  <div className="text-xs text-zinc-400">Scored at</div>
                  <div className="mt-1 text-xs text-zinc-200 break-all">{summary.scored_at}</div>
                </div>

                <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
                  <div className="text-xs text-zinc-400">Output blob</div>
                  <div className="mt-1 text-xs text-zinc-200 break-all">{summary.output_blob}</div>
                </div>
              </div>
            </section>
          )}

          {/* Results */}
          {rows && rows.length > 0 && (
            <section className="rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Rows (preview)</div>
                  <div className="text-xs text-zinc-400">
                    Showing {rows.length} rows • {previewCols.length} columns
                    {anomaliesCountInPreview !== null && (
                      <> • <span className="text-emerald-300">{anomaliesCountInPreview} anomalies in preview</span></>
                    )}
                  </div>
                </div>
                <Pill>Auto-highlight anomalies</Pill>
              </div>

              <div className="mt-4 overflow-auto rounded-2xl border border-zinc-900">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-950/80 backdrop-blur text-zinc-300">
                    <tr>
                      {previewCols.map((k) => (
                        <th key={k} className="px-3 py-2 text-left whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {rows.map((r, idx) => {
                      const isAnom =
                        "is_anomaly" in r &&
                        (r["is_anomaly"] === 1 ||
                          r["is_anomaly"] === "1" ||
                          r["is_anomaly"] === true ||
                          r["is_anomaly"] === "true");

                      return (
                        <tr
                          key={idx}
                          className={isAnom ? "bg-emerald-950/20" : "hover:bg-zinc-900/30"}
                        >
                          {previewCols.map((k) => (
                            <td key={k} className="px-3 py-2 text-xs text-zinc-200 whitespace-nowrap">
                              {String(r[k] ?? "")}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
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
        </main>
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-zinc-600">
        Tip: for huge CSVs, keep “rows limit” small (50–200) for fast UI response.
      </footer>
    </div>
  );
}
