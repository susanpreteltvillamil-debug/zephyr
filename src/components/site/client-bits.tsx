"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { formatDateTimeLong, bogotaDateKey, bogotaToday, addDaysToKey, formatTime } from "@/lib/booking/time";
import { isSupabaseConfigured } from "@/lib/env";
import { BookButton } from "@/components/booking/booking-modal";
import { WhatsAppIcon } from "./brand-icons";
import { waLink } from "@/lib/booking/whatsapp";

function describeSlot(iso: string): string {
  const key = bogotaDateKey(iso);
  const today = bogotaToday();
  if (key === today) return `hoy a las ${formatTime(iso)}`;
  if (key === addDaysToKey(today, 1)) return `mañana a las ${formatTime(iso)}`;
  return formatDateTimeLong(iso);
}

/** "Próximo cupo disponible" calculado con datos reales (RPC). */
export function NextSlot() {
  const [state, setState] = React.useState<{ status: "loading" | "ready" | "none" | "error"; slot?: string }>(() => ({
    status: isSupabaseConfigured() ? "loading" : "error",
  }));

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    getBrowserSupabase()
      .rpc("get_next_available_slot")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setState({ status: "error" });
        else if (!data) setState({ status: "none" });
        else setState({ status: "ready", slot: data as string });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "error") return null;

  return (
    <p
      className="inline-flex min-h-10 items-center gap-2.5 rounded-full border bg-card/80 px-4 py-2 text-sm shadow-sm backdrop-blur"
      aria-live="polite"
    >
      <span className="relative flex size-2.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2.5 rounded-full bg-success" />
      </span>
      <CalendarClock className="size-4 text-brand" aria-hidden />
      {state.status === "loading" ? (
        <span className="text-muted-foreground">Buscando el próximo cupo…</span>
      ) : state.status === "none" ? (
        <span>Agenda llena por ahora. Escríbenos y te avisamos.</span>
      ) : (
        <span>
          Próximo cupo disponible: <strong className="font-semibold first-letter:uppercase">{describeSlot(state.slot!)}</strong>
        </span>
      )}
    </p>
  );
}

/** Botón flotante de WhatsApp + CTA fijo en móvil. */
export function FloatingActions({ whatsapp, salonName }: { whatsapp: string; salonName: string }) {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <a
        href={waLink(whatsapp, `¡Hola ${salonName}! Quiero información para agendar una cita.`)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#128C4B] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:bottom-6"
      >
        <WhatsAppIcon className="size-7" />
      </a>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 sm:hidden ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        inert={!visible}
      >
        <BookButton className="w-full" size="lg">
          Reserva tu cita
        </BookButton>
      </div>
    </>
  );
}
