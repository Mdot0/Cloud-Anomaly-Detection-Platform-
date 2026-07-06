import { Dropzone } from "./Dropzone";
import { Button } from "./Button";
import { Card, Section } from "./Card";
import { Pill } from "./Pill";
import type { ToastState } from "./Toast";
import { fmtBytes } from "../lib/format";

type Props = {
  file: File | null;
  onFileChange: (f: File | null) => void;
  onUpload: () => void;
  busy: string | null;
  notify: (t: ToastState) => void;
};

export function UploadPanel({ file, onFileChange, onUpload, busy, notify }: Props) {
  return (
    <Section>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Upload</div>
          <div className="text-xs text-zinc-400">POST /api/upload-logs — analysis starts automatically</div>
        </div>
        <Pill>CSV</Pill>
      </div>

      <div className="mt-4">
        <Dropzone
          disabled={!!busy}
          onPick={(f) => {
            onFileChange(f);
            notify({
              type: "info",
              title: "File selected",
              message: `${f.name} • ${fmtBytes(f.size)}`,
            });
          }}
        />
      </div>

      {file && (
        <Card className="mt-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{file.name}</div>
            <div className="text-xs text-zinc-400">{fmtBytes(file.size)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onFileChange(null)} disabled={!!busy}>
              Clear
            </Button>
            <Button onClick={onUpload} disabled={!!busy}>
              Upload
            </Button>
          </div>
        </Card>
      )}
    </Section>
  );
}
