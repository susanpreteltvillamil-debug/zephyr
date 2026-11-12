-- =============================================================================
-- Zephyr · 0003 · RLS, permisos de funciones, Storage y Realtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS en TODAS las tablas
-- -----------------------------------------------------------------------------
alter table public.admins               enable row level security;
alter table public.settings             enable row level security;
alter table public.service_categories   enable row level security;
alter table public.services             enable row level security;
alter table public.business_hours       enable row level security;
alter table public.time_off             enable row level security;
alter table public.customers            enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_services enable row level security;
alter table public.gallery_items        enable row level security;
alter table public.site_sections        enable row level security;
alter table public.contact_channels     enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.legal_documents      enable row level security;

-- Administradora: acceso total en todas las tablas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'service_categories', 'services', 'business_hours', 'time_off',
    'customers', 'appointments', 'appointment_services', 'gallery_items',
    'site_sections', 'contact_channels', 'payment_methods', 'legal_documents'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || '_admin_all', t
    );
  end loop;
end;
$$;

create policy admins_self_read on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Público (anon y authenticated): solo contenido publicado.
create policy settings_public_read on public.settings
  for select to anon, authenticated using (true);
create policy categories_public_read on public.service_categories
  for select to anon, authenticated using (active);
create policy services_public_read on public.services
  for select to anon, authenticated using (active);
create policy business_hours_public_read on public.business_hours
  for select to anon, authenticated using (true);
create policy gallery_public_read on public.gallery_items
  for select to anon, authenticated using (visible);
create policy sections_public_read on public.site_sections
  for select to anon, authenticated using (visible);
create policy channels_public_read on public.contact_channels
  for select to anon, authenticated using (active);
create policy payment_methods_public_read on public.payment_methods
  for select to anon, authenticated using (active);
create policy legal_public_read on public.legal_documents
  for select to anon, authenticated using (true);
-- customers, appointments, appointment_services, time_off: sin política pública.

-- Defensa en profundidad: anon no puede escribir en ninguna tabla.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Permisos de funciones
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Públicas (sin datos personales)
grant execute on function public.get_available_slots(date, uuid[])       to anon, authenticated;
grant execute on function public.get_available_days(date, date, uuid[])  to anon, authenticated;
grant execute on function public.get_next_available_slot()               to anon, authenticated;
grant execute on function public.compute_deposit(integer, integer)       to anon, authenticated;
grant execute on function public.is_admin()                              to anon, authenticated;

-- Administradora (cada función valida is_admin() por dentro)
grant execute on function public.admin_get_slots(date, uuid[], uuid)                                       to authenticated;
grant execute on function public.admin_create_appointment(uuid[], timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.admin_reschedule_appointment(uuid, timestamptz)                            to authenticated;
grant execute on function public.admin_update_appointment_status(uuid, text, boolean, text)                 to authenticated;
grant execute on function public.admin_use_customer_credit(uuid)                                            to authenticated;
grant execute on function public.expire_stale_holds()                                                        to authenticated;

-- Solo servidor (service_role): reserva web, gestión por token, mantenimiento.
grant execute on all functions in schema public to service_role;

-- Funciones creadas en el futuro no quedan expuestas por defecto.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket público de lectura, escritura solo para la administradora
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
create policy media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Realtime: el dashboard escucha nuevas citas (respeta RLS: solo admin)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end;
$$;
