"use client";

import * as React from "react";
import { CalendarOff, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, useAction } from "@/components/admin/kit";
import { createTimeOff, deleteTimeOff, saveBusinessHours } from "@/app/admin/actions/content";
import { addDaysToKey, bogotaToUtc, bogotaToday, formatDateShort, WEEKDAYS } from "@/lib/booking/time";
import type { BusinessHour, TimeOff } from "@/lib/types";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursManager({ hours, timeOff }: { hours: BusinessHour[]; timeOff: TimeOff[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Horario semanal</CardTitle>
          <CardDescription>Hora de Colombia. Un día sin rangos queda cerrado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {ORDER.map((d) => (
            <DayRow key={d} weekday={d} ranges={hours.filter((h) => h.weekday === d)} />
          ))}
        </CardContent>
      </Card>
      <TimeOffCard timeOff={timeOff} />
    </div>
  );
}

function DayRow({ weekday, ranges: initial }: { weekday: number; ranges: BusinessHour[] }) {
  const { run, pending } = useAction();
  const toState = React.useCallback(
    () => initial.map((r) => ({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) })),
    [initial],
  );
  const [ranges, setRanges] = React.useState(toState);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setRanges(toState());
  }
  const dirty = JSON.stringify(ranges) !== JSON.stringify(toState());

  return (
    <div className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{WEEKDAYS[weekday]}</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRanges((r) => [...r, { start: r.at(-1)?.end ?? "09:00", end: "18:00" }])}
            disabled={ranges.length >= 6}
          >
            <Plus /> Rango
          </Button>
          <Button
            size="sm"
            disabled={!dirty || pending}
            onClick={() => void run(saveBusinessHours({ weekday, ranges }), { success: `Horario del ${WEEKDAYS[weekday].toLowerCase()} guardado` })}
          >
            Guardar
          </Button>
        </div>
      </div>
      {ranges.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Cerrado</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {ranges.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                type="time"
                step={300}
                value={r.start}
                aria-label={`Inicio del rango ${i + 1}`}
                onChange={(e) => setRanges((all) => all.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                className="h-10 max-w-36"
              />
              <span className="text-muted-foreground">a</span>
              <Input
                type="time"
                step={300}
                value={r.end}
                aria-label={`Fin del rango ${i + 1}`}
                onChange={(e) => setRanges((all) => all.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                className="h-10 max-w-36"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Quitar rango"
                onClick={() => setRanges((all) => all.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimeOffCard({ timeOff }: { timeOff: TimeOff[] }) {
  const { run, pending } = useAction();
  const today = bogotaToday();
  const [allDay, setAllDay] = React.useState(true);
  const [startDay, setStartDay] = React.useState(today);
  const [endDay, setEndDay] = React.useState(today);
  const [startTime, setStartTime] = React.useState("12:00");
  const [endTime, setEndTime] = React.useState("14:00");
  const [reason, setReason] = React.useState("");

  async function add() {
    const startAt = allDay ? bogotaToUtc(startDay, "00:00") : bogotaToUtc(startDay, startTime);
    const endAt = allDay ? bogotaToUtc(addDaysToKey(endDay < startDay ? startDay : endDay, 1), "00:00") : bogotaToUtc(startDay, endTime);
    const r = await run(createTimeOff({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), reason }), {
      success: "Bloqueo agregado",
    });
    if (r.ok) setReason("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bloqueos puntuales</CardTitle>
        <CardDescription>Festivos, vacaciones, citas personales u horas sueltas. No afecta citas ya creadas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-xl border p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} /> Día(s) completo(s)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label={allDay ? "Desde" : "Día"} htmlFor="to-start">
              <Input id="to-start" type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} />
            </Field>
            {allDay ? (
              <Field label="Hasta" htmlFor="to-end">
                <Input id="to-end" type="date" value={endDay} min={startDay} onChange={(e) => setEndDay(e.target.value)} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="De" htmlFor="to-st">
                  <Input id="to-st" type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </Field>
                <Field label="A" htmlFor="to-et">
                  <Input id="to-et" type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
          <Field label="Motivo (privado)" htmlFor="to-reason">
            <Input id="to-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Ej. Festivo" />
          </Field>
          <Button onClick={() => void add()} disabled={pending}>
            <CalendarOff /> Agregar bloqueo
          </Button>
        </div>

        {timeOff.length === 0 ? (
          <EmptyState>No hay bloqueos próximos.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {timeOff.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {formatDateShort(t.start_at)} → {formatDateShort(t.end_at)}
                  </p>
                  {t.reason ? <p className="text-muted-foreground">{t.reason}</p> : null}
                </div>
                <ConfirmDialog
                  trigger={
                    <Button size="icon-sm" variant="ghost" aria-label="Eliminar bloqueo">
                      <Trash2 />
                    </Button>
                  }
                  title="¿Eliminar este bloqueo?"
                  description="Esos horarios volverán a estar disponibles."
                  confirmLabel="Eliminar"
                  destructive
                  onConfirm={() => void run(deleteTimeOff({ id: t.id }), { success: "Bloqueo eliminado" })}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
