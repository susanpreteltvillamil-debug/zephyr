"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldError, Input, Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { computeDeposit, formatCOP, formatDuration } from "@/lib/booking/money";
import { formatDateTimeLong } from "@/lib/booking/time";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { customerDetailsSchema, type CustomerDetailsInput } from "@/lib/validation/booking";
import { createBookingAction } from "@/app/(site)/reservar/actions";
import type { BookingResult } from "@/lib/types";
import type { BookingConfig } from "./booking-context";
import { ServicePicker, pruneSelection } from "./service-picker";
import { SlotPicker } from "./slot-picker";
import { BookingConfirmation } from "./confirmation";
import { Turnstile } from "./small";

const STEPS = ["Servicios", "Fecha y hora", "Tus datos", "Confirmación"] as const;

export function BookingWizard({
  config,
  initialServiceId,
  onDone,
}: {
  config: BookingConfig;
  initialServiceId?: string | null;
  onDone?: () => void;
}) {
  const allServices = React.useMemo(() => config.categories.flatMap((c) => c.services), [config.categories]);
  const [step, setStep] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(() =>
    initialServiceId && allServices.some((s) => s.id === initialServiceId && s.price_type === "fixed")
      ? new Set([initialServiceId])
      : new Set(),
  );
  const [slot, setSlot] = React.useState<string | null>(null);
  const [slotsVersion, setSlotsVersion] = React.useState(0);
  const [result, setResult] = React.useState<BookingResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | undefined>();
  const [turnstileReset, setTurnstileReset] = React.useState(0);
  const [honeypot, setHoneypot] = React.useState("");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const chosen = allServices.filter((s) => selected.has(s.id));
  const ordered = [...chosen].sort((a, b) => (a.price_type === b.price_type ? 0 : a.price_type === "fixed" ? -1 : 1));
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const duration = chosen.reduce((sum, s) => sum + s.duration_minutes, 0);
  const deposit = computeDeposit(total, config.settings.deposit_percent);
  const hasMain = chosen.some((s) => s.price_type === "fixed");
  const ids = React.useMemo(() => [...selected].sort(), [selected]);
  const idsKey = ids.join(",");

  const form = useForm<CustomerDetailsInput>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: { name: "", phone: "", email: "", notes: "", acceptPrivacy: false, acceptPolicy: false },
    mode: "onTouched",
  });

  React.useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [step]);

  const fetchDays = React.useCallback(
    async (from: string, to: string) => {
      const { data, error } = await getBrowserSupabase().rpc("get_available_days", {
        p_from: from,
        p_to: to,
        p_service_ids: ids,
      });
      if (error) throw error;
      return ((data ?? []) as { day: string }[]).map((d) => d.day);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, slotsVersion],
  );

  const fetchSlots = React.useCallback(
    async (day: string) => {
      const { data, error } = await getBrowserSupabase().rpc("get_available_slots", {
        p_day: day,
        p_service_ids: ids,
      });
      if (error) throw error;
      return ((data ?? []) as { slot_start: string }[]).map((d) => d.slot_start);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, slotsVersion],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    if (!slot) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await createBookingAction({
        ...values,
        serviceIds: ids,
        startAt: slot,
        website: honeypot,
        turnstileToken,
      });
      if (res.ok) {
        setResult(res.data);
        setStep(3);
      } else {
        toast.error(res.error);
        setTurnstileReset((n) => n + 1);
        if (res.code === "ZP001" || res.code === "ZP002" || res.code === "ZP003") {
          setSlot(null);
          setSlotsVersion((v) => v + 1);
          setStep(1);
        }
      }
    } catch {
      toast.error("No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  });

  if (allServices.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        Pronto podrás reservar en línea. Mientras tanto, escríbenos por WhatsApp.
      </p>
    );
  }

  const canNext = step === 0 ? hasMain : step === 1 ? Boolean(slot) : true;

  return (
    <div className="flex flex-col">
      {/* Progreso */}
      <ol className="mb-6 grid grid-cols-4 gap-1.5" aria-label="Pasos de la reserva">
        {STEPS.map((label, i) => (
          <li key={label} className="grid gap-1.5" aria-current={i === step ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("hidden text-xs sm:block", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="mb-1 font-display text-2xl font-semibold outline-none">
        {step === 0 && "¿Qué te quieres hacer?"}
        {step === 1 && "Elige fecha y hora"}
        {step === 2 && "Tus datos"}
        {step === 3 && <span className="sr-only">Confirmación</span>}
      </h2>
      {step === 0 ? (
        <p className="mb-5 text-sm text-muted-foreground">Puedes combinar varios servicios. El total se suma al instante.</p>
      ) : null}
      {step === 1 ? (
        <p className="mb-5 text-sm text-muted-foreground">
          Solo ves horarios realmente disponibles para {formatDuration(duration)} de servicio.
        </p>
      ) : null}
      {step === 2 && slot ? (
        <p className="mb-5 text-sm text-muted-foreground">
          <span className="capitalize">{formatDateTimeLong(slot)}</span> · {formatDuration(duration)}
        </p>
      ) : null}

      <div className="min-h-0 flex-1">
        {step === 0 ? (
          <ServicePicker
            categories={config.categories}
            selected={selected}
            onChange={(next) => {
              setSelected(pruneSelection(next, allServices));
              setSlot(null);
            }}
          />
        ) : null}

        {step === 1 ? (
          <SlotPicker
            fetchDays={fetchDays}
            fetchSlots={fetchSlots}
            maxAdvanceDays={config.settings.max_advance_days}
            value={slot}
            onChange={setSlot}
            resetKey={`${idsKey}|${slotsVersion}`}
          />
        ) : null}

        {step === 2 ? (
          <form id="booking-details" onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field label="Nombre completo" htmlFor="bk-name" error={form.formState.errors.name?.message}>
              <Input
                id="bk-name"
                autoComplete="name"
                aria-invalid={Boolean(form.formState.errors.name)}
                aria-describedby="bk-name-error"
                {...form.register("name")}
              />
            </Field>
            <Field
              label="WhatsApp"
              htmlFor="bk-phone"
              hint="Te escribiremos a este número para confirmar tu cita."
              error={form.formState.errors.phone?.message}
            >
              <Input
                id="bk-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="300 123 4567"
                aria-invalid={Boolean(form.formState.errors.phone)}
                aria-describedby="bk-phone-error"
                {...form.register("phone")}
              />
            </Field>
            <Field label="Correo (opcional)" htmlFor="bk-email" error={form.formState.errors.email?.message}>
              <Input
                id="bk-email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Notas (opcional)"
              htmlFor="bk-notes"
              hint="Diseño que quieres, largo, alergias o algo que debamos saber."
              error={form.formState.errors.notes?.message}
            >
              <Textarea id="bk-notes" rows={3} maxLength={500} {...form.register("notes")} />
            </Field>

            {/* Honeypot: invisible para personas, tentador para bots */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="bk-website">Sitio web</label>
              <input
                id="bk-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid gap-3 rounded-2xl border bg-muted/40 p-4">
              <Controller
                control={form.control}
                name="acceptPrivacy"
                render={({ field, fieldState }) => (
                  <div className="grid gap-1">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="bk-privacy"
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        aria-invalid={Boolean(fieldState.error)}
                        className="mt-0.5"
                      />
                      <label htmlFor="bk-privacy" className="text-sm leading-relaxed">
                        Autorizo el tratamiento de mis datos según la{" "}
                        <Link href="/legal/privacidad" target="_blank" className="font-medium text-brand underline underline-offset-2">
                          Política de Tratamiento de Datos
                        </Link>{" "}
                        (Ley 1581 de 2012).
                      </label>
                    </div>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </div>
                )}
              />
              <Controller
                control={form.control}
                name="acceptPolicy"
                render={({ field, fieldState }) => (
                  <div className="grid gap-1">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="bk-policy"
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        aria-invalid={Boolean(fieldState.error)}
                        className="mt-0.5"
                      />
                      <label htmlFor="bk-policy" className="text-sm leading-relaxed">
                        Acepto la{" "}
                        <Link href="/legal/reservas" target="_blank" className="font-medium text-brand underline underline-offset-2">
                          Política de Reservas
                        </Link>
                        : abono de {formatCOP(deposit)}, <strong>no reembolsable si no asisto</strong>, y cambios solo con{" "}
                        {config.settings.change_cutoff_hours} h de anticipación.
                      </label>
                    </div>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </div>
                )}
              />
            </div>

            {publicEnv.turnstileSiteKey ? (
              <Turnstile siteKey={publicEnv.turnstileSiteKey} onToken={setTurnstileToken} resetSignal={turnstileReset} />
            ) : null}
          </form>
        ) : null}

        {step === 3 && result ? (
          <BookingConfirmation
            result={result}
            customerName={form.getValues("name")}
            serviceNames={ordered.map((s) => s.name)}
            paymentMethods={config.paymentMethods}
            whatsapp={config.whatsapp}
            changeCutoffHours={config.settings.change_cutoff_hours}
          />
        ) : null}
      </div>

      {/* Barra de resumen y navegación */}
      {step < 3 ? (
        <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t bg-popover/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0" aria-live="polite">
              {chosen.length > 0 ? (
                <>
                  <p className="font-display text-xl font-semibold tabular-nums">{formatCOP(total)}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> {formatDuration(duration)} · Abono {formatCOP(deposit)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Elige al menos un servicio</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {step > 0 ? (
                <Button type="button" variant="outline" size="icon" onClick={() => setStep(step - 1)} aria-label="Paso anterior">
                  <ArrowLeft />
                </Button>
              ) : null}
              {step < 2 ? (
                <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
                  Continuar <ArrowRight />
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="booking-details"
                  disabled={submitting || (Boolean(publicEnv.turnstileSiteKey) && !turnstileToken)}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  Reservar
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={onDone} asChild={!onDone}>
            {onDone ? "Cerrar" : <Link href="/">Volver al inicio</Link>}
          </Button>
        </div>
      )}
    </div>
  );
}
