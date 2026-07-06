import type { UploadItem } from "../types";
import { Button } from "./Button";
import { Card } from "./Card";
import { fmtBytes, uploadIdFromBlob } from "../lib/format";

type Props = {
  filteredUploads: UploadItem[];
  search: string;
  onSearchChange: (v: string) => void;
  limit: number;
  onLimitChange: (n: number) => void;
  selectedUploadId: string;
  selectedItem: UploadItem | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  busy: string | null;
  onCopy: (text: string) => void;
};

export function UploadsSidebar({
  filteredUploads,
  search,
  onSearchChange,
  limit,
  onLimitChange,
  selectedUploadId,
  selectedItem,
  onSelect,
  onRefresh,
  busy,
  onCopy,
}: Props) {
  return (
    <aside className="lg:col-span-4 rounded-3xl border border-zinc-900 bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Uploads</div>
          <div className="text-xs text-zinc-400">Pick an upload_id to view results</div>
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={!!busy}>
          Refresh
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by filename or upload_id…"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-zinc-600"
        />
        <select
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
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
                    onClick={() => onSelect(id)}
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
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-400">Selected upload_id</div>
              <div className="mt-1 font-mono text-xs text-zinc-200 break-all">{selectedUploadId}</div>
            </div>
            <Button variant="secondary" onClick={() => onCopy(selectedUploadId)}>
              Copy
            </Button>
          </div>
        </Card>
      )}
    </aside>
  );
}
