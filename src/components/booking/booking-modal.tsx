"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBooking, useOptionalBooking } from "./booking-context";
import { BookingWizard } from "./booking-wizard";

export function BookingModal() {
  const { config, open, setOpen, initialServiceId } = useBooking();
  // Remontar el wizard en cada apertura para empezar limpio.
  const [session, setSession] = React.useState(0);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setSession((s) => s + 1);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl pb-0 sm:pb-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Reserva tu cita en {config.settings.salon_name}</DialogTitle>
        <DialogDescription className="sr-only">
          Elige servicios, fecha y hora, y asegura tu cupo con un abono.
        </DialogDescription>
        <BookingWizard key={session} config={config} initialServiceId={initialServiceId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botón de reserva: abre el modal si existe el proveedor y, si JavaScript no
 * cargó todavía, funciona como enlace normal a /reservar.
 */
export function BookButton({
  children,
  serviceId,
  className,
  size = "lg",
  variant = "default",
}: {
  children: React.ReactNode;
  serviceId?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
}) {
  const booking = useOptionalBooking();
  const href = serviceId ? `/reservar?servicio=${serviceId}` : "/reservar";
  return (
    <Button asChild size={size} variant={variant} className={cn(className)}>
      <Link
        href={href}
        onClick={(e) => {
          if (!booking || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          booking.openBooking(serviceId);
        }}
      >
        {children}
      </Link>
    </Button>
  );
}
