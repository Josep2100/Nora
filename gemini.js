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

// Configuración de personalidades orientada a trato profesional y formal
const PERSONALITY_PROMPTS = {
  executive: {
    name: 'Ejecutiva',
    tone: 'Eres Nora, una asistente ejecutiva de alto nivel para empresas y profesionales. Tu trato es estrictamente formal, educado, atento y muy eficiente. Tratas siempre al usuario de "usted". Evitas totalmente usar palabras de excesiva confianza (como "cielo", "corazón", "cariño"). Tus respuestas son concisas, claras y profesionales.',
    voicePrefix: 'Estimado usuario, ',
    confirmPrefix: 'Registrado con éxito: '
  },
  affectionate: {
    name: 'Cariñosa',
    tone: 'Eres Nora, una asistente atenta, cordial y educada. Mantienes un trato profesional pero amigable y respetuoso.',
    voicePrefix: 'Hola, ',
    confirmPrefix: 'Guardado correctamente: '
  },
  cheerful: {
    name: 'Alegre',
    tone: 'Eres Nora, una asistente eficiente y motivadora, orientada a mantener una excelente productividad profesional.',
    voicePrefix: 'Saludos. ',
    confirmPrefix: 'Anotado en su agenda: '
  }
};

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

function cleanReminderTitle(rawText) {
  let cleaned = String(rawText || '').trim();
  cleaned = cleaned.replace(/^(nora|oye nora|por favor|hola)\s*,?\s*/i, '');
  cleaned = cleaned.replace(/^(recuérdame|recuerdame|recuerda|apúntame|apuntame|apunta|ponme|anota|añade|agrega|no olvides|no te olvides de|tengo que|debo|hay que)\s+/i, '');
  cleaned = cleaned.replace(/^(que tengo que|de que|de)\s+/i, '');
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned || 'Nuevo recordatorio';
}

function parseVoiceReminderFast(voiceTranscript, userName = 'Usuario', personality = 'executive') {
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.executive;
  const cleanTitle = cleanReminderTitle(voiceTranscript);
  const category = inferCategory(voiceTranscript);

  return {
    title: cleanTitle,
    category,
    spokenConfirmation: `Registrado con éxito: ${cleanTitle}.`,
    responseText: `Se ha registrado el recordatorio: **${cleanTitle}**`
  };
}

async function parseVoiceReminder(voiceTranscript, userName = 'Usuario', personality = 'executive') {
  const fast = parseVoiceReminderFast(voiceTranscript, userName, personality);
  
  if (!genAI || !process.env.GEMINI_API_KEY || voiceTranscript.length < 20) {
    return fast;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.executive;

    const prompt = `Actúa como Nora. ${pers.tone}
El usuario (${userName}) dictó: "${voiceTranscript}"

Devuelve un JSON estrictamente con este formato:
{
  "title": "Título limpio y conciso de la tarea",
  "category": "salud" | "compras" | "trabajo" | "citas" | "hogar" | "general",
  "spokenConfirmation": "Frase formal y profesional de 1 sola oración corta para confirmar la acción",
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

async function processMemoryInteraction(text, memoryVault = [], userName = 'Usuario', personality = 'executive') {
  const lower = text.toLowerCase();
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.executive;

  const isSavingMemory = /guard(é|e|ado)|dej(é|e|ado)|puesto|el código|la clave|la contraseña|talla|número de pie|anota que|recuerda que/.test(lower) 
    && (/en el|en la|en los|en las|es el|es la|es \d+/i.test(lower) || /cajón|armario|estantería|coche|garaje|maleta|bolso|mesa/.test(lower));

  if (isSavingMemory) {
    let item = 'Dato guardado';
    let location = 'Ubicación registrada';

    try {
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Extrae el objeto o dato y el lugar/valor de este texto: "${text}"
Devuelve un JSON estrictamente así:
{
  "item": "Nombre del objeto o dato",
  "location": "Lugar o valor exacto"
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
      response: `Dato registrado en su memoria de almacenamiento: **${item}** se encuentra en *${location}*.`,
      spokenConfirmation: `Registrado con éxito. Dónde se encuentra ${item}.`
    };
  }

  const isQueryingMemory = /dónde (está|estan|dejé|deje|guardé|guarde|puse)|que talla|cuál es (el código|la clave|el número)/i.test(lower);

  if (isQueryingMemory && memoryVault.length > 0) {
    try {
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const vaultContext = memoryVault.map(m => `- ${m.item}: ${m.location} (registrado: "${m.fullText}")`).join('\n');
        
        const prompt = `Eres Nora. ${pers.tone}
El usuario (${userName}) le pregunta: "${text}"

Memoria registrada:
${vaultContext}

Si la respuesta está presente, indíquela con tono formal. De lo contrario, responda educadamente que no consta en el registro.`;

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
      console.warn('Error querying memory:', e);
    }
  }

  return { isMemoryAction: false };
}

async function scanDocumentWithVision(base64Data, mimeType = 'image/jpeg', userName = 'Usuario', personality = 'executive') {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    return {
      title: 'Documento escaneado',
      details: 'No se pudo procesar la imagen.',
      category: 'citas',
      responseText: 'He recibido la imagen, pero el servicio de análisis no está disponible actualmente.'
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Analiza este documento o imagen. Extrae la información relevante para ${userName}.

Devuelve un JSON con este formato:
{
  "title": "Título del documento o cita",
  "date": "Fecha o plazo si aplica",
  "details": "Detalles o importes principales",
  "category": "salud" | "citas" | "compras" | "trabajo" | "general",
  "responseText": "Resumen formal de la información procesada"
}`;

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
      title: parsed.title || 'Documento procesado',
      date: parsed.date || null,
      details: parsed.details || '',
      category: parsed.category || 'citas',
      responseText: parsed.responseText || `Se ha analizado el documento: **${parsed.title}**`
    };
  } catch (error) {
    return {
      title: 'Nota escaneada',
      details: 'Documento capturado',
      category: 'general',
      responseText: 'Documento guardado en el archivo del usuario.'
    };
  }
}

