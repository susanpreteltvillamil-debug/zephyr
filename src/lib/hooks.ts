"use client";

import * as React from "react";

/**
 * Hora actual (ms) que se actualiza cada `intervalMs`. Devuelve `null` en el
 * servidor y en el primer render del cliente para evitar desajustes de hidratación.
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

const noopSubscribe = () => () => {};

/** `window.location.origin` en el cliente; cadena vacía durante el SSR. */
export function useOrigin(): string {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}
