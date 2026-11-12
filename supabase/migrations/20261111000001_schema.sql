-- =============================================================================
-- Zephyr · 0001 · Esquema base
-- Todas las fechas se guardan en UTC (timestamptz). La zona horaria de negocio
-- es fija: America/Bogota (UTC-5, sin horario de verano).
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Administradoras (vinculadas a auth.users)
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
comment on table public.admins is 'Usuarias con acceso total al dashboard.';

-- -----------------------------------------------------------------------------
-- Configuración (fila única)
-- -----------------------------------------------------------------------------
create table public.settings (
  id                        smallint primary key default 1 check (id = 1),
  salon_name                text not null default 'Zephyr' check (char_length(salon_name) between 1 and 80),
  tagline                   text not null default '',
  address                   text not null default '',
  city                      text not null default '',
  whatsapp_number           text not null default '3144657351' check (whatsapp_number ~ '^[0-9]{10,13}$'),
  deposit_percent           integer not null default 20 check (deposit_percent between 20 and 100),
  hold_minutes              integer not null default 120 check (hold_minutes between 10 and 1440),
  min_notice_minutes        integer not null default 120 check (min_notice_minutes between 0 and 10080),
  max_advance_days          integer not null default 60 check (max_advance_days between 1 and 365),
  slot_interval_minutes     integer not null default 30 check (slot_interval_minutes between 5 and 240),
  buffer_minutes            integer not null default 0 check (buffer_minutes between 0 and 240),
  change_cutoff_hours       integer not null default 24 check (change_cutoff_hours between 0 and 336),
  max_reschedules           integer not null default 1 check (max_reschedules between 0 and 10),
  cancellation_refund_mode  text not null default 'credit' check (cancellation_refund_mode in ('credit', 'refund')),
  max_pending_per_phone     integer not null default 2 check (max_pending_per_phone between 1 and 10),
  updated_at                timestamptz not null default now()
);
comment on column public.settings.deposit_percent is 'Porcentaje de abono. Nunca puede ser menor a 20.';
comment on column public.settings.cancellation_refund_mode is 'credit = saldo a favor; refund = devolución.';

