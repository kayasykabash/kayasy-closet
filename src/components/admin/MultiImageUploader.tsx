import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, GripVertical, Star } from "lucide-react";
import { toast } from "sonner";

export type ImageItem =
  | { kind: "url"; url: string }
  | { kind: "file"; file: File; previewUrl: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

interface Props {
  items: ImageItem[];
  onChange: (items: ImageItem[]) => void;
  label?: string;
  help?: string;
}

export function MultiImageUploader({ items, onChange, label = "Product Images", help }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  // Revoke preview URLs we created when items change/unmount
  const createdUrls = useMemo(
    () => items.filter(i => i.kind === "file").map(i => (i as any).previewUrl),
    [items]
  );
  useEffect(() => {
    return () => {
      createdUrls.forEach(u => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: ImageItem[] = [];
    for (const f of arr) {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`${f.name}: only JPG, PNG, WEBP allowed`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: max 5MB`);
        continue;
      }
      valid.push({ kind: "file", file: f, previewUrl: URL.createObjectURL(f) });
    }
    if (valid.length) onChange([...items, ...valid]);
  };

  const remove = (idx: number) => {
    const item = items[idx];
    if (item.kind === "file") URL.revokeObjectURL(item.previewUrl);
    onChange(items.filter((_, i) => i !== idx));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-[10px] text-muted-foreground">JPG/PNG/WEBP · max 5MB</span>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
        }`}
      >
        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-sm font-medium">Drop images here or click to upload</p>
        <p className="text-xs text-muted-foreground">Select multiple files at once</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {help && <p className="text-[11px] text-muted-foreground mt-1">{help}</p>}

      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {items.map((it, i) => {
            const url = it.kind === "url" ? it.url : it.previewUrl;
            return (
              <div
                key={(it.kind === "url" ? it.url : it.previewUrl) + i}
                draggable
                onDragStart={() => { dragIndex.current = i; }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const from = dragIndex.current;
                  dragIndex.current = null;
                  if (from !== null) move(from, i);
                }}
                className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5" /> Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); remove(i); }}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-90"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex justify-between items-center px-1 py-0.5 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); move(i, i - 1); }}
                    disabled={i === 0}
                    className="text-[10px] px-1 disabled:opacity-30"
                  >◀</button>
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); move(i, i + 1); }}
                    disabled={i === items.length - 1}
                    className="text-[10px] px-1 disabled:opacity-30"
                  >▶</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
