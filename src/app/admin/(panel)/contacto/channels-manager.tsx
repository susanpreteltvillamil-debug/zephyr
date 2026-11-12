"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Switch } from "@/components/ui/form-controls";
import { EmptyState, SortableList, useAction } from "@/components/admin/kit";
import { ChannelIcon } from "@/components/site/brand-icons";
import { deleteContactChannel, reorderRows, saveContactChannel } from "@/app/admin/actions/content";
import { CONTACT_TYPES, type ContactChannel, type ContactType } from "@/lib/types";

const TYPE_LABELS: Record<ContactType, string> = {
  whatsapp: "WhatsApp",
  phone: "Teléfono",
  email: "Correo",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X (Twitter)",
  address: "Dirección",
  website: "Sitio web",
  other: "Otro",
};

export function ChannelsManager({ channels }: { channels: ContactChannel[] }) {
  const { run } = useAction();
  const [editing, setEditing] = React.useState<Partial<ContactChannel> | null>(null);
  return (
    <div className="grid max-w-3xl gap-4">
      <Button className="justify-self-start" onClick={() => setEditing({ type: "instagram", active: true })}>
        <Plus /> Agregar canal o red
      </Button>
      {channels.length === 0 ? (
        <EmptyState>No hay canales.</EmptyState>
      ) : (
        <SortableList
          items={channels}
          onReorder={(ids) => void run(reorderRows({ table: "contact_channels", ids }), { refresh: false })}
          renderItem={(c, handle) => (
            <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 pr-3">
              {handle}
              <span className="flex size-10 items-center justify-center rounded-full bg-soft text-soft-foreground">
                <ChannelIcon type={c.type} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {c.label} {!c.active ? <Badge variant="muted">Inactivo</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.value || c.url || "Sin completar"}</p>
              </div>
              <Switch
                checked={c.active}
                aria-label={`Activar ${c.label}`}
                onCheckedChange={(v) =>
                  void run(saveContactChannel({ id: c.id, type: c.type, label: c.label, value: c.value, url: c.url, active: v }), {
                    success: v ? "Canal activado" : "Canal desactivado",
                  })
                }
              />
              <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.label}`} onClick={() => setEditing(c)}>
                <Pencil />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${c.label}`}>
                    <Trash2 />
                  </Button>
                }
                title={`¿Eliminar ${c.label}?`}
                description="Dejará de mostrarse en la web."
                confirmLabel="Eliminar"
                destructive
                onConfirm={() => void run(deleteContactChannel({ id: c.id }), { success: "Canal eliminado" })}
              />
            </div>
          )}
        />
      )}
      {editing ? <ChannelDialog value={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ChannelDialog({ value, onClose }: { value: Partial<ContactChannel>; onClose: () => void }) {
  const { run, pending } = useAction();
  const [type, setType] = React.useState<ContactType>(value.type ?? "instagram");
  const [label, setLabel] = React.useState(value.label ?? TYPE_LABELS[value.type ?? "instagram"]);
  const [val, setVal] = React.useState(value.value ?? "");
  const [url, setUrl] = React.useState(value.url ?? "");
  const [active, setActive] = React.useState(value.active ?? true);
  const needsUrl = ["instagram", "facebook", "tiktok", "youtube", "x", "website", "other"].includes(type);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar canal" : "Nuevo canal"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Tipo" htmlFor="ch-type">
            <NativeSelect
              id="ch-type"
              value={type}
              onChange={(e) => {
                const t = e.target.value as ContactType;
                if (label === TYPE_LABELS[type]) setLabel(TYPE_LABELS[t]);
                setType(t);
              }}
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Etiqueta" htmlFor="ch-label">
            <Input id="ch-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </Field>
          <Field
            label={needsUrl ? "Usuario o texto visible" : "Valor"}
            htmlFor="ch-value"
            hint={type === "whatsapp" || type === "phone" ? "Número de 10 dígitos, ej. 314 465 7351" : needsUrl ? "Ej. @zephyr.nails" : undefined}
          >
            <Input id="ch-value" value={val} onChange={(e) => setVal(e.target.value)} maxLength={200} />
          </Field>
          <Field label={needsUrl ? "URL del perfil" : "URL (opcional, se genera sola)"} htmlFor="ch-url">
            <Input id="ch-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={600} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Activo (visible en la web)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              const r = await run(saveContactChannel({ id: value.id, type, label, value: val, url, active }), { success: "Canal guardado" });
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
