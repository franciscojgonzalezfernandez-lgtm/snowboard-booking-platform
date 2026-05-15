# PRD — Plataforma de Reservas de Clases de Snowboard

**Versión:** 1.1 · MVP
**Fecha:** 2026-05-14
**Owner:** Javi (admin + instructor principal)
**Stack tecnológico:** Next.js 15 · TypeScript · Prisma · Better Auth · Stripe · Resend · Vercel

> **Producto/negocio.** La arquitectura técnica, modelo de datos, integraciones externas y ADRs viven en [`Architecture.md`](./Architecture.md). El backlog operativo vive en [`FEATURES.md`](./FEATURES.md). Las reglas operativas para el agente viven en [`../CLAUDE.md`](../CLAUDE.md).

---

## 1. Resumen Ejecutivo

Plataforma web para la reserva de **clases privadas de snowboard** en una única estación suiza. Operada inicialmente por un solo instructor (el owner), arquitecturada desde el día uno para soportar múltiples instructores en fases posteriores. Modelo de negocio simple: la escuela vende clases privadas para grupos de 1 a 4 personas con duraciones predefinidas, cobra al reservar mediante Stripe (Card, TWINT, Apple Pay, Google Pay), y aplica una política de cancelación basada en crédito en cuenta (no reembolsos en cash) válida por un año.

La aplicación combina una **landing pública marketing-first** con estética editorial/premium, optimizada para SEO multi-idioma (EN, DE, ES), con un **panel de gestión interno en inglés** para instructores y administración.

**KPIs clave del MVP:**
- Tasa de conversión visitor → reserva confirmada
- Tiempo medio de completion del flujo de reserva (objetivo < 3 min)
- Tasa de uso de créditos sobre cancelaciones
- Net Promoter Score post-clase

---

## 2. Contexto y Objetivos

### 2.1 Por qué este producto

Las plataformas de reserva genéricas (Bókun, Peek, FareHarbor) son funcionales pero genéricas, con UX poco diferenciada y altas comisiones. Las escuelas de snowboard pequeñas e independientes carecen de una solución que respete la identidad de marca premium característica de la industria outdoor/wellness suiza y que ofrezca un flujo de reserva sin fricción para clientela internacional multi-idioma.

### 2.2 Objetivos del MVP

| Objetivo | Métrica de éxito |
|---|---|
| Permitir reservas online sin intervención manual | 100% del flujo automatizado de fecha a confirmación |
| Reducir no-shows y cancelaciones tardías | Política de cancelación claramente comunicada en UI |
| Maximizar reseñas en Google | CTA primario en email post-clase |
| Operar legalmente bajo marco suizo | T&C claros, opt-in GDPR/nLPD, datos en CH/UE |
| Permitir crecimiento a multi-instructor | Modelo de datos preparado, UI lista para N instructores |

### 2.3 No-objetivos del MVP

- No es un marketplace multi-escuela
- No incluye reserva de equipamiento ni alquiler
- No incluye seguros (gestionados offline por la escuela)
- No incluye gestión de nóminas/pagos a instructores (offline)
- No incluye clases grupales abiertas (solo privadas)
- No incluye reservas de glaciar verano ni indoor (solo invierno)
- No incluye app móvil nativa (web responsive PWA-ready)

---

## 3. Usuarios y Roles

### 3.1 Personas

**Booker (alumno o quien paga)**
- Turista internacional o residente suizo
- Edad 18-65
- Compra clase para sí o para terceros (familia, amigos)
- Espera comunicación en su idioma (EN, DE, ES)
- Mobile-first: 70% del tráfico esperado desde móvil

**Attendee**
- La persona que recibe la clase
- Puede ser el booker o un tercero (hijo, pareja, amigo)
- No requiere cuenta
- Solo aporta: nombre, fecha de nacimiento, nivel

**Instructor**
- Empleado de la escuela
- En MVP: el owner como instructor único
- Necesita ver agenda, marcar disponibilidad, ver alumnos del día
- Interfaz en inglés exclusivamente

