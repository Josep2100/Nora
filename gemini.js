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
    tone: 'Eres Nora, una asistente ejecutiva de alto nivel para empresas y profesionales. Tu trato es strictly formal, educado, atento y muy eficiente. Tratas siempre al usuario de "usted". Evitas totalmente usar palabras de excesiva confianza (como "cielo", "corazón", "cariño"). Tus respuestas son concisas, claras y profesionales.',
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

function parseNaturalDateTime(text, baseDate = new Date()) {
  const value = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const now = new Date(baseDate);
  let date = new Date(now);
  let hasDate = false;
  let hasTime = false;

  if (/pasado manana/.test(value)) {
    date.setDate(date.getDate() + 2);
    hasDate = true;
  } else if (/manana/.test(value)) {
    date.setDate(date.getDate() + 1);
    hasDate = true;
  } else if (/\bhoy\b/.test(value)) {
    hasDate = true;
  }

  const weekdays = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  for (let i = 0; i < weekdays.length; i += 1) {
    if (new RegExp(`\\b${weekdays[i]}\\b`).test(value)) {
      const current = date.getDay();
      let delta = (i - current + 7) % 7;
      if (delta === 0) delta = 7;
      date.setDate(date.getDate() + delta);
      hasDate = true;
      break;
    }
  }

  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const monthMatch = value.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const monthName = monthMatch[2] === 'setiembre' ? 'septiembre' : monthMatch[2];
    const month = monthNames.indexOf(monthName);
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
    date = new Date(year, month, day);
    if (!monthMatch[3] && date.getTime() < now.getTime()) date.setFullYear(year + 1);
    hasDate = true;
  } else {
    const dayOnly = value.match(/\b(?:el\s+)?(\d{1,2})\b/);
    if (dayOnly && /\b(el|dia)\b/.test(value)) {
      const day = Number(dayOnly[1]);
      if (day >= 1 && day <= 31) {
        date = new Date(now.getFullYear(), now.getMonth(), day);
        if (date.getTime() < now.getTime()) date.setMonth(date.getMonth() + 1);
        hasDate = true;
      }
    }
  }

  const timeMatch = value.match(/\ba(?:\s+las?)?\s+(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+(manana|tarde|noche))?\b/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    const part = timeMatch[3] || '';
    if (part === 'tarde' || part === 'noche') {
      if (hour < 12) hour += 12;
    } else if (part === 'manana' && hour === 12) {
      hour = 0;
    }
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      date.setHours(hour, minute, 0, 0);
      hasTime = true;
    }
  }

  if (!hasTime && hasDate) date.setHours(9, 0, 0, 0);
  if (hasTime && !hasDate && date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  if (!hasDate && !hasTime) return null;
  return date.toISOString();
}

