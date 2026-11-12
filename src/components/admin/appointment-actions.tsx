"use client";

import * as React from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCheck,
  Eye,
  MoreHorizontal,
  PiggyBank,
  Trash2,
  Unlock,
  UserX,
  XCircle,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/misc";
import { Checkbox, Input, Label } from "@/components/ui/form-controls";
import { SlotPicker } from "@/components/booking/slot-picker";
import { WhatsAppIcon } from "@/components/site/brand-icons";
import { useAction } from "./kit";
import {
  adminSlots,
  applyCustomerCredit,
  deleteAppointment,
  rescheduleAppointment,
  updateAppointmentNotes,
  updateAppointmentStatus,
} from "@/app/admin/actions/appointments";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import { formatPhone } from "@/lib/booking/phone";
import { bogotaDateKey, bogotaToUtc, formatDateShort, formatDateTimeLong } from "@/lib/booking/time";
import { waLink } from "@/lib/booking/whatsapp";
import type { AppointmentWithServices } from "@/lib/types";
import { Textarea } from "@/components/ui/form-controls";

type Dialogs = "detail" | "reschedule" | "cancel" | "delete" | null;

export function AppointmentActions({ appointment: a, compact = false }: { appointment: AppointmentWithServices; compact?: boolean }) {
  const { run, pending } = useAction();
  const [dialog, setDialog] = React.useState<Dialogs>(null);
  const active = a.status === "pending_payment" || a.status === "confirmed";
  const credit = a.customers?.credit_balance ?? 0;

  const status = (action: Parameters<typeof updateAppointmentStatus>[0]["action"], success: string) =>
    run(updateAppointmentStatus({ id: a.id, action }), { success });

  const waMessage = `Hola ${a.customer_name.split(" ")[0]}, te escribimos de Zephyr sobre tu cita ${a.code} del ${formatDateTimeLong(a.start_at)}.`;

  return (
    <>
      <div className="flex items-center gap-1.5">
        {a.status === "pending_payment" && !compact ? (
          <Button size="sm" variant="success" disabled={pending} onClick={() => status("confirm_deposit", "Abono confirmado")}>
            <BadgeCheck /> Confirmar abono
          </Button>
        ) : null}
        <Button asChild size="icon-sm" variant="ghost" aria-label="Escribir por WhatsApp">
          <a href={waLink(a.customer_phone, waMessage)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-4 text-[#128C4B] dark:text-[#4ade80]" />
          </a>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Acciones de la cita ${a.code}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setDialog("detail")}>
              <Eye /> Ver detalle
            </DropdownMenuItem>
            {a.status === "pending_payment" || a.status === "expired" ? (
              <DropdownMenuItem onSelect={() => void status("confirm_deposit", "Abono confirmado")}>
                <BadgeCheck /> Confirmar abono
              </DropdownMenuItem>
            ) : null}
            {(a.status === "pending_payment" || a.status === "expired") && credit >= a.deposit_amount && a.deposit_amount > 0 ? (
              <DropdownMenuItem onSelect={() => void run(applyCustomerCredit({ id: a.id }), { success: "Abono cubierto con saldo a favor" })}>
                <PiggyBank /> Usar saldo a favor ({formatCOP(credit)})
              </DropdownMenuItem>
            ) : null}
            {a.status === "confirmed" && !a.deposit_paid ? (
              <DropdownMenuItem onSelect={() => void status("mark_deposit_paid", "Abono registrado")}>
                <BadgeCheck /> Registrar abono recibido
              </DropdownMenuItem>
            ) : null}
            {a.status === "confirmed" || a.status === "no_show" ? (
              <DropdownMenuItem onSelect={() => void status("complete", "Marcada como atendida")}>
                <CheckCheck /> Marcar asistió
              </DropdownMenuItem>
            ) : null}
            {a.status === "confirmed" || a.status === "completed" ? (
              <DropdownMenuItem onSelect={() => void status("no_show", "Marcada como no asistió")}>
                <UserX /> Marcar no asistió
              </DropdownMenuItem>
            ) : null}
            {active ? (
              <DropdownMenuItem onSelect={() => setDialog("reschedule")}>
                <CalendarClock /> Reagendar
              </DropdownMenuItem>
            ) : null}
            {a.status === "pending_payment" ? (
              <DropdownMenuItem onSelect={() => void status("release", "Espacio liberado")}>
                <Unlock /> Liberar espacio
              </DropdownMenuItem>
            ) : null}
            {a.refund_status === "refund_pending" ? (
              <DropdownMenuItem onSelect={() => void status("mark_refunded", "Devolución registrada")}>
                <Undo2 /> Marcar abono devuelto
              </DropdownMenuItem>
            ) : null}
            {active ? (
              <DropdownMenuItem destructive onSelect={() => setDialog("cancel")}>
                <XCircle /> Cancelar cita
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setDialog("delete")}>
              <Trash2 /> Eliminar definitivamente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DetailDialog appointment={a} open={dialog === "detail"} onOpenChange={(o) => setDialog(o ? "detail" : null)} />
      {dialog === "reschedule" ? <RescheduleDialog appointment={a} onClose={() => setDialog(null)} /> : null}
      {dialog === "cancel" ? <CancelDialog appointment={a} onClose={() => setDialog(null)} /> : null}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title="¿Eliminar esta cita?"
        description={`Se borrará ${a.code} de ${a.customer_name} de forma permanente. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => void run(deleteAppointment({ id: a.id }), { success: "Cita eliminada" })}
      />
    </>
  );
}

function DetailDialog({
  appointment: a,
  open,
  onOpenChange,
}: {
  appointment: AppointmentWithServices;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { run, pending } = useAction();
  const [notes, setNotes] = React.useState(a.notes);
  const rows: [string, React.ReactNode][] = [
    ["Fecha", <span key="d" className="capitalize">{formatDateTimeLong(a.start_at)}</span>],
    ["Duración", formatDuration(a.total_duration_minutes)],
    ["Cliente", a.customer_name],
    ["WhatsApp", formatPhone(a.customer_phone)],
    ["Correo", a.customer_email ?? "—"],
    ["Total", formatCOP(a.total_price)],
    ["Abono", `${formatCOP(a.deposit_amount)} (${a.deposit_percent} %) · ${a.deposit_paid ? "recibido" : "pendiente"}`],
    ["Saldo a favor del cliente", formatCOP(a.customers?.credit_balance ?? 0)],
    ["Origen", a.source === "web" ? "Sitio web" : "Manual (panel)"],
    ["Reagendamientos", String(a.reschedule_count)],
    ["Creada", formatDateShort(a.created_at)],
  ];
  if (a.hold_expires_at && a.status === "pending_payment") rows.push(["Reserva temporal hasta", formatDateShort(a.hold_expires_at)]);
  if (a.privacy_accepted_at)
    rows.push(["Aceptó políticas", `${formatDateShort(a.privacy_accepted_at)} · Datos v${a.privacy_version} · Reservas v${a.booking_policy_version}`]);
  if (a.cancelled_at) rows.push(["Cancelada", `${formatDateShort(a.cancelled_at)} por ${a.cancelled_by === "admin" ? "el salón" : "el cliente"}`]);
  if (a.refund_status !== "none")
    rows.push([
      "Abono tras cancelar",
      { credited: "Saldo a favor", refund_pending: "Devolución pendiente", refunded: "Devuelto", none: "—" }[a.refund_status],
    ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{a.code}</span> <StatusBadge status={a.status} />
          </DialogTitle>
          <DialogDescription>{a.appointment_services.map((s) => s.name).join(" + ")}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b pb-2 last:border-0">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 grid gap-1 rounded-xl bg-muted p-3 text-sm">
          {a.appointment_services.map((s) => (
            <li key={s.id} className="flex justify-between">
              <span>{s.name}</span>
              <span className="tabular-nums">
                {formatCOP(s.price)} · {formatDuration(s.duration_minutes)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2">
          <Label htmlFor={`notes-${a.id}`}>Notas</Label>
          <Textarea id={`notes-${a.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending || notes === a.notes}
            onClick={() => void run(updateAppointmentNotes({ id: a.id, notes }), { success: "Notas guardadas" })}
          >
            Guardar notas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ appointment: a, onClose }: { appointment: AppointmentWithServices; onClose: () => void }) {
  const { run, pending } = useAction();
  const [slot, setSlot] = React.useState<string | null>(null);
  const [manualDay, setManualDay] = React.useState(bogotaDateKey(a.start_at));
  const [manualTime, setManualTime] = React.useState("");
  const serviceIds = a.appointment_services.map((s) => s.service_id).filter((x): x is string => Boolean(x));

  const fetchSlots = React.useCallback(
    async (day: string) => {
      if (serviceIds.length === 0) return [];
      const r = await adminSlots({ day, serviceIds, exclude: a.id });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.id],
  );
  const fetchDays = React.useCallback(async (from: string, to: string) => {
    const days: string[] = [];
    for (let d = from; d <= to; ) {
      days.push(d);
      const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
      d = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
    }
    return days;
  }, []);

  const chosen = manualTime ? bogotaToUtc(manualDay, manualTime).toISOString() : slot;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reagendar {a.code}</DialogTitle>
          <DialogDescription>
            Actual: <span className="capitalize">{formatDateTimeLong(a.start_at)}</span>. Como administradora puedes saltarte
            la antelación mínima; los choques con otras citas siguen bloqueados.
          </DialogDescription>
        </DialogHeader>
        {serviceIds.length > 0 ? (
          <SlotPicker fetchDays={fetchDays} fetchSlots={fetchSlots} maxAdvanceDays={365} value={slot} onChange={setSlot} />
        ) : (
          <p className="text-sm text-muted-foreground">Los servicios de esta cita ya no existen en el catálogo: usa la hora manual.</p>
        )}
        <details className="mt-4 rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">Usar una hora personalizada</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input type="date" value={manualDay} onChange={(e) => setManualDay(e.target.value)} aria-label="Fecha" />
            <Input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} aria-label="Hora" step={300} />
          </div>
        </details>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button
            disabled={!chosen || pending}
            onClick={async () => {
              if (!chosen) return;
              const r = await run(rescheduleAppointment({ id: a.id, startAt: chosen }), { success: "Cita reagendada" });
              if (r.ok) onClose();
            }}
          >
            Guardar nuevo horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ appointment: a, onClose }: { appointment: AppointmentWithServices; onClose: () => void }) {
  const { run, pending } = useAction();
  const [credit, setCredit] = React.useState(true);
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar {a.code}</DialogTitle>
          <DialogDescription>El horario quedará libre para nuevas reservas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {a.deposit_paid && a.deposit_amount > 0 ? (
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
              <Checkbox checked={credit} onCheckedChange={(v) => setCredit(v === true)} className="mt-0.5" />
              <span>
                Dejar el abono de <strong>{formatCOP(a.deposit_amount)}</strong> como saldo a favor del cliente. Si lo desmarcas,
                quedará como <em>devolución pendiente</em>.
              </span>
            </label>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={`reason-${a.id}`}>Motivo (opcional)</Label>
            <Input id={`reason-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              const r = await run(updateAppointmentStatus({ id: a.id, action: "cancel", giveCredit: credit, reason }), {
                success: "Cita cancelada",
              });
              if (r.ok) onClose();
            }}
          >
            Cancelar cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
