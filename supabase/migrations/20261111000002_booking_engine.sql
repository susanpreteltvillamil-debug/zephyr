-- =============================================================================
-- Zephyr · 0002 · Motor de disponibilidad y reservas
--
-- Códigos de error propios (SQLSTATE) que la app traduce a mensajes:
--   ZP001 horario tomado            ZP002 pasado / sin antelación mínima
--   ZP003 fuera de horario          ZP004 fuera del horizonte de reserva
--   ZP005 servicios inválidos       ZP006 demasiadas reservas pendientes
--   ZP007 fuera de plazo de cambio  ZP008 límite de reagendamientos
--   ZP009 cita no encontrada        ZP010 estado no permite la acción
--   ZP011 no autorizada             ZP012 datos del cliente inválidos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if length(v) = 12 and left(v, 2) = '57' then
    v := substr(v, 3);
  end if;
  return v;
end;
$$;

create or replace function public.compute_deposit(p_total integer, p_percent integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  -- Mínimo 20 %, redondeado hacia arriba al múltiplo de 1.000 COP, sin superar el total.
  select least(
    greatest(p_total, 0),
    (ceil(greatest(p_total, 0) * greatest(p_percent, 20) / 100.0 / 1000.0) * 1000)::integer
  );
$$;

create or replace function public.bogota_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

create or replace function public.generate_booking_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v text := 'ZP-';
begin
  for i in 1..6 loop
    v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return v;
end;
$$;

create or replace function public.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Expiración perezosa de reservas temporales vencidas
-- -----------------------------------------------------------------------------
create or replace function public.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.appointments
     set status = 'expired'
   where status = 'pending_payment'
     and hold_expires_at is not null
     and hold_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Validación de servicios: devuelve totales o lanza ZP005
-- -----------------------------------------------------------------------------
create or replace function public.resolve_services(p_service_ids uuid[], p_only_active boolean default true)
returns table (total_price integer, total_duration integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_found integer;
  v_fixed integer;
  r record;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'Elige al menos un servicio.' using errcode = 'ZP005';
  end if;
  if cardinality(p_service_ids) > 10 then
    raise exception 'Puedes elegir máximo 10 servicios por cita.' using errcode = 'ZP005';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_service_ids) as x;
  if cardinality(v_ids) <> cardinality(p_service_ids) then
    raise exception 'Hay servicios repetidos en la selección.' using errcode = 'ZP005';
  end if;

  select count(*), count(*) filter (where s.price_type = 'fixed')
    into v_found, v_fixed
    from public.services s
   where s.id = any (v_ids) and (not p_only_active or s.active);

  if v_found <> cardinality(v_ids) then
    raise exception 'Alguno de los servicios ya no está disponible.' using errcode = 'ZP005';
  end if;
  if v_fixed = 0 then
    raise exception 'Los adicionales deben combinarse con un servicio principal.' using errcode = 'ZP005';
  end if;

  for r in
    select s.name, s.requires_any_service_ids
      from public.services s
     where s.id = any (v_ids) and s.price_type = 'addon'
  loop
    if cardinality(r.requires_any_service_ids) > 0
       and not (r.requires_any_service_ids && v_ids) then
      raise exception '"%" solo se puede combinar con los servicios indicados.', r.name using errcode = 'ZP005';
    end if;
  end loop;

  return query
    select sum(s.price)::integer, sum(s.duration_minutes)::integer
      from public.services s
     where s.id = any (v_ids);
end;
$$;

-- -----------------------------------------------------------------------------
-- Generador de cupos de un día (núcleo de la disponibilidad)
-- -----------------------------------------------------------------------------
create or replace function public.slots_for_day(
  p_day            date,
  p_duration       integer,
  p_exclude        uuid default null,
  p_enforce_rules  boolean default true
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s          public.settings%rowtype;
  r          record;
  v_now      timestamptz := now();
  v_today    date := public.bogota_today();
  v_start    timestamptz;
  v_end      timestamptz;
  v_slot     timestamptz;
  v_dur      interval;
  v_block    interval;
begin
  select * into s from public.settings where id = 1;
  if p_duration is null or p_duration <= 0 then
    return;
  end if;
  if p_enforce_rules and (p_day < v_today or p_day > v_today + s.max_advance_days) then
    return;
  end if;

  v_dur   := make_interval(mins => p_duration);
  v_block := make_interval(mins => p_duration + s.buffer_minutes);

  for r in
    select bh.start_time, bh.end_time
      from public.business_hours bh
     where bh.weekday = extract(dow from p_day)::int
     order by bh.start_time
  loop
    v_start := (p_day + r.start_time) at time zone 'America/Bogota';
    v_end   := (p_day + r.end_time) at time zone 'America/Bogota';
    v_slot  := v_start;

    -- El servicio completo debe caber antes del cierre del rango.
    while v_slot + v_dur <= v_end loop
      if (not p_enforce_rules or v_slot >= v_now + make_interval(mins => s.min_notice_minutes))
         and (not p_enforce_rules or v_slot > v_now)
         and not exists (
           select 1 from public.time_off t
            where tstzrange(t.start_at, t.end_at, '[)') && tstzrange(v_slot, v_slot + v_dur, '[)')
         )
         and not exists (
           select 1 from public.appointments a
            where a.staff_id = '00000000-0000-0000-0000-000000000001'
              and (a.status = 'confirmed'
                   or (a.status = 'pending_payment' and (a.hold_expires_at is null or a.hold_expires_at > v_now)))
              and a.id is distinct from p_exclude
              and tstzrange(a.start_at, a.blocked_until, '[)') && tstzrange(v_slot, v_slot + v_block, '[)')
         )
      then
        return next v_slot;
      end if;
      v_slot := v_slot + make_interval(mins => s.slot_interval_minutes);
    end loop;
  end loop;
end;
$$;

-- Diagnóstico de por qué un horario no es válido (para mensajes claros).
create or replace function public.assert_slot_bookable(
  p_start    timestamptz,
  p_duration integer,
  p_exclude  uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s       public.settings%rowtype;
  v_day   date := (p_start at time zone 'America/Bogota')::date;
  v_block interval;
begin
  select * into s from public.settings where id = 1;

  if p_start < now() + make_interval(mins => s.min_notice_minutes) then
    raise exception 'Ese horario ya pasó o no cumple la antelación mínima de reserva.' using errcode = 'ZP002';
  end if;
  if v_day > public.bogota_today() + s.max_advance_days then
    raise exception 'Solo se puede reservar con máximo % días de anticipación.', s.max_advance_days using errcode = 'ZP004';
  end if;

  if exists (select 1 from public.slots_for_day(v_day, p_duration, p_exclude, true) x where x = p_start) then
    return;
  end if;

  v_block := make_interval(mins => p_duration + s.buffer_minutes);
  if exists (
    select 1 from public.appointments a
     where a.staff_id = '00000000-0000-0000-0000-000000000001'
       and a.status in ('pending_payment', 'confirmed')
       and (a.status = 'confirmed' or a.hold_expires_at is null or a.hold_expires_at > now())
       and a.id is distinct from p_exclude
       and tstzrange(a.start_at, a.blocked_until, '[)') && tstzrange(p_start, p_start + v_block, '[)')
  ) then
    raise exception 'Ese horario acaba de ser tomado, elige otro.' using errcode = 'ZP001';
  end if;

  raise exception 'Ese horario no está disponible. Elige uno de los cupos que te mostramos.' using errcode = 'ZP003';
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC públicas de disponibilidad (sin datos personales)
-- -----------------------------------------------------------------------------
create or replace function public.get_available_slots(p_day date, p_service_ids uuid[])
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration integer;
begin
  select rs.total_duration into v_duration from public.resolve_services(p_service_ids, true) rs;
  return query select x from public.slots_for_day(p_day, v_duration, null, true) x;
end;
$$;

create or replace function public.get_available_days(p_from date, p_to date, p_service_ids uuid[])
returns table (day date, slots integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration integer;
  v_from     date := greatest(p_from, public.bogota_today());
  v_to       date;
  d          date;
  n          integer;
begin
  select rs.total_duration into v_duration from public.resolve_services(p_service_ids, true) rs;
  select least(p_to, public.bogota_today() + s.max_advance_days, v_from + 92) into v_to
    from public.settings s where s.id = 1;
  d := v_from;
  while d <= v_to loop
    select count(*) into n from public.slots_for_day(d, v_duration, null, true);
    if n > 0 then
      day := d; slots := n;
      return next;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- Próximo cupo real para el servicio principal más corto (sin escasez falsa).
create or replace function public.get_next_available_slot()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration integer;
  v_max      integer;
  d          date := public.bogota_today();
  v_slot     timestamptz;
begin
  select min(duration_minutes) into v_duration from public.services where active and price_type = 'fixed';
  if v_duration is null then
    return null;
  end if;
  select max_advance_days into v_max from public.settings where id = 1;
  while d <= public.bogota_today() + v_max loop
    select x into v_slot from public.slots_for_day(d, v_duration, null, true) x order by x limit 1;
    if v_slot is not null then
      return v_slot;
    end if;
    d := d + 1;
  end loop;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Crear reserva web (transaccional). Solo la llama el servidor (service_role)
-- después de validar Turnstile y honeypot.
-- -----------------------------------------------------------------------------
create or replace function public.create_booking(
  p_service_ids uuid[],
  p_start_at    timestamptz,
  p_name        text,
  p_phone       text,
  p_email       text default null,
  p_notes       text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s            public.settings%rowtype;
  v_phone      text := public.normalize_phone(p_phone);
  v_name       text := btrim(coalesce(p_name, ''));
  v_email      text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_total      integer;
  v_duration   integer;
  v_deposit    integer;
  v_customer   uuid;
  v_pending    integer;
  v_code       text;
  v_token      text;
  v_appt       uuid;
  v_hold       timestamptz;
  v_priv_ver   text;
  v_pol_ver    text;
begin
  select * into s from public.settings where id = 1;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Escribe tu nombre completo.' using errcode = 'ZP012';
  end if;
  if v_phone !~ '^3[0-9]{9}$' then
    raise exception 'Escribe un número de WhatsApp colombiano válido (10 dígitos).' using errcode = 'ZP012';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.' using errcode = 'ZP012';
  end if;

  -- 1. Liberar reservas temporales vencidas (perezoso).
  perform public.expire_stale_holds();

  -- 2. Servicios y totales.
  select rs.total_price, rs.total_duration into v_total, v_duration
    from public.resolve_services(p_service_ids, true) rs;

  -- 3. Reglas de horario.
  perform public.assert_slot_bookable(p_start_at, v_duration, null);

  -- 4. Anti-abuso: límite de reservas pendientes por teléfono.
  select count(*) into v_pending
    from public.appointments a
   where a.customer_phone = v_phone
     and a.status = 'pending_payment'
     and a.hold_expires_at > now();
  if v_pending >= s.max_pending_per_phone then
    raise exception 'Ya tienes reservas pendientes de abono. Envía el comprobante o escríbenos por WhatsApp.' using errcode = 'ZP006';
  end if;

  -- 5. Cliente.
  insert into public.customers (full_name, phone, email)
  values (v_name, v_phone, v_email)
  on conflict (phone) do update
     set full_name = excluded.full_name,
         email = coalesce(excluded.email, public.customers.email)
  returning id into v_customer;

  select version into v_priv_ver from public.legal_documents where slug = 'privacidad';
  select version into v_pol_ver from public.legal_documents where slug = 'reservas';

  v_deposit := public.compute_deposit(v_total, s.deposit_percent);
  v_token   := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_hold    := least(now() + make_interval(mins => s.hold_minutes), p_start_at);

  -- 6. Insertar. La EXCLUDE constraint resuelve la concurrencia.
  for attempt in 1..5 loop
    v_code := public.generate_booking_code();
    begin
      insert into public.appointments (
        code, customer_id, customer_name, customer_phone, customer_email, notes,
        start_at, end_at, blocked_until, status, source,
        total_price, total_duration_minutes, deposit_percent, deposit_amount,
        hold_expires_at, manage_token_hash,
        privacy_accepted_at, privacy_version, booking_policy_accepted_at, booking_policy_version
      ) values (
        v_code, v_customer, v_name, v_phone, v_email, left(coalesce(p_notes, ''), 500),
        p_start_at,
        p_start_at + make_interval(mins => v_duration),
        p_start_at + make_interval(mins => v_duration + s.buffer_minutes),
        'pending_payment', 'web',
        v_total, v_duration, s.deposit_percent, v_deposit,
        v_hold, public.hash_token(v_token),
        now(), coalesce(v_priv_ver, '1.0'), now(), coalesce(v_pol_ver, '1.0')
      )
      returning id into v_appt;
      exit;
    exception
      when exclusion_violation then
        raise exception 'Ese horario acaba de ser tomado, elige otro.' using errcode = 'ZP001';
      when unique_violation then
        if attempt = 5 then
          raise;
        end if;
    end;
  end loop;

  insert into public.appointment_services (appointment_id, service_id, name, price, price_type, duration_minutes, sort_order)
  select v_appt, sv.id, sv.name, sv.price, sv.price_type, sv.duration_minutes,
         row_number() over (order by sv.price_type, c.sort_order, sv.sort_order)
    from public.services sv
    join public.service_categories c on c.id = sv.category_id
   where sv.id = any (p_service_ids);

  return jsonb_build_object(
    'id', v_appt,
    'code', v_code,
    'manage_token', v_token,
    'start_at', p_start_at,
    'end_at', p_start_at + make_interval(mins => v_duration),
    'total_price', v_total,
    'total_duration_minutes', v_duration,
    'deposit_percent', s.deposit_percent,
    'deposit_amount', v_deposit,
    'hold_expires_at', v_hold,
    'status', 'pending_payment'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Gestión por enlace privado (token). Solo servidor.
-- -----------------------------------------------------------------------------
create or replace function public.booking_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'code', a.code,
    'status', case when a.status = 'pending_payment' and a.hold_expires_at <= now() then 'expired' else a.status end,
    'start_at', a.start_at,
    'end_at', a.end_at,
    'customer_name', a.customer_name,
    'total_price', a.total_price,
    'total_duration_minutes', a.total_duration_minutes,
    'deposit_percent', a.deposit_percent,
    'deposit_amount', a.deposit_amount,
    'deposit_paid', a.deposit_paid,
    'hold_expires_at', a.hold_expires_at,
    'reschedule_count', a.reschedule_count,
    'refund_status', a.refund_status,
    'max_reschedules', s.max_reschedules,
    'change_cutoff_hours', s.change_cutoff_hours,
    'can_change', a.status in ('pending_payment', 'confirmed')
                  and (a.status = 'confirmed' or a.hold_expires_at > now())
                  and now() <= a.start_at - make_interval(hours => s.change_cutoff_hours),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'service_id', x.service_id, 'name', x.name, 'price', x.price,
               'price_type', x.price_type, 'duration_minutes', x.duration_minutes)
             order by x.sort_order)
        from public.appointment_services x where x.appointment_id = a.id), '[]'::jsonb)
  )
  from public.appointments a
  cross join public.settings s
  where a.id = p_id and s.id = 1;
$$;

create or replace function public.find_booking_by_token(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'El enlace no es válido.' using errcode = 'ZP009';
  end if;
  select id into v_id from public.appointments where manage_token_hash = public.hash_token(p_token);
  if v_id is null then
    raise exception 'No encontramos esa cita. Revisa el enlace.' using errcode = 'ZP009';
  end if;
  return v_id;
end;
$$;

create or replace function public.get_booking_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.booking_json(public.find_booking_by_token(p_token));
$$;

create or replace function public.get_slots_for_token(p_token text, p_day date)
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id  uuid := public.find_booking_by_token(p_token);
  v_dur integer;
begin
  select total_duration_minutes into v_dur from public.appointments where id = v_id;
  return query select x from public.slots_for_day(p_day, v_dur, v_id, true) x;
end;
$$;

create or replace function public.get_days_for_token(p_token text, p_from date, p_to date)
returns table (day date, slots integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id   uuid := public.find_booking_by_token(p_token);
  v_dur  integer;
  v_from date := greatest(p_from, public.bogota_today());
  v_to   date;
  d      date;
  n      integer;
begin
  select total_duration_minutes into v_dur from public.appointments where id = v_id;
  select least(p_to, public.bogota_today() + s.max_advance_days, v_from + 92) into v_to
    from public.settings s where s.id = 1;
  d := v_from;
  while d <= v_to loop
    select count(*) into n from public.slots_for_day(d, v_dur, v_id, true);
    if n > 0 then
      day := d; slots := n;
      return next;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- Verifica la regla de antelación para cambios. Bloquea la fila.
create or replace function public.lock_for_customer_change(p_id uuid)
returns public.appointments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments%rowtype;
  s public.settings%rowtype;
begin
  select * into s from public.settings where id = 1;
  select * into a from public.appointments where id = p_id for update;

  if a.status = 'pending_payment' and a.hold_expires_at <= now() then
    raise exception 'Tu reserva temporal venció porque no recibimos el abono a tiempo.' using errcode = 'ZP010';
  end if;
  if a.status not in ('pending_payment', 'confirmed') then
    raise exception 'Esta cita ya no se puede modificar.' using errcode = 'ZP010';
  end if;
  if now() > a.start_at - make_interval(hours => s.change_cutoff_hours) then
    raise exception 'Los cambios y cancelaciones solo se permiten con al menos % horas de anticipación. Escríbenos por WhatsApp.', s.change_cutoff_hours using errcode = 'ZP007';
  end if;
  return a;
end;
$$;

create or replace function public.reschedule_booking_by_token(p_token text, p_new_start timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.find_booking_by_token(p_token);
  a    public.appointments%rowtype;
  s    public.settings%rowtype;
begin
  perform public.expire_stale_holds();
  select * into s from public.settings where id = 1;
  select * into a from public.lock_for_customer_change(v_id);

  if a.reschedule_count >= s.max_reschedules then
    raise exception 'Ya usaste el número máximo de reagendamientos (%). Escríbenos por WhatsApp.', s.max_reschedules using errcode = 'ZP008';
  end if;

  perform public.assert_slot_bookable(p_new_start, a.total_duration_minutes, a.id);

  begin
    update public.appointments
       set start_at = p_new_start,
           end_at = p_new_start + make_interval(mins => a.total_duration_minutes),
           blocked_until = p_new_start + make_interval(mins => a.total_duration_minutes + s.buffer_minutes),
           reschedule_count = a.reschedule_count + 1,
           hold_expires_at = case when a.status = 'pending_payment' then least(a.hold_expires_at, p_new_start) else a.hold_expires_at end
     where id = a.id;
  exception when exclusion_violation then
    raise exception 'Ese horario acaba de ser tomado, elige otro.' using errcode = 'ZP001';
  end;

  return public.booking_json(a.id);
end;
$$;

create or replace function public.cancel_booking_by_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id     uuid := public.find_booking_by_token(p_token);
  a        public.appointments%rowtype;
  s        public.settings%rowtype;
  v_refund text := 'none';
begin
  select * into s from public.settings where id = 1;
  select * into a from public.lock_for_customer_change(v_id);

  if a.deposit_paid and a.deposit_amount > 0 then
    if s.cancellation_refund_mode = 'credit' then
      update public.customers set credit_balance = credit_balance + a.deposit_amount where id = a.customer_id;
      v_refund := 'credited';
    else
      v_refund := 'refund_pending';
    end if;
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer', refund_status = v_refund
   where id = a.id;

  return public.booking_json(a.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Trigger: rechaza citas web en el pasado o sin antelación mínima
-- -----------------------------------------------------------------------------
create or replace function public.appointments_guard_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice integer;
begin
  if new.source = 'web'
     and coalesce(current_setting('zephyr.admin_override', true), '') <> 'on'
     and (tg_op = 'INSERT' or new.start_at is distinct from old.start_at) then
    select min_notice_minutes into v_notice from public.settings where id = 1;
    if new.start_at < now() + make_interval(mins => coalesce(v_notice, 0)) then
      raise exception 'No se pueden reservar fechas u horas pasadas ni sin la antelación mínima.' using errcode = 'ZP002';
    end if;
  end if;
  return new;
end;
$$;

create trigger appointments_guard_time
before insert or update of start_at on public.appointments
for each row execute function public.appointments_guard_time();

-- -----------------------------------------------------------------------------
-- RPC de la administradora
-- -----------------------------------------------------------------------------
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizada.' using errcode = 'ZP011';
  end if;
end;
$$;

create or replace function public.admin_get_slots(p_day date, p_service_ids uuid[], p_exclude uuid default null)
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration integer;
begin
  perform public.assert_admin();
  select rs.total_duration into v_duration from public.resolve_services(p_service_ids, false) rs;
  return query select x from public.slots_for_day(p_day, v_duration, p_exclude, false) x;
end;
$$;

create or replace function public.admin_create_appointment(
  p_service_ids  uuid[],
  p_start_at     timestamptz,
  p_name         text,
  p_phone        text,
  p_email        text default null,
  p_notes        text default '',
  p_deposit_mode text default 'paid' -- paid | skip | pending
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s          public.settings%rowtype;
  v_phone    text := public.normalize_phone(p_phone);
  v_name     text := btrim(coalesce(p_name, ''));
  v_email    text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_total    integer;
  v_duration integer;
  v_customer uuid;
  v_code     text;
  v_appt     uuid;
begin
  perform public.assert_admin();
  if p_deposit_mode not in ('paid', 'skip', 'pending') then
    raise exception 'Modo de abono inválido.' using errcode = 'ZP012';
  end if;
  if char_length(v_name) < 2 or v_phone !~ '^3[0-9]{9}$' then
    raise exception 'Revisa el nombre y el WhatsApp del cliente.' using errcode = 'ZP012';
  end if;

  select * into s from public.settings where id = 1;
  perform public.expire_stale_holds();
  select rs.total_price, rs.total_duration into v_total, v_duration
    from public.resolve_services(p_service_ids, false) rs;

  insert into public.customers (full_name, phone, email)
  values (v_name, v_phone, v_email)
  on conflict (phone) do update
     set full_name = excluded.full_name,
         email = coalesce(excluded.email, public.customers.email)
  returning id into v_customer;

  for attempt in 1..5 loop
    v_code := public.generate_booking_code();
    begin
      insert into public.appointments (
        code, customer_id, customer_name, customer_phone, customer_email, notes,
        start_at, end_at, blocked_until, status, source,
        total_price, total_duration_minutes, deposit_percent, deposit_amount,
        deposit_paid, deposit_confirmed_at, hold_expires_at
      ) values (
        v_code, v_customer, v_name, v_phone, v_email, left(coalesce(p_notes, ''), 500),
        p_start_at,
        p_start_at + make_interval(mins => v_duration),
        p_start_at + make_interval(mins => v_duration + s.buffer_minutes),
        case when p_deposit_mode = 'pending' then 'pending_payment' else 'confirmed' end,
        'admin',
        v_total, v_duration, s.deposit_percent, public.compute_deposit(v_total, s.deposit_percent),
        p_deposit_mode = 'paid',
        case when p_deposit_mode = 'paid' then now() end,
        case when p_deposit_mode = 'pending' then greatest(now(), least(now() + make_interval(mins => s.hold_minutes), p_start_at)) end
      )
      returning id into v_appt;
      exit;
    exception
      when exclusion_violation then
        raise exception 'Ese horario se cruza con otra cita.' using errcode = 'ZP001';
      when unique_violation then
        if attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.appointment_services (appointment_id, service_id, name, price, price_type, duration_minutes, sort_order)
  select v_appt, sv.id, sv.name, sv.price, sv.price_type, sv.duration_minutes,
         row_number() over (order by sv.price_type, sv.sort_order)
    from public.services sv
   where sv.id = any (p_service_ids);

  return jsonb_build_object('id', v_appt, 'code', v_code);
end;
$$;

create or replace function public.admin_reschedule_appointment(p_id uuid, p_new_start timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments%rowtype;
  s public.settings%rowtype;
begin
  perform public.assert_admin();
  perform public.expire_stale_holds();
  select * into s from public.settings where id = 1;
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then
    raise exception 'Cita no encontrada.' using errcode = 'ZP009';
  end if;
  if a.status not in ('pending_payment', 'confirmed') then
    raise exception 'Solo se pueden reagendar citas activas.' using errcode = 'ZP010';
  end if;

  perform set_config('zephyr.admin_override', 'on', true);
  begin
    update public.appointments
       set start_at = p_new_start,
           end_at = p_new_start + make_interval(mins => a.total_duration_minutes),
           blocked_until = p_new_start + make_interval(mins => a.total_duration_minutes + s.buffer_minutes),
           reschedule_count = a.reschedule_count + 1
     where id = a.id;
  exception when exclusion_violation then
    raise exception 'Ese horario se cruza con otra cita.' using errcode = 'ZP001';
  end;
  perform set_config('zephyr.admin_override', 'off', true);
end;
$$;

create or replace function public.admin_update_appointment_status(
  p_id          uuid,
  p_action      text,
  p_give_credit boolean default null,
  p_reason      text default ''
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a        public.appointments%rowtype;
  s        public.settings%rowtype;
  v_credit boolean;
begin
  perform public.assert_admin();
  select * into s from public.settings where id = 1;
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then
    raise exception 'Cita no encontrada.' using errcode = 'ZP009';
  end if;

  if p_action = 'confirm_deposit' then
    if a.status not in ('pending_payment', 'expired') then
      raise exception 'Solo se confirma el abono de citas pendientes o vencidas.' using errcode = 'ZP010';
    end if;
    begin
      update public.appointments
         set status = 'confirmed', deposit_paid = true, deposit_confirmed_at = now(), hold_expires_at = null
       where id = a.id;
    exception when exclusion_violation then
      raise exception 'El cupo de esta cita ya fue ocupado por otra reserva. Reagéndala primero.' using errcode = 'ZP001';
    end;

  elsif p_action = 'mark_deposit_paid' then
    update public.appointments set deposit_paid = true, deposit_confirmed_at = now() where id = a.id;

  elsif p_action = 'complete' then
    if a.status not in ('confirmed', 'no_show') then
      raise exception 'Solo se marcan como atendidas las citas confirmadas.' using errcode = 'ZP010';
    end if;
    update public.appointments set status = 'completed' where id = a.id;

  elsif p_action = 'no_show' then
    if a.status not in ('confirmed', 'completed') then
      raise exception 'Solo se marca inasistencia en citas confirmadas.' using errcode = 'ZP010';
    end if;
    -- El abono NO se devuelve por inasistencia.
    update public.appointments set status = 'no_show' where id = a.id;

  elsif p_action = 'cancel' then
    if a.status not in ('pending_payment', 'confirmed') then
      raise exception 'Solo se cancelan citas activas.' using errcode = 'ZP010';
    end if;
    v_credit := coalesce(p_give_credit, s.cancellation_refund_mode = 'credit');
    if a.deposit_paid and a.deposit_amount > 0 and v_credit then
      update public.customers set credit_balance = credit_balance + a.deposit_amount where id = a.customer_id;
    end if;
    update public.appointments
       set status = 'cancelled', cancelled_at = now(), cancelled_by = 'admin',
           cancel_reason = left(coalesce(p_reason, ''), 300),
           refund_status = case
             when not (a.deposit_paid and a.deposit_amount > 0) then 'none'
             when v_credit then 'credited'
             else 'refund_pending' end
     where id = a.id;

  elsif p_action = 'release' then
    if a.status <> 'pending_payment' then
      raise exception 'Solo se libera el espacio de reservas pendientes de abono.' using errcode = 'ZP010';
    end if;
    update public.appointments set status = 'expired', hold_expires_at = now() where id = a.id;

  elsif p_action = 'mark_refunded' then
    update public.appointments set refund_status = 'refunded' where id = a.id and refund_status = 'refund_pending';

  else
    raise exception 'Acción desconocida.' using errcode = 'ZP010';
  end if;
end;
$$;

create or replace function public.admin_use_customer_credit(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.appointments%rowtype;
  c public.customers%rowtype;
begin
  perform public.assert_admin();
  select * into a from public.appointments where id = p_id for update;
  select * into c from public.customers where id = a.customer_id for update;
  if a.status not in ('pending_payment', 'expired') then
    raise exception 'Solo aplica a citas pendientes de abono.' using errcode = 'ZP010';
  end if;
  if c.credit_balance < a.deposit_amount then
    raise exception 'El saldo a favor no alcanza para cubrir el abono.' using errcode = 'ZP010';
  end if;
  update public.customers set credit_balance = credit_balance - a.deposit_amount where id = c.id;
  perform public.admin_update_appointment_status(p_id, 'confirm_deposit');
end;
$$;

-- Mantenimiento (cron): expira reservas y devuelve un pulso ligero.
create or replace function public.run_maintenance()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expired integer := public.expire_stale_holds();
begin
  return jsonb_build_object('expired', v_expired, 'at', now());
end;
$$;
