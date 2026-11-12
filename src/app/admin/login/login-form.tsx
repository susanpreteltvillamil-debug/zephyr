"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured()) {
      setError("Supabase no está configurado. Revisa las variables de entorno.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    const sb = getBrowserSupabase();
    const { error: authError } = await sb.auth.signInWithPassword({ email, password });
    if (authError) {
      setLoading(false);
      setError("Correo o contraseña incorrectos.");
      return;
    }
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (!isAdmin) {
      await sb.auth.signOut();
      setLoading(false);
      setError("Esta cuenta no tiene permisos de administradora.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Correo" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="animate-spin" /> : null}
        Ingresar
      </Button>
    </form>
  );
}
