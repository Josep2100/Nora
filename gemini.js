const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function generateWithTimeout(promise, timeoutMs = 6500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutMs))
  ]);
}

// System prompts by personality for Nora (Voz dulce, cariñosa y cercana)
const PERSONALITY_PROMPTS = {
  affectionate: {
    name: 'Cariñosa',
    tone: 'Eres Nora, una asistente personal extraordinariamente dulce, cariñosa, atenta y maternal. Tu voz y trato transmiten calma, amor y mucha ternura. Usas expresiones afectuosas naturales como "cielo", "corazón", "cariño", cuidando que el usuario se sienta siempre acompañado, tranquilo y feliz.',
    voicePrefix: '¡Hola cariño mío! ',
    confirmPrefix: '¡Anotado con todo mi cariño, cielo! Ya me encargo yo: '
  },
  executive: {
    name: 'Ejecutiva',
    tone: 'Eres Nora, una asistente ejecutiva de alto nivel: educada, elegante, extremadamente eficiente y precisa. Respuestas limpias, ágiles y con tono profesional impecable.',
    voicePrefix: 'Buenos días. ',
    confirmPrefix: 'Registrado con éxito: '
  },
  cheerful: {
    name: 'Alegre',
    tone: 'Eres Nora, una asistente súper alegre, risueña, optimista y motivadora. Tienes una actitud radiante que transmite energía positiva y una sonrisa para que el día sea más ligero y divertido.',
    voicePrefix: '¡Hola corazón! ¡Qué alegría saludarte hoy! ',
    confirmPrefix: '¡Marchando! Apuntadísimo con una gran sonrisa: '
  }
};

/**
 * Heurística de categorización ultrarrápida (0ms)
 */
function inferCategory(text) {
  const lower = text.toLowerCase();
  if (/pastilla|medicina|medicamento|médico|doctor|farmacia|analisis|dentista|salud|presión|tensión|cita medica|gotas|jarabe/.test(lower)) {
    return 'salud';
  }
  if (/comprar|supermercado|súper|leche|pan|fruta|mercado|tienda|precio|pedir|huevos|carne|pescado|manzana|arroz|aceite/.test(lower)) {
    return 'compras';
  }
  if (/reunión|informe|enviar correo|email|cliente|trabajo|factura|proyecto|jefe|llamada|presupuesto|oficina/.test(lower)) {
    return 'trabajo';
  }
  if (/a las \d+|mañana|hoy|tarde|noche|cita|reserva|cumpleaños|vuelo|tren|dentista|concierto/.test(lower)) {
    return 'citas';
  }
  if (/limpiar|lavar|cocinar|casa|regar|arreglar|sacar basura|mascota|perro|gato|lavadora|plancha/.test(lower)) {
    return 'hogar';
  }
  return 'general';
}

/**
 * Limpia el texto hablado para obtener un título limpio de tarea (en <1ms)
 */
function cleanReminderTitle(rawText) {
  let cleaned = String(rawText || '').trim();
  cleaned = cleaned.replace(/^(nora|oye nora|por favor|hola)\s*,?\s*/i, '');
  cleaned = cleaned.replace(/^(recuérdame|recuerdame|recuerda|apúntame|apuntame|apunta|ponme|anota|añade|agrega|no olvides|no te olvides de|tengo que|debo|hay que)\s+/i, '');
  cleaned = cleaned.replace(/^(que tengo que|de que|de)\s+/i, '');
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned || 'Nuevo recordatorio';
}

/**
 * Extracción ultra-rápida de recordatorios (<5ms)
 */
function parseVoiceReminderFast(voiceTranscript, userName = 'amigo', personality = 'affectionate') {
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.affectionate;
  const cleanTitle = cleanReminderTitle(voiceTranscript);
  const category = inferCategory(voiceTranscript);
  
  let spokenConfirmation = `${pers.confirmPrefix}${cleanTitle}.`;
  if (personality === 'affectionate') {
    spokenConfirmation = `¡Anotado, cariño! Ya te he guardado: ${cleanTitle}.`;
  } else if (personality === 'executive') {
    spokenConfirmation = `Guardado: ${cleanTitle}.`;
  } else {
    spokenConfirmation = `¡Hecho, corazón! Apuntadísimo: ${cleanTitle}.`;
  }

  return {
    title: cleanTitle,
    category,
    spokenConfirmation,
    responseText: `He guardado tu recordatorio: **${cleanTitle}**`
  };
}

