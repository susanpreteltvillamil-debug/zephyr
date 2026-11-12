import { formatCOP } from "./money";
import { toWhatsAppNumber } from "./phone";
import { formatDateTimeLong } from "./time";

export function waLink(number: string, message?: string): string {
  const base = `https://wa.me/${toWhatsAppNumber(number)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function proofMessage(input: {
  code: string;
  name: string;
  services: string[];
  startAt: string;
  deposit: number;
  total: number;
}): string {
  return [
    "¡Hola! Te envío el comprobante de mi abono.",
    "",
    `Código: ${input.code}`,
    `Nombre: ${input.name}`,
    `Servicios: ${input.services.join(", ")}`,
    `Fecha: ${formatDateTimeLong(input.startAt)}`,
    `Abono: ${formatCOP(input.deposit)} (total ${formatCOP(input.total)})`,
    "",
    "Adjunto la captura del pago.",
  ].join("\n");
}