**Admin**
- En MVP: el owner en su segundo rol
- Necesita CRUD instructores, gestión de temporadas y reservas, cancelación operativa
- Interfaz en inglés exclusivamente

### 3.2 Modelo de roles

Un mismo `User` puede tener múltiples roles (`student`, `instructor`, `admin`) almacenados como enum array. El header de la app autenticada muestra un selector contextual cuando hay varios roles activos.

| Rol | Acceso |
|---|---|
| `student` | `/dashboard/*` + flujo de reserva con auth gate |
| `instructor` | `/instructor/*` (EN only) |
| `admin` | `/admin/*` (EN only) |
| Multi-rol | Selector contextual en header |

---

## 4. Alcance del MVP

### 4.1 Incluido

- **Landing pública** multi-idioma (EN, DE, ES) con SEO completo
- **Flujo de reserva** público de 5 pasos con calendario smart
- **Auth** con email+password + magic link de verificación + Google OAuth
- **Dashboard alumno** para ver reservas, cancelar y gestionar créditos
- **Vista instructor** con agenda diaria, gestión de disponibilidad, perfil
- **Panel admin** con CRUD instructores, gestión de reservas, temporadas, cancelación de día completo
- **Pagos** con Stripe Payment Element (Card, TWINT, Apple Pay, Google Pay)
- **Créditos en cuenta** generados automáticamente en cualquier cancelación
- **Emails** transaccionales: confirmación, recordatorio 24h, post-clase con CTA review+propina
- **Calendar sync**: `.ics` adjunto en email + Google Calendar API para instructor
- **Blog** MDX integrado para SEO/content marketing
- **Analytics** y monitoring (Vercel Analytics, Speed Insights, Sentry)

### 4.2 Explícitamente fuera del MVP (futuras versiones)

| Feature | Versión objetivo |
|---|---|
| Refunds reales en cash (en lugar de solo crédito) | v1.1 (requiere review legal) |
| Métricas avanzadas en admin (dashboards analíticos) | v1.1 |
| UI para procesar refunds desde admin | v1.1 (Stripe Dashboard manual hasta entonces) |
| Notificaciones SMS | v1.1 (Twilio) |
| Newsletter marketing | v1.2 |
| Reserva de equipamiento | v1.2 |
| Programa de fidelización | v2.0 |
| App móvil nativa | v2.0 |
| Multi-estación | v2.0 |
| Marketplace de instructores externos | v2.0 |

---

## 5. User Stories Principales

### 5.1 Reserva exitosa (happy path)

> Como **turista interesado en aprender snowboard**, quiero **reservar una clase privada de 2 horas para mí y un amigo el sábado por la mañana**, para **garantizar nuestro espacio antes de viajar a Suiza**.

**Pasos:**
1. Llega a la home desde Google (SEO orgánico o anuncio)
2. Clica "Reservar tu clase"
3. Selecciona duración 2h + idioma preferido EN
4. Ve el calendario smart: sábados con disponibilidad marcados activos
5. Clica el próximo sábado disponible
6. Ve 4 anchor times (09:00, 11:00, 13:00, 15:00) con instructores disponibles
7. Selecciona "11:00 con cualquiera disponible"
8. Auth gate: se registra con Google OAuth
9. Añade attendee 2 (su amigo) con nombre + fecha nacimiento + nivel
10. Confirma datos, acepta T&C en nombre del grupo
11. Paga con tarjeta (no está en Suiza, no ve TWINT)
12. Recibe email de confirmación con `.ics` adjunto
13. Importa el `.ics` a su Google Calendar

### 5.2 Cancelación por usuario con crédito

> Como **alumno con una reserva confirmada**, quiero **cancelar mi reserva porque me han cambiado las fechas del viaje**, esperando **recuperar el dinero en forma de crédito para usar más adelante**.

**Pasos:**
1. Entra a `/dashboard/reservas`
2. Clica la reserva, ve botón "Cancelar reserva"
3. Modal explica: "Recibirás CHF 280 en crédito válido hasta [fecha+1 año]"
4. Confirma cancelación
5. Recibe email de confirmación con el balance de créditos
6. El admin recibe email de notificación
7. El slot vuelve a estar disponible para otros alumnos

