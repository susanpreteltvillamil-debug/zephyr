import type { Metadata } from "next";
import { ReservarClient } from "./reservar-client";

export const metadata: Metadata = {
  title: "Reserva tu cita",
  description: "Elige tus servicios, fecha y hora entre los cupos disponibles y asegura tu cita con un abono.",
  alternates: { canonical: "/reservar" },
};

export default async function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  const sp = await searchParams;
  const servicio = typeof sp.servicio === "string" ? sp.servicio : null;
  return (
    <div className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Reserva tu cita</h1>
        <p className="mb-8 text-muted-foreground">En menos de un minuto. Solo te mostramos horarios realmente disponibles.</p>
        <div className="rounded-3xl border bg-popover p-5 pb-0 shadow-sm sm:p-6 sm:pb-0">
          <ReservarClient initialServiceId={servicio} />
        </div>
      </div>
    </div>
  );
}
