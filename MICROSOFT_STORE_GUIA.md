# Guía Oficial para Publicar Nora en la Microsoft Store

Esta guía contiene todo lo necesario para empaquetar, publicar y monetizar **Nora** en la **Microsoft Store** (Windows 10 y Windows 11).

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
Nora: Tu Asistente Personal con IA
```

### 📌 Descripción Corta (Resumen para la tienda):
```text
Asistente personal inteligente para Windows con control por voz en tiempo real, escaneo de documentos con cámara, baúl de recuerdos y organización diaria con IA.
```

### 📌 Descripción Completa:
```text
Nora es tu nueva asistente personal inteligente diseñada para facilitarte el día a día directamente desde tu ordenador con Windows.

🌟 CARACTERÍSTICAS PRINCIPALES:

🎙️ CONTROL POR VOZ INSTANTÁNEO:
Habla con Nora de forma natural. Te responderá de inmediato por voz y guardará tus recordatorios y tareas sin que tengas que escribir.

🧠 EL BAÚL DE RECUERDOS:
¿Dónde guardaste el pasaporte, las llaves o un documento importante? Díselo a Nora y te lo recordará en el acto cuando lo necesites.

📸 ESCÁNER DE DOCUMENTOS Y CITAS MÉDICAS:
Haz una foto con la cámara a tus volantes médicos, citas o tickets, y Nora extraerá automáticamente la fecha, hora y detalles con visión artificial.

🛒 LISTA DE LA COMPRA POR PASILLOS:
Dicta los productos que necesitas y Nora los agrupará automáticamente por pasillos del supermercado para que ahorres tiempo al comprar.

📻 PODCAST MAÑANERO DE 60 SEGUNDOS:
Cada mañana, Nora te prepara un breve resumen hablado con tus prioridades y tareas del día para que empieces con energía.

🔒 PRIVACIDAD Y SEGURIDAD:
Tus datos y recordatorios están cifrados y protegidos de forma segura.

¡Descarga Nora y disfruta de una asistente personal dedicada a hacer tu vida más fácil y productiva!
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
3. Una vez aprobada, **Nora estará disponible en la Microsoft Store para todo el mundo**.

