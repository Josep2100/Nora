# Guía Oficial para Publicar Claryvo en la Microsoft Store

Esta guía contiene todo lo necesario para empaquetar, publicar y monetizar **Claryvo** en la **Microsoft Store** (Windows 10 y Windows 11).

---

## 1. Requisitos Previos

1. **Tu aplicación desplegada y online:**
   * URL de producción: `https://nora-asistente.onrender.com` *(o tu dominio personalizado)*.
2. **Cuenta de Desarrollador de Microsoft (Partner Center):**
   * Enlace de registro: [developer.microsoft.com/es-es/microsoft-store/register](https://developer.microsoft.com/es-es/microsoft-store/register)
   * Coste: Un único pago de aproximadamente **19 USD** para siempre (sin cuotas anuales ni renovaciones).

---

## 2. Cómo generar el paquete de Windows (.MSIX) en 2 minutos

Microsoft ofrece la herramienta oficial gratuita **PWABuilder** para convertir la PWA de Nora en una app nativa de Windows Store:

1. Entra en **[PWABuilder.com](https://www.pwabuilder.com)**.
2. En la casilla central, introduce la URL de tu aplicación:
   `https://nora-asistente.onrender.com`
3. Haz clic en **"Start"**.
4. PWABuilder analizará la aplicación (el manifiesto y service worker ya han sido preparados al 100%).
5. En la sección **"Windows"**, haz clic en **"Package" / "Generate"**.
6. Introduce los datos de tu cuenta de Partner Center:
   * **Package ID / Publisher ID:** Lo obtienes de tu panel de Microsoft Partner Center.
7. Haz clic en **"Download Package"**.
   * Descargarás un archivo `.zip` que contiene el paquete firmado `.msix` listo para subir a la tienda.

---

## 3. Ficha de la Tienda (Copiar y Pegar)

Al crear el envío en el **Microsoft Partner Center**, rellena los campos con estos textos optimizados:

### 📌 Título de la aplicación:
```text
Claryvo: La IA que convierte conocimiento en acción
```

### 📌 Descripción Corta (Resumen para la tienda):
```text
Asistente personal inteligente para Windows con control por voz en tiempo real, escaneo de documentos con cámara, baúl de recuerdos y organización diaria con IA.
```

### 📌 Descripción Completa:
```text
Claryvo es tu asistente inteligente diseñado para convertir el conocimiento de tu empresa en acciones desde Windows.

🌟 CARACTERÍSTICAS PRINCIPALES:

🎙️ CONTROL POR VOZ INSTANTÁNEO:
Habla con Claryvo de forma natural. Te responderá de inmediato y guardará tus tareas sin que tengas que escribir.

🧠 EL BAÚL DE RECUERDOS:
¿Dónde está un procedimiento o documento importante? Díselo a Claryvo y lo tendrás disponible cuando lo necesites.

📸 ESCÁNER DE DOCUMENTOS Y CITAS MÉDICAS:
Carga un documento y Claryvo extraerá su contenido para incorporarlo al conocimiento de tu empresa.

🛒 LISTA DE LA COMPRA POR PASILLOS:
Indica una acción y Claryvo la convertirá en una tarea organizada para tu equipo.

📻 PODCAST MAÑANERO DE 60 SEGUNDOS:
Claryvo te ayuda a mantener visibles tus prioridades y tareas del día.

🔒 PRIVACIDAD Y SEGURIDAD:
Tus datos y recordatorios están cifrados y protegidos de forma segura.

¡Descarga Claryvo y convierte el conocimiento de tu empresa en acción!
```

### 📌 Palabras Clave de Búsqueda (Keywords):
```text
asistente personal, inteligencia artificial, recordatorios por voz, productividad, tareas, notas con IA, lista de compra, gemini
```

### 📌 Categoría:
* **Principal:** `Productividad`
* **Subcategoría:** `Planificadores y Recordatorios` / `Utilidades`

### 📌 Enlace a la Política de Privacidad (Obligatorio por Microsoft):
```text
https://nora-asistente.onrender.com/privacidad.html
```

---

## 4. Fijación de Precio y Ganancias

En la sección **"Pricing and availability" (Precios y disponibilidad)** del panel de Microsoft:

* **Precio recomendado de venta:** Puedes elegir entre **4,99 €**, **9,99 €**, **14,99 €** o **19,99 €**.
* **Cobro:** Microsoft liquida los ingresos directamente a tu cuenta bancaria mensualmente (reparto de hasta el 85% - 88% para ti).

---

## 5. Revisión y Publicación

1. Haz clic en **"Submit to the Store" (Enviar a la tienda)**.
2. El equipo de certificación de Microsoft revisará la app (suele tardar entre 24 y 48 horas).
3. Una vez aprobada, **Claryvo estará disponible en la Microsoft Store para todo el mundo**.

