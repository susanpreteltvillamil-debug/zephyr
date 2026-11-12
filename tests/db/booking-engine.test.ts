import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  book,
  bogotaDay,
  bogotaTime,
  createTestDb,
  errorCode,
  openEveryDay,
  serviceIds,
  slots,
  type TestDb,
} from "./harness";

let db: TestDb;
let semi: string;
let retiro: string;
let acrilicoExt: string;
let pedicura: string;
let spa: string;
let tradicional: string;

beforeAll(async () => {
  db = await createTestDb();
  [semi, retiro, acrilicoExt, pedicura, spa, tradicional] = await serviceIds(db, [
    "Semipermanente",
    "Retiro semipermanente",
    "Acrílico extensión",
    "Pedicura tradicional",
    "Pedicura con spa",
    "Tradicional",
  ]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from public.appointments;
    delete from public.customers;
    delete from public.time_off;
    update public.settings set deposit_percent = 20, min_notice_minutes = 120, max_advance_days = 60,
      slot_interval_minutes = 30, buffer_minutes = 0, change_cutoff_hours = 24, max_reschedules = 1,
      hold_minutes = 120, max_pending_per_phone = 2, cancellation_refund_mode = 'credit';
  `);
  await openEveryDay(db, "09:00", "19:00");
});

describe("disponibilidad", () => {
  it("ofrece cupos cada 30 minutos y solo si el servicio cabe completo antes del cierre", async () => {
    const day = await bogotaDay(db, 3);
    const s = await slots(db, day, [acrilicoExt]); // 150 min
    expect(s[0]).toBe("09:00");
    expect(s[1]).toBe("09:30");
    expect(s.at(-1)).toBe("16:30"); // 16:30 + 2h30 = 19:00
    expect(s).not.toContain("17:00");
  });

  it("respeta varios rangos por día (pausa de almuerzo)", async () => {
    await db.exec(`delete from public.business_hours;`);
    await db.exec(`insert into public.business_hours (weekday, start_time, end_time)
      select d, t.s, t.e from generate_series(0,6) d
      cross join (values (time '09:00', time '13:00'), (time '14:00', time '19:00')) t(s, e);`);
    const day = await bogotaDay(db, 3);
    const s = await slots(db, day, [semi]); // 75 min
    expect(s).toContain("11:30"); // 11:30-12:45
    expect(s).not.toContain("12:00"); // 12:00-13:15 cruza el almuerzo
    expect(s).not.toContain("13:30");
    expect(s).toContain("14:00");
  });

  it("no ofrece días pasados, ni más allá del horizonte máximo", async () => {
    const ayer = await bogotaDay(db, -1);
    expect(await slots(db, ayer, [semi])).toEqual([]);
    const lejos = await bogotaDay(db, 61);
    expect(await slots(db, lejos, [semi])).toEqual([]);

    const from = await bogotaDay(db, -5);
    const to = await bogotaDay(db, 90);
    const days = await db.query<{ day: string }>(
      `select to_char(day, 'YYYY-MM-DD') as day from public.get_available_days($1::date, $2::date, $3::uuid[])`,
      [from, to, [semi]],
    );
    const list = days.rows.map((r) => r.day);
    expect(list).not.toContain(ayer);
    expect(list).not.toContain(lejos);
    expect(list.every((d) => d >= from)).toBe(true);
  });

  it("aplica la antelación mínima en el día de hoy", async () => {
    await openEveryDay(db, "00:00", "23:59");
    const res = await db.query<{ ok: boolean }>(
      `select bool_and(slot_start >= now() + interval '120 minutes') as ok
         from public.get_available_slots(public.bogota_today(), $1::uuid[])`,
      [[retiro]],
    );
    expect(res.rows[0]!.ok ?? true).toBe(true);
  });

  it("excluye bloqueos puntuales (time_off)", async () => {
    const day = await bogotaDay(db, 4);
    await db.query(`insert into public.time_off (start_at, end_at, reason) values ($1, $2, 'Cita médica')`, [
      bogotaTime(day, "10:00"),
      bogotaTime(day, "12:00"),
    ]);
    const s = await slots(db, day, [tradicional]); // 60 min
    expect(s).toContain("09:00");
    expect(s).not.toContain("09:30"); // 09:30-10:30 choca
    expect(s).not.toContain("11:30");
    expect(s).toContain("12:00");
  });

  it("la duración combinada se suma (retiro + semipermanente = 105 min)", async () => {
    const day = await bogotaDay(db, 3);
    const s = await slots(db, day, [retiro, semi]);
    expect(s.at(-1)).toBe("17:00"); // 17:00 + 1h45 = 18:45 ; 17:30 + 1h45 = 19:15
  });
});

describe("reservas", () => {
  it("crea la cita en pending_payment con totales, snapshot y abono ≥ 20 %", async () => {
    const day = await bogotaDay(db, 5);
    const r = await book(db, { services: [retiro, semi], start: bogotaTime(day, "10:00") });
    expect(r.total_price).toBe(48000);
    expect(r.deposit_amount).toBe(10000); // 9.600 → 10.000
    expect(r.manage_token).toMatch(/^[0-9a-f]{64}$/);
    expect(r.code).toMatch(/^ZP-[A-Z0-9]{6}$/);

    const row = await db.query<{ status: string; manage_token_hash: string; n: number; dur: number }>(
      `select a.status, a.manage_token_hash, a.total_duration_minutes as dur,
              (select count(*)::int from public.appointment_services x where x.appointment_id = a.id) as n
         from public.appointments a where a.id = $1`,
      [r.id],
    );
    expect(row.rows[0]!.status).toBe("pending_payment");
    expect(row.rows[0]!.n).toBe(2);
    expect(row.rows[0]!.dur).toBe(105);
    // Solo se guarda el hash del token, nunca el token.
    expect(row.rows[0]!.manage_token_hash).not.toBe(r.manage_token);

    // El snapshot no cambia si después se edita el catálogo.
    await db.query(`update public.services set price = 99000 where id = $1`, [semi]);
    const snap = await db.query<{ price: number }>(
      `select price from public.appointment_services where appointment_id = $1 and service_id = $2`,
      [r.id, semi],
    );
    expect(snap.rows[0]!.price).toBe(40000);
    await db.query(`update public.services set price = 40000 where id = $1`, [semi]);
  });

  it("rechaza fechas y horas pasadas (RPC y trigger)", async () => {
    const ayer = await bogotaDay(db, -1);
    expect(await errorCode(book(db, { services: [semi], start: bogotaTime(ayer, "10:00") }))).toBe("ZP002");

    // Inserción directa saltándose el RPC: el trigger también la bloquea.
    await db.exec(`insert into public.customers (full_name, phone) values ('Prueba Directa', '3009999999')`);
    const direct = db.query(
      `insert into public.appointments (code, customer_id, customer_name, customer_phone, start_at, end_at, blocked_until,
         total_price, total_duration_minutes, deposit_percent, deposit_amount, source)
       select 'ZP-PAST01', id, 'Prueba Directa', '3009999999', now() - interval '1 hour', now(), now(), 1000, 60, 20, 1000, 'web'
         from public.customers where phone = '3009999999'`,
    );
    expect(await errorCode(direct)).toBe("ZP002");
  });

  it("rechaza horarios sin la antelación mínima", async () => {
    await openEveryDay(db, "00:00", "23:59");
    const res = await db.query<{ t: string }>(
      `select (date_trunc('hour', now()) + interval '1 hour')::text as t`,
    );
    expect(await errorCode(book(db, { services: [retiro], start: res.rows[0]!.t }))).toBe("ZP002");
  });

  it("rechaza horarios fuera del horario de atención o desalineados", async () => {
    const day = await bogotaDay(db, 3);
    expect(await errorCode(book(db, { services: [semi], start: bogotaTime(day, "07:00") }))).toBe("ZP003");
    expect(await errorCode(book(db, { services: [semi], start: bogotaTime(day, "10:10") }))).toBe("ZP003");
    expect(await errorCode(book(db, { services: [acrilicoExt], start: bogotaTime(day, "17:00") }))).toBe("ZP003");
  });

  it("no permite citas que se crucen", async () => {
    const day = await bogotaDay(db, 3);
    await book(db, { services: [tradicional], start: bogotaTime(day, "10:00") }); // 10:00-11:00
    expect(
      await errorCode(book(db, { services: [tradicional], start: bogotaTime(day, "10:30"), phone: "3011111111" })),
    ).toBe("ZP001");
    expect(
      await errorCode(book(db, { services: [tradicional], start: bogotaTime(day, "09:30"), phone: "3011111111" })),
    ).toBe("ZP001");
    // Contiguo sí se permite.
    await book(db, { services: [tradicional], start: bogotaTime(day, "11:00"), phone: "3011111111" });
    const s = await slots(db, day, [tradicional]);
    expect(s).not.toContain("10:00");
    expect(s).not.toContain("10:30");
    expect(s).not.toContain("09:30");
    expect(s).toContain("09:00");
  });

  it("respeta el tiempo de preparación (buffer) entre citas", async () => {
    await db.exec(`update public.settings set buffer_minutes = 15`);
    const day = await bogotaDay(db, 3);
    await book(db, { services: [tradicional], start: bogotaTime(day, "10:00") }); // bloquea hasta 11:15
    const s = await slots(db, day, [tradicional]);
    expect(s).not.toContain("11:00");
    expect(s).toContain("11:30");
  });

  it("la EXCLUDE constraint bloquea cruces aunque se salte el RPC", async () => {
    const day = await bogotaDay(db, 6);
    await book(db, { services: [tradicional], start: bogotaTime(day, "10:00") });
    const raw = db.query(
      `insert into public.appointments (code, customer_id, customer_name, customer_phone, start_at, end_at, blocked_until,
         total_price, total_duration_minutes, deposit_percent, deposit_amount, source)
       select 'ZP-RAW001', id, full_name, phone, $1::timestamptz, $2::timestamptz, $2::timestamptz, 20000, 60, 20, 4000, 'admin'
         from public.customers limit 1`,
      [bogotaTime(day, "10:15"), bogotaTime(day, "11:15")],
    );
    expect(await errorCode(raw)).toBe("23P01");
  });

  it("libera el cupo cuando la reserva temporal vence (expiración perezosa)", async () => {
    const day = await bogotaDay(db, 3);
    const first = await book(db, { services: [tradicional], start: bogotaTime(day, "10:00") });
    await db.query(`update public.appointments set hold_expires_at = now() - interval '1 minute' where id = $1`, [first.id]);
    expect(await slots(db, day, [tradicional])).toContain("10:00");
    const second = await book(db, { services: [tradicional], start: bogotaTime(day, "10:00"), phone: "3022222222" });
    expect(second.id).toBeTruthy();
    const st = await db.query<{ status: string }>(`select status from public.appointments where id = $1`, [first.id]);
    expect(st.rows[0]!.status).toBe("expired");
  });

  it("valida la dependencia del adicional de spa", async () => {
    const day = await bogotaDay(db, 3);
    expect(await errorCode(book(db, { services: [spa], start: bogotaTime(day, "10:00") }))).toBe("ZP005");
    expect(await errorCode(book(db, { services: [spa, semi], start: bogotaTime(day, "10:00") }))).toBe("ZP005");
    const ok = await book(db, { services: [pedicura, spa], start: bogotaTime(day, "10:00") });
    expect(ok.total_price).toBe(45000);
    expect(ok.deposit_amount).toBe(9000);
  });

  it("limita las reservas pendientes por teléfono", async () => {
    const day = await bogotaDay(db, 3);
    await book(db, { services: [retiro], start: bogotaTime(day, "09:00") });
    await book(db, { services: [retiro], start: bogotaTime(day, "10:00"), phone: "+57 300 123 4567" });
    expect(await errorCode(book(db, { services: [retiro], start: bogotaTime(day, "11:00") }))).toBe("ZP006");
  });

  it("valida el teléfono colombiano", async () => {
    const day = await bogotaDay(db, 3);
    expect(await errorCode(book(db, { services: [retiro], start: bogotaTime(day, "09:00"), phone: "12345" }))).toBe(
      "ZP012",
    );
  });
});

describe("concurrencia", () => {
  it("de 12 solicitudes simultáneas al mismo horario solo se crea una", async () => {
    const day = await bogotaDay(db, 7);
    const start = bogotaTime(day, "15:00");
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        book(db, { services: [semi], start, phone: `31000000${String(i).padStart(2, "0")}` }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed.every((f) => (f.reason as { code?: string }).code === "ZP001")).toBe(true);
    const count = await db.query<{ n: number }>(
      `select count(*)::int as n from public.appointments where start_at = $1 and status = 'pending_payment'`,
      [start],
    );
    expect(count.rows[0]!.n).toBe(1);
  });
});

describe("abono", () => {
  it("redondea hacia arriba al múltiplo de 1.000", async () => {
    const q = async (total: number, pct: number) =>
      (await db.query<{ v: number }>(`select public.compute_deposit($1, $2) as v`, [total, pct])).rows[0]!.v;
    expect(await q(20000, 20)).toBe(4000);
    expect(await q(8000, 20)).toBe(2000);
    expect(await q(57000, 20)).toBe(12000); // 11.400
    expect(await q(90000, 35)).toBe(32000); // 31.500
    expect(await q(1500, 20)).toBe(1000);
    expect(await q(500, 20)).toBe(500); // nunca supera el total
    expect(await q(100000, 5)).toBe(20000); // nunca menos de 20 %
  });

  it("la base de datos impide un porcentaje menor a 20 %", async () => {
    expect(await errorCode(db.exec(`update public.settings set deposit_percent = 19`))).toBe("23514");
  });
});

describe("cambios y cancelaciones por enlace privado", () => {
  it("permite reagendar y cancelar con 24 h o más, y respeta el límite de reagendamientos", async () => {
    const day = await bogotaDay(db, 5);
    const r = await book(db, { services: [semi], start: bogotaTime(day, "10:00") });
    const newDay = await bogotaDay(db, 6);

    await db.query(`select public.reschedule_booking_by_token($1, $2::timestamptz)`, [
      r.manage_token,
      bogotaTime(newDay, "11:00"),
    ]);
    const moved = await db.query<{ h: string; n: number }>(
      `select to_char(start_at at time zone 'America/Bogota', 'HH24:MI') as h, reschedule_count as n
         from public.appointments where id = $1`,
      [r.id],
    );
    expect(moved.rows[0]).toEqual({ h: "11:00", n: 1 });

    const again = db.query(`select public.reschedule_booking_by_token($1, $2::timestamptz)`, [
      r.manage_token,
      bogotaTime(newDay, "14:00"),
    ]);
    expect(await errorCode(again)).toBe("ZP008");

    // Confirmamos el abono y cancelamos: queda como saldo a favor.
    await db.query(`update public.appointments set status = 'confirmed', deposit_paid = true where id = $1`, [r.id]);
    await db.query(`select public.cancel_booking_by_token($1)`, [r.manage_token]);
    const after = await db.query<{ status: string; refund_status: string; credit: number }>(
      `select a.status, a.refund_status, c.credit_balance as credit
         from public.appointments a join public.customers c on c.id = a.customer_id where a.id = $1`,
      [r.id],
    );
    expect(after.rows[0]).toEqual({ status: "cancelled", refund_status: "credited", credit: 8000 });
  });

  it("falla en el servidor si faltan menos de 24 h", async () => {
    await openEveryDay(db, "00:00", "23:59");
    const today = await bogotaDay(db, 0);
    const tomorrow = await bogotaDay(db, 1);
    const first = await db.query<{ t: string }>(
      `select slot_start::text as t from (
         select slot_start from public.get_available_slots($1::date, $3::uuid[])
         union all
         select slot_start from public.get_available_slots($2::date, $3::uuid[])
       ) s order by slot_start limit 1`,
      [today, tomorrow, [retiro]],
    );
    const r = await book(db, { services: [retiro], start: first.rows[0]!.t });
    expect(await errorCode(db.query(`select public.cancel_booking_by_token($1)`, [r.manage_token]))).toBe("ZP007");
    const later = await bogotaDay(db, 4);
    expect(
      await errorCode(
        db.query(`select public.reschedule_booking_by_token($1, $2::timestamptz)`, [
          r.manage_token,
          bogotaTime(later, "10:00"),
        ]),
      ),
    ).toBe("ZP007");
  });

  it("un token inválido no revela información", async () => {
    expect(await errorCode(db.query(`select public.get_booking_by_token('abc')`))).toBe("ZP009");
    expect(await errorCode(db.query(`select public.get_booking_by_token($1)`, ["f".repeat(64)]))).toBe("ZP009");
  });
});

describe("seguridad (RLS y permisos)", () => {
  it("anon no puede leer citas ni clientes, ni crear reservas directamente", async () => {
    const day = await bogotaDay(db, 3);
    await book(db, { services: [semi], start: bogotaTime(day, "10:00") });
    await db.exec(`set role anon`);
    try {
      const a = await db.query<{ n: number }>(`select count(*)::int as n from public.appointments`);
      expect(a.rows[0]!.n).toBe(0);
      const c = await db.query<{ n: number }>(`select count(*)::int as n from public.customers`);
      expect(c.rows[0]!.n).toBe(0);
      const s = await db.query<{ n: number }>(`select count(*)::int as n from public.services`);
      expect(s.rows[0]!.n).toBeGreaterThan(0);
      expect(
        await errorCode(
          db.query(`select public.create_booking($1::uuid[], $2::timestamptz, 'X', '3001112233')`, [
            [semi],
            bogotaTime(day, "15:00"),
          ]),
        ),
      ).toBe("42501");
      expect(await errorCode(db.query(`select public.admin_update_appointment_status(gen_random_uuid(), 'cancel')`))).toBe(
        "42501",
      );
      const free = await db.query(`select * from public.get_available_slots($1::date, $2::uuid[])`, [day, [semi]]);
      expect(free.rows.length).toBeGreaterThan(0);
    } finally {
      await db.exec(`reset role`);
    }
  });

  it("un usuario autenticado que no es admin no puede usar RPC de administración", async () => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', gen_random_uuid()::text, false);`);
    try {
      expect(
        await errorCode(db.query(`select public.admin_update_appointment_status(gen_random_uuid(), 'cancel')`)),
      ).toBe("ZP011");
      const a = await db.query<{ n: number }>(`select count(*)::int as n from public.appointments`);
      expect(a.rows[0]!.n).toBe(0);
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  });

  it("la administradora puede crear citas manuales saltándose la antelación, pero no los choques", async () => {
    const adminId = "11111111-1111-1111-1111-111111111111";
    await db.query(`insert into auth.users (id, email) values ($1, 'a@a.co') on conflict do nothing`, [adminId]);
    await db.query(`insert into public.admins (user_id, email) values ($1, 'a@a.co') on conflict do nothing`, [adminId]);
    const day = await bogotaDay(db, 3);
    await book(db, { services: [tradicional], start: bogotaTime(day, "10:00") });

    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${adminId}', false);`);
    try {
      const soon = await db.query<{ r: { code: string } }>(
        `select public.admin_create_appointment($1::uuid[], now() + interval '10 minutes', 'Walk in', '3015550000', null, '', 'skip') as r`,
        [[retiro]],
      );
      expect(soon.rows[0]!.r.code).toMatch(/^ZP-/);
      const clash = db.query(
        `select public.admin_create_appointment($1::uuid[], $2::timestamptz, 'Otra', '3015550001', null, '', 'paid')`,
        [[tradicional], bogotaTime(day, "10:30")],
      );
      expect(await errorCode(clash)).toBe("ZP001");
      const n = await db.query<{ n: number }>(`select count(*)::int as n from public.appointments`);
      expect(n.rows[0]!.n).toBe(2);
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  });
});