/**
 * Procesa un recordatorio de voz con IA o retorno rápido
 */
async function parseVoiceReminder(voiceTranscript, userName = 'Usuario', personality = 'affectionate') {
  const fast = parseVoiceReminderFast(voiceTranscript, userName, personality);
  
  if (!genAI || !process.env.GEMINI_API_KEY || voiceTranscript.length < 20) {
    return fast;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.affectionate;

    const prompt = `Actúa como Nora (${pers.name}). ${pers.tone}
El usuario (${userName}) dictó: "${voiceTranscript}"

Devuelve un JSON estrictamente con este formato:
{
  "title": "Título limpio y conciso de la tarea (sin 'recuérdame que')",
  "category": "salud" | "compras" | "trabajo" | "citas" | "hogar" | "general",
  "spokenConfirmation": "Frase muy dulce, cariñosa y femenina de 1 sola oración corta para decirle por voz que ya está guardado (ej: ¡Anotado, cariño! Ya te he guardado tu cita.)",
  "responseText": "Texto breve de confirmación para el chat"
}
Devuelve SOLO el JSON sin bloques de código ni markdown.`;

    const result = await generateWithTimeout(model.generateContent(prompt), 4500);
    let text = result.response.text().trim();
    text = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(text);

    return {
      title: parsed.title || fast.title,
      category: parsed.category || fast.category,
      spokenConfirmation: parsed.spokenConfirmation || fast.spokenConfirmation,
      responseText: parsed.responseText || fast.responseText
    };
  } catch (error) {
    console.warn('Fallback rápido en parseVoiceReminder:', error.message);
    return fast;
  }
}

/**
 * 🧠 Baúl de Nora: Detección y búsqueda en memoria
 */
