import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeDeposit, formatCOP, formatDuration, MIN_DEPOSIT_PERCENT } from "@/lib/booking/money";
import { formatPhone, isValidColombianMobile, normalizePhone, toWhatsAppNumber } from "@/lib/booking/phone";
import {
  addDaysToKey,
  bogotaDateKey,
  bogotaHHmm,
  bogotaToUtc,
  bogotaToday,
  canChangeAppointment,
  weekdayOfKey,
} from "@/lib/booking/time";
import { isAddonAllowed, pruneSelection } from "@/components/booking/service-picker";
import { createTestDb, type TestDb } from "../db/harness";
import type { Service } from "@/lib/types";

describe("computeDeposit", () => {
  it("redondea hacia arriba al millar", () => {
    expect(computeDeposit(40_000, 20)).toBe(8_000);
    expect(computeDeposit(45_000, 20)).toBe(9_000);
    expect(computeDeposit(42_500, 20)).toBe(9_000); // 8.500 → 9.000
    expect(computeDeposit(85_000, 20)).toBe(17_000);
    expect(computeDeposit(1_000, 20)).toBe(1_000);
  });

  it("nunca baja del 20 %", () => {
    expect(computeDeposit(100_000, 5)).toBe(20_000);
    expect(computeDeposit(100_000, MIN_DEPOSIT_PERCENT - 1)).toBe(20_000);
  });

  it("no supera el total", () => {
    expect(computeDeposit(500, 20)).toBe(500);
    expect(computeDeposit(30_500, 100)).toBe(30_500);
    expect(computeDeposit(0, 20)).toBe(0);
  });
});

describe("computeDeposit coincide con public.compute_deposit (SQL)", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb({ seed: false });
  });
  afterAll(async () => {
    await db.close();
  });

  it("para una muestra amplia de totales y porcentajes", async () => {
    const cases: [number, number][] = [];
    for (const total of [0, 500, 999, 1_000, 1_001, 25_000, 42_500, 58_300, 85_000, 123_456, 250_000]) {
      for (const pct of [0, 10, 20, 25, 33, 50, 100]) cases.push([total, pct]);
    }
    const values = cases.map(([t, p]) => `(${t}, ${p})`).join(",");
    const { rows } = await db.query<{ t: number; p: number; d: number }>(
      `select t, p, public.compute_deposit(t, p) as d from (values ${values}) as v(t, p)`,
    );
    for (const r of rows) expect(r.d, `total ${r.t}, ${r.p}%`).toBe(computeDeposit(r.t, r.p));
  });
});

describe("formato", () => {
  it("COP sin decimales con separador de miles", () => {
    const s = formatCOP(40_000).replace(/\s/g, " ");
    expect(s).toMatch(/40\.000/);
    expect(s).not.toMatch(/,\d{2}$/);
  });
  it("duración legible", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(150)).toBe("2 h 30 min");
  });
});

describe("teléfono", () => {
  it("normaliza +57 y espacios", () => {
    expect(normalizePhone("+57 314 465 7351")).toBe("3144657351");
    expect(normalizePhone("314-465-7351")).toBe("3144657351");
  });
  it("valida celulares colombianos", () => {
    expect(isValidColombianMobile("3144657351")).toBe(true);
    expect(isValidColombianMobile("6014657351")).toBe(false);
    expect(isValidColombianMobile("31446573")).toBe(false);
  });
  it("formatea y arma número de WhatsApp", () => {
    expect(formatPhone("3144657351")).toBe("314 465 7351");
    expect(toWhatsAppNumber("3144657351")).toBe("573144657351");
  });
});

describe("zona horaria America/Bogota", () => {
  it("convierte hora local a UTC (UTC−5, sin horario de verano)", () => {
    expect(bogotaToUtc("2026-11-20", "09:00").toISOString()).toBe("2026-11-20T14:00:00.000Z");
    expect(bogotaToUtc("2026-06-20", "09:00").toISOString()).toBe("2026-06-20T14:00:00.000Z");
  });
  it("la fecha local cambia a las 19:00 UTC", () => {
    expect(bogotaDateKey("2026-11-21T04:59:00Z")).toBe("2026-11-20");
    expect(bogotaDateKey("2026-11-21T05:00:00Z")).toBe("2026-11-21");
    expect(bogotaToday(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-20");
  });
  it("hora y día de la semana locales", () => {
    expect(bogotaHHmm("2026-11-20T14:30:00Z")).toBe("09:30");
    expect(weekdayOfKey("2026-11-15")).toBe(0); // domingo
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("canChangeAppointment (regla de 24 h)", () => {
  const start = "2026-11-20T14:00:00Z";
  it("permite con 24 h o más", () => {
    expect(canChangeAppointment(start, 24, new Date("2026-11-19T14:00:00Z"))).toBe(true);
    expect(canChangeAppointment(start, 24, new Date("2026-11-18T10:00:00Z"))).toBe(true);
  });
  it("rechaza con menos de 24 h", () => {
    expect(canChangeAppointment(start, 24, new Date("2026-11-19T14:00:01Z"))).toBe(false);
    expect(canChangeAppointment(start, 24, new Date("2026-11-20T15:00:00Z"))).toBe(false);
  });
});

describe("dependencia del spa (add-on)", () => {
  const svc = (id: string, extra: Partial<Service> = {}): Service => ({
    id,
    category_id: "c",
    name: id,
    description: "",
    price: 10_000,
    price_type: "fixed",
    duration_minutes: 30,
    image_url: null,
    active: true,
    sort_order: 0,
    requires_any_service_ids: [],
    ...extra,
  });
  const pedi = svc("pedicura");
  const spa = svc("spa", { price_type: "addon", requires_any_service_ids: ["pedicura"] });
  const semi = svc("semi");
  const all = [pedi, spa, semi];

  it("solo se habilita con pedicura", () => {
    expect(isAddonAllowed(spa, new Set(["semi"]))).toBe(false);
    expect(isAddonAllowed(spa, new Set(["pedicura"]))).toBe(true);
  });
  it("se quita al deseleccionar la pedicura", () => {
    expect([...pruneSelection(new Set(["spa", "semi"]), all)]).toEqual(["semi"]);
    expect([...pruneSelection(new Set(["spa", "pedicura"]), all)].sort()).toEqual(["pedicura", "spa"]);
  });
});
