-- =============================================================================
-- Zephyr · Datos semilla
-- Idempotente: se puede correr varias veces sin duplicar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configuración
-- -----------------------------------------------------------------------------
insert into public.settings (id, salon_name, tagline, whatsapp_number)
values (1, 'Zephyr', 'Uñas impecables, cuidado de verdad', '3144657351')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Categorías y servicios
-- -----------------------------------------------------------------------------
insert into public.service_categories (name, slug, description, sort_order) values
  ('Manos',   'manos',   'Manicura, sistemas y recubrimientos con acabado de salón.', 1),
  ('Retiros', 'retiros', 'Retiro seguro y cuidadoso para proteger tu uña natural.', 2),
  ('Pies',    'pies',    'Pedicura completa para que tus pies se vean y se sientan bien.', 3)
on conflict (slug) do nothing;

insert into public.services (category_id, name, description, price, price_type, duration_minutes, sort_order)
select c.id, s.name, s.description, s.price, s.price_type, s.duration, s.sort_order
from (values
  ('manos',   'Tradicional',              'Limpieza, cutícula, limado y esmaltado tradicional con brillo duradero.',                         20000, 'fixed', 60, 1),
  ('manos',   'Semipermanente',           'Esmalte en gel curado en lámpara: brillo intacto y cero descascarado hasta por 3 semanas.',       40000, 'fixed', 75, 2),
  ('manos',   'Press on',                 'Uñas prediseñadas a tu medida, aplicadas con técnica profesional. Look completo en poco tiempo.',  60000, 'fixed', 90, 3),
  ('manos',   'Dipping',                  'Polvo de inmersión que fortalece y da un acabado resistente, ligero y natural.',                  55000, 'fixed', 90, 4),
  ('manos',   'Base rubber',              'Base niveladora flexible que protege tu uña natural y la ayuda a crecer fuerte.',                 57000, 'fixed', 90, 5),
  ('manos',   'Acrílico recubrimiento',   'Capa de acrílico sobre tu uña natural para darle resistencia y forma perfecta.',                  70000, 'fixed', 120, 6),
  ('manos',   'Poligel recubrimiento',    'Recubrimiento en poligel: liviano, flexible y con acabado muy natural.',                          70000, 'fixed', 120, 7),
  ('manos',   'Acrílico extensión',       'Extensión en acrílico con el largo y la forma que sueñas: almendra, coffin, square y más.',       90000, 'fixed', 150, 8),
  ('manos',   'Poligel extensión',        'Extensión en poligel, más liviana y cómoda, con un resultado elegante y duradero.',              90000, 'fixed', 150, 9),
  ('retiros', 'Retiro semipermanente',    'Retiro suave del esmalte en gel sin raspar ni debilitar tu uña.',                                  8000, 'fixed', 30, 1),
  ('retiros', 'Retiro de sistemas',       'Retiro profesional de acrílico, poligel, dipping o press on, cuidando la uña natural.',           15000, 'fixed', 45, 2),
  ('pies',    'Pedicura tradicional',     'Limpieza, cutícula, limado, exfoliación ligera y esmaltado tradicional.',                         20000, 'fixed', 60, 1),
  ('pies',    'Pedicura semipermanente',  'Pedicura completa con esmalte en gel de larga duración.',                                         40000, 'fixed', 75, 2),
  ('pies',    'Pedicura con spa',         'Adicional de spa: remojo relajante, exfoliación, mascarilla e hidratación profunda.',            25000, 'addon', 30, 3)
) as s(cat, name, description, price, price_type, duration, sort_order)
join public.service_categories c on c.slug = s.cat
where not exists (select 1 from public.services x where x.name = s.name);

-- El spa solo se combina con una pedicura.
update public.services spa
   set requires_any_service_ids = (
     select array_agg(p.id) from public.services p
      where p.name in ('Pedicura tradicional', 'Pedicura semipermanente')
   )
 where spa.name = 'Pedicura con spa' and cardinality(spa.requires_any_service_ids) = 0;

-- -----------------------------------------------------------------------------
-- Horario (supuesto inicial: lunes a sábado, con pausa de almuerzo)
-- -----------------------------------------------------------------------------
insert into public.business_hours (weekday, start_time, end_time)
select d, t.s, t.e
from generate_series(1, 6) d
cross join (values (time '09:00', time '13:00'), (time '14:00', time '19:00')) t(s, e)
where not exists (select 1 from public.business_hours);