### 5.3 Uso de crédito en nueva reserva

> Como **alumno con CHF 280 de crédito**, quiero **aplicar mi crédito a una nueva reserva de CHF 350**, para **pagar solo la diferencia con tarjeta**.

**Pasos:**
1. Completa Steps 1-4 de reserva normal
2. En Step 5 ve: "Tienes CHF 280 disponible. ¿Aplicar a esta reserva?"
3. Activa el toggle
4. UI muestra: "Pagas CHF 70 con tarjeta, CHF 280 con crédito"
5. Stripe Payment Element solo cobra CHF 70
6. Al confirmarse el pago, el crédito queda marcado como usado

### 5.4 Cancelación operativa por clima

> Como **admin**, quiero **cancelar todas las reservas de mañana porque las pistas estarán cerradas por avalancha**, para **generar automáticamente créditos a todos los afectados y notificarlos**.

**Pasos:**
1. Entra a `/admin/reservas`
2. Selecciona fecha → "Cancel day (ops)"
3. Indica razón "weather" + mensaje opcional
4. Preview: "This will cancel 7 bookings (CHF 1820 in credits will be issued)"
5. Confirma
6. El sistema procesa en lote: actualiza bookings, crea créditos, manda emails en cada idioma del booker, elimina eventos de Google Calendar

### 5.5 Instructor revisa su día

> Como **instructor**, quiero **ver en mi tablet de mañana qué clases tengo y con qué alumnos**, para **preparar el día**.

**Pasos:**
1. Entra a `/instructor`
2. Ve "Today, [fecha]" con timeline visual de sus clases
3. Cada clase muestra: hora, duración, attendees (nombres, edades, niveles), notas del booker
4. Si necesita ver detalle, clica una clase y ve modal con info ampliada

---

## 6. Requisitos Funcionales Detallados

### 6.1 Búsqueda de disponibilidad ("Calendario Smart")

**Endpoint:** `GET /api/availability/calendar`

**Parámetros:**
- `duration` (enum: `ONE_HOUR | TWO_HOURS | INTENSIVE | FULL_DAY`)
- `language` (enum: `en | de | es`)
- `monthFrom` (ISO date)
- `monthTo` (ISO date, max 3 meses desde `monthFrom`)

**Lógica:**
1. Filtrar `Season` activas que cubran el rango
2. Para cada día del rango, verificar:
   - Hay al menos un `Instructor` activo que habla `language`
   - Existe al menos un anchor time donde:
     - `instructor.availabilityBlock` cubre el rango `[anchor, anchor + duration]`
     - No hay `Booking` confirmado solapando ese instructor en ese rango
     - El rango respeta `season.operatingHoursStart` y `operatingHoursEnd`
     - Si la fecha es < 24h desde ahora: verificar `instructor.acceptsSameDayIfBooked` AND existe otra booking ese día para ese instructor
3. Retornar array de `{ date, hasAvailability: boolean, instructorCount: number }`

**Fallback "fechas cercanas":**
- Si el usuario clica un día sin disponibilidad, llamar `/api/availability/nearby?date=X&duration&language` que retorna las 3-5 fechas más cercanas con disponibilidad (window: ±14 días)

**Performance:**
- Para MVP con 1-4 instructores: query directo aceptable
- A futuro: vista materializada o cache Redis por `(date, duration, language)`

### 6.2 Selección de slot e instructor

**Endpoint:** `GET /api/availability/slots`

**Parámetros:**
- `date` (ISO date)
- `duration` (enum)
- `language` (enum)

**Respuesta:**
```json
{
  "anchorTimes": [
    {
      "time": "09:00",
      "available": true,
      "instructors": [
        { "id": "...", "name": "...", "photo": "...", "specialties": [...] }
      ]
    },
    ...
  ]
}
```

**Lógica:**
- Para cada anchor time del día (definido en `Season.anchorTimes`):
  - Verificar si `anchor + duration` cabe en `operatingHoursEnd`
  - Listar instructores compatibles (idioma, sin booking solapante, dentro de su `availabilityBlock`)
  - Aplicar buffer de 10 min entre clases consecutivas del mismo instructor

