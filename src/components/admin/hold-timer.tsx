"use client";

import { useNow } from "@/lib/hooks";

/** Minutos restantes de la reserva temporal (se actualiza cada 30 s). */
export function HoldTimer({ until }: { until: string }) {
  const now = useNow(30_000);
  if (now === null) return null;
  const mins = Math.max(0, Math.round((new Date(until).getTime() - now) / 60_000));
  if (mins === 0) return <span className="font-semibold text-destructive-text">vencida</span>;
  const h = Math.floor(mins / 60);
  return (
    <span className="font-semibold text-warning-foreground">
      vence en {h > 0 ? `${h} h ` : ""}
      {mins % 60} min
    </span>
  );
}
