import type { UploadsResponse, AnalyzeSummary, ResultsResponse } from "./types";

/**
 * In dev: we use Vite proxy, so API_BASE = "" and we call "/api/..."
 * In prod: set VITE_API_BASE to your Function App URL, e.g. https://<app>.azurewebsites.net
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  if (!API_BASE) return path; // relative -> Vite proxy in dev
  return `${API_BASE}${path}`;
}

async function safeJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (ct.includes("application/json")) return JSON.parse(text);

  // try parsing anyway
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text, _contentType: ct, _status: res.status };
  }
}

export async function uploadLogs(file: File) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(apiUrl("/api/upload-logs"), {
    method: "POST",
    body: form,
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

export async function listUploads(limit = 10): Promise<UploadsResponse> {
  const res = await fetch(apiUrl(`/api/uploads?limit=${limit}`));
  const data = await safeJson(res);
  if (!res.ok) throw new Error(`Uploads failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data as UploadsResponse;
}

export async function analyzeUpload(uploadId: string): Promise<AnalyzeSummary> {
  const res = await fetch(apiUrl(`/api/analyze?upload_id=${encodeURIComponent(uploadId)}`), {
    method: "POST",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(`Analyze failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data as AnalyzeSummary;
}

export async function getResults(uploadId: string, limit = 50): Promise<ResultsResponse> {
  const res = await fetch(
    apiUrl(`/api/results?upload_id=${encodeURIComponent(uploadId)}&limit=${limit}`)
  );
  const data = await safeJson(res);
  if (!res.ok) throw new Error(`Results failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return data as ResultsResponse;
}