**UX:**
- Opción "Cualquiera disponible" preseleccionada por defecto
- Si "cualquiera": el backend asigna en orden de prioridad: por idioma exacto → por menor carga del día → round-robin

### 6.3 Auth gate y datos de attendees

**Step 4 del flujo:** auth gate antes de capturar datos.

**Si no autenticado:**
- Mostrar modal con tabs `[Login] [Registrarme]`
- Login: email+password (con magic link de verificación si no verificado) o Google OAuth
- Registro: email+password con verificación obligatoria por magic link antes de continuar
- En todos los casos: una vez auth completado, volver al flujo (estado preservado en URL o sessionStorage)

**Captura de datos:**
- Booker (= user autenticado): nombre prefilled, editable
- Attendees 1-4: para cada uno → `name`, `birthDate` (date picker), `level` (4 opciones), `isBooker` (checkbox para indicar si el booker es uno de los attendees)
- Notas opcionales (`Booking.notes`): texto libre 0-500 chars
- Aceptación T&C (checkbox obligatorio)

**Validación:**
- Al menos 1 attendee
- Máximo 4 attendees
- Booker debe estar en attendees si activa "I'm one of the participants"
- Edades: niños < 8 requieren warning explícito
- Todos los attendees deben tener nivel asignado

### 6.4 Pagos con Stripe

**Métodos habilitados:**
- Card (Visa, Mastercard, AmEx) - universal
- TWINT (solo CHF + IP suiza)
- Apple Pay (devices compatibles)
- Google Pay (devices compatibles)

**Flujo:**
1. Frontend: crear `PaymentIntent` server-side con `amount = totalPrice - creditsApplied`
2. Renderizar Stripe Payment Element (auto-detecta país/divisa)
3. Confirmar pago client-side
4. Webhook `payment_intent.succeeded` en `/api/webhooks/stripe`:
   - Verificar firma webhook
   - Actualizar `Booking.status = CONFIRMED`
   - Commit créditos aplicados (status = `used`)
   - Bloquear `AvailabilityBlock` para el slot
   - Encolar email de confirmación
   - Si instructor.calendarConnected: insertar evento en su Google Calendar
5. Webhook `payment_intent.payment_failed`:
   - Marcar `Booking.status = PAYMENT_FAILED`
   - Liberar locks de créditos
   - No enviar email (Stripe maneja la comunicación de fallo)

**Edge cases:**
- Crédito >= total: no se crea PaymentIntent, booking se confirma directamente
- Webhook delay > 30 min: cron de cleanup libera locks de créditos huérfanos

### 6.5 Cancelaciones

**Por usuario:**
- Validaciones: booking.bookerId === session.user.id, status === CONFIRMED, startDateTime > now
- Transacción Prisma:
  - `booking.status = CANCELLED_BY_USER`, `cancelledByUserAt = now`
  - Liberar `AvailabilityBlock`
  - Crear `AccountCredit` con `reason='user_cancel'`, `expiresAt = now + 1y`
  - Eliminar evento Google Calendar si existe
- Emails async: a booker (confirmación) y a instructor (notificación)
- No se permite cancelar < 1h antes del slot (forzar contacto telefónico)

**Por operaciones (admin):**
- Modal "Cancel day": date picker + reason (enum: weather, closed_slopes, other) + mensaje opcional
- Preview del impacto antes de confirmar (número de bookings + total CHF en créditos)
- Misma lógica de transacción aplicada en batch
- Emails en el locale de cada booker (no en el del admin)

### 6.6 Sistema de créditos

**Generación:** automática en cualquier cancelación (user o ops). Monto = `totalPriceCents` original.

**Uso:**
- En Step 5 (pago) si user autenticado y tiene créditos activos:
  - Query: `accountCredit WHERE userId AND status='active' AND expiresAt > now ORDER BY expiresAt ASC`
  - UI muestra balance total + toggle "Aplicar créditos"
  - Lock al crear PaymentIntent (status pasa a `locked` con `lockedByBookingId`)
  - Commit al webhook success (status pasa a `used`)
  - Si cubre todo el total: no Stripe transaction, booking confirma directo

