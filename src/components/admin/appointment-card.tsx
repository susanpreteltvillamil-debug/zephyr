import { StatusBadge } from "@/components/ui/badge";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import { formatPhone } from "@/lib/booking/phone";
import { formatDateLong, formatTime } from "@/lib/booking/time";
import { cn } from "@/lib/utils";
import type { AppointmentWithServices } from "@/lib/types";
import { AppointmentActions } from "./appointment-actions";
import { HoldTimer } from "./hold-timer";

const STATUS_BORDER: Record<string, string> = {
  pending_payment: "border-l-warning",
  confirmed: "border-l-success",
  completed: "border-l-primary",
  no_show: "border-l-destructive",
  cancelled: "border-l-destructive",
  expired: "border-l-muted-foreground",
};

export function AppointmentCard({
  appointment: a,
  showDate = false,
  highlight = false,
}: {
  appointment: AppointmentWithServices;
  showDate?: boolean;
  highlight?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-l-4 bg-card p-4",
        STATUS_BORDER[a.status],
        highlight && "border-warning/60 bg-warning-soft/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums">
            {showDate || highlight ? <span className="capitalize">{formatDateLong(a.start_at)} · </span> : null}
            {formatTime(a.start_at)} – {formatTime(a.end_at)}
          </p>
          <p className="mt-0.5 truncate font-display text-lg font-semibold">{a.customer_name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {a.appointment_services.map((s) => s.name).join(" + ")} · {formatDuration(a.total_duration_minutes)}
          </p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{a.code}</span> · {formatPhone(a.customer_phone)} · Abono {formatCOP(a.deposit_amount)}
          {a.deposit_paid ? " ✓" : ""}
          {a.status === "pending_payment" && a.hold_expires_at ? (
            <>
              {" "}
              · <HoldTimer until={a.hold_expires_at} />
            </>
          ) : null}
        </p>
        <AppointmentActions appointment={a} />
      </div>
    </article>
  );
}
