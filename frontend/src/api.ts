// frontend/src/api.ts
import type { AnalyzeSummary, UploadItem } from "./types";

const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const API_BASE = RAW_BASE.replace(/\/+$/, ""); // remove trailing slashes

function url(path: string) {
  // If VITE_API_BASE is set, always call the Function App directly.
  // If not set (local dev), fallback to relative paths so Vite proxy can work.
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    mode: "cors",
  });

  const ct = res.headers.get("content-type") || "";
  const bodyText = await res.text().catch(() => "");

  if (!res.ok) {
    const msg = bodyText ? `${res.status} ${res.statusText}: ${bodyText}` : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  if (ct.includes("application/json")) {
    return JSON.parse(bodyText || "{}") as T;
  }

  // If server returned non-JSON successfully, return the raw text as a fallback.
  return ({ _raw: bodyText } as unknown) as T;
}

export async function listUploads(limit = 50): Promise<{ count: number; items: UploadItem[] }> {
  return request(`/api/uploads?limit=${encodeURIComponent(String(limit))}`);
}

export async function analyzeUpload(uploadId: string): Promise<AnalyzeSummary> {
  return request(`/api/analyze?upload_id=${encodeURIComponent(uploadId)}`, {
    method: "POST",
  });
}

export async function getResults(uploadId: string, limit = 200): Promise<any> {
  return request(`/api/results?upload_id=${encodeURIComponent(uploadId)}&limit=${encodeURIComponent(String(limit))}`);
}

export async function uploadLogs(file: File): Promise<{ upload_id?: string; blob?: string; _raw?: string }> {
  const fd = new FormData();
  fd.append("file", file);

  // upload endpoint returns text/plain in your backend, so handle both json + text
  const res = await fetch(url("/api/upload-logs"), {
    method: "POST",
    body: fd,
    mode: "cors",
  });

  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(text ? `${res.status} ${res.statusText}: ${text}` : `${res.status} ${res.statusText}`);
  }

  if (ct.includes("application/json")) {
    return JSON.parse(text || "{}");
  }

  // Parse your text output format:
  // "UploadId: <uuid>" and "Blob: <uuid>.csv"
  const uploadIdMatch = text.match(/UploadId:\s*([0-9a-fA-F-]+)/);
  const blobMatch = text.match(/Blob:\s*([^\s]+)/);

  return {
    upload_id: uploadIdMatch?.[1],
    blob: blobMatch?.[1],
    _raw: text,
  };
}
