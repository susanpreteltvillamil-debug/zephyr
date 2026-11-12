import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "supabase", "migrations");

export const ALL_DAYS_HOURS = "00:00-23:59";

/** Crea una base de datos en memoria con el esquema completo de Zephyr. */
export async function createTestDb(options: { seed?: boolean } = {}) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(path.join(__dirname, "supabase-shim.sql"), "utf8"));
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  if (options.seed !== false) {
    await db.exec(readFileSync(path.join(root, "supabase", "seed.sql"), "utf8"));
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Abre el salón todos los días casi todo el día para pruebas deterministas. */
export async function openEveryDay(db: TestDb, start = "00:00", end = "23:59") {
  await db.exec(`delete from public.business_hours;`);
  await db.query(
    `insert into public.business_hours (weekday, start_time, end_time)
     select d, $1::time, $2::time from generate_series(0, 6) d`,
    [start, end],
  );
}

export async function serviceIds(db: TestDb, names: string[]): Promise<string[]> {
  const res = await db.query<{ id: string; name: string }>(
    `select id, name from public.services where name = any($1::text[])`,
    [names],
  );
  return names.map((n) => {
    const row = res.rows.find((r) => r.name === n);
    if (!row) throw new Error(`Servicio no encontrado: ${n}`);
    return row.id;
  });
}

/** Fecha (YYYY-MM-DD) en Bogotá, desplazada N días desde hoy. */
export async function bogotaDay(db: TestDb, offsetDays: number): Promise<string> {
  const res = await db.query<{ d: string }>(
    `select to_char(public.bogota_today() + $1::int, 'YYYY-MM-DD') as d`,
    [offsetDays],
  );
  return res.rows[0]!.d;
}

/** Timestamp ISO para una hora local de Bogotá en el día indicado. */
export function bogotaTime(day: string, hhmm: string): string {
  return `${day}T${hhmm}:00-05:00`;
}

export async function book(
  db: TestDb,
  args: { services: string[]; start: string; phone?: string; name?: string },
) {
  const res = await db.query<{ r: Record<string, unknown> }>(
    `select public.create_booking($1::uuid[], $2::timestamptz, $3, $4, null, '') as r`,
    [args.services, args.start, args.name ?? "Clienta Prueba", args.phone ?? "3001234567"],
  );
  return res.rows[0]!.r as {
    id: string;
    code: string;
    manage_token: string;
    deposit_amount: number;
    total_price: number;
    hold_expires_at: string;
  };
}

export async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "UNKNOWN";
  }
}

export async function slots(db: TestDb, day: string, services: string[]): Promise<string[]> {
  const res = await db.query<{ s: string }>(
    `select to_char(slot_start at time zone 'America/Bogota', 'HH24:MI') as s
       from public.get_available_slots($1::date, $2::uuid[])`,
    [day, services],
  );
  return res.rows.map((r) => r.s);
}
