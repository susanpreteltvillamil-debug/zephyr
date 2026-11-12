/**
 * Prueba de concurrencia REAL con varias conexiones a Postgres.
 *
 * PGlite usa una sola conexión, así que las pruebas de `booking-engine.test.ts`
 * validan la lógica pero serializan las transacciones. Esta prueba abre N
 * conexiones independientes que intentan reservar el mismo cupo al mismo
 * tiempo. Se ejecuta solo si defines TEST_DATABASE_URL apuntando a una base
 * DESECHABLE (por ejemplo `supabase start` → postgresql://postgres:postgres@127.0.0.1:54322/postgres).
 *
 *   TEST_DATABASE_URL=postgresql://... npm run test:concurrency
 *
 * ¡Nunca la apuntes a producción! Crea y borra datos de prueba.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("concurrencia con conexiones reales", () => {
  let pool: Pool;
  let serviceId: string;
  let start: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 20 });
    const svc = await pool.query<{ id: string }>(
      `select id from public.services where active and price_type = 'fixed' order by duration_minutes limit 1`,
    );
    serviceId = svc.rows[0]!.id;
    const slot = await pool.query<{ s: string }>(
      `select slot_start::text as s
         from generate_series(public.bogota_today() + 2, public.bogota_today() + 30, interval '1 day') d,
              lateral public.get_available_slots(d::date, array[$1]::uuid[])
        order by slot_start limit 1`,
      [serviceId],
    );
    start = slot.rows[0]!.s;
  });

  afterAll(async () => {
    await pool.query(`delete from public.appointments where customer_phone like '3199%'`);
    await pool.query(`delete from public.customers where phone like '3199%'`);
    await pool.end();
  });

  it("20 conexiones simultáneas → exactamente 1 cita", async () => {
    const attempts = Array.from({ length: 20 }, async (_, i) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const r = await client.query(
          `select public.create_booking(array[$1]::uuid[], $2::timestamptz, 'Prueba Concurrencia', $3, null, '')`,
          [serviceId, start, `31990000${String(i).padStart(2, "0")}`],
        );
        await client.query("commit");
        return r.rows[0];
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    });
    const results = await Promise.allSettled(attempts);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect((r.reason as { code?: string }).code).toBe("ZP001");
    }
  });
});