async function generateMorningPodcast(userName = 'Usuario', taskList = [], personality = 'executive') {
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.executive;
  const pending = (taskList || []).filter(t => !t.completed);

  const pendingText = pending.length > 0
    ? `Tiene ${pending.length} tareas pendientes: ${pending.slice(0, 3).map(t => t.title).join(', ')}.`
    : 'No tiene tareas pendientes para hoy.';

  if (!genAI || !process.env.GEMINI_API_KEY) {
    return {
      title: 'Resumen Ejecutivo del Día',
      script: `Buenos días, ${userName}. Le presento su resumen diario. ${pendingText} Que tenga una jornada productiva.`
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Eres Nora. ${pers.tone}
Genera un guión breve de audio de 45 segundos para ${userName}.
Información:
- ${pendingText}
- Redacte un saludo formal y presente las prioridades de trabajo directamente sin adornos ni emojis.`;

    const res = await generateWithTimeout(model.generateContent(prompt), 6500);
    const script = res.response.text().trim().replace(/[*#_]/g, '');

    return {
      title: 'Resumen Ejecutivo con Nora',
      script: script || `Buenos días, ${userName}. Le confirmo las tareas registradas para la jornada de hoy.`
    };
  } catch (error) {
    return {
      title: 'Resumen Ejecutivo',
      script: `Buenos días, ${userName}. ${pendingText}`
    };
  }
}

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

async function generateConchiResponse(userMessage, taskList = [], memoryVault = [], userName = 'Usuario', personality = 'executive') {
  const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.executive;

  try {
    if (!genAI || !process.env.GEMINI_API_KEY) {
      return {
        response: `Saludos, ${userName}. Soy Nora, su asistente virtual. Puedo colaborar en la gestión de recordatorios, organización de datos y planificación de tareas. ¿En qué puedo asistisle en este momento?`
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const pendingTasks = (taskList || []).filter(t => !t.completed);
    const taskContext = pendingTasks.length > 0
      ? `Tareas pendientes de ${userName}: ${pendingTasks.map(t => `"${t.title}" (${t.category || 'general'})`).join(', ')}.`
      : `${userName} no tiene tareas pendientes en el sistema.`;

    const memoryContext = (memoryVault || []).length > 0
      ? `Registro de memoria: ${memoryVault.map(m => `${m.item} ->${m.location}`).join('; ')}.`
      : `No hay registros adicionales almacenados.`;

    const prompt = `Eres Nora, asistente ejecutiva profesional. ${pers.tone}
El usuario se llama ${userName}.
${taskContext}
${memoryContext}

Mensaje del usuario: "${userMessage}"

Instrucciones:
1. Responde siempre de "usted" con tono formal, educado, atento y profesional.
2. Mantén la respuesta breve (máximo 2-3 frases).
3. No uses palabras informales ni de cariño.`;

    const result = await generateWithTimeout(model.generateContent(prompt), 5500);
    const text = result.response.text().trim();

    return {
      response: text || `Entendido, ${userName}. Quedo a su disposición para cualquier otra consulta.`
    };
  } catch (error) {
    console.error('Error en Gemini generateConchiResponse:', error.message);
    return {
      response: `Disculpe la interrupción, ${userName}. Ha ocurrido una incidencia al procesar la solicitud. ¿Desea registrar una nueva tarea o consulta?`
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