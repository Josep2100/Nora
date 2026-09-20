# Propuesta de venta de Nora

## Decisión comercial

- **Plataforma recomendada:** Flippa, categoría SaaS / software / aplicación web.
- **Enlace para crear el anuncio:** https://flippa.com/sell
- **Precio inicial:** **7.500 EUR** por el activo completo.
- **Negociación:** aceptar ofertas desde 5.500 EUR solo si el comprador paga sin financiación, asume la migración y no exige soporte prolongado.
- **Cierre:** escrow de la plataforma. No entregar el repositorio privado ni datos de producción antes de que los fondos estén asegurados según las condiciones del escrow.
- **Motivo del precio:** producto funcional con PWA, autenticación, IA, voz, visión, almacenamiento gestionado y documentación, pero sin métricas verificadas de ingresos, usuarios activos o retención aportadas en este momento.

## Qué se vende

- Código fuente de Nora y configuración de despliegue.
- Aplicación Node.js / Express lista para desplegar.
- Frontend PWA responsive.
- Recordatorios, memoria de objetos y lista de la compra.
- Integración Gemini para chat, voz, visión y podcast.
- Login local y Google OAuth.
- Esquema Supabase y documentación operativa.
- Checklist de seguridad, producción y transferencia.
- Una sesión de transferencia técnica de hasta 90 minutos.

## Qué no se entrega

- `.env`, contraseñas, claves API, tokens, cookies ni sesiones.
- Datos personales de usuarios, backups, logs o bases de datos del vendedor.
- Cuentas personales de Google Cloud, Gemini, Supabase, Stripe, Render o GitHub.
- Garantías de ingresos, cumplimiento legal o aprobación de proveedores externos.

## Método de transferencia

### 1. Firma y pago

1. Publicar el anuncio en Flippa con precio de 7.500 EUR.
2. Aceptar una oferta dentro del rango acordado.
3. Firmar un acuerdo de compraventa de activos digitales.
4. Abrir escrow y esperar confirmación de fondos.

### 2. Código y dominio

1. Crear un repositorio u organización propiedad del comprador.
2. Transferir el repositorio o entregar un bundle limpio sin secretos.
3. El comprador registra o crea el dominio a su nombre.
4. Si ya existe un dominio transferible, desbloquearlo y entregar el código de autorización después de confirmar el escrow.
5. El comprador configura DNS y HTTPS; el vendedor solo acompaña la operación.

### 3. Hosting

1. El comprador crea su equipo en Render u otro proveedor.
2. El comprador conecta el repositorio y crea el servicio con `render.yaml`.
3. El comprador introduce sus propias variables secretas.
4. Ejecutar `npm ci`, `npm run check` y comprobar `/api/health`.
5. Cambiar `GOOGLE_CALLBACK_URL` al dominio definitivo.

### 4. Supabase

1. El comprador crea un proyecto Supabase bajo su organización.
2. Ejecuta `supabase_schema.sql`.
3. No se transfieren usuarios reales del vendedor salvo acuerdo escrito y base legal válida.
4. Si hubiera datos autorizados, se exportan y migran con una copia verificada.
5. El comprador crea una nueva `SUPABASE_SERVICE_ROLE_KEY` y nunca la publica en el navegador.

### 5. Google OAuth

El método recomendado es que el comprador cree un proyecto OAuth propio en Google Cloud, configure el callback HTTPS y sustituya `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. No se entrega el secreto actual del vendedor.

### 6. Gemini

El comprador crea su propio proyecto o cuenta de API, genera una clave nueva y configura `GEMINI_API_KEY`. Debe asumir sus límites, facturación y políticas de uso.

### 7. Stripe

El comprador crea o usa su propia cuenta Stripe y genera su propio Payment Link. Después configura `STRIPE_PAYMENT_LINK`. No se transfiere la cuenta Stripe personal del vendedor.

## Anuncio listo para publicar

**Título:** Nora: PWA de asistente personal con IA, voz, memoria y lista de compra

**Descripción:**

Nora es una aplicación web progresiva en español para organización personal. Permite crear recordatorios por texto o voz, guardar dónde están objetos importantes, organizar la compra por pasillos, leer documentos con cámara y conversar con una asistente basada en Gemini. Incluye autenticación local y Google, almacenamiento Supabase, exportación de datos, calendario, PWA instalable, documentación de despliegue y configuración para Render.

Se entrega el código fuente, esquema de base de datos, configuración de producción, checklist de transferencia y una sesión técnica de entrega. La aplicación no incluye datos personales ni credenciales del vendedor. El comprador deberá crear sus propias cuentas y claves para hosting, base de datos, Google, Gemini y Stripe.

**Estado:** producto funcional validado localmente; no se aportan métricas de ingresos o usuarios activos verificadas. Precio inicial: 7.500 EUR.

## Condiciones que deben quedar por escrito

- Venta de activos digitales, no de cuentas personales.
- El comprador asume costes de hosting, base de datos, IA, dominio y pagos.
- El vendedor no garantiza ingresos ni disponibilidad de proveedores externos.
- Soporte incluido: una sesión de transferencia y 7 días para incidencias de instalación.
- Los textos legales deben ser revisados por el comprador antes de abrir el servicio al público.
