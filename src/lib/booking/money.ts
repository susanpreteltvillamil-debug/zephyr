export const MIN_DEPOSIT_PERCENT = 20;

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Formatea pesos colombianos sin decimales: $ 40.000 */
export function formatCOP(value: number): string {
  return copFormatter.format(Math.round(value));
}

/**
 * Abono: mínimo 20 %, redondeado hacia arriba al múltiplo de 1.000 COP,
 * sin superar el total. Debe coincidir con public.compute_deposit en SQL.
 */
export function computeDeposit(total: number, percent: number): number {
  const safeTotal = Math.max(0, Math.round(total));
  const pct = Math.max(MIN_DEPOSIT_PERCENT, percent);
  const raw = Math.ceil((safeTotal * pct) / 100 / 1000) * 1000;
  return Math.min(safeTotal, raw);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
