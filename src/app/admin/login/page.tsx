import type { Metadata } from "next";
import { LogoMark } from "@/components/site/header";
import { ThemeToggle } from "@/components/theme-provider";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") ? sp.next : "/admin";
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="mt-3 font-display text-2xl font-semibold">Panel de administración</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresa con tu correo y contraseña.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
