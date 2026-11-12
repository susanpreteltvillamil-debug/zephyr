# Zephyr · Sitio web, reservas y dashboard

Sitio de **Zephyr** (salón de uñas) con:

- **Landing** editable desde el dashboard (hero con próximo cupo real, beneficios, servicios, galería, cómo reservar, testimonios, preguntas frecuentes, CTA, contacto y footer con enlaces legales).
- **Reservas en línea** en 4 pasos con **abono obligatorio** (Nequi, Daviplata, Llave), reserva temporal con cuenta regresiva, envío del comprobante por WhatsApp y **enlace privado** para reagendar o cancelar.
- **Dashboard** privado (`/admin`) para gestionar citas, calendario, servicios, horarios, contenido, galería, contacto, medios de pago, políticas legales y configuración.

Stack: Next.js 16 (App Router, TypeScript estricto) · Tailwind CSS v4 · Radix UI · next-themes · Supabase (Postgres, Auth, Storage, Realtime) · zod · react-hook-form · date-fns-tz · react-day-picker · dnd-kit. Todo funciona con los **planes gratuitos** de Vercel y Supabase.

---

## 1. Requisitos

- Node.js 20.9 o superior y npm.
- Una cuenta gratuita en [Supabase](https://supabase.com) y otra en [Vercel](https://vercel.com).
- Opcional: cuenta gratuita de Cloudflare para [Turnstile](https://www.cloudflare.com/products/turnstile/) (anti-bots).

## 2. Crear el proyecto en Supabase

1. En Supabase crea un proyecto nuevo (región recomendada: `South America (São Paulo)`).
2. Ve a **SQL Editor** y ejecuta, **en este orden**, el contenido de:
   1. `supabase/migrations/20261111000001_schema.sql` (tablas, restricción anti-traslapes)
   2. `supabase/migrations/20261111000002_booking_engine.sql` (motor de reservas y RPC)
   3. `supabase/migrations/20261111000003_security.sql` (RLS, permisos, bucket `media`, Realtime)
   4. `supabase/seed.sql` (servicios, horarios, contenido, medios de pago y textos legales iniciales)

   > Con la CLI de Supabase también puedes hacer `supabase link --project-ref <ref>` y `supabase db push`, y luego ejecutar `seed.sql` en el SQL Editor.
   > Todos los scripts son idempotentes en lo posible; el seed no duplica datos si lo vuelves a correr.

3. **Storage**: la migración de seguridad crea el bucket público `media` (máx. 5 MB; webp, jpeg, png, avif). Verifica en **Storage** que existe.
4. **Realtime**: la tabla `appointments` queda agregada a la publicación `supabase_realtime`, para que el dashboard muestre nuevas reservas al instante.

## 3. Crear la cuenta de la dueña (administradora)

1. En **Authentication → Users → Add user → Create new user**, crea el usuario con correo y contraseña (marca *Auto Confirm User*).
2. En **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up* para que nadie más pueda registrarse.
3. En el **SQL Editor**, dale permisos de administradora:

   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'zephyr.contacto@gmail.com';
   ```

   Cambia el correo por el que usaste. Puedes repetirlo para otras personas del equipo; todas tendrán acceso total.

## 4. Variables de entorno

Copia `.env.example` como `.env.local` y complétalo. Están documentadas en el mismo archivo:

| Variable | Dónde se obtiene | Pública |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → `anon` / publishable | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` / secret | **No. Solo servidor** |
| `NEXT_PUBLIC_SITE_URL` | Tu dominio, p. ej. `https://zephyr.vercel.app` | Sí |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → Add site | Site key sí, secret no |
| `CRON_SECRET` | Genera uno: `openssl rand -hex 32` | No |

La clave `service_role` solo se importa en módulos `server-only` (`src/lib/supabase/service.ts`) y nunca llega al navegador.

## 5. Desarrollo local

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin variables de Supabase la landing también funciona con el contenido por defecto (útil para diseñar), pero las reservas y el dashboard necesitan la base.

Scripts útiles:

```bash
npm run lint         # ESLint
npm run typecheck    # tipos de rutas + tsc
npm run test         # pruebas del motor de reservas (Postgres en memoria con PGlite) y librerías
npm run build        # build de producción
npm run check        # todo lo anterior
```

## 6. Despliegue en Vercel

1. Sube el proyecto a GitHub e impórtalo en Vercel (**Add New → Project**). El framework se detecta solo.
2. En **Settings → Environment Variables** agrega todas las variables del paso 4 (para *Production* y *Preview*).
3. Despliega. Después, en Supabase → **Authentication → URL Configuration**, pon tu dominio en *Site URL*.
4. **Cron**: `vercel.json` programa `GET /api/cron/maintenance` todos los días a las `08:00 UTC` (3:00 a. m. en Colombia). Vercel envía `Authorization: Bearer $CRON_SECRET` automáticamente. El plan Hobby permite un cron diario, que es lo que se usa.
   - Además, las reservas temporales vencidas se liberan **de forma perezosa** cada vez que alguien consulta disponibilidad o reserva, así que el cron es solo un respaldo.

## 7. Uso del dashboard

Entra a `/admin` con el usuario administrador.

| Módulo | Qué hace |
| --- | --- |
| **Resumen** | Citas de hoy, abonos por confirmar, próximas citas, abonos recibidos y ventas estimadas del mes. Avisa en tiempo real cuando llega una reserva nueva. |
| **Calendario** | Vista día / semana / mes con las citas por color de estado. |
| **Citas** | Tabla con filtros (estado, fechas, búsqueda). Acciones: confirmar abono, completar, inasistencia, reagendar, cancelar, aplicar saldo a favor, marcar devolución, notas, WhatsApp. |
| **Nueva cita** | Agenda manual (llamadas, Instagram, presencial). Puedes marcar el abono como pagado, omitido o pendiente. |
| **Servicios** | Categorías y servicios con precio, duración, foto y orden por arrastre. Los adicionales (como el spa) pueden exigir otro servicio. |
| **Horarios** | Varios rangos por día (p. ej. con almuerzo) y bloqueos de fechas u horas (festivos, vacaciones). |
| **Contenido** | Edita todos los textos e imágenes de la landing, muestra/oculta y reordena secciones. Los cambios se publican al guardar. |
| **Galería** | Sube varias fotos a la vez (se comprimen a WebP, máx. 1600 px), agrega texto alternativo, reordena y elimina. |
| **Contacto y redes** | WhatsApp, correo, Instagram, Facebook, TikTok, etc. Activa, edita o reordena. |
| **Medios de pago** | Nequi, Daviplata, Llave u otros, con titular, instrucciones y QR opcional. |
| **Políticas legales** | Editor Markdown con vista previa y versión. Cada reserva guarda la versión aceptada y la fecha. |
| **Configuración** | Nombre, WhatsApp de comprobantes, % de abono (mín. 20 %), tiempo para pagar, antelación mínima, horizonte, intervalo, preparación entre citas, plazo de cambios, reagendamientos y qué pasa con el abono al cancelar. |

### Flujo de una reserva

1. La clienta elige servicios, fecha y hora, deja sus datos y acepta las políticas.
2. La cita queda en **Pendiente de abono** y el horario se aparta por el tiempo configurado (2 h por defecto).
3. La clienta paga el abono y envía el comprobante por WhatsApp (el botón arma el mensaje con el código `ZP-XXXXXX`).
4. Tú revisas el pago y pulsas **Confirmar abono** → la cita pasa a **Confirmada**.
5. Si no se confirma a tiempo, pasa a **Vencida** y el horario se libera solo.
6. Después de atenderla: **Completada** o **No asistió** (el abono no se devuelve).

## 8. Cómo se evita la doble reserva

- La tabla `appointments` tiene una restricción `EXCLUDE USING gist (staff_id WITH =, tstzrange(start_at, blocked_until) WITH &&)` para citas pendientes o confirmadas: Postgres **no permite** dos citas que se crucen, aunque lleguen en el mismo milisegundo.
- Las reservas se crean con la función transaccional `create_booking` (`SECURITY DEFINER`), que recalcula precios, duración y abono en el servidor y devuelve el mensaje *"Ese horario acaba de ser tomado, elige otro."* si pierde la carrera.
- Un trigger rechaza reservas web en el pasado o sin la antelación mínima.
- Pruebas: `tests/db/booking-engine.test.ts` (reglas, abono, horarios, reagendamiento, cancelación, permisos) y `tests/db/concurrency-real-postgres.test.ts`, que lanza 20 conexiones reales contra el mismo cupo y verifica que solo una gana. Esta última se ejecuta con una base **desechable**:

  ```bash
  supabase start   # Postgres local con las migraciones y el seed aplicados
  TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:concurrency
  ```

## 9. Seguridad y datos personales

- RLS activo en todas las tablas; la función `is_admin()` controla el acceso del dashboard.
- El público solo lee contenido publicado. La disponibilidad se expone únicamente por RPC (sin datos de clientas).
- Las reservas y la gestión por enlace pasan por *server actions* con validación zod, honeypot, Turnstile y límite de reservas pendientes por WhatsApp.
- El enlace "Mi cita" usa un token aleatorio; en la base solo se guarda su hash SHA-256.
- Encabezados de seguridad (HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, etc.); `/admin` y `/mi-cita` con `noindex`.
- Ley 1581 de 2012: casillas de autorización explícitas; se guardan fecha, hora y versión de la política aceptada. **Completa en "Políticas legales" los marcadores `[RAZÓN SOCIAL]`, `[NIT/CC]` y `[DIRECCIÓN]`** antes de publicar.

---

## Supuestos

Decisiones tomadas donde la especificación no daba el dato. Todas son configurables en el dashboard salvo donde se indica.

| Tema | Supuesto | Dónde cambiarlo |
| --- | --- | --- |
| Horario de atención | Lunes a sábado 9:00–13:00 y 14:00–19:00; domingo cerrado. | Horarios |
| Abono | 20 % del total, redondeado hacia arriba al múltiplo de 1.000 COP y nunca mayor al total. La base de datos impide guardar menos de 20 %. | Configuración |
| Tiempo para pagar | 2 horas, o menos si la cita empieza antes. | Configuración |
| Antelación / horizonte / intervalo | 2 horas / 60 días / cada 30 min; 0 min de preparación entre citas. | Configuración |
| Cambios por la clienta | Hasta 24 h antes; 1 reagendamiento por cita. Con menos tiempo debe escribir por WhatsApp. | Configuración |
| Cancelación a tiempo | El abono queda como **saldo a favor** (opción alternativa: devolución). El saldo lo aplicas manualmente desde Citas a la siguiente reserva de esa clienta. | Configuración |
| Inasistencia o cancelación tardía | El abono no se devuelve. | Políticas legales |
| Llegadas tarde | Tolerancia de 15 minutos (texto en FAQ y política de reservas). | Contenido / Políticas legales |
| Anti-abuso | Máximo 2 reservas pendientes de abono por número de WhatsApp. Sin claves de Turnstile, el widget se omite y siguen activos el honeypot y el límite. | Configuración / variables de entorno |
| Una sola profesional | Las citas no se cruzan entre sí (`staff_id` único por defecto). El esquema ya incluye `staff_id` en la restricción para crecer a varias profesionales. | Código / base de datos |
| Precio del spa | Adicional de +25.000 COP y 30 min; solo se puede elegir junto con una pedicura. | Servicios |
| Redes sociales | Instagram y Facebook vienen creados pero **inactivos** hasta que pongas tus enlaces. | Contacto y redes |
| Dirección | Vacía por defecto; si la agregas, aparece en contacto y en los datos estructurados (SEO). | Configuración |
| Zona horaria | America/Bogota fija (UTC−5, sin horario de verano). Las horas se guardan en UTC. | No configurable |
| Notificaciones | Sin APIs de pago: los avisos a la clienta son enlaces `wa.me` que abre ella o tú; el dashboard avisa en tiempo real de nuevas reservas. | — |
| Pagos | Sin pasarela: la dueña confirma manualmente cada abono. | — |
| Imágenes | El sitio arranca sin fotos (ilustraciones y degradados de marca); sube fotos reales en Galería y Contenido. | Galería / Contenido |
| Mantenimiento | El cron diario vence reservas temporales; la expiración también ocurre al consultar disponibilidad. | `vercel.json` |
