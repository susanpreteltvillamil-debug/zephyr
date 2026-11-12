"use client";

import * as React from "react";
import { CalendarClock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Countdown } from "@/components/booking/small";
import { WhatsAppIcon } from "@/components/site/brand-icons";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import { formatDateTimeLong } from "@/lib/booking/time";
import { proofMessage, waLink } from "@/lib/booking/whatsapp";
import type { ManagedBooking, PaymentMethod, RefundMode } from "@/lib/types";
import { cancelAction, daysForTokenAction, rescheduleAction, slotsForTokenAction } from "./actions";

export function ManageBooking({
  token,
  initial,
  whatsapp,
  maxAdvanceDays,
  refundMode,
  paymentMethods,
}: {
  token: string;
  initial: ManagedBooking;
  whatsapp: string;
  maxAdvanceDays: number;
  refundMode: RefundMode;
  paymentMethods: PaymentMethod[];
}) {
  const [booking, setBooking] = React.useState(initial);
  const [mode, setMode] = React.useState<"view" | "reschedule">("view");
  const [slot, setSlot] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const active = booking.status === "pending_payment" || booking.status === "confirmed";
  const canReschedule = booking.can_change && booking.reschedule_count < booking.max_reschedules;
  const serviceNames = booking.services.map((s) => s.name);

  const fetchDays = React.useCallback(
    async (from: string, to: string) => {
      const r = await daysForTokenAction({ token, from, to });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, version],
  );
  const fetchSlots = React.useCallback(
    async (day: string) => {
      const r = await slotsForTokenAction({ token, day });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, version],
  );

  async function doReschedule() {
    if (!slot) return;
    setBusy(true);
    const r = await rescheduleAction({ token, startAt: slot });
    setBusy(false);
    if (r.ok) {
      setBooking(r.data);
      setMode("view");
      setSlot(null);
      toast.success("¡Listo! Tu cita quedó reagendada.");
    } else {
      toast.error(r.error);
      setSlot(null);
      setVersion((v) => v + 1);
    }
  }

  async function doCancel() {
    setBusy(true);
    const r = await cancelAction({ token });
    setBusy(false);
    if (r.ok) {
      setBooking(r.data);
      toast.success("Tu cita fue cancelada.");
    } else toast.error(r.error);
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-lg font-semibold tracking-wider">{booking.code}</p>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-4 font-display text-2xl font-semibold capitalize">{formatDateTimeLong(booking.start_at)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {serviceNames.join(" + ")} · {formatDuration(booking.total_duration_minutes)}
        </p>
        <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold tabular-nums">{formatCOP(booking.total_price)}</dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-muted-foreground">Abono ({booking.deposit_percent} %)</dt>
            <dd className="font-semibold tabular-nums">{formatCOP(booking.deposit_amount)}</dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-muted-foreground">Estado del abono</dt>
            <dd className="font-semibold">{booking.deposit_paid ? "Recibido" : "Pendiente"}</dd>
          </div>
        </dl>
        {booking.status === "cancelled" && booking.refund_status === "credited" ? (
          <p className="mt-4 rounded-2xl bg-success-soft p-3 text-sm text-success-foreground">
            Tu abono quedó como saldo a favor para tu próxima cita.
          </p>
        ) : null}
        {booking.status === "cancelled" && booking.refund_status === "refund_pending" ? (
          <p className="mt-4 rounded-2xl bg-success-soft p-3 text-sm text-success-foreground">
            Te contactaremos para devolverte el abono.
          </p>
        ) : null}
      </div>

      {booking.status === "pending_payment" && booking.hold_expires_at ? (
        <div className="grid gap-3">
          <Countdown until={booking.hold_expires_at} />
          {paymentMethods.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Paga el abono a {paymentMethods.map((m) => `${m.name} ${m.account_number}`).join(" · ")}
              {paymentMethods[0]?.holder ? ` (titular: ${paymentMethods[0].holder})` : ""}.
            </p>
          ) : null}
          <Button asChild variant="whatsapp" size="lg">
            <a
              href={waLink(
                whatsapp,
                proofMessage({
                  code: booking.code,
                  name: booking.customer_name,
                  services: serviceNames,
                  startAt: booking.start_at,
                  deposit: booking.deposit_amount,
                  total: booking.total_price,
                }),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon className="size-5" /> Enviar comprobante por WhatsApp
            </a>
          </Button>
        </div>
      ) : null}

      {active && booking.can_change ? (
        mode === "view" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              size="lg"
              disabled={!canReschedule}
              onClick={() => setMode("reschedule")}
              title={!canReschedule ? "Ya usaste el número máximo de reagendamientos" : undefined}
            >
              <CalendarClock /> Reagendar
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="lg" className="text-destructive-text" disabled={busy}>
                  <XCircle /> Cancelar cita
                </Button>
              }
              title="¿Cancelar tu cita?"
              description={
                booking.deposit_paid
                  ? refundMode === "credit"
                    ? `Tu abono de ${formatCOP(booking.deposit_amount)} quedará como saldo a favor.`
                    : `Te devolveremos el abono de ${formatCOP(booking.deposit_amount)}.`
                  : "El horario quedará libre para otra persona."
              }
              confirmLabel="Sí, cancelar"
              destructive
              onConfirm={doCancel}
            />
            {!canReschedule ? (
              <p className="self-center text-xs text-muted-foreground">
                Reagendamientos usados: {booking.reschedule_count} de {booking.max_reschedules}.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 rounded-3xl border bg-popover p-5 sm:p-6">
            <h2 className="font-display text-xl font-semibold">Elige tu nueva fecha</h2>
            <SlotPicker
              fetchDays={fetchDays}
              fetchSlots={fetchSlots}
              maxAdvanceDays={maxAdvanceDays}
              value={slot}
              onChange={setSlot}
              resetKey={String(version)}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setMode("view")}>
                Volver
              </Button>
              <Button disabled={!slot || busy} onClick={doReschedule}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Confirmar {slot ? formatDateTimeLong(slot) : "nuevo horario"}
              </Button>
            </div>
          </div>
        )
      ) : null}

      {active && !booking.can_change ? (
        <div className="rounded-3xl border border-warning/50 bg-warning-soft p-5 text-warning-foreground">
          <p className="font-semibold">Ya no es posible cambiar ni cancelar esta cita desde el sitio.</p>
          <p className="mt-1 text-sm">
            Los cambios y cancelaciones se permiten hasta {booking.change_cutoff_hours} horas antes de la cita. Si tienes
            una emergencia, escríbenos y lo revisamos juntas.
          </p>
          <Button asChild variant="whatsapp" className="mt-4">
            <a
              href={waLink(whatsapp, `Hola, tengo la cita ${booking.code} y necesito ayuda con un cambio.`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon className="size-5" /> Escribir por WhatsApp
            </a>
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Recuerda: el abono no se devuelve por inasistencia. Este enlace es privado; no lo compartas.
      </p>
    </div>
  );
}
