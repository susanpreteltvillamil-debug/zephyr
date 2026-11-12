import { requireAdminPage } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdminPage();
  const { count } = await session.supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_payment")
    .gt("hold_expires_at", new Date().toISOString());
  return (
    <AdminShell email={session.email} pendingCount={count ?? 0}>
      {children}
    </AdminShell>
  );
}
