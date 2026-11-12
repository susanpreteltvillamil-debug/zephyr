import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground",
        brand: "border-transparent bg-primary text-primary-foreground",
        soft: "border-transparent bg-soft text-soft-foreground",
        outline: "border-border text-foreground",
        success: "border-success/40 bg-success-soft text-success-foreground",
        warning: "border-warning/50 bg-warning-soft text-warning-foreground",
        danger: "border-destructive/40 bg-destructive-soft text-destructive-text",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; variant: NonNullable<VariantProps<typeof badgeVariants>["variant"]> }
> = {
  pending_payment: { label: "Pendiente de abono", variant: "warning" },
  confirmed: { label: "Confirmada", variant: "success" },
  completed: { label: "Atendida", variant: "brand" },
  no_show: { label: "No asistió", variant: "danger" },
  cancelled: { label: "Cancelada", variant: "danger" },
  expired: { label: "Vencida", variant: "muted" },
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}
