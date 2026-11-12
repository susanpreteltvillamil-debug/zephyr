"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

/* -----------------------------------------------------------------------------
   Ejecutar server actions con estado y avisos
   ----------------------------------------------------------------------------- */
export function useAction() {
  const router = useRouter();
  const [refreshing, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState(0);
  const pending = refreshing || busy > 0;

  const run = React.useCallback(
    async <T,>(
      promise: Promise<ActionResult<T>>,
      opts: { success?: string; refresh?: boolean } = {},
    ): Promise<ActionResult<T>> => {
      setBusy((n) => n + 1);
      let res: ActionResult<T>;
      try {
        res = await promise;
      } catch {
        res = { ok: false, error: "No pudimos conectar con el servidor. Intenta de nuevo." };
      } finally {
        setBusy((n) => n - 1);
      }
      if (res.ok) {
        if (opts.success) toast.success(opts.success);
        if (opts.refresh !== false) startTransition(() => router.refresh());
      } else {
        toast.error(res.error);
        if (res.code === "AUTH") router.replace("/admin/login");
      }
      return res;
    },
    [router],
  );

  return { run, pending };
}

/* -----------------------------------------------------------------------------
   Lista ordenable por arrastre (mouse, touch y teclado)
   ----------------------------------------------------------------------------- */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  layout = "list",
  className,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
  layout?: "list" | "grid";
  className?: string;
}) {
  const [order, setOrder] = React.useState(items);
  const [prevItems, setPrevItems] = React.useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setOrder(items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((i) => i.id === active.id);
    const to = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    onReorder(next.map((i) => i.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={cn(layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid gap-2", className)}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-accent active:cursor-grabbing"
      aria-label="Arrastrar para reordenar"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-80 shadow-xl")}
    >
      {children(handle)}
    </li>
  );
}

/* -----------------------------------------------------------------------------
   Subida de imágenes: compresión a WebP (máx. 1600 px) y subida a Storage
   ----------------------------------------------------------------------------- */
export interface UploadedImage {
  path: string;
  url: string;
  width: number;
  height: number;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

async function readSize(file: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" no es una imagen.`);
  if (file.size > 25 * 1024 * 1024) throw new Error(`"${file.name}" pesa más de 25 MB.`);
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 1.2,
    fileType: "image/webp",
    initialQuality: 0.82,
    useWebWorker: true,
  });
  const { width, height } = await readSize(compressed);
  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const sb = getBrowserSupabase();
  const { error } = await sb.storage.from("media").upload(path, compressed, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir "${file.name}": ${error.message}`);
  const { data } = sb.storage.from("media").getPublicUrl(path);
  return { path, url: data.publicUrl, width, height };
}

/** Campo de imagen única (portada, servicio, QR). */
export function ImageField({
  value,
  onChange,
  folder,
  label = "Imagen",
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const id = React.useId();

  async function handle(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadImage(file, folder);
      onChange(up.url);
      toast.success("Imagen subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="absolute inset-0 m-auto size-6 text-muted-foreground" aria-hidden />
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={id}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium hover:bg-accent focus-within:outline-2 focus-within:outline-ring"
        >
          <ImagePlus className="size-4" /> {value ? "Cambiar" : `Subir ${label.toLowerCase()}`}
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => void handle(e.target.files)}
          />
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-destructive-text hover:bg-destructive-soft"
          >
            <Trash2 className="size-4" /> Quitar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { ACCEPT as IMAGE_ACCEPT };

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
