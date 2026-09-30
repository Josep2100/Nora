# Seguridad

## Controles actuales

- Contraseñas con hash bcrypt.
- Rate limiting básico de autenticación.
- Cookies de sesión `httpOnly`, `sameSite=lax` y `secure` en producción.
- Headers de seguridad.
- CSP restrictiva para el frontend actual.
- `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- Cifrado AES-256-GCM del almacenamiento local.
- Validación de origen para mutaciones del workspace Business.
- Límites de tamaño para documentos y mensajes.
- Contexto documental tratado como contenido no confiable para reducir prompt injection.

## Pendientes antes de datos reales

1. Migrar workspace y documentos a tablas dedicadas con políticas y aislamiento por `company_id`.
2. Añadir membresías, invitaciones y RBAC real.
3. Añadir auditoría de seguridad con retención definida.
4. Implementar rate limiting específico para chat y subida de documentos.
5. Incorporar antivirus/validación de archivos si se añaden PDF/Office.
6. Añadir RAG con recuperación por fragmentos y control de fuentes.
7. Revisar gestión de secretos y rotación.
8. Revisar CSP con cualquier integración externa que se añada.
9. Pruebas de autorización entre cuentas y pruebas de fuga de datos.
10. Revisión legal de RGPD/LOPDGDD y contratos con proveedores.

## Reglas operativas

- No guardar contraseñas, claves API ni secretos en la base de conocimiento.
- No publicar `.env`.
- No usar `SUPABASE_SERVICE_ROLE_KEY` en navegador.
- Mantener backups cifrados y probar restauración.
- Separar entornos de desarrollo y producción.