**Expiración:**
- Cron mensual `0 0 1 * *`: marca como `expired` los créditos `active` con `expiresAt < now`
- Email opcional al usuario 30 días antes de expirar (v1.1)

### 6.7 Emails transaccionales

| Email | Trigger | Locale | Contenido |
|---|---|---|---|
| Confirmación de reserva | Stripe webhook success | locale del booker | Detalles + `.ics` adjunto + link al dashboard |
| Recordatorio 24h | Cron horario @ T-24h | locale del booker | Hora, instructor, qué traer, link a cancelar |
| Post-clase | Cron horario @ T+2h después del slot | locale del booker | Foto hero + texto cuidado + CTA review Google (primario) + CTA propina (secundario) |
| Cancelación user | Cancelación procesada | locale del booker | Confirmación + balance de créditos |
| Cancelación ops | Cancelación operativa procesada | locale del booker | Razón + crédito generado + link a nueva reserva |
| Notif instructor cancelación | Cancelación procesada | EN | Booking cancelada por X razón |
| Verificación email | Registro o cambio email | locale | Magic link de verificación |

**Stack:** Resend + React Email. Templates como componentes React tipados.
**Bloqueante semana 1:** verificación de dominio en Resend.

### 6.8 Calendar sync

**Para alumnos:** archivo `.ics` adjunto al email de confirmación. Generado server-side con la librería `ics`. Incluye `UID` único (`booking.icsUid`) para que actualizaciones reemplacen el evento en lugar de duplicar.

**Para instructores:**
- En `/instructor/perfil`: botón "Connect Google Calendar"
- OAuth flow con scopes: `https://www.googleapis.com/auth/calendar.events`
- Solicitar `access_type=offline` y `prompt=consent` para obtener refresh token
- Almacenar refresh token encriptado en `Instructor.googleRefreshToken`
- En cada `Booking` confirmado: insertar evento via `events.insert` con summary, descripción (attendees, nivel, notas), location (estación)
- En cancelación: `events.delete`

---

## 7. Requisitos No Funcionales

### 7.1 Performance

- **TTFB:** < 200ms en rutas estáticas (ISR cuando aplicable)
- **LCP:** < 2.5s en home y páginas marketing
- **CLS:** < 0.1
- **API availability search:** < 500ms p95
- **Imágenes:** Next/Image con AVIF + WebP, lazy loading
- **Bundle JS:** < 200KB gzipped en home (excluyendo polyfills)

### 7.2 Accesibilidad

- WCAG 2.1 AA en todas las páginas públicas
- Tab navigation completa en flujo de reserva
- Contraste mínimo 4.5:1 (texto normal) / 3:1 (texto large)
- Labels explícitos en todos los form inputs
- Alt text en todas las imágenes

### 7.3 SEO

- Sitemap dinámico con `hreflang` para los 3 idiomas
- Robots.txt configurado por entorno
- Structured data `Schema.org/LocalBusiness` con datos de la escuela
- Meta tags + Open Graph + Twitter Card por página
- URLs limpias con slugs traducidos (`/de/instruktoren/[slug]`, `/es/instructores/[slug]`)
- Canonical URLs correctas
- Server-rendered content (no client-only para SEO)

### 7.4 Seguridad

- HTTPS only (Vercel default)
- CSRF protection en mutaciones (Better Auth integrado)
- Rate limiting en endpoints sensibles (auth, availability, webhook)
- Validación con Zod en client y server
- Secrets en variables de entorno (nunca en repo)
- Refresh tokens de Google Calendar encriptados (AES-256-GCM con key en env)
- Stripe webhook signature verification obligatoria
- Headers de seguridad: CSP, X-Frame-Options, HSTS

### 7.5 Privacidad y compliance

- Conforme a nLPD (Suiza) y GDPR (UE)
- Cookie banner no necesario (Vercel Analytics no usa cookies de tracking)
- Privacy policy completa en `/privacidad`
- Datos personales mínimos (no health, no financial more than necessary)
- Stripe almacena PCI data, nuestra DB nunca
- Right to deletion: endpoint admin para borrar usuario + cascade
- Data retention: bookings se mantienen para registros contables; data personal de attendees menores eliminable

