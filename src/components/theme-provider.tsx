"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * next-themes inyecta un script bloqueante en <head> que aplica la clase
 * antes del primer pintado: sin parpadeo y con persistencia en localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="zephyr-theme">
      {children}
    </NextThemesProvider>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar tema"
    >
      {/* Ambos íconos se renderizan; CSS muestra el correcto sin esperar a la hidratación. */}
      <Sun className="size-[18px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" aria-hidden />
      <Moon className="absolute size-[18px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" aria-hidden />
    </button>
  );
}
