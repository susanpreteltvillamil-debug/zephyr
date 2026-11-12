"use client";

import * as React from "react";
import { Eye, EyeOff, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Switch } from "@/components/ui/form-controls";
import { EmptyState, IMAGE_ACCEPT, SortableList, uploadImage, useAction } from "@/components/admin/kit";
import {
  createGalleryItems,
  deleteGalleryItem,
  deleteMedia,
  reorderRows,
  updateGalleryItem,
} from "@/app/admin/actions/content";
import type { GalleryItem } from "@/lib/types";

export function GalleryManager({ items }: { items: GalleryItem[] }) {
  const { run } = useAction();
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const [category, setCategory] = React.useState("");
  const [editing, setEditing] = React.useState<GalleryItem | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files].slice(0, 30);
    setUploading({ done: 0, total: list.length });
    const uploaded: Parameters<typeof createGalleryItems>[0]["items"] = [];
    for (const file of list) {
      try {
        const up = await uploadImage(file, "gallery");
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
        uploaded.push({
          storage_path: up.path,
          image_url: up.url,
          width: up.width,
          height: up.height,
          alt: `Trabajo de uñas${category ? ` – ${category}` : ""}${base && !/^(img|dsc|image|photo|whatsapp)/i.test(base) ? `: ${base}` : ""}`.slice(0, 200),
          title: "",
          category,
          visible: true,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `No se pudo subir ${file.name}`);
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    if (uploaded.length > 0) {
      const r = await run(createGalleryItems({ items: uploaded }), {
        success: `${uploaded.length} foto(s) agregadas. Revisa los textos alternativos.`,
      });
      if (!r.ok) {
        // Limpieza: si no se guardaron los registros, borra los archivos subidos.
        await Promise.all(uploaded.map((u) => deleteMedia({ path: u.storage_path })));
      }
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end">
        <Field label="Categoría para las nuevas fotos (opcional)" htmlFor="g-cat" className="flex-1">
          <Input id="g-cat" list="g-cats" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} placeholder="Ej. Semipermanente" />
          <datalist id="g-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <label
          className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {uploading ? `Subiendo ${uploading.done}/${uploading.total}…` : "Subir fotos"}
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="sr-only"
            disabled={Boolean(uploading)}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <EmptyState>Aún no hay fotos. La sección Galería se mostrará en la web cuando subas la primera.</EmptyState>
      ) : (
        <SortableList
          layout="grid"
          items={items}
          onReorder={(ids) => void run(reorderRows({ table: "gallery_items", ids }), { refresh: false })}
          renderItem={(item, handle) => (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="relative aspect-square bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.alt} className="size-full object-cover" loading="lazy" />
                <div className="absolute top-1.5 left-1.5 rounded-lg bg-background/90">{handle}</div>
                {!item.visible ? (
                  <Badge variant="muted" className="absolute top-2 right-2">
                    Oculta
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1 p-2">
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={item.alt}>
                  {item.title || item.alt}
                </p>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={item.visible ? "Ocultar" : "Mostrar"}
                  onClick={() =>
                    void run(
                      updateGalleryItem({ id: item.id, alt: item.alt, title: item.title, category: item.category, visible: !item.visible }),
                      { success: item.visible ? "Foto oculta" : "Foto visible" },
                    )
                  }
                >
                  {item.visible ? <Eye /> : <EyeOff />}
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(item)}>
                  <Pencil />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button size="icon-sm" variant="ghost" aria-label="Eliminar">
                      <Trash2 />
                    </Button>
                  }
                  title="¿Eliminar esta foto?"
                  description="Se borrará de la galería y del almacenamiento."
                  confirmLabel="Eliminar"
                  destructive
                  onConfirm={() => void run(deleteGalleryItem({ id: item.id }), { success: "Foto eliminada" })}
                />
              </div>
            </div>
          )}
        />
      )}

      {editing ? <EditDialog item={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function EditDialog({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const { run, pending } = useAction();
  const [alt, setAlt] = React.useState(item.alt);
  const [title, setTitle] = React.useState(item.title);
  const [category, setCategory] = React.useState(item.category);
  const [visible, setVisible] = React.useState(item.visible);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar foto</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image_url} alt="" className="mb-4 max-h-60 w-full rounded-xl object-cover" />
        <div className="grid gap-4">
          <Field label="Texto alternativo (obligatorio)" htmlFor="ge-alt" hint="Describe la foto para personas con lector de pantalla y para Google.">
            <Input id="ge-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Título (opcional)" htmlFor="ge-title">
            <Input id="ge-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Categoría" htmlFor="ge-cat">
            <Input id="ge-cat" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={visible} onCheckedChange={setVisible} /> Visible en la web
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              const r = await run(updateGalleryItem({ id: item.id, alt, title, category, visible }), { success: "Foto actualizada" });
              if (r.ok) onClose();
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
