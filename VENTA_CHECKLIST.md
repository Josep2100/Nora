# Checklist de venta y lanzamiento

## Decisión comercial adoptada

- [x] Marketplace: Flippa, categoría SaaS / software.
- [x] Precio inicial: 7.500 EUR, con negociación documentada en `PROPUESTA_VENTA.md`.
- [x] Cobro: escrow de la plataforma antes de entregar código o accesos.
- [x] Transferencia: cuentas nuevas propiedad del comprador para dominio, hosting, Supabase, Google, Gemini y Stripe.

## Bloqueadores antes de publicar

- [ ] Revocar y regenerar `GEMINI_API_KEY`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` y cualquier otro secreto que haya aparecido fuera del gestor de secretos.
- [ ] Cambiar `SESSION_SECRET` y `DATA_ENCRYPTION_KEY` por valores nuevos y conservarlos en un gestor seguro.
- [ ] Crear un proyecto Supabase propiedad del comprador y ejecutar `supabase_schema.sql`.
- [ ] Migrar solo los datos autorizados; no entregar `data/`, copias ni logs personales.
- [ ] Configurar un dominio propio, HTTPS y `GOOGLE_CALLBACK_URL` de producción.
- [ ] Crear o transferir la cuenta de Stripe y configurar `STRIPE_PAYMENT_LINK`.
- [ ] Sustituir `public/privacidad.html` por una política legal revisada con identidad, contacto, base legal, conservación, encargados y derechos aplicables.
- [x] Añadido bloqueo y pantalla explícita de aceptación de privacidad y términos para usuarios que entren con Google.
- [ ] Revisar jurídicamente y sustituir los textos provisionales de privacidad y términos antes del lanzamiento.

## Comprobación técnica

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `GET /api/health` devuelve `ok: true` y almacenamiento gestionado.
- [ ] Registro, login, logout y Google OAuth funcionan en el dominio final.
- [ ] Crear, editar, completar y borrar tareas funciona.
- [ ] Memoria, lista de la compra, exportación JSON, calendario y borrado de cuenta funcionan.
- [ ] Voz, visión y respuestas Gemini funcionan con límites y fallback.
- [ ] Stripe redirige al enlace del comprador.
- [ ] Probar desde móvil y escritorio, incluido instalar la PWA.

## Entrega

- [ ] Entregar el código sin `.env`, `node_modules`, backups, logs ni datos reales.
- [ ] Entregar acceso o transferencia de Git, hosting, Supabase, Google Cloud, Gemini y Stripe.
- [ ] Entregar los secretos únicamente por un gestor seguro.
- [ ] Documentar dominio, DNS, despliegue, backups y procedimiento de recuperación.
- [ ] Confirmar quién asume soporte, privacidad, facturación y costes de API.
