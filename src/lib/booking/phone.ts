/** Normaliza un celular colombiano a 10 dígitos (sin +57). */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  return digits;
}

export function isValidColombianMobile(input: string): boolean {
  return /^3\d{9}$/.test(normalizePhone(input));
}

/** 3144657351 → 314 465 7351 */
export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  if (d.length !== 10) return input;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Número para wa.me con indicativo de Colombia. */
export function toWhatsAppNumber(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length === 10) return `57${d}`;
  return d;
}
