"use client";

import * as React from "react";
import { useNow } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { ServicePicker, pruneSelection } from "@/components/booking/service-picker";
import { SlotPicker } from "@/components/booking/slot-picker";
import { useAction } from "@/components/admin/kit";
import { adminSlots, createManualAppointment } from "@/app/admin/actions/appointments";
import { computeDeposit, formatCOP, formatDuration } from "@/lib/booking/money";
import { addDaysToKey, bogotaToUtc, bogotaToday, formatDateTimeLong } from "@/lib/booking/time";
import { cn } from "@/lib/utils";
import type { Service, ServiceCategory } from "@/lib/types";

type DepositMode = "paid" | "skip" | "pending";

export function ManualAppointmentForm({
  categories,
  depositPercent,
}: {
  categories: (ServiceCategory & { services: Service[] })[];
  depositPercent: number;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const all = React.useMemo(() => categories.flatMap((c) => c.services), [categories]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [slot, setSlot] = React.useState<string | null>(null);
  const [manualDay, setManualDay] = React.useState(bogotaToday());
  const [manualTime, setManualTime] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [mode, setMode] = React.useState<DepositMode>("paid");

  const ids = React.useMemo(() => [...selected].sort(), [selected]);
  const idsKey = ids.join(",");
  const chosen = all.filter((s) => selected.has(s.id));
  const total = chosen.reduce((s, x) => s + x.price, 0);
  const duration = chosen.reduce((s, x) => s + x.duration_minutes, 0);
  const startAt = manualTime ? bogotaToUtc(manualDay, manualTime).toISOString() : slot;
  const now = useNow(60_000);
  const inPast = startAt && now !== null ? new Date(startAt).getTime() < now : false;
  const soon = startAt && now !== null ? new Date(startAt).getTime() < now + 2 * 3_600_000 : false;

  const fetchSlots = React.useCallback(
    async (day: string) => {
      const r = await adminSlots({ day, serviceIds: ids });
      if (!r.ok) throw new Error(r.error);
      return r.data.filter((s) => new Date(s).getTime() > Date.now() - 3_600_000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey],
  );
  const fetchDays = React.useCallback(async (from: string, to: string) => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDaysToKey(d, 1)) out.push(d);
    return out;
  }, []);

  async function submit() {
    if (!startAt) return;
    const r = await run(
      createManualAppointment({
        serviceIds: ids,
        startAt,
        name,
        phone,
        email,
        notes,
        depositMode: mode,
      }),
      { success: "Cita creada", refresh: false },
    );
    if (r.ok) router.push("/admin/citas");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <ServicePicker
              categories={categories}
              selected={selected}
              onChange={(n) => {
                setSelected(pruneSelection(n, all));
                setSlot(null);
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. Fecha y hora</CardTitle>
          </CardHeader>
          <CardContent>
            {ids.length === 0 ? (
              <p className="text-sm text-muted-foreground">Elige primero los servicios.</p>
            ) : (
              <SlotPicker
                fetchDays={fetchDays}
                fetchSlots={fetchSlots}
                maxAdvanceDays={365}
                value={slot}
                onChange={(s) => {
                  setSlot(s);
                  setManualTime("");
                }}
                resetKey={idsKey}
              />
            )}
            <details className="mt-4 rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-medium">Hora personalizada (fuera de los cupos)</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input type="date" value={manualDay} onChange={(e) => setManualDay(e.target.value)} aria-label="Fecha" />
                <Input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} step={300} aria-label="Hora" />
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>3. Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nombre" htmlFor="m-name">
              <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="WhatsApp" htmlFor="m-phone">
              <Input id="m-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" />
            </Field>
            <Field label="Correo (opcional)" htmlFor="m-email">
              <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Notas" htmlFor="m-notes">
              <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Abono</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(
              [
                ["paid", "Abono ya recibido", "La cita queda confirmada con el abono registrado."],
                ["pending", "Pendiente de abono", "Queda apartada con reserva temporal, como una reserva web."],
                ["skip", "Sin abono", "Confirmada sin abono (bajo tu responsabilidad)."],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm",
                  mode === value && "border-primary bg-accent",
                )}
              >
                <input type="radio" name="deposit" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[var(--primary)]" />
                <span>
                  <strong className="block">{label}</strong>
                  <span className="text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="sticky bottom-4">
          <CardContent className="grid gap-3 pt-5 sm:pt-6">
            <dl className="grid gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold">{formatCOP(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duración</dt>
                <dd>{duration ? formatDuration(duration) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Abono ({depositPercent} %)</dt>
                <dd>{formatCOP(computeDeposit(total, depositPercent))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Horario</dt>
                <dd className="text-right capitalize">{startAt ? formatDateTimeLong(startAt) : "—"}</dd>
              </div>
            </dl>
            {soon || mode === "skip" ? (
              <p className="flex gap-2 rounded-xl border border-warning/60 bg-warning-soft p-3 text-xs text-warning-foreground" role="alert">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  {inPast ? "Esta hora ya pasó. " : soon ? "Esta cita no cumple la antelación mínima de la web. " : ""}
                  {mode === "skip" ? "Estás confirmando sin abono. " : ""}
                  Como administradora puedes hacerlo, pero revisa que sea intencional.
                </span>
              </p>
            ) : null}
            <Button disabled={pending || ids.length === 0 || !startAt || name.trim().length < 2} onClick={() => void submit()}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Crear cita
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
