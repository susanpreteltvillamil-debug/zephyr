"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, Info, Link2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/site/brand-icons";
import { CopyButton, Countdown } from "./small";
import { useOrigin } from "@/lib/hooks";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import { formatDateTimeLong } from "@/lib/booking/time";
import { proofMessage, waLink } from "@/lib/booking/whatsapp";
import type { BookingResult, PaymentMethod } from "@/lib/types";

export function BookingConfirmation({
  result,
  customerName,
  serviceNames,
  paymentMethods,
  whatsapp,
  changeCutoffHours,
}: {
  result: BookingResult;
  customerName: string;
  serviceNames: string[];
  paymentMethods: PaymentMethod[];
  whatsapp: string;
  changeCutoffHours: number;
}) {
  const origin = useOrigin();
  const manageUrl = `${origin}/mi-cita/${result.manage_token}`;
  const remainingToPay = result.total_price - result.deposit_amount;
  const message = proofMessage({
    code: result.code,
    name: customerName,
    services: serviceNames,
    startAt: result.start_at,
    deposit: result.deposit_amount,
    total: result.total_price,
  });

  return (
    <div className="grid gap-5">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
          <CalendarCheck className="size-7" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">¡Casi lista, {customerName.split(" ")[0]}!</h2>
        <p className="mt-1 text-muted-foreground">
          Tu cupo está apartado. Paga el abono y envíanos el comprobante para confirmarlo.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Código de reserva</span>
          <span className="flex items-center gap-2">
            <strong className="font-mono text-lg tracking-wider">{result.code}</strong>
            <CopyButton value={result.code} label="Código" />
          </span>
        </div>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="text-right font-medium capitalize">{formatDateTimeLong(result.start_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Servicios</dt>
            <dd className="text-right font-medium">{serviceNames.join(", ")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Duración</dt>
            <dd className="font-medium">{formatDuration(result.total_duration_minutes)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium tabular-nums">{formatCOP(result.total_price)}</dd>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-accent px-3 py-2.5">
            <dt className="font-semibold text-accent-foreground">Abono a pagar ({result.deposit_percent} %)</dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-accent-foreground">
              {formatCOP(result.deposit_amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <dt className="text-muted-foreground">Saldo el día de la cita</dt>
            <dd className="tabular-nums text-muted-foreground">{formatCOP(remainingToPay)}</dd>
          </div>
        </dl>
      </div>

      <Countdown until={result.hold_expires_at} />

      <section aria-labelledby="pay-title" className="grid gap-3">
        <h3 id="pay-title" className="font-semibold">
          Medios de pago
        </h3>
        {paymentMethods.length === 0 ? (
          <p className="text-sm text-muted-foreground">Escríbenos por WhatsApp para recibir los datos de pago.</p>
        ) : (
          <ul className="grid gap-2.5">
            {paymentMethods.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3.5">
                <div className="min-w-0">
                  <p className="font-semibold">{m.name}</p>
                  <p className="font-mono text-base tabular-nums">{m.account_number}</p>
                  {m.holder ? <p className="text-xs text-muted-foreground">Titular: {m.holder}</p> : null}
                  {m.instructions ? <p className="mt-1 text-xs text-muted-foreground">{m.instructions}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <CopyButton value={m.account_number} label={`Número de ${m.name}`} />
                  {m.holder ? <CopyButton value={m.holder} label="Titular" /> : null}
                </div>
                {m.qr_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.qr_url} alt={`Código QR de ${m.name}`} className="mt-1 size-36 rounded-xl border bg-white p-1" loading="lazy" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button asChild variant="whatsapp" size="lg" className="w-full">
        <a href={waLink(whatsapp, message)} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon className="size-5" />
          Enviar comprobante por WhatsApp
        </a>
      </Button>

      <div className="rounded-2xl border bg-muted/50 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Link2 className="size-4 text-brand" aria-hidden /> Tu enlace privado para gestionar la cita
        </p>
        <p className="mt-1 text-muted-foreground">
          Guárdalo: desde ahí puedes reagendar o cancelar hasta {changeCutoffHours} horas antes. No lo compartas.
        </p>
        {origin ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href={`/mi-cita/${result.manage_token}`} className="break-all text-brand underline underline-offset-4">
              Abrir mi cita
            </Link>
            <CopyButton value={manageUrl} label="Enlace" />
          </div>
        ) : null}
      </div>

      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          El abono se descuenta del total el día de tu cita.
        </li>
        <li className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <strong className="text-foreground">El abono no se devuelve si no asistes.</strong> Puedes cambiar o cancelar
            con al menos {changeCutoffHours} horas de anticipación.
          </span>
        </li>
      </ul>
    </div>
  );
}
