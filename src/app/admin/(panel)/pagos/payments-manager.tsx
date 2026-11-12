"use client";

import * as React from "react";
import { Pencil, Plus, QrCode, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/form-controls";
import { EmptyState, ImageField, SortableList, useAction } from "@/components/admin/kit";
import { deletePaymentMethod, reorderRows, savePaymentMethod } from "@/app/admin/actions/content";
import type { PaymentMethod } from "@/lib/types";

export function PaymentsManager({ methods }: { methods: PaymentMethod[] }) {
  const { run } = useAction();
  const [editing, setEditing] = React.useState<Partial<PaymentMethod> | null>(null);
  return (
    <div className="grid max-w-3xl gap-4">
      <Button className="justify-self-start" onClick={() => setEditing({ active: true })}>
        <Plus /> Agregar medio de pago
      </Button>
      {methods.length === 0 ? (
        <EmptyState>Agrega al menos un medio de pago para que tus clientes sepan dónde abonar.</EmptyState>
      ) : (
        <SortableList
          items={methods}
          onReorder={(ids) => void run(reorderRows({ table: "payment_methods", ids }), { refresh: false })}
          renderItem={(m, handle) => (
            <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 pr-3">
              {handle}
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                {m.qr_url ? <QrCode className="size-5" /> : <Wallet className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {m.name} {!m.active ? <Badge variant="muted">Inactivo</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.account_number}
                  {m.holder ? ` · ${m.holder}` : ""}
                </p>
              </div>
              <Switch
                checked={m.active}
                aria-label={`Activar ${m.name}`}
                onCheckedChange={(v) =>
                  void run(
                    savePaymentMethod({
                      id: m.id,
                      name: m.name,
                      account_number: m.account_number,
                      holder: m.holder,
                      instructions: m.instructions,
                      qr_url: m.qr_url ?? "",
                      active: v,
                    }),
                    { success: v ? "Activado" : "Desactivado" },
                  )
                }
              />
              <Button size="icon-sm" variant="ghost" aria-label={`Editar ${m.name}`} onClick={() => setEditing(m)}>
                <Pencil />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${m.name}`}>
                    <Trash2 />
                  </Button>
                }
                title={`¿Eliminar ${m.name}?`}
                description="Dejará de mostrarse en la confirmación de las reservas."
                confirmLabel="Eliminar"
                destructive
                onConfirm={() => void run(deletePaymentMethod({ id: m.id }), { success: "Medio de pago eliminado" })}
              />
            </div>
          )}
        />
      )}
      {editing ? <MethodDialog value={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function MethodDialog({ value, onClose }: { value: Partial<PaymentMethod>; onClose: () => void }) {
  const { run, pending } = useAction();
  const [name, setName] = React.useState(value.name ?? "");
  const [number, setNumber] = React.useState(value.account_number ?? "");
  const [holder, setHolder] = React.useState(value.holder ?? "");
  const [instructions, setInstructions] = React.useState(value.instructions ?? "");
  const [qr, setQr] = React.useState(value.qr_url ?? "");
  const [active, setActive] = React.useState(value.active ?? true);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar medio de pago" : "Nuevo medio de pago"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Nombre" htmlFor="pm-name">
            <Input id="pm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nequi" />
          </Field>
          <Field label="Número o llave" htmlFor="pm-num">
            <Input id="pm-num" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Titular" htmlFor="pm-holder">
            <Input id="pm-holder" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Instrucciones (opcional)" htmlFor="pm-ins">
            <Textarea id="pm-ins" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={300} />
          </Field>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Código QR (opcional)</span>
            <ImageField value={qr} onChange={setQr} folder="payments" label="QR" />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Activo
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
                savePaymentMethod({ id: value.id, name, account_number: number, holder, instructions, qr_url: qr, active }),
                { success: "Medio de pago guardado" },
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
