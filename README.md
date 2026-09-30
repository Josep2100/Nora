# Nora Business

**Nora Business** es un asistente inteligente orientado a pequeñas empresas. Centraliza conocimiento interno, documentos y tareas para que los equipos puedan consultar información y convertirla en acciones.

## Qué problema resuelve

La información de muchas pequeñas empresas está repartida entre documentos, correos, procedimientos y conversaciones. Nora crea un espacio empresarial donde el usuario puede:

- consultar la base de conocimiento con lenguaje natural;
- guardar procedimientos, manuales, FAQs y documentación;
- crear y gestionar tareas;
- revisar actividad reciente;
- mantener un espacio aislado por cuenta empresarial.

## Estado

**MVP / piloto.** Esta versión está preparada para demostraciones y validación con primeras empresas. Antes de usarla con datos empresariales reales deben completarse las revisiones de seguridad, privacidad y cumplimiento indicadas en `docs/SECURITY.md` y `docs/LAUNCH_CHECKLIST.md`.

## Arquitectura

```text
Navegador / PWA
      │
      ▼
Express + sesiones
      │
      ├── Autenticación local / Google OAuth
      ├── Workspace Business
      ├── Base de conocimiento
      ├── Tareas y actividad
      └── Chat empresarial
             │
             ▼
          Gemini API
             │
             ▼
   Contexto empresarial autorizado
```

La información de una empresa se mantiene asociada a su cuenta en el backend. En producción se recomienda usar Supabase/PostgreSQL y `SUPABASE_SERVICE_ROLE_KEY` únicamente en el servidor.

## Funcionalidades del MVP

- Dashboard empresarial responsive.
- Autenticación local y Google OAuth.
- Workspace empresarial por cuenta.
- Nombre y sector de empresa configurables.
- Base de conocimiento con texto y archivos TXT/MD/CSV/JSON.
- Chat de Nora con contexto empresarial.
- Protección básica frente a prompt injection en el contenido documental.
- Tareas con prioridad, fecha y estado.
- Actividad reciente.
- PWA instalable.
- Separación de contenido por usuario/workspace.
- Rate limiting básico en autenticación.
- Headers de seguridad y cookies de sesión `httpOnly`.

## Desarrollo local

```bash
npm install
npm run check
npm start
```

Abrir `http://localhost:3000`.

## Variables de entorno

Copia `.env.example` a `.env` y configura, como mínimo para una instalación gestionada:

- `SESSION_SECRET`
- `DATA_ENCRYPTION_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

Google OAuth es opcional. Nunca publiques `.env` ni claves privadas.

## Documentación

- `docs/PRODUCT.md` — definición del producto y cliente objetivo.
- `docs/BUSINESS_MODEL.md` — modelo comercial y estrategia de validación.
- `docs/SECURITY.md` — controles actuales y pendientes antes de producción.
- `docs/ROADMAP.md` — evolución de MVP a SaaS empresarial.
- `docs/LAUNCH_CHECKLIST.md` — lista de comprobación previa al primer cliente real.
- `docs/SALES.md` — guion para conseguir pilotos.
- `PROPUESTA_VENTA.md` — propuesta comercial actualizada.

## Limitaciones conocidas del MVP

- La cuenta empresarial actual tiene un único miembro activo.
- Las invitaciones y permisos por empleado están planificados para la siguiente fase.
- La carga de archivos está limitada a formatos de texto; PDF/Office requieren una fase posterior de extracción y RAG.
- La búsqueda documental actual envía un contexto limitado a Gemini; no es todavía un sistema RAG con embeddings/vector DB.
- No se debe introducir información altamente sensible, contraseñas, claves API ni secretos.
- Los textos legales incluidos son provisionales y deben ser revisados profesionalmente antes de operar comercialmente.

## Seguridad

Lee `docs/SECURITY.md` antes de desplegar. En particular, no uses una instalación local basada en archivos como almacenamiento de producción para datos empresariales.