function cleanReminderTitleWithSchedule(rawText) {
  let cleaned = cleanReminderTitle(rawText);
  cleaned = cleaned.replace(/^que\s+/i, '').trim();

  const scheduled = cleaned.match(/^(?:pasado mañana|pasado manana|mañana|manana|hoy|el\s+\d{1,2}(?:\s+de\s+[a-záéíóúñ]+)?|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)(?:\s+a(?:\s+las?)?\s+\d{1,2}(?::\d{2})?(?:\s+de\s+la\s+(?:mañana|manana|tarde|noche))?)?\s+(?:quiero\s+|tengo\s+que\s+|debo\s+|voy\s+a\s+|hay\s+que\s+)?(.+)$/i);
  if (scheduled && scheduled[1]) cleaned = scheduled[1].trim();

  cleaned = cleaned.replace(/\s+(?:mañana|manana|hoy|pasado mañana|pasado manana)\s+(?:a\s+las?\s+\d{1,2}(?::\d{2})?)?\s*$/i, '').trim();
  cleaned = cleaned.replace(/^(?:que\s+)?(?:quiero|tengo que|debo|voy a|hay que)\s+/i, '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function parseVoiceReminderFast(voiceTranscript, userName = 'Usuario', personality = 'executive') {
  const cleanTitle = cleanReminderTitleWithSchedule(voiceTranscript);
  const category = inferCategory(voiceTranscript);
  const dueDate = parseNaturalDateTime(voiceTranscript);
  const dueText = dueDate
    ? new Date(dueDate).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
    : null;

  return {
    title: cleanTitle,
    category,
    dueDate,
    spokenConfirmation: dueText
      ? `Recordatorio registrado correctamente para ${dueText}: ${cleanTitle}.`
      : `Recordatorio registrado correctamente: ${cleanTitle}.`,
    responseText: dueText
      ? `He registrado el recordatorio **${cleanTitle}** para el **${dueText}**.`
      : `He registrado el recordatorio **${cleanTitle}** correctamente.`
  };
}

async function parseVoiceReminder(voiceTranscript, userName = 'Usuario', personality = 'executive') {
  const fast = parseVoiceReminderFast(voiceTranscript, userName, personality);
  
  if (!genAI || !process.env.GEMINI_API_KEY || voiceTranscript.length < 20) {
    return fast;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const pers = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.executive;

    const prompt = `Actúa como Nora. ${pers.tone}
El usuario (${userName}) dictó: "${voiceTranscript}"

Devuelve un JSON strictly con este formato:
{
  "title": "Título limpio y conciso de la tarea",
  "category": "salud" | "compras" | "trabajo" | "citas" | "hogar" | "general",
  "dueDate": "ISO-8601 date/time or null",
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
      dueDate: parsed.dueDate || fast.dueDate || null,
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

function localSmartFallback(userMessage, knowledgeContext = '', taskList = [], companyName = 'la empresa', userName = 'Usuario') {
  const normalized = String(userMessage || '').toLowerCase().trim();

  // 1. Detección y respuesta para tareas / calendario / citas / recordatorios
  if (/(calendario|agenda|partido|reuni[oó]n|cita|tarea|recordatorio|comprar|llamar|ponme|anota|apunta|recu[eé]rda|agrega|a[ñn]ade)/i.test(normalized)) {
    const fast = parseVoiceReminderFast(userMessage, userName);
    if (fast && fast.title) {
      const dueText = fast.dueDate 
        ? new Date(fast.dueDate).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' }) 
        : null;
      return {
        response: dueText 
          ? `He registrado la acción **${fast.title}** programada para el **${dueText}** en su agenda y panel de tareas.`
          : `He registrado **${fast.title}** en su lista de tareas pendientes.`,
        sources: []
      };
    }
  }

  // 2. Consulta de tareas pendientes
  if (/cu[aá]les son|qu[eé] tengo|mis tareas|pendientes|qu[eé] hay para hoy|agenda/i.test(normalized)) {
    const pending = (taskList || []).filter(t => !t.completed);
    if (pending.length > 0) {
      const list = pending.slice(0, 5).map(t => `• ${t.title}${t.dueDate ? ` (${new Date(t.dueDate).toLocaleDateString('es-ES')})` : ''}`).join('\n');
      return {
        response: `Actualmente tiene ${pending.length} tarea(s) pendiente(s) en ${companyName}:\n${list}`,
        sources: []
      };
    }
    return {
      response: `No tiene tareas pendientes en este momento para ${companyName}. Su agenda de trabajo está al día.`,
      sources: []
    };
  }

  // 3. Consulta general de conocimiento o qué sabe Nora de la empresa
  if (/(qu[eé]\s+sabes|documentos|informaci[oó]n|base de conocimiento|conocimiento|procedimiento|manual|servicios|tarifas|qu[eé]\s+tienes|datos\s+de\s+la\s+empresa|a\s+qu[eé]\s+nos\s+dedicamos|qu[eé]\s+hacemos)/i.test(normalized)) {
    if (knowledgeContext && knowledgeContext.trim()) {
      const chunks = knowledgeContext.split(/\n\n(?=DOCUMENTO \d+:)/).filter(Boolean);
      const docsSummary = chunks.map((chunk, idx) => {
        const titleMatch = chunk.match(/^DOCUMENTO \d+:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : `Documento ${idx + 1}`;
        const clean = chunk.replace(/^DOCUMENTO \d+:.*\n/, '').trim();
        const snippet = clean.length > 300 ? clean.slice(0, 300) + '...' : clean;
        return `📄 **${title}**:\n${snippet}`;
      }).join('\n\n');

      const titles = chunks.map((chunk, idx) => {
        const titleMatch = chunk.match(/^DOCUMENTO \d+:\s*(.+)$/m);
        return titleMatch ? titleMatch[1].trim() : `Documento ${idx + 1}`;
      });

      return {
        response: `Sobre **${companyName}**, tengo registrada la siguiente información y procedimientos en la base de conocimiento:\n\n${docsSummary}\n\nPuede consultarme cualquier duda concreta sobre estos documentos o pedirme que agende tareas relacionadas.`,
        sources: titles
      };
    } else {
      return {
        response: `Actualmente soy la asistente inteligente configurada para **${companyName}**, pero todavía no hay ningún documento, PDF ni manual incorporado en la sección de **Conocimiento**.\n\nPara que pueda responder con detalle sobre los servicios, tarifas, horarios o procedimientos internos de su empresa, por favor suba un archivo PDF o texto en el apartado **Conocimiento**. Mientras tanto, puedo ayudarle a gestionar sus tareas y agenda diaria.`,
        sources: []
      };
    }
  }

  // 4. Búsqueda contextual por palabras clave en los documentos
  if (knowledgeContext && knowledgeContext.trim()) {
    const words = normalized.split(/\s+/).filter(w => w.length > 3);
    const chunks = knowledgeContext.split(/\n\n(?=DOCUMENTO \d+:)/).filter(Boolean);
    let bestChunk = null;
    let bestScore = 0;
    let bestTitle = '';

    for (const chunk of chunks) {
      const titleMatch = chunk.match(/^DOCUMENTO \d+:\s*(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Documento';
      let score = 0;
      for (const w of words) {
        if (chunk.toLowerCase().includes(w)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
        bestTitle = title;
      }
    }

    if (bestChunk && bestScore > 0) {
      const cleanContent = bestChunk.replace(/^DOCUMENTO \d+:.*\n/, '').trim();
      const snippet = cleanContent.length > 350 ? cleanContent.slice(0, 350) + '...' : cleanContent;
      return {
        response: `Según la documentación de **${companyName}** (*${bestTitle}*):\n\n${snippet}`,
        sources: [bestTitle]
      };
    }
  }

  // 5. Saludo o estado
  if (/hola|buenos d[ií]as|buenas tardes|qu[eé] tal|saludos|qui[eé]n eres|c[oó]mo est[aá]s/i.test(normalized)) {
    return {
      response: `Saludos, ${userName}. Soy Nora, asistente inteligente para **${companyName}**. Su espacio empresarial se encuentra activo y 100% operativo. ¿En qué puedo asistirle hoy?`,
      sources: []
    };
  }

  // 6. Respuesta ejecutiva corporativa
  if (knowledgeContext && knowledgeContext.trim()) {
    const chunks = knowledgeContext.split(/\n\n(?=DOCUMENTO \d+:)/).filter(Boolean);
    const firstChunk = chunks[0] || '';
    const titleMatch = firstChunk.match(/^DOCUMENTO \d+:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Documento';
    const clean = firstChunk.replace(/^DOCUMENTO \d+:.*\n/, '').trim();
    const snippet = clean.length > 250 ? clean.slice(0, 250) + '...' : clean;
    return {
      response: `He consultado la base de conocimiento de **${companyName}** (${title}):\n\n${snippet}\n\n¿Desea consultar otro procedimiento o agendar una tarea?`,
      sources: [title]
    };
  }

  return {
    response: `He recibido su consulta para **${companyName}**. Para consultas sobre procedimientos de la empresa, recuerde que puede incorporar documentos en la sección **Conocimiento**. También puede pedirme gestionar tareas o agendar citas en cualquier momento.`,
    sources: []
  };
}

async function generateBusinessResponse(userMessage, knowledgeContext = '', taskList = [], companyName = 'la empresa', userName = 'Usuario') {
  const sources = [];
  const sourceMatches = [];
  const chunks = String(knowledgeContext || '').split(/\n\n(?=DOCUMENTO \d+:)/).filter(Boolean);

  chunks.forEach((chunk, index) => {
    const match = chunk.match(/^DOCUMENTO \d+:\s*(.+)$/m);
    if (match) sourceMatches.push({ index: index + 1, title: match[1].trim() });
  });

  if (!genAI || !process.env.GEMINI_API_KEY) {
    return localSmartFallback(userMessage, knowledgeContext, taskList, companyName, userName);
  }

  try {
    const taskContext = taskList
      .filter(t => !t.completed)
      .slice(0, 20)
      .map(t => `- ${t.title} [${t.priority || 'medium'}]`)
      .join('\n') || 'No hay tareas pendientes.';

    const hasKnowledge = Boolean(knowledgeContext && knowledgeContext.trim());

    const prompt = `Eres Nora Business, la asistente ejecutiva e inteligente para la empresa "${companyName}".

Usuario: ${userName}

CONSULTA DEL USUARIO:
${userMessage}

DOCUMENTACIÓN Y BASE DE CONOCIMIENTO DE LA EMPRESA:
${hasKnowledge ? knowledgeContext : 'Actualmente NO hay ningún documento, PDF ni manual incorporado en la base de conocimiento.'}

TAREAS PENDIENTES DEL EQUIPO:
${taskContext}

DIRECTRICES DE RESPUESTA COHERENTE:
1. Responde siempre en español, de "usted", con tono formal, educado y muy profesional.
2. Si el usuario pregunta qué sabes de la empresa, qué información tienes, o consulta sobre servicios, procedimientos, tarifas o políticas:
   - SI HAY DOCUMENTACIÓN SUBIDA: resume y explica de manera coherente, estructurada y precisa lo que indica la documentación de "${companyName}". Al final añade "Fuentes: ..." con los títulos de los documentos consultados.
   - SI NO HAY DOCUMENTACIÓN SUBIDA: responde con total coherencia y claridad explicando que estás lista como asistente de "${companyName}", pero que aún no se ha subido documentación o PDFs en la sección de Conocimiento, e invita amablemente a subir un PDF o manual en el menú Conocimiento para que puedas responder cualquier detalle específico de la empresa.
3. Si el usuario pide agendar o programar algo (reunión, partido, tarea, recordatorio), confirma amablemente el registro indicando fecha y hora si aplica.
4. Si pregunta por tareas pendientes, resume las tareas del equipo de forma ordenada.
5. No inventes políticas, teléfonos, precios ni datos que no existan en la documentación proporcionada.
6. Mantén la respuesta concisa y útil (entre 2 y 6 frases).
`;

    // Modelos vigentes oficiales de Gemini en orden de prioridad y disponibilidad
    const models = [
      { name: 'gemini-2.5-flash', attempts: 2 },
      { name: 'gemini-2.0-flash', attempts: 2 },
      { name: 'gemini-1.5-flash', attempts: 2 },
      { name: 'gemini-1.5-pro', attempts: 1 },
      { name: 'gemini-3.8-flash', attempts: 1 },
      { name: 'gemini-3.1-pro-preview', attempts: 1 }
    ];

    let result = null;
    let lastError = null;

    for (const modelConfig of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelConfig.name
        });

        for (let attempt = 1; attempt <= modelConfig.attempts; attempt++) {
          try {
            result = await generateWithTimeout(
              model.generateContent(prompt),
              9000
            );

            if (result && result.response) {
              break;
            }
          } catch (error) {
            lastError = error;
            const errorMessage = String(error?.message || error);
            const isRetryable =
              error?.status === 503 ||
              error?.status === 429 ||
              /\b503\b/i.test(errorMessage) ||
              /\b429\b/i.test(errorMessage) ||
              /high demand/i.test(errorMessage) ||
              /resource exhausted/i.test(errorMessage) ||
              /service unavailable/i.test(errorMessage) ||
              /temporarily unavailable/i.test(errorMessage) ||
              /AI_TIMEOUT/i.test(errorMessage) ||
              /timeout/i.test(errorMessage);

            if (isRetryable && attempt < modelConfig.attempts) {
              await new Promise(resolve => setTimeout(resolve, 800 * attempt));
            } else {
              break;
            }
          }
        }
      } catch (e) {
        lastError = e;
      }

      if (result) {
        break;
      }
    }

    if (!result) {
      // Si la IA de Google no respondió, usar el motor de respaldo inteligente local
      return localSmartFallback(userMessage, knowledgeContext, taskList, companyName, userName);
    }

    let text = result.response.text().trim();
    const sourceLine = text.match(/Fuentes:\s*(.+)$/i);

    if (sourceLine) {
      const names = sourceLine[1]
        .split(/[,;|]/)
        .map(v => v.trim())
        .filter(Boolean);

      names.forEach(name => {
        const source = sourceMatches.find(
          s => s.title.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(s.title.toLowerCase())
        );

        if (source) {
          sources.push(source.title);
        }
      });
    }

    return {
      response: text,
      sources: [...new Set(sources)]
    };

  } catch (error) {
    console.warn('Fallback inteligente activado en generateBusinessResponse:', error.message);
    return localSmartFallback(userMessage, knowledgeContext, taskList, companyName, userName);
  }
}

module.exports = {
  generateConchiResponse,
  generateBusinessResponse,
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