-- -----------------------------------------------------------------------------
-- Catálogo de servicios
-- -----------------------------------------------------------------------------
create table public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text not null default '',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.services (
  id                       uuid primary key default gen_random_uuid(),
  category_id              uuid not null references public.service_categories (id) on delete restrict,
  name                     text not null check (char_length(name) between 1 and 80),
  description              text not null default '',
  price                    integer not null check (price >= 0 and price <= 10000000),
  price_type               text not null default 'fixed' check (price_type in ('fixed', 'addon')),
  duration_minutes         integer not null check (duration_minutes between 5 and 600),
  image_url                text,
  active                   boolean not null default true,
  sort_order               integer not null default 0,
  -- Regla de dependencia: un adicional solo se puede reservar si se elige al
  -- menos uno de estos servicios. Vacío = sin dependencia.
  requires_any_service_ids uuid[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index services_category_idx on public.services (category_id, sort_order);

-- -----------------------------------------------------------------------------
-- Disponibilidad
-- -----------------------------------------------------------------------------
create table public.business_hours (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);
create index business_hours_weekday_idx on public.business_hours (weekday, start_time);

create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  reason     text not null default '',
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index time_off_range_idx on public.time_off using gist (tstzrange(start_at, end_at, '[)'));

-- -----------------------------------------------------------------------------
-- Clientes y citas
-- -----------------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null check (char_length(full_name) between 2 and 100),
  phone          text not null unique check (phone ~ '^3[0-9]{9}$'),
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  credit_balance integer not null default 0 check (credit_balance >= 0),
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.appointments (
  id                         uuid primary key default gen_random_uuid(),
  code                       text not null unique,
  -- Preparado para varias profesionales: hoy todas las citas usan la misma.
  staff_id                   uuid not null default '00000000-0000-0000-0000-000000000001',
  customer_id                uuid not null references public.customers (id) on delete restrict,
  customer_name              text not null,
  customer_phone             text not null,
  customer_email             text,
  notes                      text not null default '',
  start_at                   timestamptz not null,
  end_at                     timestamptz not null,
  -- end_at + tiempo de preparación vigente al reservar. Es el rango que bloquea.
  blocked_until              timestamptz not null,
  status                     text not null default 'pending_payment'
                               check (status in ('pending_payment', 'confirmed', 'completed', 'no_show', 'cancelled', 'expired')),
  source                     text not null default 'web' check (source in ('web', 'admin')),
  total_price                integer not null check (total_price >= 0),
  total_duration_minutes     integer not null check (total_duration_minutes > 0),
  deposit_percent            integer not null check (deposit_percent between 0 and 100),
  deposit_amount             integer not null check (deposit_amount >= 0),
  deposit_paid               boolean not null default false,
  deposit_confirmed_at       timestamptz,
  hold_expires_at            timestamptz,
  manage_token_hash          text unique,
  reschedule_count           integer not null default 0,
  refund_status              text not null default 'none' check (refund_status in ('none', 'credited', 'refund_pending', 'refunded')),
  cancelled_at               timestamptz,
  cancelled_by               text check (cancelled_by in ('customer', 'admin')),
  cancel_reason              text not null default '',
  privacy_accepted_at        timestamptz,
  privacy_version            text,
  booking_policy_accepted_at timestamptz,
  booking_policy_version     text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (end_at > start_at),
  check (blocked_until >= end_at),
  -- GARANTÍA ANTI-DUPLICADOS: dos citas activas de la misma profesional no
  -- pueden cruzarse jamás, aunque lleguen solicitudes simultáneas.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(start_at, blocked_until, '[)') with &&
  ) where (status in ('pending_payment', 'confirmed'))
);
create index appointments_start_idx on public.appointments (start_at);
create index appointments_status_idx on public.appointments (status, hold_expires_at);
create index appointments_customer_idx on public.appointments (customer_id);
create index appointments_phone_idx on public.appointments (customer_phone, status);

create table public.appointment_services (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references public.appointments (id) on delete cascade,
  service_id       uuid references public.services (id) on delete set null,
  -- Copia (snapshot) para que cambios futuros del catálogo no alteren la cita.
  name             text not null,
  price            integer not null check (price >= 0),
  price_type       text not null check (price_type in ('fixed', 'addon')),
  duration_minutes integer not null check (duration_minutes > 0),
  sort_order       integer not null default 0
);
create index appointment_services_appt_idx on public.appointment_services (appointment_id);

-- -----------------------------------------------------------------------------
-- Contenido del sitio
-- -----------------------------------------------------------------------------
create table public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  storage_path text,
  image_url    text not null,
  alt          text not null check (char_length(alt) between 1 and 200),
  title        text not null default '',
  category     text not null default '',
  width        integer,
  height       integer,
  visible      boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.site_sections (
  key        text primary key check (key ~ '^[a-z_]+$'),
  content    jsonb not null default '{}'::jsonb,
  visible    boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.contact_channels (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('whatsapp', 'phone', 'email', 'instagram', 'facebook', 'tiktok', 'youtube', 'x', 'address', 'website', 'other')),
  label      text not null check (char_length(label) between 1 and 60),
  value      text not null default '',
  url        text not null default '',
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.payment_methods (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 60),
  account_number text not null check (char_length(account_number) between 1 and 60),
  holder         text not null default '',
  instructions   text not null default '',
  qr_url         text,
  active         boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table public.legal_documents (
  slug       text primary key check (slug ~ '^[a-z-]+$'),
  title      text not null,
  content_md text not null default '',
  version    text not null default '1.0',
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger appointments_touch before update on public.appointments for each row execute function public.touch_updated_at();
create trigger site_sections_touch before update on public.site_sections for each row execute function public.touch_updated_at();
