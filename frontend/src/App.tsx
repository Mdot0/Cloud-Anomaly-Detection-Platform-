import { useMemo, useState } from "react";
import { useUploads } from "./hooks/useUploads";
import { useAnalysis } from "./hooks/useAnalysis";
import { Toast, type ToastState } from "./components/Toast";
import { Pill } from "./components/Pill";
import { UploadsSidebar } from "./components/UploadsSidebar";
import { UploadPanel } from "./components/UploadPanel";
import { ResultsSection } from "./components/ResultsSection";

export default function App() {
  const [toast, setToast] = useState<ToastState>(null);

  const uploads = useUploads(setToast);
  const analysis = useAnalysis(setToast, (uploadId) => {
    uploads.refreshUploads();
    if (uploadId) uploads.setSelectedUploadId(uploadId);
  });

  const busy = uploads.busy ?? analysis.busy;

  const step = useMemo(() => {
    // 1: file picked, 2: summary in, 3: rows loaded
    if (analysis.rows?.length) return 3;
    if (analysis.summary) return 2;
    if (analysis.file) return 1;
    return 0;
  }, [analysis.file, analysis.summary, analysis.rows]);

  function selectUpload(id: string) {
    uploads.setSelectedUploadId(id);
    analysis.clear();
  }

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
              <div className="text-xs text-zinc-400">Upload → (auto) Analyze → Review anomalies</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Pill>Step {step}/3</Pill>
            {busy ? <Pill>{busy}</Pill> : <Pill>Ready</Pill>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid gap-6 lg:grid-cols-12">
        <UploadsSidebar
          filteredUploads={uploads.filteredUploads}
          search={uploads.search}
          onSearchChange={uploads.setSearch}
          limit={uploads.limit}
          onLimitChange={uploads.setLimit}
          selectedUploadId={uploads.selectedUploadId}
          selectedItem={uploads.selectedItem}
          onSelect={selectUpload}
          onRefresh={uploads.refreshUploads}
          busy={busy}
          onCopy={copy}
        />

        <main className="lg:col-span-8 space-y-6">
          <UploadPanel
            file={analysis.file}
            onFileChange={analysis.setFile}
            onUpload={analysis.onUpload}
            busy={busy}
            notify={setToast}
          />

          <ResultsSection
            status={analysis.status}
            summary={analysis.summary}
            rows={analysis.rows}
            rawText={analysis.rawText}
            resultsLimit={analysis.resultsLimit}
            onResultsLimitChange={analysis.setResultsLimit}
            onLoadResults={() => analysis.loadResults(uploads.selectedUploadId)}
            busy={busy}
            selectedUploadId={uploads.selectedUploadId}
          />
        </main>
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-zinc-600">
        Tip: for huge CSVs, keep "rows limit" small (50–200) for fast UI response.
      </footer>
    </div>
  );
}
