// frontend/src/api.ts
const API_BASE_RAW = (import.meta.env.VITE_API_BASE ?? "").trim();
const API_BASE = API_BASE_RAW.replace(/\/+$/, ""); // remove trailing slash

function requireApiBase() {
  if (!API_BASE) {
    throw new Error(
      "VITE_API_BASE is missing. It must be set to your Function App base, e.g. https://<funcapp>.azurewebsites.net/api"
    );
  }
}

function url(path: string) {
  requireApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

async function readJsonOrText(res: Response) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      // fall through
    }
  }
  return { _raw: text };
}

async function request(path: string, init?: RequestInit) {
  const res = await fetch(url(path), init);
  if (!res.ok) {
    const body = await readJsonOrText(res);
    const msg =
      (body && typeof body === "object" && "_raw" in body && String((body as any)._raw).trim()) ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new Error(`${res.status} ${msg}`);
  }
  return readJsonOrText(res);
}

export async function listUploads(limit = 25) {
  return request(`/uploads?limit=${encodeURIComponent(String(limit))}`, {
    method: "GET",
  });
}

export async function analyzeUpload(uploadId: string) {
  return request(`/analyze?upload_id=${encodeURIComponent(uploadId)}`, {
    method: "POST",
  });
}

export async function getResults(uploadId: string, limit = 200) {
  return request(
    `/results?upload_id=${encodeURIComponent(uploadId)}&limit=${encodeURIComponent(String(limit))}`,
    { method: "GET" }
  );
}

export async function uploadLogs(file: File) {
  const form = new FormData();
  form.append("file", file);

  return request(`/upload-logs`, {
    method: "POST",
    body: form,
  });
}
