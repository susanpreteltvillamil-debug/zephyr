"use client";

import * as React from "react";
import { Check, Clock, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import type { Service, ServiceCategory } from "@/lib/types";

export function isAddonAllowed(service: Service, selected: Set<string>): boolean {
  if (service.price_type !== "addon") return true;
  if (service.requires_any_service_ids.length === 0) {
    // Sin dependencia explícita: basta con un servicio principal.
    return [...selected].some((id) => id !== service.id);
  }
  return service.requires_any_service_ids.some((id) => selected.has(id));
}

/** Quita adicionales cuya dependencia ya no se cumple. */
export function pruneSelection(selected: Set<string>, services: Service[]): Set<string> {
  const next = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of services) {
      if (s.price_type === "addon" && next.has(s.id)) {
        const others = new Set([...next].filter((id) => id !== s.id));
        if (!isAddonAllowed(s, others) || ![...others].some((id) => services.find((x) => x.id === id)?.price_type === "fixed")) {
          next.delete(s.id);
          changed = true;
        }
      }
    }
  }
  return next;
}

export function ServicePicker({
  categories,
  selected,
  onChange,
}: {
  categories: (ServiceCategory & { services: Service[] })[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const all = React.useMemo(() => categories.flatMap((c) => c.services), [categories]);
  const nameOf = (id: string) => all.find((s) => s.id === id)?.name ?? "";

  const toggle = (service: Service) => {
    const next = new Set(selected);
    if (next.has(service.id)) next.delete(service.id);
    else next.add(service.id);
    onChange(pruneSelection(next, all));
  };

  return (
    <div className="grid gap-6">
      {categories.map((cat) => (
        <fieldset key={cat.id}>
          <legend className="mb-3 font-display text-lg font-semibold">{cat.name}</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {cat.services.map((s) => {
              const checked = selected.has(s.id);
              const allowed = checked || isAddonAllowed(s, new Set([...selected].filter((id) => all.find((x) => x.id === id)?.price_type === "fixed")));
              const requirement =
                s.price_type === "addon" && s.requires_any_service_ids.length > 0
                  ? `Solo con: ${s.requires_any_service_ids.map(nameOf).filter(Boolean).join(" o ")}`
                  : s.price_type === "addon"
                    ? "Adicional: combínalo con un servicio"
                    : null;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-disabled={!allowed}
                  onClick={() => allowed && toggle(s)}
                  className={cn(
                    "group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-ring",
                    checked
                      ? "border-primary bg-accent shadow-sm ring-1 ring-primary"
                      : "bg-card hover:border-brand/60 hover:shadow-sm",
                    !allowed && "cursor-not-allowed opacity-60 hover:border-border hover:shadow-none",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="size-3.5" strokeWidth={3} /> : !allowed ? <Lock className="size-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <span className="font-semibold text-brand tabular-nums">
                        {s.price_type === "addon" ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Plus className="size-3.5" aria-label="adicional" />
                            {formatCOP(s.price)}
                          </span>
                        ) : (
                          formatCOP(s.price)
                        )}
                      </span>
                    </span>
                    {s.description ? (
                      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{s.description}</span>
                    ) : null}
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {formatDuration(s.duration_minutes)}
                      </span>
                      {requirement ? <span>{requirement}</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
