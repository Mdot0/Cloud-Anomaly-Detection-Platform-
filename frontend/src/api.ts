// frontend/src/api.ts
// Robust API base handling for SWA + Azure Functions.
// Works whether VITE_API_BASE is set to:
//   - https://<functionapp>.azurewebsites.net
//   - https://<functionapp>.azurewebsites.net/api
// and supports queue mode where results may not be ready yet.

export type UploadResponse = {
  ok?: boolean;
  upload_id?: string;
  blob?: string;
  container?: string;
  enqueued?: boolean;
  enqueue_error?: string | null;
  queue_name?: string;
  [k: string]: any;
};

function normalizeApiBase(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) {
    // Fail loudly so we don't accidentally call https://<staticapp>/api/...
    throw new Error(
      "VITE_API_BASE is missing. Set it to your Azure Functions URL (with or without /api)."
    );
  }

  // Remove trailing slashes
  const base = v.replace(/\/+$/, "");

  // Ensure it ends with /api exactly once
  return base.endsWith("/api") ? base : `${base}/api`;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE as string | undefined);

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text || `${res.status} ${res.statusText}`;
}

async function readJsonOrText(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text().catch(() => "");
  return { _raw: text };
}

export async function uploadLogs(file: File): Promise<UploadResponse> {
  const url = `${API_BASE}/upload-logs`;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(url, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await readJsonOrText(res);
}

export async function listUploads(limit = 25): Promise<any> {
  const url = `${API_BASE}/uploads?limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(await readError(res));
  return await res.json();
}

export async function analyzeUpload(uploadId: string): Promise<any> {
  const url = `${API_BASE}/analyze?upload_id=${encodeURIComponent(uploadId)}`;

  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
  return await res.json();
}

/**
 * In queue mode, results may not exist yet.
 * Backend currently returns 404 when missing; we treat 404/202 as "processing"
 * so the UI can show "still running" instead of "broken".
 */
export async function getResults(uploadId: string, limit = 100): Promise<any> {
  const url = `${API_BASE}/results?upload_id=${encodeURIComponent(uploadId)}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, { method: "GET" });

  if (res.status === 202) {
    return { status: "processing" };
  }

  if (res.status === 404) {
    // Worker likely still running or hasn't produced blobs yet
    return { status: "processing" };
  }

  if (!res.ok) throw new Error(await readError(res));
  return await res.json();
}