-- -----------------------------------------------------------------------------
-- Contacto y redes
-- -----------------------------------------------------------------------------
insert into public.contact_channels (type, label, value, url, active, sort_order)
select * from (values
  ('whatsapp',  'WhatsApp',  '314 465 7351',               'https://wa.me/573144657351', true,  1),
  ('email',     'Correo',    'zephyr.contacto@gmail.com',  'mailto:zephyr.contacto@gmail.com', true, 2),
  ('instagram', 'Instagram', '',                           '', false, 3),
  ('facebook',  'Facebook',  '',                           '', false, 4)
) as v(type, label, value, url, active, sort_order)
where not exists (select 1 from public.contact_channels);

-- -----------------------------------------------------------------------------
-- Medios de pago
-- -----------------------------------------------------------------------------
insert into public.payment_methods (name, account_number, holder, instructions, sort_order)
select * from (values
  ('Nequi',     '3242264065', 'Susan Pretelt', 'Envía el abono desde tu app Nequi a este número.', 1),
  ('Daviplata', '3242264065', 'Susan Pretelt', 'Transfiere desde Daviplata a este número.', 2),
  ('Llave',     '3242264065', 'Susan Pretelt', 'Usa la llave desde la app de tu banco (Bre-B).', 3)
) as v(name, account_number, holder, instructions, sort_order)
where not exists (select 1 from public.payment_methods);

