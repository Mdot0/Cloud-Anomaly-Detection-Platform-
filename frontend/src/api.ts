// frontend/src/api.ts
// Strict API base handling so the app never silently falls back to /api on the SWA domain.

export type UploadResponse = {
  upload_id?: string;
  blob?: string;
  [k: string]: any;
};

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE as string | undefined;

  if (!raw || !raw.trim()) {
    // Fail loudly so we don't accidentally call https://<staticapp>/api/...
    throw new Error(
      "VITE_API_BASE is missing. Set it to your Azure Functions base URL ending with /api"
    );
  }

  // Remove trailing slashes
  return raw.replace(/\/+$/, "");
}

export const API_BASE = getApiBase();

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text || `${res.status} ${res.statusText}`;
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

  // Your backend returns text/plain sometimes, so handle both.
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  return { _raw: text };
}

export async function listUploads(limit = 25): Promise<any> {
  const url = `${API_BASE}/uploads?limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return await res.json();
}

export async function analyzeUpload(uploadId: string): Promise<any> {
  const url = `${API_BASE}/analyze?upload_id=${encodeURIComponent(uploadId)}`;

  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return await res.json();
}

export async function getResults(uploadId: string, limit = 100): Promise<any> {
  const url = `${API_BASE}/results?upload_id=${encodeURIComponent(
    uploadId
  )}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return await res.json();
}
