"use client";

import * as React from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field, Input, NativeSelect, Switch, Textarea } from "@/components/ui/form-controls";
import { EmptyState, ImageField, SortableList, useAction } from "@/components/admin/kit";
import { deleteCategory, deleteService, reorderRows, saveCategory, saveService } from "@/app/admin/actions/content";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import type { Service, ServiceCategory } from "@/lib/types";

export function ServicesManager({ categories, services }: { categories: ServiceCategory[]; services: Service[] }) {
  const { run } = useAction();
  const [editingCat, setEditingCat] = React.useState<Partial<ServiceCategory> | null>(null);
  const [editingSvc, setEditingSvc] = React.useState<Partial<Service> | null>(null);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditingSvc({ category_id: categories[0]?.id, price_type: "fixed", active: true, duration_minutes: 60, price: 0 })} disabled={categories.length === 0}>
          <Plus /> Nuevo servicio
        </Button>
        <Button variant="outline" onClick={() => setEditingCat({ active: true })}>
          <Plus /> Nueva categoría
        </Button>
      </div>

      {categories.length === 0 ? <EmptyState>Crea una categoría para empezar (por ejemplo, Manos).</EmptyState> : null}

      <SortableList
        items={categories}
        onReorder={(ids) => void run(reorderRows({ table: "service_categories", ids }), { refresh: false })}
        renderItem={(cat, handle) => {
          const list = services.filter((s) => s.category_id === cat.id);
          return (
            <section className="rounded-2xl border bg-card" aria-label={`Categoría ${cat.name}`}>
              <header className="flex flex-wrap items-center gap-2 border-b p-3">
                {handle}
                <h2 className="font-display text-xl font-semibold">{cat.name}</h2>
                {!cat.active ? <Badge variant="muted">Oculta</Badge> : null}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingCat(cat)}>
                    <Pencil /> Editar
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label={`Eliminar categoría ${cat.name}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`¿Eliminar "${cat.name}"?`}
                    description={list.length > 0 ? "Primero mueve o elimina los servicios de esta categoría." : "Esta acción no se puede deshacer."}
                    confirmLabel="Eliminar"
                    destructive
                    onConfirm={() => void run(deleteCategory({ id: cat.id }), { success: "Categoría eliminada" })}
                  />
                </div>
              </header>
              <div className="p-3">
                {list.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Sin servicios.</p>
                ) : (
                  <SortableList
                    items={list}
                    onReorder={(ids) => void run(reorderRows({ table: "services", ids }), { refresh: false })}
                    renderItem={(s, h) => (
                      <div className="flex items-center gap-2 rounded-xl border bg-background p-2 pr-3">
                        {h}
                        {s.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.image_url} alt="" className="size-11 rounded-lg object-cover" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            {s.name}
                            {s.price_type === "addon" ? <Badge variant="soft">Adicional</Badge> : null}
                            {!s.active ? <Badge variant="muted">Inactivo</Badge> : null}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            {s.price_type === "addon" ? "+" : ""}
                            {formatCOP(s.price)} · <Clock className="size-3" /> {formatDuration(s.duration_minutes)}
                          </p>
                        </div>
                        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${s.name}`} onClick={() => setEditingSvc(s)}>
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${s.name}`}>
                              <Trash2 />
                            </Button>
                          }
                          title={`¿Eliminar "${s.name}"?`}
                          description="Las citas existentes conservan su copia del servicio. Si solo quieres ocultarlo, desactívalo."
                          confirmLabel="Eliminar"
                          destructive
                          onConfirm={() => void run(deleteService({ id: s.id }), { success: "Servicio eliminado" })}
                        />
                      </div>
                    )}
                  />
                )}
              </div>
            </section>
          );
        }}
      />

      {editingCat ? <CategoryDialog value={editingCat} onClose={() => setEditingCat(null)} /> : null}
      {editingSvc ? (
        <ServiceDialog value={editingSvc} categories={categories} services={services} onClose={() => setEditingSvc(null)} />
      ) : null}
    </div>
  );
}

function CategoryDialog({ value, onClose }: { value: Partial<ServiceCategory>; onClose: () => void }) {
  const { run, pending } = useAction();
  const [name, setName] = React.useState(value.name ?? "");
  const [description, setDescription] = React.useState(value.description ?? "");
  const [active, setActive] = React.useState(value.active ?? true);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Nombre" htmlFor="cat-name">
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Descripción" htmlFor="cat-desc">
            <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Visible en la web
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              const r = await run(saveCategory({ id: value.id, name, description, active }), { success: "Categoría guardada" });
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

function ServiceDialog({
  value,
  categories,
  services,
  onClose,
}: {
  value: Partial<Service>;
  categories: ServiceCategory[];
  services: Service[];
  onClose: () => void;
}) {
  const { run, pending } = useAction();
  const [form, setForm] = React.useState({
    category_id: value.category_id ?? categories[0]?.id ?? "",
    name: value.name ?? "",
    description: value.description ?? "",
    price: String(value.price ?? 0),
    price_type: value.price_type ?? "fixed",
    duration_minutes: String(value.duration_minutes ?? 60),
    image_url: value.image_url ?? "",
    active: value.active ?? true,
    requires: new Set(value.requires_any_service_ids ?? []),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const candidates = services.filter((s) => s.id !== value.id && s.price_type === "fixed");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Nombre" htmlFor="svc-name">
            <Input id="svc-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Descripción" htmlFor="svc-desc">
            <Textarea id="svc-desc" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={400} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría" htmlFor="svc-cat">
              <NativeSelect id="svc-cat" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tipo de precio" htmlFor="svc-type">
              <NativeSelect id="svc-type" value={form.price_type} onChange={(e) => set("price_type", e.target.value as "fixed" | "addon")}>
                <option value="fixed">Fijo (servicio principal)</option>
                <option value="addon">Adicional (se suma a otro)</option>
              </NativeSelect>
            </Field>
            <Field label="Precio (COP, sin puntos)" htmlFor="svc-price" hint={formatCOP(Number(form.price) || 0)}>
              <Input id="svc-price" inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Duración (minutos)" htmlFor="svc-dur" hint={formatDuration(Number(form.duration_minutes) || 0)}>
              <Input
                id="svc-dur"
                inputMode="numeric"
                value={form.duration_minutes}
                onChange={(e) => set("duration_minutes", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          {form.price_type === "addon" ? (
            <fieldset className="rounded-xl border p-3">
              <legend className="px-1 text-sm font-medium">Solo se puede combinar con…</legend>
              <p className="mb-2 text-xs text-muted-foreground">Si no marcas ninguno, se puede combinar con cualquier servicio principal.</p>
              <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                {candidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.requires.has(c.id)}
                      onCheckedChange={(v) => {
                        const n = new Set(form.requires);
                        if (v === true) n.add(c.id);
                        else n.delete(c.id);
                        set("requires", n);
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="grid gap-2">
            <span className="text-sm font-medium">Imagen (opcional)</span>
            <ImageField value={form.image_url} onChange={(u) => set("image_url", u)} folder="services" />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} /> Activo (visible y reservable)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              const r = await run(
                saveService({
                  id: value.id,
                  category_id: form.category_id,
                  name: form.name,
                  description: form.description,
                  price: Number(form.price),
                  price_type: form.price_type,
                  duration_minutes: Number(form.duration_minutes),
                  image_url: form.image_url,
                  active: form.active,
                  requires_any_service_ids: [...form.requires],
                }),
                { success: "Servicio guardado" },
              );
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
