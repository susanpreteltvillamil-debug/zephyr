"use client";

import { useBooking } from "@/components/booking/booking-context";
import { BookingWizard } from "@/components/booking/booking-wizard";

export function ReservarClient({ initialServiceId }: { initialServiceId: string | null }) {
  const { config } = useBooking();
  return <BookingWizard config={config} initialServiceId={initialServiceId} />;
}