### 7.6 Internacionalización

- next-intl con 3 locales: EN (default), DE, ES
- Detección automática por `Accept-Language` con fallback a EN
- Prefix path: `/`, `/de/`, `/es/` (EN sin prefix por SEO en mercado anglo)
- Mensajes en JSON por locale en `messages/`
- Fechas/horas: `Intl.DateTimeFormat` con `timeZone: 'Europe/Zurich'`
- Moneda: siempre CHF, formato suizo (`CHF 280.00` con apóstrofo como separador de miles para DE)

### 7.7 Observabilidad

- Sentry: error tracking en frontend + backend, source maps subidos en build
- Vercel Analytics: page views, vitals
- Vercel Speed Insights: real-user monitoring de Core Web Vitals
- Logs de Stripe webhooks persistidos en BD (`emailLog` extendido a `eventLog`) para audit

---

## 8. Arquitectura Técnica

> Movido a [`Architecture.md`](./Architecture.md): stack confirmado, estructura del proyecto y principios arquitectónicos (server-first, edge, type-safety, booking engine aislado, transactional integrity, idempotencia de webhooks).

---

## 9. Modelo de Datos

> Movido a [`Architecture.md` §4](./Architecture.md#4-modelo-de-datos): tablas Better Auth, tablas de dominio (instructor, availabilityBlock, season, booking, attendee, accountCredit, tip) y enums (Locale, Role, Duration, Level, BookingStatus, AvailabilityKind, CreditReason, CreditStatus).
>
> **Mapping duraciones:** `ONE_HOUR=1h, TWO_HOURS=2h, INTENSIVE=4h, FULL_DAY=6h`.

---

## 10. Páginas y Rutas

Ver Diagrama 4 (Estructura de páginas públicas + home) en el documento de discovery.

**Resumen:**

| Categoría | Path | Idioma | Auth requerido |
|---|---|---|---|
| Marketing | `/[locale]/` | 3 | No |
| Booking | `/[locale]/reservar/*` | 3 | Step 4+ |
| Auth | `/[locale]/(login\|registro\|verificar\|recuperar)` | 3 | No |
| Dashboard | `/[locale]/dashboard/*` | 3 | `student` |
| Instructor | `/instructor/*` | EN | `instructor` |
| Admin | `/admin/*` | EN | `admin` |

---

## 11. Integraciones Externas

> Movido a [`Architecture.md` §5](./Architecture.md#5-integraciones-externas). Resumen: Stripe (pagos) y Resend (emails) requieren URL pública → su setup va a Sprint 1.5 post-deploy a Vercel. Google OAuth se inicia en Sprint 0 con callback `localhost`; la URL de Vercel se añade al callback list en Sprint 1.5.

---

## 12. Roadmap de Implementación

> El roadmap de alto nivel vive aquí; el desglose en tickets accionables (con AC, dependencias, Playwright, estado) vive en [`FEATURES.md`](./FEATURES.md). Sprint 1.5 (servicios externos post-deploy) está documentado allí.

### Sprint 0 — Setup (semana 1)
- Crear proyecto Next.js 15 + TypeScript + Tailwind
- Configurar Prisma + Neon + schema inicial
- Configurar Better Auth (email+pwd + magic link + Google)
- Configurar Resend + verificación dominio
- Configurar Stripe + activar TWINT
- Configurar Sentry, Vercel Analytics
- CI/CD básico (Vercel deploy preview en PRs)
- CLAUDE.md y skills (Impeccable + Playwright) configuradas

### Sprint 0.5 — Home + Login visibles (pre-Sprint 1, repriorización)

> Pulled forward from Sprint 5 so the owner can manually validate sessions, locale routing and brand direction before the booking engine work begins. Out of scope: full marketing landing (still Sprint 5), booking wizard, instructor/admin views.

- Reprioritization in `FEATURES.md` (F-028)
- Reset `app/globals.css` to a neutral baseline + drop the placeholder Cormorant Garamond import (F-028b) so the design phase isn't biased
- Design exploration: 3 greenfield HTML hi-fi mockups (home + login) via `huashu-design`; owner picks one (F-029)
- Design tokens + `docs/design-system.md` via `impeccable` (oklch palette, type scale, spacing, motion) + fonts reintroduced in `app/layout.tsx` (F-030)
- `next-intl` scaffolding: `[locale]` segment, `middleware.ts`, `messages/{en,de,es}.json` (F-031). English slugs (`/en/login`, `/de/login`, `/es/login`); translated slugs deferred to Sprint 5 via `pathnames` config
- Home page minimal en `app/[locale]/page.tsx` × 3 locales — hero + "Book a lesson" CTA + Sign in + language switcher (F-032)
- Login moved to `app/[locale]/login/` × 3 locales, auth wiring (better-auth client, `auth.api.getSession`) intact (F-033)
- Playwright E2E: home + login × 3 locales, language switcher, redirect-on-session (F-034)
- Cross-ref Section 10 (route table) — final URLs land here

### Sprint 1 — Core booking engine (semanas 2-3)
- `lib/booking-engine/` con algoritmo availability y tests unitarios completos
- Modelo de datos completo (todas las tablas + seed data: 1 instructor = yo, 1 season activa)
- Endpoint `/api/availability/calendar` y `/api/availability/slots`
- UI Steps 1-3 de reserva

### Sprint 2 — Auth y pagos (semanas 4-5)
- Auth completo: login, registro, magic link, Google OAuth, dashboard alumno
- Step 4 (booker + attendees) con auth gate
- Step 5 (pago) con Stripe Payment Element
- Webhook handler con tests
- Emails: confirmación, recordatorio (cron), post-clase (cron)
- `.ics` generation
- Página de éxito `/reservar/exito/[id]`

### Sprint 3 — Cancelaciones y créditos (semana 6)
- Flujo de cancelación por usuario (dashboard + lógica + emails)
- Sistema de créditos: generación, uso, locking, FIFO
- UI de aplicar créditos en Step 5
- Cron mensual de expiración

### Sprint 4 — Vista instructor y admin (semanas 7-8)
- Vista instructor: agenda, marcar disponibilidad, perfil, conectar Google Calendar
- Google Calendar API integration: events.insert, delete
- Panel admin: CRUD instructores, ver reservas, cancelar día (ops)
- Email de notificación a instructor en cancelaciones

### Sprint 5 — Landing y SEO (semanas 9-10)
- Home editorial completa (sections, instructor teaser, etc.) — la home **minimal** ya existe desde Sprint 0.5 (F-032); aquí se expande con la narrativa editorial
- Página de instructores y perfiles individuales
- Página de precios
- Blog MDX con primeros 2-3 posts
- Páginas estáticas: sobre, contacto, FAQ, T&C, privacidad
- SEO completo: sitemap dinámico, structured data, hreflang, OG images
- next-intl ya scaffolded en Sprint 0.5 (F-031); aquí se añaden **slugs traducidos** vía `pathnames` (`/es/iniciar-sesion`, `/de/anmelden`, etc.) y mensajes para el resto del producto

### Sprint 6 — Polish y QA (semanas 11-12)
- E2E tests Playwright para flujos críticos (happy path + cancelación + crédito)
- Visual review loop con Playwright para QA visual
- Accessibility audit (WCAG 2.1 AA)
- Performance audit (Lighthouse > 95 en mobile)
- Soft launch interno
- Producción

**Total estimado:** 12 semanas para MVP funcional, asumiendo trabajo focused (single developer).

---

## 13. Riesgos y Decisiones Pendientes

### 13.1 Riesgos identificados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Modelo credit-only puede ser legalmente cuestionable en cancelaciones operativas | Alta | Review legal antes de producción; considerar refund cash automático en cancelación ops para v1.1 |
| Verificación dominio Resend con proveedores suizos (Infomaniak, Hostpoint) puede tardar | Media | Iniciar semana 1, no semana 8 |
| Google Calendar refresh token expiry sin user revoke | Media | Implementar retry con re-auth flow; logging exhaustivo |
| TVA umbral CHF 100k cruzado a futuro | Baja | Flag `vatEnabled` en config + precios en `priceInCents` desde día 1 |
| Conflictos de booking concurrentes (race condition en availability) | Media | Prisma transactions + DB-level constraint (índice único compuesto) |
| Stripe webhook delays > 30 min | Baja | Cron de cleanup de créditos huérfanos; UI muestra "procesando" |
| Performance del availability search con muchos instructores | Baja | Optimizar query + considerar cache Redis en v1.1 |

### 13.2 Decisiones pendientes (a revisar antes de producción)

- **Validación legal del modelo credit-only** en cancelación operativa
- **Place ID exacto de la escuela en Google Business Profile** para el CTA de review
- **Logo final de la marca** (afecta a OG images, favicons, email templates)
- **Fotografía hero de la home** (estética editorial, full-bleed, alta calidad)
- **Lista inicial de specialties** para instructores (e.g. "freestyle", "off-piste", "kids")
- **Política de propinas:** ¿se quedan 100% para el instructor o hay split con la escuela?
- **Precios concretos** por duración (no definidos en este PRD)

---

## 14. Métricas de Éxito

### 14.1 Producto

- **Conversión visitor → reserva:** baseline a definir post-launch, objetivo > 3% en mobile
- **Completion rate del flujo:** > 80% de quienes inician Step 1 llegan a Step 5
- **Tiempo medio del flujo:** < 3 minutos
- **Cancelación rate:** < 10% de bookings confirmados
- **Uso de créditos:** > 70% de los créditos generados se redimen antes de expirar

### 14.2 Marketing

- **Tráfico orgánico** desde Google: crecimiento mes-a-mes
- **Reviews en Google Business Profile:** > 20 reviews en primera temporada con rating > 4.5
- **CTR del email post-clase:** > 30% para CTA review, > 5% para CTA propina

### 14.3 Operación

- **Tiempo medio de respuesta admin a cancelaciones operativas:** < 1h
- **Uptime:** > 99.9% (objetivo SLA Vercel)
- **Error rate:** < 0.5% de requests resultan en error 5xx

---

## 15. Apéndice: Consideraciones suizas

### 15.1 Marco legal

- **nLPD (Nouvelle Loi sur la Protection des Données)** efectiva desde sep 2023: análoga a GDPR en muchos aspectos, requiere consentimiento explícito para procesamiento de datos personales, derecho a portabilidad y borrado
- **CO (Code des Obligations)** Art. 19: contratos no pueden imponer condiciones leoninas; cláusulas de cancelación deben ser razonables y comunicadas claramente
- **TVA Suiza:** umbral CHF 100k de facturación anual para registro obligatorio (8.1% tarifa estándar)

### 15.2 Métodos de pago

- **TWINT** es el método de pago móvil dominante (>5M usuarios en CH): casi imprescindible para clientela local
- **Cartes (Visa, MC)** universal
- **PostFinance Card** común pero declinante
- **Klarna y similares:** no típicos en deportes/turismo

### 15.3 Idiomas

- Idiomas nacionales: DE, FR, IT, RM
- EN obligatorio por turismo internacional
- DE-CH (Schweizerdeutsch) es hablado pero no escrito: usamos Standard German
- ES no es nacional pero hay demanda en mercado hispano (residentes + turismo LATAM/España)

### 15.4 Datos y hosting

- Vercel almacena datos en regiones globales por defecto
- Para máxima soberanía, considerar Vercel region `fra1` (Frankfurt) o Cloudflare Workers con bindings a R2 en EU
- Neon Postgres permite seleccionar región: usar `eu-central-1` (Frankfurt)

---

## Fin del PRD

**Documentos relacionados:**

- [`Architecture.md`](./Architecture.md) — stack, modelo de datos, integraciones, ADRs.
- [`FEATURES.md`](./FEATURES.md) — backlog vivo (tickets accionables).
- [`WORKFLOW.md`](./WORKFLOW.md) — workflow con subagentes y reglas Playwright per-feature.
- [`../CLAUDE.md`](../CLAUDE.md) — reglas operativas para el agente.
