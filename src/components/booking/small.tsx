"use client";

import * as React from "react";
import Script from "next/script";
import { Check, Copy, Timer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("No se pudo copiar. Mantén presionado para copiar manualmente.");
        }
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function remaining(target: string): number {
  return Math.max(0, new Date(target).getTime() - Date.now());
}

export function Countdown({ until, onExpire }: { until: string; onExpire?: () => void }) {
  const [ms, setMs] = React.useState(() => remaining(until));
  React.useEffect(() => {
    const id = setInterval(() => {
      const r = remaining(until);
      setMs(r);
      if (r === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, onExpire]);

  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const expired = ms === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        expired ? "border-destructive/40 bg-destructive-soft text-destructive-text" : "border-warning/50 bg-warning-soft text-warning-foreground",
      )}
      role="timer"
      aria-live="off"
    >
      <Timer className="size-5 shrink-0" aria-hidden />
      <div className="text-sm">
        {expired ? (
          <strong>Tu reserva temporal venció. Si ya pagaste, escríbenos por WhatsApp.</strong>
        ) : (
          <>
            <span className="block">Tu cupo está apartado por:</span>
            <strong className="font-display text-2xl tabular-nums">
              {h > 0 ? `${h}:` : ""}
              {pad(m)}:{pad(s)}
            </strong>
          </>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

/** Widget de Cloudflare Turnstile (gratis). No se renderiza si no hay site key. */
export function Turnstile({
  siteKey,
  onToken,
  resetSignal = 0,
}: {
  siteKey: string;
  onToken: (token: string | undefined) => void;
  resetSignal?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const onTokenRef = React.useRef(onToken);
  React.useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  React.useEffect(() => {
    if (!ready || !ref.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      language: "es",
      theme: "auto",
      callback: (t: string) => onTokenRef.current(t),
      "expired-callback": () => onTokenRef.current(undefined),
      "error-callback": () => onTokenRef.current(undefined),
    });
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready, siteKey]);

  React.useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onTokenRef.current(undefined);
    }
  }, [resetSignal]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={ref} className="min-h-[65px]" />
    </>
  );
}