-- -----------------------------------------------------------------------------
-- Secciones de la landing
-- -----------------------------------------------------------------------------
insert into public.site_sections (key, sort_order, visible, content) values
('hero', 1, true, $json${
  "eyebrow": "Salón de uñas · Cita previa",
  "title": "Uñas que hablan por ti, hechas con calma y precisión",
  "subtitle": "Semipermanente, sistemas y pedicura con productos de calidad, herramientas esterilizadas y el tiempo que tus manos merecen. Reserva en 1 minuto y asegura tu cupo con un abono.",
  "primaryCta": "Reserva tu cita",
  "secondaryCta": "Escríbenos por WhatsApp",
  "highlights": ["Herramientas esterilizadas", "Duración hasta 3 semanas", "Atención solo con cita"],
  "image": { "url": "", "alt": "" }
}$json$::jsonb),
('benefits', 2, true, $json${
  "title": "Por qué elegir Zephyr",
  "subtitle": "No es solo esmalte: es un ritual de cuidado pensado para que salgas feliz y tus uñas se mantengan sanas.",
  "items": [
    { "icon": "shield", "title": "Higiene sin negociación", "description": "Limas y pulidores de un solo uso, metal esterilizado y superficies desinfectadas en cada cita." },
    { "icon": "sparkles", "title": "Acabado que dura", "description": "Preparamos bien la uña natural para que el color y el brillo te acompañen por semanas." },
    { "icon": "clock", "title": "Tu tiempo se respeta", "description": "Atendemos solo con cita: sin filas, sin afanes y con la hora que tú elegiste." },
    { "icon": "heart", "title": "Cuidamos tu uña natural", "description": "Retiros suaves y técnicas que no debilitan. Belleza hoy y uñas sanas mañana." }
  ]
}$json$::jsonb),
('services', 3, true, $json${
  "title": "Servicios y precios",
  "subtitle": "Precios claros desde el inicio. Puedes combinar servicios, por ejemplo retiro + semipermanente, y ver el total al reservar.",
  "note": "Los tiempos son aproximados y pueden variar según el diseño y el estado de tu uña."
}$json$::jsonb),
('gallery', 4, true, $json${
  "title": "Nuestros trabajos",
  "subtitle": "Resultados reales hechos en Zephyr. Inspírate para tu próxima cita."
}$json$::jsonb),
('how_to_book', 5, true, $json${
  "title": "Reserva en 3 pasos",
  "subtitle": "Rápido, claro y sin llamadas.",
  "steps": [
    { "title": "Elige tus servicios", "description": "Combina lo que quieras y mira el precio y la duración total al instante." },
    { "title": "Escoge fecha y hora", "description": "Solo te mostramos horarios realmente disponibles." },
    { "title": "Asegura con tu abono", "description": "Paga el abono por Nequi, Daviplata o Llave y envíanos el comprobante por WhatsApp." }
  ]
}$json$::jsonb),
('testimonials', 6, true, $json${
  "title": "Lo que dicen nuestras clientas",
  "subtitle": "La mejor publicidad es una clienta que vuelve.",
  "items": [
    { "name": "Valentina R.", "service": "Semipermanente", "text": "Me duró impecable tres semanas y la atención fue súper puntual. Por fin un lugar donde no me toca esperar.", "rating": 5 },
    { "name": "Laura M.", "service": "Poligel extensión", "text": "Quedaron livianas y naturales, justo como las quería. Se nota el cuidado con la higiene.", "rating": 5 },
    { "name": "Daniela P.", "service": "Pedicura con spa", "text": "El spa de pies es un regalo. Salí relajada y con los pies divinos.", "rating": 5 }
  ]
}$json$::jsonb),
('faq', 7, true, $json${
  "title": "Preguntas frecuentes",
  "subtitle": "Todo claro antes de tu cita.",
  "items": [
    { "question": "¿Por qué piden un abono?", "answer": "El abono (mínimo el 20 % del total) separa tu horario solo para ti. Se descuenta del valor final el día de tu cita." },
    { "question": "¿Cuánto tiempo tengo para pagar el abono?", "answer": "Al reservar, tu cupo queda apartado temporalmente (2 horas por defecto). Si en ese tiempo no recibimos el comprobante, el horario se libera para otra persona." },
    { "question": "¿Puedo cambiar o cancelar mi cita?", "answer": "Sí, desde el enlace privado que recibes al reservar, con al menos 24 horas de anticipación. Si cancelas a tiempo, tu abono queda como saldo a favor para tu próxima cita." },
    { "question": "¿Qué pasa si no asisto?", "answer": "Si no asistes sin avisar con 24 horas de anticipación, el abono no se devuelve, porque ese horario se reservó solo para ti." },
    { "question": "¿Y si llego tarde?", "answer": "Te esperamos hasta 15 minutos. Después de eso es posible que debamos ajustar el servicio para no afectar a la siguiente clienta, o reprogramar." },
    { "question": "¿Cuánto dura cada servicio?", "answer": "Desde 30 minutos para un retiro hasta 2 horas y media para extensiones. Al reservar ves la duración total de lo que elijas." },
    { "question": "¿Cómo garantizan la higiene?", "answer": "Esterilizamos el instrumental metálico, usamos limas y pulidores de un solo uso y desinfectamos la estación antes de cada clienta." }
  ]
}$json$::jsonb),
('cta', 8, true, $json${
  "title": "Tus próximas uñas favoritas están a un clic",
  "subtitle": "Elige tu horario ahora y llega directo a consentirte.",
  "buttonLabel": "Reserva tu cita"
}$json$::jsonb),
('contact', 9, true, $json${
  "title": "Visítanos o escríbenos",
  "subtitle": "Atendemos únicamente con cita previa.",
  "showHours": true
}$json$::jsonb),
('footer', 10, true, $json${
  "tagline": "Uñas impecables, cuidado de verdad.",
  "copyright": "Todos los derechos reservados."
}$json$::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Documentos legales (texto inicial, editable desde el dashboard)
-- -----------------------------------------------------------------------------
insert into public.legal_documents (slug, title, version, content_md) values
('privacidad', 'Política de Tratamiento de Datos Personales', '1.0', $md$
**Última actualización:** noviembre de 2026 · **Versión:** 1.0

En cumplimiento de la **Ley Estatutaria 1581 de 2012**, el **Decreto 1377 de 2013** (compilado en el **Decreto Único Reglamentario 1074 de 2015**) y demás normas que las modifiquen o complementen, se adopta la presente Política de Tratamiento de Datos Personales.

## 1. Responsable del tratamiento

- **Nombre o razón social:** [RAZÓN SOCIAL] (nombre comercial: Zephyr)
- **Identificación:** [NIT/CC]
- **Dirección:** [DIRECCIÓN], [CIUDAD], Colombia
- **Correo electrónico:** zephyr.contacto@gmail.com
- **WhatsApp:** 314 465 7351

## 2. Definiciones

Para efectos de esta política se aplican las definiciones del artículo 3 de la Ley 1581 de 2012: **titular** (persona natural cuyos datos son objeto de tratamiento), **dato personal**, **base de datos**, **tratamiento**, **responsable**, **encargado** y **autorización**.

## 3. Datos que recolectamos

Al reservar una cita o comunicarte con nosotros recolectamos:

- Nombre y apellido.
- Número de celular / WhatsApp.
- Correo electrónico (opcional).
- Servicios elegidos, fecha y hora de la cita, historial de citas y abonos.
- Observaciones que tú decidas compartir en las notas de la reserva (por ejemplo, preferencias de diseño).
- Datos técnicos mínimos necesarios para la seguridad del sitio (por ejemplo, la verificación anti-spam).

**No solicitamos datos sensibles.** Si en las notas decides contarnos información relacionada con tu salud (por ejemplo, alergias o condiciones de tus uñas) para que tomemos precauciones, entiendes que es **facultativo** responder y nos autorizas a tratarla únicamente con esa finalidad. No recolectamos datos de niñas, niños o adolescentes sin la autorización de su representante legal.

## 4. Finalidades del tratamiento

Tus datos se usan para:

1. Agendar, confirmar, reagendar, cancelar y recordar tus citas.
2. Verificar y registrar el abono y los pagos de los servicios.
3. Comunicarnos contigo por WhatsApp, llamada o correo sobre tu cita.
4. Gestionar saldos a favor, devoluciones, quejas y reclamos.
5. Llevar el historial de servicios para atenderte mejor.
6. Cumplir obligaciones legales, contables y tributarias.
7. Prevenir fraudes y el uso abusivo del sistema de reservas.
8. Con tu autorización adicional, enviarte promociones o novedades. Puedes retirar esta autorización en cualquier momento.

## 5. Derechos del titular

Como titular tienes derecho a (artículo 8 de la Ley 1581 de 2012):

- **Conocer, actualizar y rectificar** tus datos personales.
- **Solicitar prueba** de la autorización otorgada.
- **Ser informada** sobre el uso que se le ha dado a tus datos.
- **Presentar quejas** ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley, una vez agotado el trámite de consulta o reclamo ante nosotros.
- **Revocar la autorización** y/o **solicitar la supresión** de tus datos cuando no se respeten los principios, derechos y garantías legales, siempre que no exista un deber legal o contractual de conservarlos.
- **Acceder gratuitamente** a tus datos personales.

## 6. Procedimiento de consultas y reclamos

**Canales:** correo zephyr.contacto@gmail.com o WhatsApp 314 465 7351. Indica tu nombre, número de identificación o celular asociado, la descripción de tu solicitud y un medio de respuesta.

- **Consultas:** se responden en un término máximo de **diez (10) días hábiles** contados a partir de su recibo. Si no es posible atenderla en ese término, te informaremos los motivos y la fecha de respuesta, que no superará cinco (5) días hábiles adicionales.
- **Reclamos** (corrección, actualización, supresión o incumplimiento): se atienden en un término máximo de **quince (15) días hábiles** contados a partir del día siguiente a su recibo. Si el reclamo está incompleto, te pediremos completarlo dentro de los cinco (5) días siguientes; si pasan dos (2) meses sin respuesta, se entenderá desistido. Si no es posible atenderlo en ese término, te informaremos los motivos y la nueva fecha, que no superará ocho (8) días hábiles adicionales.

## 7. Seguridad y encargados

Aplicamos medidas técnicas, humanas y administrativas razonables para proteger tus datos contra pérdida, consulta, uso o acceso no autorizado. Usamos proveedores tecnológicos (alojamiento web y base de datos en la nube) que actúan como **encargados del tratamiento** y pueden ubicarse fuera de Colombia; con ellos exigimos niveles adecuados de protección conforme a la ley.

## 8. Autorización

Al marcar la casilla "Acepto la Política de Tratamiento de Datos" en el formulario de reserva, otorgas tu **autorización previa, expresa e informada** para el tratamiento de tus datos según esta política. Guardamos la fecha, la hora y la versión del documento aceptado como prueba de la autorización.

## 9. Vigencia

Esta política rige desde su publicación. Las bases de datos se conservarán mientras exista una relación comercial contigo y durante el tiempo necesario para cumplir obligaciones legales. Cualquier cambio sustancial se informará en este sitio web, indicando la nueva versión y fecha.
$md$),
('terminos', 'Términos y Condiciones de Uso', '1.0', $md$
**Última actualización:** noviembre de 2026 · **Versión:** 1.0

Estos términos regulan el uso de este sitio web, operado por [RAZÓN SOCIAL], identificada con [NIT/CC] (en adelante, "Zephyr"). Al navegar o reservar aceptas estos términos.

## 1. Objeto del sitio

El sitio permite conocer los servicios del salón, sus precios y reservar citas en línea. La información publicada (precios, duraciones, imágenes) es orientativa y puede cambiar; el precio aplicable es el que se muestra al momento de reservar.

## 2. Reservas

La reserva se rige por la **Política de Reservas, Abonos, Cancelaciones y Reagendamientos**, que forma parte de estos términos. Una cita solo se considera confirmada cuando Zephyr verifica el abono.

## 3. Uso adecuado

Te comprometes a suministrar información veraz y a no usar el sitio para reservas falsas, spam, suplantación o cualquier actividad ilícita. Zephyr puede cancelar reservas que evidencien abuso del sistema.

## 4. Propiedad intelectual

Los textos, fotografías, diseños, logotipos y demás contenidos del sitio pertenecen a Zephyr o se usan con autorización. No pueden reproducirse sin permiso previo y por escrito.

## 5. Fotografías de trabajos

Las imágenes de la galería muestran trabajos reales. El resultado de cada servicio puede variar según el estado de la uña natural, el diseño y los cuidados posteriores.

## 6. Responsabilidad

Zephyr procura que el sitio esté disponible y libre de errores, pero no garantiza su funcionamiento ininterrumpido. Informa en las notas de la reserva cualquier alergia o condición relevante para que podamos tomar precauciones.

## 7. Protección al consumidor

Nada en estos términos limita los derechos que te reconoce la **Ley 1480 de 2011 (Estatuto del Consumidor)**.

## 8. Datos personales

El tratamiento de tus datos se rige por nuestra **Política de Tratamiento de Datos Personales**.

## 9. Ley aplicable

Estos términos se rigen por las leyes de la República de Colombia. Contacto: zephyr.contacto@gmail.com · WhatsApp 314 465 7351.
$md$),
('reservas', 'Política de Reservas, Abonos, Cancelaciones y Reagendamientos', '1.0', $md$
**Última actualización:** noviembre de 2026 · **Versión:** 1.0

## 1. Cómo se reserva

1. Eliges tus servicios, la fecha y la hora entre los cupos disponibles.
2. Al enviar tus datos, el horario queda **apartado temporalmente** (por defecto, durante **2 horas**).
3. Pagas el **abono** y nos envías el comprobante por WhatsApp.
4. Cuando verificamos el abono, tu cita queda **confirmada**.

Si el tiempo de reserva temporal vence sin recibir el comprobante, la reserva **expira automáticamente** y el horario se libera.

## 2. Abono

- El abono es de **mínimo el 20 %** del valor total de los servicios, redondeado hacia arriba al múltiplo de $1.000 COP más cercano. El porcentaje vigente se muestra al reservar.
- El abono **se descuenta** del valor total el día de la cita.
- **Medios de pago:** Nequi, Daviplata y Llave (Bre-B), a nombre de la titular indicada en la confirmación de la reserva.
- **Comprobante:** envía la captura del pago por WhatsApp con tu código de reserva.

## 3. Inasistencia

**El abono no es reembolsable si no asistes a tu cita** sin haberla cancelado o reagendado con la anticipación indicada abajo. Ese horario se reservó exclusivamente para ti y no pudo ofrecerse a otra persona.

## 4. Cancelaciones

- Puedes cancelar desde el enlace privado de tu reserva **hasta 24 horas antes** de la hora de la cita.
- Si cancelas a tiempo, el abono queda como **saldo a favor** para una próxima cita (o se devuelve, si así lo indica la configuración vigente del salón al momento de cancelar).
- Con **menos de 24 horas** de anticipación no es posible cancelar ni cambiar la cita desde el sitio, y el abono no se devuelve. Si tienes una emergencia, escríbenos por WhatsApp y lo revisamos.

## 5. Reagendamientos

- Puedes cambiar la fecha u hora desde tu enlace privado **hasta 24 horas antes** de la cita, sujeto a disponibilidad.
- Se permite **1 reagendamiento** por reserva (o el número que indique la configuración vigente). Tu abono se conserva.

## 6. Retrasos

Te esperamos hasta **15 minutos**. Pasado ese tiempo podríamos acortar o ajustar el servicio para no afectar a la siguiente clienta, o tratarlo como inasistencia si no es posible atenderte.

## 7. Cambios del salón

Si por fuerza mayor debemos mover tu cita, te contactaremos para reprogramarla sin costo o, si lo prefieres, devolverte el abono completo.

## 8. Contacto

WhatsApp 314 465 7351 · zephyr.contacto@gmail.com
$md$),
('cookies', 'Aviso de Cookies', '1.0', $md$
**Última actualización:** noviembre de 2026 · **Versión:** 1.0

Este sitio **no usa cookies de analítica, publicidad ni seguimiento de terceros**.

Solo se usan elementos **estrictamente necesarios** para que el sitio funcione:

- **Preferencia de tema** (claro u oscuro), guardada en el almacenamiento local de tu navegador.
- **Verificación anti-spam (Cloudflare Turnstile)** en el formulario de reserva, que puede usar datos técnicos para distinguir personas de bots.
- **Sesión de la administradora**, únicamente en el panel privado del salón.

Como no hay cookies no esenciales, no se requiere tu consentimiento adicional. Si en el futuro incorporamos analítica, actualizaremos este aviso y te pediremos autorización.
$md$)
on conflict (slug) do nothing;
