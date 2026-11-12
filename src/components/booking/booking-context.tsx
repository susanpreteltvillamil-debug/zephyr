"use client";

import * as React from "react";
import type { PaymentMethod, Service, ServiceCategory, Settings } from "@/lib/types";

export interface BookingConfig {
  categories: (ServiceCategory & { services: Service[] })[];
  settings: Pick<
    Settings,
    | "salon_name"
    | "deposit_percent"
    | "hold_minutes"
    | "change_cutoff_hours"
    | "max_advance_days"
    | "cancellation_refund_mode"
  >;
  paymentMethods: PaymentMethod[];
  whatsapp: string;
}

interface BookingModalState {
  config: BookingConfig;
  open: boolean;
  initialServiceId: string | null;
  openBooking: (serviceId?: string) => void;
  setOpen: (open: boolean) => void;
}

const BookingContext = React.createContext<BookingModalState | null>(null);

export function BookingProvider({ config, children }: { config: BookingConfig; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [initialServiceId, setInitialServiceId] = React.useState<string | null>(null);

  const openBooking = React.useCallback((serviceId?: string) => {
    setInitialServiceId(serviceId ?? null);
    setOpen(true);
  }, []);

  const value = React.useMemo(
    () => ({ config, open, initialServiceId, openBooking, setOpen }),
    [config, open, initialServiceId, openBooking],
  );

  return <BookingContext value={value}>{children}</BookingContext>;
}

export function useBooking(): BookingModalState {
  const ctx = React.use(BookingContext);
  if (!ctx) throw new Error("useBooking debe usarse dentro de <BookingProvider>");
  return ctx;
}

export function useOptionalBooking(): BookingModalState | null {
  return React.use(BookingContext);
}
