import type { Metadata } from "next";
import Link from "next/link";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getContactChannels, getPaymentMethods, getSettings, primaryWhatsApp } from "@/lib/data/public";
import { tokenSchema } from "@/lib/validation/booking";
import type { ManagedBooking } from "@/lib/types";
import { ManageBooking } from "./manage-booking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi cita",
  robots: { index: false, follow: false },
};

export default async function MiCitaPage({ params }: PageProps<"/mi-cita/[token]">) {
  const { token } = await params;
  const valid = tokenSchema.safeParse(token);
  let booking: ManagedBooking | null = null;
  if (valid.success) {
    try {
      const { data, error } = await getServiceSupabase().rpc("get_booking_by_token", { p_token: token });
      if (error) console.error("[mi-cita] get_booking_by_token:", error.message);
      booking = (data as ManagedBooking | null) ?? null;
    } catch (error) {
      console.error("[mi-cita] Supabase no disponible:", error);
    }
  }

  const [settings, channels, payments] = await Promise.all([getSettings(), getContactChannels(), getPaymentMethods()]);

  return (
    <div className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 font-display text-4xl font-semibold tracking-tight">Mi cita</h1>
        {booking ? (
          <ManageBooking
            token={token}
            initial={booking}
            whatsapp={primaryWhatsApp(settings, channels)}
            maxAdvanceDays={settings.max_advance_days}
            refundMode={settings.cancellation_refund_mode}
            paymentMethods={payments}
          />
        ) : (
          <div className="rounded-3xl border bg-card p-8 text-center">
            <p className="text-lg font-semibold">No encontramos esta cita</p>
            <p className="mt-2 text-muted-foreground">Revisa que el enlace esté completo o escríbenos por WhatsApp.</p>
            <Link href="/" className="mt-6 inline-block text-brand underline underline-offset-4">
              Volver al inicio
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
