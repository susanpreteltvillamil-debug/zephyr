"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { BookButton } from "@/components/booking/booking-modal";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export function SiteHeader({ salonName, nav }: { salonName: string; nav: NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300",
        scrolled ? "border-b bg-background/85 shadow-sm backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 rounded-full" aria-label={`${salonName}, inicio`}>
          <LogoMark />
          <span className="font-display text-2xl font-semibold tracking-tight">{salonName}</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <BookButton size="sm" className="hidden sm:inline-flex">
            Reserva tu cita
          </BookButton>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border bg-background lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Principal móvil" className="border-t bg-background px-4 pb-4 lg:hidden">
          <ul className="grid gap-1 pt-2">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base font-medium hover:bg-accent"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="zp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7B2CBF" />
          <stop offset="1" stopColor="#FFB5C0" />
        </linearGradient>
      </defs>
      <path d="M16 2c5.5 0 9 4.6 9 11.2C25 22 20.6 30 16 30S7 22 7 13.2C7 6.6 10.5 2 16 2Z" fill="url(#zp-logo)" />
      <path d="M12 9.5c1.6-1.9 5.4-2.3 7.4-.6" stroke="#fff" strokeOpacity=".75" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
