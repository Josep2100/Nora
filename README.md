# Nora

Nora es una PWA de asistencia personal con recordatorios, memoria de objetos, lista de la compra, voz, lectura de documentos y respuestas con Gemini.

## Requisitos

- Node.js 20 o superior
- Una base gestionada en producción: Supabase con `SUPABASE_SERVICE_ROLE_KEY` o PostgreSQL con `DATABASE_URL`
- Variables de entorno copiadas desde `.env.example`

## Desarrollo local

```powershell
npm install
npm run check
npm start
```

Abre <http://localhost:3000>. Para usar Google OAuth en local, configura la URL de callback local en la consola de Google.

## Producción

1. Crea una base Supabase nueva y ejecuta `supabase_schema.sql`.
2. Configura en el proveedor de hosting todas las variables de `.env.example`; nunca subas `.env`.
3. Usa secretos nuevos de al menos 32 caracteres para `SESSION_SECRET` y `DATA_ENCRYPTION_KEY`.
4. Configura `GOOGLE_CALLBACK_URL` con HTTPS y el dominio definitivo.
5. Configura `STRIPE_PAYMENT_LINK` solo después de transferir la cuenta de Stripe al comprador.
6. Ejecuta `npm run check` y comprueba `/api/health` tras el despliegue.

Render puede desplegar el proyecto con `render.yaml`. El servicio necesita una base gestionada y las variables marcadas como secretas en el panel del proveedor.

## Seguridad y datos

- `.env`, usuarios, eventos, copias y temporales están excluidos por `.gitignore`.
- Las contraseñas se almacenan con bcrypt y el archivo local de desarrollo se cifra.
- En producción la aplicación se detiene si no puede usar almacenamiento gestionado; no debe operar con persistencia local efímera.
- La clave `SUPABASE_SERVICE_ROLE_KEY` solo debe existir en el servidor.
- Las cuentas que entran con Google deben aceptar explícitamente privacidad y términos antes de usar sus datos.

## Transferencia comercial

Antes de entregar el proyecto, completa `VENTA_CHECKLIST.md`. En particular, rota las credenciales que hayan estado expuestas durante el desarrollo, transfiere los servicios externos y sustituye los textos legales provisionales por los datos de la entidad responsable.

La propuesta comercial recomendada, con precio, anuncio y procedimiento de escrow, está en `PROPUESTA_VENTA.md`.
