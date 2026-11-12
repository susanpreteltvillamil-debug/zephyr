"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileText,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageCircle,
  Clock,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-provider";
import { LogoMark } from "@/components/site/header";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { formatDateTimeLong } from "@/lib/booking/time";
import { formatCOP } from "@/lib/booking/money";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/admin/citas", label: "Citas", icon: ClipboardList, badge: true },
  { href: "/admin/servicios", label: "Servicios", icon: Sparkles },
  { href: "/admin/horarios", label: "Horarios y bloqueos", icon: Clock },
  { href: "/admin/contenido", label: "Contenido del sitio", icon: LayoutTemplate },
  { href: "/admin/galeria", label: "Galería", icon: Images },
  { href: "/admin/contacto", label: "Contacto y redes", icon: MessageCircle },
  { href: "/admin/pagos", label: "Medios de pago", icon: CreditCard },
  { href: "/admin/legales", label: "Políticas legales", icon: FileText },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
] as const;

interface NewAppointmentPayload {
  code: string;
  customer_name: string;
  start_at: string;
  deposit_amount: number;
  source: string;
}

export function AdminShell({
  email,
  pendingCount,
  children,
}: {
  email: string;
  pendingCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newCount, setNewCount] = React.useState(0);

  const [prevPath, setPrevPath] = React.useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
    if (pathname.startsWith("/admin/citas")) setNewCount(0);
  }

  // Notificación en tiempo real de nuevas reservas (Supabase Realtime, respeta RLS).
  React.useEffect(() => {
    const sb = getBrowserSupabase();
    const channel = sb
      .channel("admin-appointments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, (payload) => {
        const row = payload.new as NewAppointmentPayload;
        if (row.source !== "web") return;
        setNewCount((n) => n + 1);
        toast.info(`Nueva reserva ${row.code}`, {
          description: `${row.customer_name} · ${formatDateTimeLong(row.start_at)} · Abono ${formatCOP(row.deposit_amount)}`,
          duration: 10_000,
          action: { label: "Ver", onClick: () => router.push("/admin/citas?status=pending_payment") },
        });
        router.refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "appointments" }, () => router.refresh())
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [router]);

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Panel" className="grid gap-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const badge = "badge" in item && item.badge ? newCount : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {"badge" in item && item.badge && (badge > 0 || pendingCount > 0) ? (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold",
                  badge > 0 ? "bg-secondary text-secondary-foreground" : "bg-warning-soft text-warning-foreground",
                )}
                aria-label={badge > 0 ? `${badge} nuevas` : `${pendingCount} pendientes de abono`}
              >
                {badge > 0 ? `+${badge}` : pendingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-background p-4 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-2 pt-1">
          <LogoMark />
          <span className="font-display text-xl font-semibold">Zephyr</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Panel</span>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 grid gap-2 border-t pt-4">
          <a href="/" target="_blank" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            <ExternalLink className="size-4" /> Ver sitio
          </a>
          <p className="truncate px-3 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
          <div className="flex items-center gap-2 px-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="size-4" /> Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-accent"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <LogoMark className="size-7" />
          <span className="font-display text-lg font-semibold">Panel</span>
        </Link>
        <Link
          href="/admin/citas?status=pending_payment"
          className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-accent"
          aria-label={newCount > 0 ? `${newCount} reservas nuevas` : "Citas pendientes"}
        >
          <Bell className="size-5" />
          {newCount > 0 ? (
            <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
              {newCount}
            </span>
          ) : null}
        </Link>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-background p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-xl font-semibold">Zephyr</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-full hover:bg-accent"
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="mt-4 flex items-center gap-2 border-t pt-4">
              <ThemeToggle />
              <button type="button" onClick={signOut} className="flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm">
                <LogOut className="size-4" /> Salir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main id="contenido" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
