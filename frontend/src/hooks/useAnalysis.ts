import { useCallback, useEffect, useRef, useState } from "react";
import { getResults, uploadLogs } from "../api";
import type { AnalyzeSummary } from "../types";
import type { ToastState } from "../components/Toast";
import { uploadIdFromBlob } from "../lib/format";

export type AnalysisStatus = "idle" | "processing" | "ready" | "error";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // ~30s of polling before giving up automatically

/**
 * Owns the upload -> (auto) analyze -> results flow. There is no manual "Analyze" step:
 * upload always enqueues a Service Bus job on the backend, so after a successful upload this
 * polls GET /results until the queue worker has produced output (or gives up after ~30s,
 * leaving the manual `loadResults` call available to check again later).
 */
export function useAnalysis(notify: (t: ToastState) => void, onUploaded: (uploadId: string) => void) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resultsLimit, setResultsLimit] = useState(100);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const clear = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setSummary(null);
    setRows(null);
    setRawText(null);
    setStatus("idle");
  }, []);

  const loadResults = useCallback(
    async (uploadId: string, silent = false): Promise<AnalysisStatus> => {
      if (!uploadId) return "idle";
      if (!silent) setBusy("Loading results…");
      try {
        const r: any = await getResults(uploadId, resultsLimit);

        if (r?.status === "processing") {
          setStatus("processing");
          if (!silent) {
            notify({ type: "info", title: "Still processing", message: "Analysis hasn't finished yet — try again shortly." });
          }
          return "processing";
        }

        if (r?.summary) setSummary(r.summary);
        if (Array.isArray(r?.rows)) setRows(r.rows);
        if (r?._raw) setRawText(String(r._raw));

        setStatus("ready");
        if (!silent) notify({ type: "success", title: "Results loaded" });
        return "ready";
      } catch (e: any) {
        setStatus("error");
        if (!silent) notify({ type: "error", title: "Results failed", message: e?.message ?? String(e) });
        return "error";
      } finally {
        if (!silent) setBusy(null);
      }
    },
    [resultsLimit, notify]
  );

  const pollUntilReady = useCallback(
    (uploadId: string, attempt = 0) => {
      loadResults(uploadId, true).then((result) => {
        if (result !== "processing") return;

        if (attempt < MAX_POLL_ATTEMPTS) {
          pollTimer.current = setTimeout(() => pollUntilReady(uploadId, attempt + 1), POLL_INTERVAL_MS);
        } else {
          notify({
            type: "info",
            title: "Still processing",
            message: "Taking longer than expected — click Load results to check again.",
          });
        }
      });
    },
    [loadResults, notify]
  );

  async function onUpload() {
    if (!file) return;
    setBusy("Uploading…");
    clear();

    try {
      const res = await uploadLogs(file);
      const uploadId = res.upload_id ?? (res.blob ? uploadIdFromBlob(res.blob) : "");

      notify({
        type: "success",
        title: "Upload complete",
        message: uploadId ? `upload_id: ${uploadId}` : undefined,
      });

      setFile(null);
      onUploaded(uploadId);

      if (uploadId) {
        setStatus("processing");
        pollUntilReady(uploadId);
      }
    } catch (e: any) {
      notify({ type: "error", title: "Upload failed", message: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  }

  return {
    file,
    setFile,
    busy,
    resultsLimit,
    setResultsLimit,
    summary,
    rows,
    rawText,
    status,
    onUpload,
    loadResults,
    clear,
  };
}
