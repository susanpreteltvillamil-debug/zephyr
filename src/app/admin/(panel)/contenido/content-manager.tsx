"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Input, Label, NativeSelect, Switch, Textarea } from "@/components/ui/form-controls";
import { ImageField, SortableList, useAction } from "@/components/admin/kit";
import { reorderSections, saveSection, setSectionVisibility } from "@/app/admin/actions/content";
import {
  FIXED_SECTIONS,
  SECTION_LABELS,
  sectionFields,
  sectionSchemas,
  type AllSections,
  type FieldDescriptor,
  type ItemField,
  type SectionKey,
} from "@/lib/content/sections";

type Json = Record<string, unknown>;

export function ContentManager({ content, order }: { content: AllSections; order: { key: SectionKey; visible: boolean }[] }) {
  const { run } = useAction();
  const [editing, setEditing] = React.useState<SectionKey | null>(null);
  const movable = order.filter((o) => !FIXED_SECTIONS.includes(o.key)).map((o) => ({ id: o.key, ...o }));
  const fixedTop = order.filter((o) => o.key === "hero");
  const fixedBottom = order.filter((o) => o.key === "footer");

  const row = (o: { key: SectionKey; visible: boolean }, handle?: React.ReactNode) => (
    <div className="flex items-center gap-2 rounded-2xl border bg-card p-3">
      {handle ?? <span className="w-9" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{SECTION_LABELS[o.key]}</p>
        <p className="truncate text-xs text-muted-foreground">{summary(content[o.key] as Json)}</p>
      </div>
      {!o.visible ? <Badge variant="muted">Oculta</Badge> : null}
      {o.key !== "hero" && o.key !== "footer" ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Visible</span>
          <Switch
            checked={o.visible}
            aria-label={`Mostrar ${SECTION_LABELS[o.key]}`}
            onCheckedChange={(v) => void run(setSectionVisibility({ key: o.key, visible: v }), { success: v ? "Sección visible" : "Sección oculta" })}
          />
        </label>
      ) : null}
      <Button size="sm" variant="outline" onClick={() => setEditing(o.key)}>
        <Pencil /> Editar
      </Button>
    </div>
  );

  return (
    <div className="grid max-w-3xl gap-2">
      <div className="mb-2 flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <a href="/" target="_blank" rel="noopener">
            <ExternalLink /> Ver la web
          </a>
        </Button>
      </div>
      {fixedTop.map((o) => (
        <React.Fragment key={o.key}>{row(o)}</React.Fragment>
      ))}
      <SortableList
        items={movable}
        onReorder={(ids) =>
          void run(reorderSections({ keys: ["hero", ...(ids as SectionKey[]), "footer"] }), { success: "Orden guardado" })
        }
        renderItem={(o, handle) => row(o, handle)}
      />
      {fixedBottom.map((o) => (
        <React.Fragment key={o.key}>{row(o)}</React.Fragment>
      ))}

      {editing ? <SectionEditor sectionKey={editing} initial={content[editing] as Json} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function summary(c: Json): string {
  const t = c.title ?? c.tagline ?? "";
  return typeof t === "string" ? t : "";
}

function SectionEditor({ sectionKey, initial, onClose }: { sectionKey: SectionKey; initial: Json; onClose: () => void }) {
  const { run, pending } = useAction();
  const [value, setValue] = React.useState<Json>(() => structuredClone(initial));
  const [error, setError] = React.useState<string | null>(null);
  const fields = sectionFields[sectionKey];

  async function save() {
    const parsed = sectionSchemas[sectionKey].safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${issue?.message ?? "Contenido inválido"}${issue?.path.length ? ` (${issue.path.join(" › ")})` : ""}`);
      return;
    }
    setError(null);
    const r = await run(saveSection({ key: sectionKey, content: parsed.data }), { success: "Sección guardada. Ya se ve en la web." });
    if (r.ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{SECTION_LABELS[sectionKey]}</DialogTitle>
          <DialogDescription>Los cambios se publican al guardar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 pb-24">
          {fields.map((f) => (
            <FieldRenderer key={f.name} field={f} value={value[f.name]} onChange={(v) => setValue((s) => ({ ...s, [f.name]: v }))} />
          ))}
        </div>
        <div className="sticky bottom-0 -mx-5 mt-auto border-t bg-popover px-5 py-4 sm:-mx-6 sm:px-6">
          {error ? (
            <p role="alert" className="mb-2 text-sm text-destructive-text">
              {error}
            </p>
          ) : null}
          <DialogFooter className="mt-0">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={pending}>
              Guardar y publicar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldRenderer({ field, value, onChange }: { field: FieldDescriptor; value: unknown; onChange: (v: unknown) => void }) {
  const id = React.useId();
  switch (field.kind) {
    case "text":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint ?? `${String(value ?? "").length}/${field.max}`}>
          <Input id={id} value={String(value ?? "")} maxLength={field.max} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint ?? `${String(value ?? "").length}/${field.max}`}>
          <Textarea id={id} rows={3} value={String(value ?? "")} maxLength={field.max} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={Boolean(value)} onCheckedChange={onChange} /> {field.label}
        </label>
      );
    case "image": {
      const img = (value ?? { url: "", alt: "" }) as { url: string; alt: string };
      return (
        <div className="grid gap-3 rounded-xl border p-3">
          <Label>{field.label}</Label>
          {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
          <ImageField value={img.url} onChange={(url) => onChange({ ...img, url })} folder="site" />
          <Field label="Texto alternativo (describe la imagen)" htmlFor={id}>
            <Input id={id} value={img.alt} maxLength={200} onChange={(e) => onChange({ ...img, alt: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "stringList": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="grid gap-2 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">{field.label}</legend>
          {list.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                maxLength={field.itemMax}
                aria-label={`${field.label} ${i + 1}`}
                onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          {list.length < field.max ? (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => onChange([...list, ""])}>
              <Plus /> Agregar
            </Button>
          ) : null}
        </fieldset>
      );
    }
    case "list": {
      const list = Array.isArray(value) ? (value as Json[]) : [];
      const blank = Object.fromEntries(
        field.fields.map((f) => [f.name, f.kind === "number" ? f.max : f.kind === "select" ? f.options[0] : ""]),
      );
      const move = (i: number, d: number) => {
        const next = [...list];
        const [it] = next.splice(i, 1);
        next.splice(i + d, 0, it!);
        onChange(next);
      };
      return (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">{field.label}</legend>
          {list.map((item, i) => (
            <div key={i} className="grid gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.itemLabel} {i + 1}
                </span>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Bajar" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {field.fields.map((sub) => (
                <ItemFieldRenderer
                  key={sub.name}
                  field={sub}
                  value={item[sub.name]}
                  onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, [sub.name]: v } : x)))}
                />
              ))}
            </div>
          ))}
          {list.length < field.max ? (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => onChange([...list, blank])}>
              <Plus /> Agregar {field.itemLabel.toLowerCase()}
            </Button>
          ) : null}
        </fieldset>
      );
    }
  }
}

const ICON_LABELS: Record<string, string> = {
  shield: "Escudo (higiene)",
  sparkles: "Destellos",
  clock: "Reloj",
  heart: "Corazón",
  star: "Estrella",
  leaf: "Hoja",
  gem: "Gema",
  smile: "Sonrisa",
};

function ItemFieldRenderer({ field, value, onChange }: { field: ItemField; value: unknown; onChange: (v: unknown) => void }) {
  const id = React.useId();
  switch (field.kind) {
    case "text":
      return (
        <Field label={field.label} htmlFor={id}>
          <Input id={id} value={String(value ?? "")} maxLength={field.max} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "textarea":
      return (
        <Field label={field.label} htmlFor={id}>
          <Textarea id={id} rows={3} value={String(value ?? "")} maxLength={field.max} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "number":
      return (
        <Field label={field.label} htmlFor={id}>
          <Input
            id={id}
            type="number"
            min={field.min}
            max={field.max}
            value={Number(value ?? field.max)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="max-w-28"
          />
        </Field>
      );
    case "select":
      return (
        <Field label={field.label} htmlFor={id}>
          <NativeSelect id={id} value={String(value ?? field.options[0])} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {ICON_LABELS[o] ?? o}
              </option>
            ))}
          </NativeSelect>
        </Field>
      );
  }
}