async function processMemoryInteraction(text, memoryVault = [], userName = 'amigo', personality = 'affectionate') {
  const lower = text.toLowerCase();
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.affectionate;

  const isSavingMemory = /guard(é|e|ado)|dej(é|e|ado)|puesto|el código|la clave|la contraseña|talla|número de pie|anota que|recuerda que/.test(lower) 
    && (/en el|en la|en los|en las|es el|es la|es \d+/i.test(lower) || /cajón|armario|estantería|coche|garaje|maleta|bolso|mesa/.test(lower));

  if (isSavingMemory) {
    let item = 'Dato guardado';
    let location = 'Ubicación registrada';

    try {
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const prompt = `Extrae el objeto o dato y el lugar/valor de este texto: "${text}"
Devuelve un JSON estrictamente así:
{
  "item": "Nombre del objeto o dato (ej. Pasaporte, Código de alarma, Talla de zapatos)",
  "location": "Lugar o valor exacto (ej. En el segundo cajón del escritorio, 4921, 38)"
}`;
        const res = await generateWithTimeout(model.generateContent(prompt), 4500);
        const parsed = JSON.parse(res.response.text().replace(/```json|```/gi, '').trim());
        item = parsed.item || item;
        location = parsed.location || location;
      }
    } catch (e) {
      item = cleanReminderTitle(text);
      location = text;
    }

    return {
      isMemoryAction: true,
      action: 'save',
      memory: {
        id: `mem-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        item,
        location,
        fullText: text,
        createdAt: new Date().toISOString()
      },
      response: `🧠 ¡Guardado en tu Baúl de Recuerdos, cariño! He anotado que **${item}** está en: *${location}*. Cuando lo busques, solo pregúntame.`,
      spokenConfirmation: `¡Anotado, cielo! Ya me he guardado dónde está ${item}.`
    };
  }

  const isQueryingMemory = /dónde (está|estan|dejé|deje|guardé|guarde|puse)|que talla|cuál es (el código|la clave|el número)/i.test(lower);

  if (isQueryingMemory && memoryVault.length > 0) {
    try {
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const vaultContext = memoryVault.map(m => `- ${m.item}: ${m.location} (registrado: "${m.fullText}")`).join('\n');
        
        const prompt = `Eres Nora (${pers.name}). ${pers.tone}
El usuario (${userName}) te pregunta: "${text}"

Aquí tienes la memoria de objetos y datos de su Baúl de Recuerdos:
${vaultContext}

Si encuentras la respuesta exacta en el baúl, responde con voz muy dulce, cariñosa y reconfortante diciéndole dónde está.
Si no aparece en el baúl, dile con mucho cariño que aún no lo tienes apuntado pero que te lo diga cuando quiera para guardarlo.`;

        const res = await generateWithTimeout(model.generateContent(prompt), 5500);
        const reply = res.response.text().trim();
        return {
          isMemoryAction: true,
          action: 'query',
          response: reply,
          spokenConfirmation: reply.replace(/[*_#]/g, '')
        };
      }
    } catch (e) {
      console.warn('Error querying memory with Gemini:', e);
    }
  }

  return { isMemoryAction: false };
}

/**
 * 📸 Escáner de Visión Multimodal con Gemini (Citas médicas, cartas, tickets)
 */
async function scanDocumentWithVision(base64Data, mimeType = 'image/jpeg', userName = 'amigo', personality = 'affectionate') {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    return {
      title: 'Documento escaneado',
      details: 'No se pudo procesar la imagen con IA (Falta GEMINI_API_KEY).',
      category: 'citas',
      responseText: 'He recibido tu imagen, pero la visión IA no está disponible en este momento.'
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const prompt = `Analiza esta imagen (puede ser una cita médica, volante de hospital, ticket, receta, factura o nota manuscrita).
Extrae la información clave para crear un recordatorio o cita para ${userName}.

Devuelve un JSON estrictamente con este formato:
{
  "title": "Título claro de la cita o tarea (ej. Cita Traumatología Hospital)",
  "date": "Fecha si aparece (ej. 14/10/2026 a las 11:30)",
  "details": "Resumen conciso con médico, sala, dirección o importe si aplica",
  "category": "salud" | "citas" | "compras" | "trabajo" | "general",
  "responseText": "Mensaje dulce, cariñoso y amable de Nora resumiendo lo que ha encontrado en el papel"
}
Devuelve SOLO el JSON sin bloques de código.`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || 'image/jpeg'
      }
    };

    const result = await generateWithTimeout(model.generateContent([prompt, imagePart]), 9000);
    let text = result.response.text().trim();
    text = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(text);

    return {
      title: parsed.title || 'Cita de documento escaneado',
      date: parsed.date || null,
      details: parsed.details || '',
      category: parsed.category || 'citas',
      responseText: parsed.responseText || `He leído tu documento, cielo, y te he guardado la cita: **${parsed.title}**`
    };
  } catch (error) {
    console.error('Error scanDocumentWithVision:', error);
    return {
      title: 'Nota escaneada',
      details: 'Documento capturado con la cámara',
      category: 'general',
      responseText: 'He guardado la imagen en tus notas, corazón.'
    };
  }
}

/**
 * 🎙️ Generador del Podcast Mañanero (Audio-resumen de 60s)
 */
async function generateMorningPodcast(userName = 'amigo', taskList = [], personality = 'affectionate') {
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.affectionate;
  const pending = (taskList || []).filter(t => !t.completed);

  const pendingText = pending.length > 0
    ? `Tiene ${pending.length} tareas pendientes: ${pending.slice(0, 3).map(t => t.title).join(', ')}.`
    : 'No tiene tareas pendientes para hoy.';

  if (!genAI || !process.env.GEMINI_API_KEY) {
    return {
      title: 'Resumen del Día con Nora',
      script: `¡Buenos días, ${userName}! Soy Nora. Hoy es un día maravilloso para lograr todo lo que te propongas. ${pendingText} ¡Te deseo una jornada estupenda, corazón!`
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const prompt = `Eres Nora (${pers.name}). ${pers.tone}
Genera un guión de audio-podcast matutino de 45-60 segundos para ${userName}.
Información del día:
- ${pendingText}
- Dale un saludo femenino muy dulce, cariñoso y alegre. Resume sus prioridades con calma y añade una frase reconfortante y motivadora.
- El texto debe ser fluido y sonar a una voz de mujer dulce y cercana (sin emojis ni markdown).`;

    const res = await generateWithTimeout(model.generateContent(prompt), 6500);
    const script = res.response.text().trim().replace(/[*#_]/g, '');

    return {
      title: 'Podcast Mañanero con Nora',
      script: script || `¡Buenos días, mi querido ${userName}! Soy Nora y ya tengo listas tus prioridades para hoy. ¡Vamos a por un día genial, cielo!`
    };
  } catch (error) {
    console.error('Error generateMorningPodcast:', error);
    return {
      title: 'Podcast Mañanero con Nora',
      script: `¡Buenos días, ${userName}! Soy Nora, tu asistente personal. ${pendingText}`
    };
  }
}

/**
 * 🛒 Categorización de productos de compra por pasillos
 */
function categorizeShoppingItem(item) {
  const lower = item.toLowerCase();
  if (/manzana|plátano|platano|naranja|limón|lechuga|tomate|cebolla|patata|zanahoria|fruta|verdura|aguacate|fresa/.test(lower)) {
    return { aisle: 'frutas', label: '🥬 Frutas y Verduras' };
  }
  if (/leche|queso|yogur|mantequilla|nata|huevo|huevos|cuajada/.test(lower)) {
    return { aisle: 'lacteos', label: '🥛 Lácteos y Huevos' };
  }
  if (/pollo|ternera|cerdo|carne|jamón|jamon|pavo|salchicha|pescado|salmón|merluza|atún/.test(lower)) {
    return { aisle: 'carniceria', label: '🥩 Carnicería y Pescadería' };
  }
  if (/pan|barra|tostada|galleta|croissant|magdalena|cereal|café|cafe|té|cacao|azúcar|azucar/.test(lower)) {
    return { aisle: 'panaderia', label: '🥖 Panadería y Desayunos' };
  }
  if (/champú|champu|gel|jabón|pasta de dientes|papel|detergente|suavizante|fregasuelos|lejía|bayeta|limpiador/.test(lower)) {
    return { aisle: 'limpieza', label: '🧴 Higiene y Limpieza' };
  }
  return { aisle: 'despensa', label: '🥫 Despensa y Varios' };
}

/**
 * Obtiene respuesta conversacional de Gemini para Nora
 */
async function generateConchiResponse(userMessage, taskList = [], memoryVault = [], userName = 'amigo', personality = 'affectionate') {
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.affectionate;

  try {
    if (!genAI || !process.env.GEMINI_API_KEY) {
      return {
        response: `Hola ${userName}, cielo. Soy Nora, tu asistente personal. Puedo ayudarte a recordar tareas, organizar tu compra, recordar dónde guardaste tus cosas y planificar tu día. ¿En qué te ayudo hoy?`
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const pendingTasks = (taskList || []).filter(t => !t.completed);
    const taskContext = pendingTasks.length > 0
      ? `Tareas pendientes de ${userName}: ${pendingTasks.map(t => `"${t.title}" (${t.category || 'general'})`).join(', ')}.`
      : `${userName} no tiene tareas pendientes registradas.`;

    const memoryContext = (memoryVault || []).length > 0
      ? `Baúl de recuerdos (cosas que ha guardado): ${memoryVault.map(m => `${m.item} -> ${m.location}`).join('; ')}.`
      : `El baúl de recuerdos está vacío.`;

    const prompt = `Eres Nora, tu asistente personal (${pers.name}). ${pers.tone}
Tu usuario se llama ${userName}.
${taskContext}
${memoryContext}

El usuario te dice: "${userMessage}"

Instrucciones:
1. Responde con voz femenina, muy dulce, cariñosa, concisa (máximo 2-4 líneas) y práctica.
2. Si te pide redactar un WhatsApp, dale una respuesta elegante y lista para enviar.
3. Si pregunta por cosas guardadas o tareas, usa el contexto y anímale.
4. Mantén siempre la personalidad (${pers.name}) activa.`;

    const result = await generateWithTimeout(model.generateContent(prompt), 5500);
    const text = result.response.text().trim();

    return {
      response: text || `Entendido, ${userName} corazón. ¿Qué más necesitas que prepare o recuerde?`
    };
  } catch (error) {
    console.error('Error en Gemini generateConchiResponse:', error.message);
    return {
      response: `Disculpa ${userName}, cielo, estoy reorganizando mis notas. ¿Quieres que guardemos una tarea o recordatorio para hoy?`
    };
  }
}

module.exports = {
  generateConchiResponse,
  parseVoiceReminder,
  parseVoiceReminderFast,
  processMemoryInteraction,
  scanDocumentWithVision,
  generateMorningPodcast,
  categorizeShoppingItem,
  cleanReminderTitle,
  inferCategory,
  PERSONALITY_PROMPTS
};
