type Json = any;

const API_BASE = (() => {
  const v = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (!v) return ""; // local dev: use Vite proxy (/api -> localhost:7071)
  return v.replace(/\/+$/, ""); // trim trailing slash
})();

async function safeJson(res: Response): Promise<Json> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return { _raw: text, _contentType: ct, _status: res.status };
    }
  }
  return { _raw: text, _contentType: ct, _status: res.status };
}

async function request(path: string, init?: RequestInit): Promise<Json> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, init);

  const body = await safeJson(res);
  if (!res.ok) {
    const msg =
      body?.error ||
      body?.message ||
      body?._raw ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body;
}

export async function uploadLogs(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  // backend returns text/plain today — safeJson will wrap it in {_raw: "..."}
  // If you later change backend to return JSON, this still works.
  const url = `${API_BASE}/api/upload-logs`;

  const res = await fetch(url, { method: "POST", body: fd });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) throw new Error(text || `Upload failed (${res.status})`);

  // Try parse upload_id from plain text response like:
  // UploadId: <uuid>
  let upload_id = "";
  const m = text.match(/UploadId:\s*([0-9a-fA-F-]{36})/);
  if (m) upload_id = m[1];

  if (ct.includes("application/json")) {
    try {
      const j = JSON.parse(text);
      return j;
    } catch {
      // fall through
    }
  }

  return { upload_id, _raw: text };
}

export async function listUploads(limit: number) {
  return request(`/api/uploads?limit=${encodeURIComponent(limit)}`);
}

export async function analyzeUpload(upload_id: string) {
  return request(`/api/analyze?upload_id=${encodeURIComponent(upload_id)}`, {
    method: "POST",
  });
}

export async function getResults(upload_id: string, limit: number) {
  return request(
    `/api/results?upload_id=${encodeURIComponent(upload_id)}&limit=${encodeURIComponent(
      limit
    )}`
  );
}
