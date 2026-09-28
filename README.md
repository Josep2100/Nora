# Nora — versión profesional

## Estructura

```text
/
├─ server.js
├─ storage.js
├─ gemini.js
├─ package.json
├─ package-lock.json
├─ render.yaml
├─ supabase_schema.sql
├─ security-bot.js
├─ test/
│  └─ core.test.js
└─ public/
   ├─ index.html
   ├─ app.js
   ├─ styles.css
   ├─ manifest.json
   ├─ manifest.webmanifest
   ├─ sw.js
   ├─ icon.svg
   ├─ icon-192.png
   ├─ icon-512.png
   ├─ privacidad.html
   └─ terminos.html
```

## Cambios principales

- Dashboard comercial con Agenda, Rutinas, Familia, Bienestar, Lista de compra, Actividad reciente y chat.
- Chat accesible permanentemente desde la pantalla principal.
- Nora utiliza un tono formal y profesional.
- Los recordatorios se ejecutan de forma determinista antes de consultar la IA.
- Se interpretan expresiones como «mañana a las 15», «hoy a las 18:30», «el viernes a las 9» y «el 3 de octubre a las 10».
- El recordatorio guarda fecha y hora cuando se proporcionan.
- Se eliminan respuestas informales del flujo principal.
- Se mantiene autenticación, Supabase/PostgreSQL, PWA, voz, cámara, memoria y lista de compra.

## Desarrollo local

```bash
npm install
npm run check
npm start
```

Abrir `http://localhost:3000`.

## Render

El servicio usa `npm start` y sirve el frontend desde `public/`. Configura las variables secretas indicadas en `render.yaml`.

Nunca publiques `.env`, claves de Gemini, secretos de sesión ni `SUPABASE_SERVICE_ROLE_KEY`.
