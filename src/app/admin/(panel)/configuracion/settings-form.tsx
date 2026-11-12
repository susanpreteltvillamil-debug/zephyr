"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { useAction } from "@/components/admin/kit";
import { saveSettings } from "@/app/admin/actions/content";
import { MIN_DEPOSIT_PERCENT, computeDeposit, formatCOP } from "@/lib/booking/money";
import type { RefundMode, Settings } from "@/lib/types";

type NumKey =
  | "deposit_percent"
  | "hold_minutes"
  | "min_notice_minutes"
  | "max_advance_days"
  | "slot_interval_minutes"
  | "buffer_minutes"
  | "change_cutoff_hours"
  | "max_reschedules"
  | "max_pending_per_phone";

const RULES: { key: NumKey; label: string; hint: string; min: number; max: number; suffix: string }[] = [
  { key: "deposit_percent", label: "Abono requerido", hint: `Porcentaje del total, mínimo ${MIN_DEPOSIT_PERCENT}%. Se redondea hacia arriba al millar.`, min: MIN_DEPOSIT_PERCENT, max: 100, suffix: "%" },
  { key: "hold_minutes", label: "Tiempo para pagar el abono", hint: "Cuánto se aparta el horario mientras llega el comprobante. Luego se libera solo.", min: 10, max: 1440, suffix: "min" },
  { key: "min_notice_minutes", label: "Antelación mínima", hint: "No se ofrecen horarios que empiecen antes de este tiempo.", min: 0, max: 10080, suffix: "min" },
  { key: "max_advance_days", label: "Horizonte de reservas", hint: "Hasta cuántos días adelante se puede reservar.", min: 1, max: 365, suffix: "días" },
  { key: "slot_interval_minutes", label: "Intervalo entre horarios", hint: "Cada cuánto se ofrece una hora de inicio (ej. 30 → 9:00, 9:30…).", min: 5, max: 240, suffix: "min" },
  { key: "buffer_minutes", label: "Tiempo de preparación", hint: "Minutos libres después de cada cita para limpiar y organizar.", min: 0, max: 240, suffix: "min" },
  { key: "change_cutoff_hours", label: "Plazo para cambios", hint: "Las clientas pueden reagendar o cancelar hasta estas horas antes.", min: 0, max: 336, suffix: "h" },
  { key: "max_reschedules", label: "Reagendamientos permitidos", hint: "Veces que una clienta puede mover su cita por su cuenta.", min: 0, max: 10, suffix: "" },
  { key: "max_pending_per_phone", label: "Reservas pendientes por WhatsApp", hint: "Evita que una sola persona aparte muchos horarios sin pagar.", min: 1, max: 10, suffix: "" },
];

export function SettingsForm({ settings }: { settings: Settings }) {
  const { run, pending } = useAction();
  const [form, setForm] = React.useState(() => ({
    salon_name: settings.salon_name,
    tagline: settings.tagline,
    address: settings.address,
    city: settings.city,
    whatsapp_number: settings.whatsapp_number,
    cancellation_refund_mode: settings.cancellation_refund_mode,
    ...Object.fromEntries(RULES.map((r) => [r.key, String(settings[r.key])])),
  }) as Record<string, string> & { cancellation_refund_mode: RefundMode });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.salon_name?.trim()) next.salon_name = "Escribe el nombre del salón.";
    if (!/^\d{10,13}$/.test(form.whatsapp_number ?? "")) next.whatsapp_number = "Solo números, 10 dígitos.";
    for (const r of RULES) {
      const n = Number(form[r.key]);
      if (!Number.isInteger(n) || n < r.min || n > r.max) next[r.key] = `Debe ser un entero entre ${r.min} y ${r.max}.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const pct = Number(form.deposit_percent);
  const example = Number.isInteger(pct) && pct >= MIN_DEPOSIT_PERCENT && pct <= 100 ? computeDeposit(85_000, pct) : null;

  return (
    <form
      className="grid max-w-4xl gap-6"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!validate()) return;
        await run(
          saveSettings({
            salon_name: form.salon_name ?? "",
            tagline: form.tagline ?? "",
            address: form.address ?? "",
            city: form.city ?? "",
            whatsapp_number: (form.whatsapp_number ?? "").replace(/\D/g, ""),
            cancellation_refund_mode: form.cancellation_refund_mode,
            ...(Object.fromEntries(RULES.map((r) => [r.key, Number(form[r.key])])) as Record<NumKey, number>),
          }),
          { success: "Configuración guardada" },
        );
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Negocio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del salón" htmlFor="s-name" error={errors.salon_name}>
            <Input id="s-name" value={form.salon_name} onChange={(e) => set("salon_name", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Frase corta" htmlFor="s-tag" hint="Se usa en la pestaña del navegador y al compartir.">
            <Input id="s-tag" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={160} />
          </Field>
          <Field label="Dirección" htmlFor="s-addr">
            <Input id="s-addr" value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={160} />
          </Field>
          <Field label="Ciudad" htmlFor="s-city">
            <Input id="s-city" value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
          </Field>
          <Field
            label="WhatsApp para comprobantes"
            htmlFor="s-wa"
            hint="Recibe los comprobantes de abono. Sin espacios ni +57."
            error={errors.whatsapp_number}
          >
            <Input
              id="s-wa"
              inputMode="numeric"
              value={form.whatsapp_number}
              onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, ""))}
              maxLength={13}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de reserva</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {RULES.map((r) => (
            <Field key={r.key} label={r.label} htmlFor={`s-${r.key}`} hint={r.hint} error={errors[r.key]}>
              <div className="flex items-center gap-2">
                <Input
                  id={`s-${r.key}`}
                  type="number"
                  inputMode="numeric"
                  min={r.min}
                  max={r.max}
                  step={1}
                  value={form[r.key]}
                  onChange={(e) => set(r.key, e.target.value)}
                  aria-invalid={errors[r.key] ? true : undefined}
                />
                {r.suffix ? <span className="w-10 text-sm text-muted-foreground">{r.suffix}</span> : null}
              </div>
            </Field>
          ))}
          <Field
            label="Al cancelar a tiempo, el abono…"
            htmlFor="s-refund"
            hint="Si cancela fuera de plazo o no asiste, el abono no se devuelve."
          >
            <NativeSelect
              id="s-refund"
              value={form.cancellation_refund_mode}
              onChange={(e) => set("cancellation_refund_mode", e.target.value)}
            >
              <option value="credit">Queda como saldo a favor</option>
              <option value="refund">Se devuelve (tú haces la transferencia)</option>
            </NativeSelect>
          </Field>
          {example !== null ? (
            <p className="rounded-xl bg-soft p-3 text-sm text-soft-foreground sm:col-span-2">
              Ejemplo: en una cita de {formatCOP(85_000)} el abono sería de <strong>{formatCOP(example)}</strong>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          Guardar configuración
        </Button>
      </div>
    </form>
  );
}
