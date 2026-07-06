import { useCallback, useEffect, useMemo, useState } from "react";
import { listUploads } from "../api";
import type { UploadItem } from "../types";
import type { ToastState } from "../components/Toast";
import { uploadIdFromBlob } from "../lib/format";

export function useUploads(notify: (t: ToastState) => void) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refreshUploads = useCallback(async () => {
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
      setSelectedUploadId((prev) => prev || (items[0]?.blob ? uploadIdFromBlob(items[0].blob) : ""));
    } catch (e: any) {
      notify({ type: "error", title: "Failed to load uploads", message: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

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

  return {
    uploads,
    limit,
    setLimit,
    search,
    setSearch,
    selectedUploadId,
    setSelectedUploadId,
    filteredUploads,
    selectedItem,
    refreshUploads,
    busy,
  };
}
