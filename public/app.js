// ==========================================================================
// NORA | TU ASISTENTE PERSONAL - CLIENT APPLICATION
// ==========================================================================

const state = {
  user: null,
  tasks: [],
  memoryVault: [],
  shoppingList: [],
  personality: 'affectionate',
  emergencyContact: { name: '', phone: '' },
  activeFilter: 'all',
  activeMainTab: 'tasks',
  pendingWhatsapp: false,
  isAudioMuted: localStorage.getItem('nora_audio_muted') === 'true',
  deferredInstallPrompt: null,
  isVoiceActive: false,
  currentOnboardingStep: 1
  ,taskSearch: ''
};

// DOM Elements
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showLoginBtn = document.getElementById('showLogin');
const showRegisterBtn = document.getElementById('showRegister');
const authMessage = document.getElementById('authMessage');
const googleLoginBtn = document.getElementById('googleLoginBtn');

// OAuth necesita que Nora se sirva desde http://localhost:3000, nunca desde file://.
if (window.location.protocol === 'file:') {
  if (authMessage) {
    authMessage.innerHTML = 'Nora está abierta como archivo local. <strong>Arranca el servidor</strong> y entra en <a href="http://localhost:3000">http://localhost:3000</a> para que funcionen Google, las sesiones y la IA.';
  }
  if (googleLoginBtn) googleLoginBtn.disabled = true;
}

// Password security DOM
const signupPassword = document.getElementById('signupPassword');
const passwordMeterFill = document.getElementById('passwordMeterFill');
const passwordMeterLabel = document.getElementById('passwordMeterLabel');
const reqLength = document.getElementById('reqLength');
const reqUpper = document.getElementById('reqUpper');
const reqNumber = document.getElementById('reqNumber');
const reqSpecial = document.getElementById('reqSpecial');

// Onboarding Modal DOM
const onboardingModal = document.getElementById('onboardingModal');
const closeOnboardingBtn = document.getElementById('closeOnboardingBtn');
const prevSlideBtn = document.getElementById('prevSlideBtn');
const nextSlideBtn = document.getElementById('nextSlideBtn');
const openGuideBtn = document.getElementById('openGuideBtn');

const userName = document.getElementById('userName');
const taskList = document.getElementById('taskList');
const taskCountBadge = document.getElementById('taskCountBadge');
const chatMessages = document.getElementById('chatMessages');
const assistantForm = document.getElementById('assistantForm');
const userInput = document.getElementById('userInput');
const logoutBtn = document.getElementById('logoutBtn');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskDueDate = document.getElementById('taskDueDate');
const taskRecurrence = document.getElementById('taskRecurrence');
const taskSearch = document.getElementById('taskSearch');
const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const calendarExportBtn = document.getElementById('calendarExportBtn');
const privacyConsent = document.getElementById('privacyConsent');
const voiceBtn = document.getElementById('voiceBtn');
const sendBtn = document.getElementById('sendBtn');
const cameraBtn = document.getElementById('cameraBtn');
const cameraInput = document.getElementById('cameraInput');

const voiceStatusBanner = document.getElementById('voiceStatusBanner');
const voiceStatusText = document.getElementById('voiceStatusText');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const audioToggleBtnMob = document.getElementById('audioToggleBtnMob');
const podcastBtn = document.getElementById('podcastBtn');
const podcastBtnMob = document.getElementById('podcastBtnMob');

// Navigation Tabs
const tabTasksBtn = document.getElementById('tabTasksBtn');
const tabMemoryBtn = document.getElementById('tabMemoryBtn');
const tabShoppingBtn = document.getElementById('tabShoppingBtn');
const tasksView = document.getElementById('tasksView');
const memoryView = document.getElementById('memoryView');
const shoppingView = document.getElementById('shoppingView');

// Memory View DOM
const memoryForm = document.getElementById('memoryForm');
const memoryItemInput = document.getElementById('memoryItemInput');
const memoryLocationInput = document.getElementById('memoryLocationInput');
const memoryList = document.getElementById('memoryList');
const memoryCountBadge = document.getElementById('memoryCountBadge');

// Shopping View DOM
const shoppingForm = document.getElementById('shoppingForm');
const shoppingInput = document.getElementById('shoppingInput');
const shoppingAislesContainer = document.getElementById('shoppingAislesContainer');
const clearBoughtBtn = document.getElementById('clearBoughtBtn');

// SOS & Settings Modal DOM
const sosBtn = document.getElementById('sosBtn');
const sosBtnMob = document.getElementById('sosBtnMob');
const sosSettingsBtn = document.getElementById('sosSettingsBtn');
const sosModal = document.getElementById('sosModal');
const closeSosModalBtn = document.getElementById('closeSosModalBtn');
const sosForm = document.getElementById('sosForm');
const sosNameInput = document.getElementById('sosNameInput');
const sosPhoneInput = document.getElementById('sosPhoneInput');
const testSosAlertBtn = document.getElementById('testSosAlertBtn');

// Mobile drawer
const menuToggleBtn = document.getElementById('menuToggleBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const appSidebar = document.getElementById('appSidebar');
const drawerOverlay = document.getElementById('drawerOverlay');
const botsBtn = document.getElementById('botsBtn');
const botsModal = document.getElementById('botsModal');
const closeBotsModalBtn = document.getElementById('closeBotsModalBtn');
const accessibilityBtn = document.getElementById('accessibilityBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const pilotBtn = document.getElementById('pilotBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const consentModal = document.getElementById('consentModal');
const accountConsent = document.getElementById('accountConsent');
const acceptConsentBtn = document.getElementById('acceptConsentBtn');
const consentMessage = document.getElementById('consentMessage');

// PWA
const pwaBanner = document.getElementById('pwaBanner');
const installPwaBtn = document.getElementById('installPwaBtn');
const dismissPwaBtn = document.getElementById('dismissPwaBtn');
const installSidebarBtn = document.getElementById('installSidebarBtn');
const filterTabs = document.querySelectorAll('.filter-tab');
const persPills = document.querySelectorAll('.pers-pill');

// ==========================================================================
// HELPERS
// ==========================================================================
function getCategoryIcon(category) {
  switch (category) {
    case 'salud': return '💊';
    case 'compras': return '🛒';
    case 'trabajo': return '💼';
    case 'citas': return '⏰';
    case 'hogar': return '🏠';
    default: return '📌';
  }
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 13) return 'Buenos días';
  if (hour >= 13 && hour < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatTaskMeta(task) {
  const bits = [];
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    if (!Number.isNaN(d.getTime())) bits.push(`⏰ ${d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`);
  }
  if (task.recurrence) bits.push({ daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes' }[task.recurrence] || task.recurrence);
  return bits.join(' · ');
}

function cleanReminderTitleClient(rawText) {
  let cleaned = String(rawText || '').trim();
  cleaned = cleaned.replace(/^(nora|oye nora|por favor|hola)\s*,?\s*/i, '');
  cleaned = cleaned.replace(/^(recuérdame|recuerdame|recuerda|apúntame|apuntame|apunta|ponme|anota|añade|agrega|no olvides|no te olvides de|tengo que|debo|hay que)\s+/i, '');
  cleaned = cleaned.replace(/^(que tengo que|de que|de)\s+/i, '');
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned || 'Nuevo recordatorio';
}

// ==========================================================================
// 🌸 SELECTOR DE VOZ FEMENINA DULCE Y NATURAL DE NORA
// ==========================================================================
function getBestFemaleVoice() {
  if (!('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const maleKeywords = [
    'jorge', 'pablo', 'raul', 'raúl', 'diego', 'enrique', 'carlos', 'david',
    'mateo', 'gonzalo', 'manuel', 'javier', 'alvaro', 'álvaro', 'alonso',
    'sergio', 'male', 'hombre', 'miguel', 'antonio', 'pedro', 'guy', 'stefan'
  ];

  // Voces estilo Asistente de Google, Alexa y Siri (ordenadas por calidad y naturalidad)
  const priorityFemaleVoices = [
    'google español',
    'google spanish',
    'es-es-x-eed-network',
    'es-es-x-ana-network',
    'es-us-x-sfg-network',
    'elvira online (natural)',
    'dalia online (natural)',
    'salma online (natural)',
    'sabina online (natural)',
    'helena',
    'laura',
    'elvira',
    'monica',
    'mónica',
    'paulina',
    'paloma',
    'lucia',
    'lucía',
    'elena',
    'samantha',
    'spanish spain female',
    'female'
  ];

  const spanishVoices = voices.filter(v => {
    const lang = (v.lang || '').toLowerCase();
    return lang.startsWith('es') || lang.includes('spanish');
  });

  const femaleSpanishVoices = spanishVoices.filter(v => {
    const name = (v.name || '').toLowerCase();
    return !maleKeywords.some(mk => name.includes(mk));
  });

  for (const preferred of priorityFemaleVoices) {
    const match = femaleSpanishVoices.find(v => (v.name || '').toLowerCase().includes(preferred));
    if (match) return match;
  }

  if (femaleSpanishVoices.length > 0) return femaleSpanishVoices[0];
  return spanishVoices[0] || null;
}

// ==========================================================================
// SPEECH SYNTHESIS (TTS - Voz natural tipo Google Assistant / Alexa)
// ==========================================================================
function speakText(text) {
  return new Promise((resolve) => {
    if (state.isAudioMuted || !('speechSynthesis' in window)) {
      return resolve();
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '').trim();
    if (!cleanText) return resolve();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';

    // Parámetros acústicos naturales estilo Google Assistant / Alexa
    utterance.pitch = state.personality === 'cheerful' ? 1.08 : 1.04;
    utterance.rate = state.personality === 'executive' ? 1.02 : 0.98;

    const femaleVoice = getBestFemaleVoice();
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
      showVoiceBanner('Nora está hablando...', 'speaking');
      if (voiceBtn) voiceBtn.classList.add('speaking');
    };

    utterance.onend = () => {
      hideVoiceBanner();
      if (voiceBtn) voiceBtn.classList.remove('speaking');
      resolve();
    };

    utterance.onerror = () => {
      hideVoiceBanner();
      if (voiceBtn) voiceBtn.classList.remove('speaking');
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

function showVoiceBanner(text, mode = 'speaking') {
  if (!voiceStatusBanner) return;
  voiceStatusText.textContent = text;
  voiceStatusBanner.classList.remove('hidden');
}

function hideVoiceBanner() {
  if (!voiceStatusBanner) return;
  voiceStatusBanner.classList.add('hidden');
}

function updateAudioUI() {
  const label = state.isAudioMuted ? '🔇 Voz silenciada' : '🔊 Voz de Nora';
  if (audioToggleBtn) audioToggleBtn.textContent = label;
  if (audioToggleBtnMob) audioToggleBtnMob.textContent = state.isAudioMuted ? '🔇' : '🔊';
  localStorage.setItem('nora_audio_muted', String(state.isAudioMuted));
}

function toggleAudio() {
  state.isAudioMuted = !state.isAudioMuted;
  if (state.isAudioMuted && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    hideVoiceBanner();
    if (voiceBtn) voiceBtn.classList.remove('speaking');
  }
  updateAudioUI();
}

if (audioToggleBtn) audioToggleBtn.addEventListener('click', toggleAudio);
if (audioToggleBtnMob) audioToggleBtnMob.addEventListener('click', toggleAudio);

// ==========================================================================
// 🔒 LIVE PASSWORD STRENGTH VALIDATOR
// ==========================================================================
if (signupPassword) {
  signupPassword.addEventListener('input', () => {
    const val = signupPassword.value;
    
    const hasLen = val.length >= 8;
    const hasUpper = /[A-Z]/.test(val);
    const hasNum = /[0-9]/.test(val);
    const hasSpec = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(val);

    // Update requirements checklist
    updateReqItem(reqLength, hasLen);
    updateReqItem(reqUpper, hasUpper);
    updateReqItem(reqNumber, hasNum);
    updateReqItem(reqSpecial, hasSpec);

    // Calculate score
    const score = [hasLen, hasUpper, hasNum, hasSpec].filter(Boolean).length;
    passwordMeterFill.className = 'meter-fill';

    if (score === 0) {
      passwordMeterFill.style.width = '0%';
      passwordMeterLabel.textContent = 'Introduce una contraseña segura';
      passwordMeterLabel.style.color = 'var(--subtle)';
    } else if (score <= 1) {
      passwordMeterFill.classList.add('weak');
      passwordMeterLabel.textContent = '🔴 Contraseña débil (faltan requisitos)';
      passwordMeterLabel.style.color = '#f43f5e';
    } else if (score <= 2) {
      passwordMeterFill.classList.add('medium');
      passwordMeterLabel.textContent = '🟡 Seguridad media';
      passwordMeterLabel.style.color = '#f59e0b';
    } else if (score === 3) {
      passwordMeterFill.classList.add('good');
      passwordMeterLabel.textContent = '🔵 Seguridad buena';
      passwordMeterLabel.style.color = '#06b6d4';
    } else {
      passwordMeterFill.classList.add('strong');
      passwordMeterLabel.textContent = '🟢 ¡Contraseña segura y excelente!';
      passwordMeterLabel.style.color = '#10b981';
    }
  });
}

function updateReqItem(el, isValid) {
  if (!el) return;
  if (isValid) {
    el.classList.add('valid');
    el.querySelector('.req-icon').textContent = '✓';
  } else {
    el.classList.remove('valid');
    el.querySelector('.req-icon').textContent = '○';
  }
}

// ==========================================================================
// 🌸 ONBOARDING / MINI-GUÍA DE NORA
// ==========================================================================
function openOnboardingModal() {
  if (!onboardingModal) return;
  state.currentOnboardingStep = 1;
  showOnboardingSlide(1);
  onboardingModal.classList.remove('hidden');

  // Bienvenida hablada dulce de Nora al abrir la guía
  speakText('¡Hola, cielo! Qué alegría tenerte aquí. Soy Nora, tu asistente personal. Te he preparado esta pequeña guía para que le saques todo el partido.');
}

function closeOnboardingModal() {
  if (!onboardingModal) return;
  onboardingModal.classList.add('hidden');
  fetch('/api/user/onboarding-complete', { method: 'POST' }).catch(() => {});
}

function showOnboardingSlide(step) {
  state.currentOnboardingStep = step;
  
  // Hide all slides
  for (let i = 1; i <= 4; i++) {
    const slide = document.getElementById(`onboardingSlide${i}`);
    const dot = document.getElementById(`stepDot${i}`);
    if (slide) slide.classList.toggle('hidden', i !== step);
    if (dot) dot.classList.toggle('active', i === step);
  }

  // Navigation buttons
  if (prevSlideBtn) prevSlideBtn.classList.toggle('hidden', step === 1);
  if (nextSlideBtn) {
    nextSlideBtn.textContent = step === 4 ? '¡Empezar a usar Nora! 🚀' : 'Siguiente →';
  }
}

if (nextSlideBtn) {
  nextSlideBtn.addEventListener('click', () => {
    if (state.currentOnboardingStep < 4) {
      showOnboardingSlide(state.currentOnboardingStep + 1);
    } else {
      closeOnboardingModal();
      addMessage('assistant', '¡Listo, corazón! Ya conoces lo básico. Pulsa el micrófono cuando quieras y empezamos. 🌸', 'Nora');
    }
  });
}

if (prevSlideBtn) {
  prevSlideBtn.addEventListener('click', () => {
    if (state.currentOnboardingStep > 1) {
      showOnboardingSlide(state.currentOnboardingStep - 1);
    }
  });
}

if (closeOnboardingBtn) closeOnboardingBtn.addEventListener('click', closeOnboardingModal);
if (openGuideBtn) openGuideBtn.addEventListener('click', openOnboardingModal);

// ==========================================================================
// CHAT MESSAGES WITH DIRECT WHATSAPP BUTTON
// ==========================================================================
function addMessage(role, text, title, whatsappText = null) {
  const message = document.createElement('div');
  message.className = `message ${role}`;

  if (title) {
    const label = document.createElement('span');
    label.className = 'message-title';
    label.innerHTML = role === 'assistant' 
      ? `🌸 ${title}`
      : `👤 ${title}`;
    message.appendChild(label);
  }

  const content = document.createElement('div');
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
  content.innerHTML = formatted;
  message.appendChild(content);

  if (whatsappText) {
    const waLink = document.createElement('a');
    waLink.className = 'whatsapp-btn';
    waLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
    waLink.target = '_blank';
    waLink.rel = 'noopener noreferrer';
    waLink.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.079-2.121-.518-1.579-.659-2.58-2.27-2.658-2.373-.079-.104-.633-.842-.633-1.606 0-.764.397-1.14.538-1.293.141-.153.308-.192.41-.192.103 0 .205.002.296.006.095.005.223-.036.349.266.13.312.443 1.08.482 1.16.039.08.065.174.013.278-.052.104-.078.169-.155.26-.078.09-.163.201-.233.27-.078.077-.16.16-.068.318.092.158.409.675.877 1.092.602.536 1.109.702 1.267.781.158.078.251.069.345-.039.095-.109.408-.475.517-.638.109-.164.218-.137.367-.082.148.055.945.446 1.107.527.163.081.272.122.312.191.04.068.04.396-.104.801z"/>
      </svg>
      Enviar por WhatsApp
    `;
    message.appendChild(waLink);
  }

  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================================================
// ⚡ RESPUESTA DE VOZ INSTANTÁNEA EN EL ACTO (CERO LATENCIA)
// ==========================================================================
function isVoiceAction(text) {
  return /recuérdame|recuerdame|recordar|recordatorio|apunta|apúntame|anota|añade|agrega|compra|a la lista|dónde está|donde esta|guardé|guarde|en el cajón|en la mesa/i.test(text);
}

async function handleVoiceInteraction() {
  if (state.isVoiceActive) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage('assistant', 'Tu navegador no tiene activado el reconocimiento de voz. Puedes escribir en el recuadro.', 'Nora');
    return;
  }

  state.isVoiceActive = true;
  voiceBtn.disabled = true;

  try {
    const greeting = getGreeting();
    const question = '¿Qué quieres que te recuerde?';
    const fullPrompt = `${greeting}. ${question}`;

    addMessage('assistant', fullPrompt, 'Nora');
    speakText(fullPrompt);

    await new Promise((resolve) => {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let recognized = false;
      let settled = false;
      const finishRecognition = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const recognitionTimeout = setTimeout(() => {
        if (!recognized) {
          try { recognition.stop(); } catch (_) {}
          addMessage('assistant', 'No he recibido audio. Comprueba el permiso del micrófono y vuelve a intentarlo.', 'Nora');
        }
        finishRecognition();
      }, 12000);

      recognition.onstart = () => {
        voiceBtn.classList.add('listening');
        voiceBtn.textContent = '🔴';
        showVoiceBanner('🎙️ Nora te está escuchando...', 'listening');
      };

      recognition.onresult = async (event) => {
        recognized = true;
        clearTimeout(recognitionTimeout);
        const transcript = event.results[0][0].transcript;
        
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎙️';
        hideVoiceBanner();

        addMessage('user', transcript, 'Tú');

        const actionRequest = isVoiceAction(transcript);
        const endpoint = actionRequest ? '/api/conchi/voice-task' : '/api/conchi/message';
        const payload = actionRequest ? { transcript } : { text: transcript };

        if (actionRequest) {
          const cleanTitle = cleanReminderTitleClient(transcript);
          let instantSpeech = `¡Anotado, cariño! Ya te he guardado: ${cleanTitle}.`;
          if (state.personality === 'executive') instantSpeech = `Guardado: ${cleanTitle}.`;
          if (state.personality === 'cheerful') instantSpeech = `¡Hecho, corazón! Apuntadísimo: ${cleanTitle}.`;
          speakText(instantSpeech);
        } else {
          showVoiceBanner('Nora está preparando tu respuesta...', 'speaking');
        }

        // En paralelo, guardar la acción o resolver la conversación.
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (res.ok && (actionRequest ? data.ok : data.response)) {
            if (!actionRequest && data.response) {
              addMessage('assistant', data.response, 'Nora', data.whatsappText || null);
              await speakText(data.response);
            } else if (data.actionType === 'memory' && data.memoryVault) {
              state.memoryVault = data.memoryVault;
              renderMemory();
              addMessage('assistant', data.responseText, 'Nora');
            } else if (data.actionType === 'shopping' && data.shoppingList) {
              state.shoppingList = data.shoppingList;
              renderShopping();
              addMessage('assistant', data.responseText, 'Nora');
            } else if (data.tasks) {
              state.tasks = data.tasks;
              renderTasks();
              addMessage('assistant', data.responseText, 'Nora');
            }
          }
        } catch (err) {
          console.error('Error background sync voz:', err);
        }

        finishRecognition();
      };

      recognition.onerror = (event) => {
        clearTimeout(recognitionTimeout);
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎙️';
        hideVoiceBanner();
        if (!recognized) {
          addMessage('assistant', 'No te he escuchado con claridad, cielo. Pulsa el micro para intentarlo de nuevo.', 'Nora');
        }
        finishRecognition();
      };

      recognition.onend = () => {
        clearTimeout(recognitionTimeout);
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎙️';
        hideVoiceBanner();
        finishRecognition();
      };

      recognition.start();
    });

  } catch (error) {
    console.error('Voice error:', error);
  } finally {
    state.isVoiceActive = false;
    voiceBtn.disabled = false;
    voiceBtn.classList.remove('listening', 'speaking');
    voiceBtn.textContent = '🎙️';
    hideVoiceBanner();
  }
}

if (voiceBtn) voiceBtn.addEventListener('click', handleVoiceInteraction);

// ==========================================================================
// 🎙️ PODCAST MAÑANERO CON NORA (AUDIO RESUMEN DE 60s)
// ==========================================================================
async function playMorningPodcast() {
  showVoiceBanner('📻 Nora está preparando tu Podcast Mañanero...', 'speaking');
  try {
    const res = await fetch('/api/conchi/morning-podcast');
    const data = await res.json();
    if (res.ok && data.podcast) {
      addMessage('assistant', `📻 **Podcast del Día con Nora:**\n\n${data.podcast.script}`, 'Nora');
      await speakText(data.podcast.script);
    }
  } catch (err) {
    console.error('Error podcast:', err);
  } finally {
    hideVoiceBanner();
  }
}

if (podcastBtn) podcastBtn.addEventListener('click', playMorningPodcast);
if (podcastBtnMob) podcastBtnMob.addEventListener('click', playMorningPodcast);

// ==========================================================================
// 📸 ESCÁNER DE CITAS Y DOCUMENTOS CON CÁMARA
// ==========================================================================
if (cameraBtn && cameraInput) {
  cameraBtn.addEventListener('click', () => {
    cameraInput.click();
  });

  cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showVoiceBanner('📸 Nora está analizando tu documento con visión IA...', 'speaking');
    addMessage('user', '📷 [Foto de documento o cita subida para escanear]', 'Tú');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      try {
        const res = await fetch('/api/conchi/scan-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type || 'image/jpeg'
          })
        });

        const data = await res.json();
        hideVoiceBanner();
        if (res.ok && data.ok) {
          state.tasks = data.tasks || [];
          renderTasks();
          addMessage('assistant', `📸 **Cita/Documento extraído por Nora:**\n- **Título:** ${data.task.title}\n- **Detalles:** ${data.task.details}`, 'Nora');
          await speakText(`¡He leído tu papel, cielo! Ya te he guardado la cita: ${data.task.title}`);
        } else {
          addMessage('assistant', 'No se pudo leer la información del documento.', 'Nora');
        }
      } catch (err) {
        hideVoiceBanner();
        addMessage('assistant', 'Error de conexión al procesar la imagen.', 'Nora');
      }
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================================================
// 🎭 PERSONALITY SWITCHER
// ==========================================================================
persPills.forEach(pill => {
  pill.addEventListener('click', async () => {
    persPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const pers = pill.dataset.pers;
    state.personality = pers;

    await fetch('/api/user/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personality: pers })
    });

    const msg = pers === 'executive'
      ? 'Modo Ejecutivo activado. Respuestas directas y máxima eficiencia.'
      : pers === 'cheerful'
      ? '¡Modo Alegre activado! ¡Con una gran sonrisa y mucha energía para ti!'
      : 'Modo Cariñosa activado. Cuidándote en cada momento con todo mi cariño.';

    addMessage('assistant', msg, 'Nora');
    speakText(msg);
  });
});

// ==========================================================================
// 🧠 BAÚL DE RECUERDOS (¿Dónde dejé mis cosas?)
// ==========================================================================
async function loadMemory() {
  try {
    const res = await fetch('/api/memory');
    const data = await res.json();
    state.memoryVault = data.memoryVault || [];
    renderMemory();
  } catch (err) {
    state.memoryVault = [];
  }
}

function renderMemory() {
  if (!memoryList) return;
  memoryList.innerHTML = '';
  if (memoryCountBadge) memoryCountBadge.textContent = state.memoryVault.length;

  if (!state.memoryVault.length) {
    const empty = document.createElement('li');
    empty.className = 'memory-card';
    empty.style.justifyContent = 'center';
    empty.style.color = 'var(--subtle)';
    empty.innerHTML = '<span>El baúl está vacío. Guarda dónde dejas tus llaves, pasaporte o cosas importantes.</span>';
    memoryList.appendChild(empty);
    return;
  }

  state.memoryVault.forEach(mem => {
    const li = document.createElement('li');
    li.className = 'memory-card';

    const header = document.createElement('div');
    header.className = 'memory-header';

    const title = document.createElement('span');
    title.className = 'memory-item-title';
    title.textContent = `🔑 ${mem.item}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Olvidar este recuerdo';
    delBtn.addEventListener('click', async () => {
      const res = await fetch(`/api/memory/${mem.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.memoryVault) {
        state.memoryVault = data.memoryVault;
        renderMemory();
      }
    });

    header.appendChild(title);
    header.appendChild(delBtn);

    const loc = document.createElement('span');
    loc.className = 'memory-location';
    loc.textContent = `📍 ${mem.location}`;

    li.appendChild(header);
    li.appendChild(loc);
    memoryList.appendChild(li);
  });
}

if (memoryForm) {
  memoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = memoryItemInput.value.trim();
    const location = memoryLocationInput.value.trim();
    if (!item || !location) return;

    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, location })
    });

    const data = await res.json();
    memoryItemInput.value = '';
    memoryLocationInput.value = '';
    if (data.memoryVault) {
      state.memoryVault = data.memoryVault;
      renderMemory();
    }
    addMessage('assistant', `🧠 Guardado en tu Baúl: **${item}** en *${location}*.`, 'Nora');
  });
}

// ==========================================================================
// 🛒 LISTA DE LA COMPRA INTELIGENTE POR PASILLOS
// ==========================================================================
async function loadShopping() {
  try {
    const res = await fetch('/api/shopping');
    const data = await res.json();
    state.shoppingList = data.shoppingList || [];
    renderShopping();
  } catch (err) {
    state.shoppingList = [];
  }
}

function renderShopping() {
  if (!shoppingAislesContainer) return;
  shoppingAislesContainer.innerHTML = '';

  if (!state.shoppingList.length) {
    shoppingAislesContainer.innerHTML = '<p class="section-desc" style="text-align:center; padding: 20px;">Tu lista de la compra está vacía.</p>';
    return;
  }

  const grouped = {};
  state.shoppingList.forEach(item => {
    const label = item.aisleLabel || '🥫 Despensa y Varios';
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  });

  Object.entries(grouped).forEach(([label, items]) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'aisle-group';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'aisle-label';
    labelSpan.textContent = label;
    groupDiv.appendChild(labelSpan);

    const ul = document.createElement('ul');
    ul.className = 'shop-item-list';

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = `shop-item ${item.bought ? 'bought' : ''}`;

      const text = document.createElement('span');
      text.textContent = item.name;

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const check = document.createElement('button');
      check.className = 'check-btn';
      check.textContent = item.bought ? '✓' : '○';
      check.addEventListener('click', async () => {
        const res = await fetch(`/api/shopping/${item.id}/toggle`, { method: 'POST' });
        const data = await res.json();
        if (data.shoppingList) {
          state.shoppingList = data.shoppingList;
          renderShopping();
        }
      });

      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.textContent = '✕';
      del.addEventListener('click', async () => {
        const res = await fetch(`/api/shopping/${item.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.shoppingList) {
          state.shoppingList = data.shoppingList;
          renderShopping();
        }
      });

      actions.appendChild(check);
      actions.appendChild(del);
      li.appendChild(text);
      li.appendChild(actions);
      ul.appendChild(li);
    });

    groupDiv.appendChild(ul);
    shoppingAislesContainer.appendChild(groupDiv);
  });
}

if (shoppingForm) {
  shoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = shoppingInput.value.trim();
    if (!text) return;

    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    shoppingInput.value = '';
    if (data.shoppingList) {
      state.shoppingList = data.shoppingList;
      renderShopping();
    }
    addMessage('assistant', `🛒 Añadido a la compra: “${text}”.`, 'Nora');
  });
}

if (clearBoughtBtn) {
  clearBoughtBtn.addEventListener('click', async () => {
    const res = await fetch('/api/shopping/clear-bought', { method: 'POST' });
    const data = await res.json();
    if (data.shoppingList) {
      state.shoppingList = data.shoppingList;
      renderShopping();
    }
  });
}

// ==========================================================================
// 🚨 SOS EMERGENCY MODAL & ACTIONS
// ==========================================================================
function openSosModal() {
  if (sosModal) {
    sosNameInput.value = state.emergencyContact.name || '';
    sosPhoneInput.value = state.emergencyContact.phone || '';
    sosModal.classList.remove('hidden');
  }
}

function closeSosModal() {
  if (sosModal) sosModal.classList.add('hidden');
}

if (sosBtn) sosBtn.addEventListener('click', () => triggerSosAlert());
if (sosBtnMob) sosBtnMob.addEventListener('click', () => triggerSosAlert());
if (sosSettingsBtn) sosSettingsBtn.addEventListener('click', openSosModal);
if (closeSosModalBtn) closeSosModalBtn.addEventListener('click', closeSosModal);

if (sosForm) {
  sosForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = sosNameInput.value.trim();
    const phone = sosPhoneInput.value.trim();
    state.emergencyContact = { name, phone };

    await fetch('/api/user/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emergencyContact: state.emergencyContact })
    });

    closeSosModal();
    addMessage('assistant', `🚨 Contacto de emergencia SOS guardado: **${name}** (${phone}).`, 'Nora');
  });
}

function triggerSosAlert() {
  if (!state.emergencyContact.phone) {
    openSosModal();
    return;
  }
  const user = state.user ? state.user.name : 'Usuario';
  const msg = `🚨 [AVISO DE EMERGENCIA]: ${user} necesita asistencia o contacto inmediato. Enviado a través de Nora Tu Asistente Personal.`;
  const waUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(state.emergencyContact.phone)}&text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

if (testSosAlertBtn) {
  testSosAlertBtn.addEventListener('click', triggerSosAlert);
}

// ==========================================================================
// SUB-TABS NAVIGATION
// ==========================================================================
function switchMainTab(tab) {
  state.activeMainTab = tab;
  [tabTasksBtn, tabMemoryBtn, tabShoppingBtn].forEach(b => b && b.classList.remove('active'));
  [tasksView, memoryView, shoppingView].forEach(v => v && v.classList.add('hidden'));

  if (tab === 'tasks') {
    if (tabTasksBtn) tabTasksBtn.classList.add('active');
    if (tasksView) tasksView.classList.remove('hidden');
  } else if (tab === 'memory') {
    if (tabMemoryBtn) tabMemoryBtn.classList.add('active');
    if (memoryView) memoryView.classList.remove('hidden');
    loadMemory();
  } else if (tab === 'shopping') {
    if (tabShoppingBtn) tabShoppingBtn.classList.add('active');
    if (shoppingView) shoppingView.classList.remove('hidden');
    loadShopping();
  }
}

if (tabTasksBtn) tabTasksBtn.addEventListener('click', () => switchMainTab('tasks'));
if (tabMemoryBtn) tabMemoryBtn.addEventListener('click', () => switchMainTab('memory'));
if (tabShoppingBtn) tabShoppingBtn.addEventListener('click', () => switchMainTab('shopping'));

// ==========================================================================
// AUTHENTICATION & SESSION
// ==========================================================================
function showAuthScreen() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showAppScreen() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
}

function openConsentModal() {
  consentMessage.textContent = '';
  accountConsent.checked = false;
  consentModal.classList.remove('hidden');
}

async function acceptAccountConsent() {
  if (!accountConsent.checked) {
    consentMessage.textContent = 'Marca la casilla para continuar.';
    return;
  }

  acceptConsentBtn.disabled = true;
  try {
    const response = await fetch('/api/user/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted: true })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo guardar el consentimiento.');
    state.user = data.user;
    consentModal.classList.add('hidden');
    await loadTasks();
    await loadMemory();
    await loadShopping();
    if (state.user.hasSeenOnboarding === false) openOnboardingModal();
  } catch (error) {
    consentMessage.textContent = error.message;
  } finally {
    acceptConsentBtn.disabled = false;
  }
}

if (acceptConsentBtn) acceptConsentBtn.addEventListener('click', acceptAccountConsent);

async function loadSession() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    if (!data.user) {
      state.user = null;
      showAuthScreen();
      return;
    }

    state.user = data.user;
    state.personality = data.user.personality || 'affectionate';
    state.emergencyContact = data.user.emergencyContact || { name: '', phone: '' };
    userName.textContent = data.user.name;

    persPills.forEach(p => {
      p.classList.toggle('active', p.dataset.pers === state.personality);
    });

    showAppScreen();
    if (!data.user.privacyConsentAt || !data.user.termsConsentAt) {
      openConsentModal();
      return;
    }
    await loadTasks();
    await loadMemory();
    await loadShopping();

    // 🌸 Comprobar si es usuario nuevo para mostrar el Onboarding guiado
    if (data.user.hasSeenOnboarding === false) {
      setTimeout(() => {
        openOnboardingModal();
      }, 500);
    } else {
      const greeting = getGreeting();
      const shortName = data.user.name.split(' ')[0];
      addMessage(
        'assistant',
        `¡${greeting}, ${shortName} cielo! Soy **Nora**, tu asistente personal. ¿En qué te ayudo hoy? Puedes dictarme cualquier tarea, preguntarme dónde dejaste tus cosas o escuchar tu **Podcast Mañanero**.`,
        'Nora'
      );
    }
  } catch (error) {
    showAuthScreen();
    if (window.location.protocol !== 'file:' && authMessage) authMessage.textContent = 'No se pudo conectar con Nora. Comprueba que el servidor esté iniciado en http://localhost:3000.';
  }
}

const authParams = new URLSearchParams(window.location.search);
if (authParams.get('auth') === 'google-error' && authMessage) {
  authMessage.textContent = 'No se pudo completar el acceso con Google. Revisa la URL autorizada y vuelve a intentarlo.';
  window.history.replaceState({}, document.title, window.location.pathname);
}

async function handleAuthResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudo completar la operación.');
  }
  return data;
}

async function loginWithEmail(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await handleAuthResponse(response);
  state.user = data.user;
  userName.textContent = state.user.name;
  showAppScreen();
  await loadTasks();
  await loadMemory();
  await loadShopping();
  const shortName = state.user.name.split(' ')[0];
  addMessage('assistant', `Bienvenido de nuevo, ${shortName} cariño. Nora está lista para ayudarte hoy.`, 'Nora');
}

async function signupWithEmail(name, email, password) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, consentAccepted: Boolean(privacyConsent?.checked) })
  });

  const data = await handleAuthResponse(response);
  state.user = data.user;
  userName.textContent = state.user.name;
  showAppScreen();
  await loadTasks();
  await loadMemory();
  await loadShopping();
  
  // Abrir onboarding guiado para la persona recién registrada
  setTimeout(() => {
    openOnboardingModal();
  }, 400);
}

showLoginBtn.addEventListener('click', () => {
  showLoginBtn.classList.add('active');
  showRegisterBtn.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  authMessage.textContent = '';
});

showRegisterBtn.addEventListener('click', () => {
  showRegisterBtn.classList.add('active');
  showLoginBtn.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  authMessage.textContent = '';
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    await loginWithEmail(email, password);
    loginForm.reset();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  try {
    await signupWithEmail(name, email, password);
    signupForm.reset();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', () => {
    window.location.href = '/auth/google';
  });
}

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout');
  state.user = null;
  state.tasks = [];
  state.memoryVault = [];
  state.shoppingList = [];
  chatMessages.innerHTML = '';
  showAuthScreen();
});

// ==========================================================================
// TASK MANAGER (CRUD & FILTERS)
// ==========================================================================
async function loadTasks() {
  try {
    const response = await fetch('/api/tasks');
    const data = await response.json();
    state.tasks = data.tasks || [];
    renderTasks();
  } catch (error) {
    state.tasks = [];
    renderTasks();
  }
}

const notifiedTasks = new Set(JSON.parse(localStorage.getItem('nora_notified_tasks') || '[]'));
function checkDueTaskNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  state.tasks.filter(task => !task.completed && task.dueDate).forEach(task => {
    const due = new Date(task.dueDate).getTime();
    if (due > now - 60000 && due <= now + 5 * 60000 && !notifiedTasks.has(task.id)) {
      new Notification('Recordatorio de Nora', { body: task.title });
      notifiedTasks.add(task.id);
    }
  });
  localStorage.setItem('nora_notified_tasks', JSON.stringify([...notifiedTasks].slice(-200)));
}
setInterval(checkDueTaskNotifications, 30000);

function renderTasks() {
  if (!taskList) return;
  taskList.innerHTML = '';

  const totalPending = state.tasks.filter(t => !t.completed).length;
  if (taskCountBadge) taskCountBadge.textContent = totalPending;

  let filteredTasks = state.tasks;
  if (state.taskSearch) {
    const query = state.taskSearch.toLowerCase();
    filteredTasks = filteredTasks.filter(t => `${t.title} ${t.details || ''}`.toLowerCase().includes(query));
  }
  if (state.activeFilter === 'pending') {
    filteredTasks = state.tasks.filter(t => !t.completed);
  } else if (state.activeFilter === 'completed') {
    filteredTasks = state.tasks.filter(t => t.completed);
  }

  if (!filteredTasks.length) {
    const empty = document.createElement('li');
    empty.className = 'task-item';
    empty.style.justifyContent = 'center';
    empty.style.color = 'var(--subtle)';
    empty.innerHTML = '<span>No hay tareas en esta sección.</span>';
    taskList.appendChild(empty);
    return;
  }

  filteredTasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'done' : ''}`;

    const icon = document.createElement('span');
    icon.className = 'task-icon';
    icon.textContent = getCategoryIcon(task.category);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.title;
    contentDiv.appendChild(text);
    const meta = formatTaskMeta(task);
    if (meta) {
      const metaEl = document.createElement('small');
      metaEl.className = 'task-meta';
      metaEl.textContent = meta;
      contentDiv.appendChild(metaEl);
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'task-actions';

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'check-btn';
    checkBtn.title = task.completed ? 'Marcar como pendiente' : 'Marcar como completada';
    checkBtn.textContent = task.completed ? '✓' : '○';
    checkBtn.addEventListener('click', async () => {
      const res = await fetch(`/api/tasks/${task.id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.tasks) {
        state.tasks = data.tasks;
        renderTasks();
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Eliminar tarea';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', async () => {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.tasks) {
        state.tasks = data.tasks;
        renderTasks();
      }
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button'; editBtn.className = 'edit-btn'; editBtn.title = 'Editar tarea'; editBtn.textContent = '✎';
    editBtn.addEventListener('click', async () => {
      const title = window.prompt('Título de la tarea:', task.title);
      if (title === null || !title.trim()) return;
      const due = window.prompt('Fecha ISO opcional (ej. 2026-09-03T09:00):', task.dueDate || '');
      const response = await fetch(`/api/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, details: task.details || '', dueDate: due || null, recurrence: task.recurrence || null, category: task.category }) });
      const data = await response.json();
      if (data.tasks) { state.tasks = data.tasks; renderTasks(); addMessage('assistant', 'He actualizado tu tarea, cariño.', 'Nora'); }
    });

    actionsDiv.appendChild(checkBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(icon);
    li.appendChild(contentDiv);
    li.appendChild(actionsDiv);
    taskList.appendChild(li);
  });
}

filterTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeFilter = tab.dataset.filter;
    renderTasks();
  });
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = taskInput.value.trim();
  if (!value) return;

  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: value, dueDate: taskDueDate?.value || null, recurrence: taskRecurrence?.value || null })
  });

  const data = await res.json();
  taskInput.value = '';
  if (taskDueDate) taskDueDate.value = '';
  if (taskRecurrence) taskRecurrence.value = '';
  if (data.tasks) {
    state.tasks = data.tasks;
    renderTasks();
  }
  addMessage('assistant', `He añadido a tu lista, cielo: “${value}”.`, 'Nora');
});

if (taskSearch) taskSearch.addEventListener('input', () => { state.taskSearch = taskSearch.value.trim(); renderTasks(); });

async function requestNotifications() {
  if (!('Notification' in window)) return addMessage('assistant', 'Este dispositivo no permite avisos del navegador todavía, cielo.', 'Nora');
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    new Notification('Nora está lista', { body: 'Te avisaré de tus recordatorios importantes.' });
    if (enableNotificationsBtn) enableNotificationsBtn.textContent = '🔔 Avisos activos';
  } else addMessage('assistant', 'Puedes activar los avisos cuando quieras desde los permisos del navegador.', 'Nora');
}
if (enableNotificationsBtn) enableNotificationsBtn.addEventListener('click', requestNotifications);

if (exportDataBtn) exportDataBtn.addEventListener('click', () => { window.location.href = '/api/user/export'; });
if (calendarExportBtn) calendarExportBtn.addEventListener('click', () => { window.location.href = '/api/calendar.ics'; });

if (pilotBtn) pilotBtn.addEventListener('click', async () => {
  const message = window.prompt('Cuéntanos quién probaría Nora en el piloto (familia, cuidador, autónomo o empresa):');
  if (message === null) return;
  const response = await fetch('/api/pilot/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
  const data = await response.json();
  addMessage('assistant', data.message || 'Hemos registrado tu interés, corazón.', 'Nora');
});
if (upgradeBtn) upgradeBtn.addEventListener('click', () => { window.location.href = '/api/billing/checkout'; });

function openBots() { botsModal?.classList.remove('hidden'); }
function closeBots() { botsModal?.classList.add('hidden'); }
if (botsBtn) botsBtn.addEventListener('click', openBots);
if (closeBotsModalBtn) closeBotsModalBtn.addEventListener('click', closeBots);
document.querySelectorAll('.bot-card').forEach((btn) => btn.addEventListener('click', () => {
  const prompts = { agenda: 'Ayúdame a organizar mi agenda de hoy.', rutinas: 'Quiero crear una rutina recurrente.', familia: 'Quiero preparar una tarea para compartir con mi familia.', documentos: 'Quiero revisar documentos y fechas de renovación.', bienestar: 'Hazme un check-in de bienestar y hábitos, sin diagnosticar.', seguridad: 'Dime cómo mejorar la seguridad de mi cuenta.' };
  closeBots(); if (userInput) { userInput.value = prompts[btn.dataset.bot]; assistantForm?.requestSubmit(); }
}));

if (accessibilityBtn) accessibilityBtn.addEventListener('click', () => {
  document.body.classList.toggle('accessible-mode');
  const enabled = document.body.classList.contains('accessible-mode');
  localStorage.setItem('nora_accessible', String(enabled));
  accessibilityBtn.textContent = enabled ? '👁️ Modo normal' : '👁️ Modo accesible';
});
if (localStorage.getItem('nora_accessible') === 'true') { document.body.classList.add('accessible-mode'); if (accessibilityBtn) accessibilityBtn.textContent = '👁️ Modo normal'; }

if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', async () => {
  if (!window.confirm('Se borrarán tus tareas, memoria, compras y contacto SOS. Esta acción no se puede deshacer. ¿Continuar?')) return;
  const response = await fetch('/api/user/account', { method: 'DELETE' });
  if (response.ok) { state.user = null; showAuthScreen(); window.alert('Tus datos se han borrado correctamente.'); }
});

// ==========================================================================
// CHAT & COMPOSER FORM
// ==========================================================================
assistantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage('user', text, 'Tú');
  userInput.value = '';
  sendBtn.disabled = true;

  try {
    const endpoint = state.pendingWhatsapp ? '/api/conchi/whatsapp-reply' : '/api/conchi/message';
    const payload = state.pendingWhatsapp ? { message: text } : { text };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'No pude responderte ahora.');
    }

    state.pendingWhatsapp = false;
    addMessage('assistant', data.response, 'Nora', data.whatsappText);
    
    if (data.tasks) {
      state.tasks = data.tasks;
      renderTasks();
    } else {
      await loadTasks();
    }

    if (!state.isAudioMuted && data.response && !data.hasWhatsappButton) {
      speakText(data.response);
    }
  } catch (error) {
    addMessage('assistant', error.message, 'Nora');
  } finally {
    sendBtn.disabled = false;
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    userInput.value = chip.dataset.text;
    assistantForm.requestSubmit();
    closeMobileDrawer();
  });
});

// ==========================================================================
// MOBILE DRAWER
// ==========================================================================
function openMobileDrawer() {
  if (appSidebar) appSidebar.classList.add('open');
  if (drawerOverlay) drawerOverlay.classList.remove('hidden');
}

function closeMobileDrawer() {
  if (appSidebar) appSidebar.classList.remove('open');
  if (drawerOverlay) drawerOverlay.classList.add('hidden');
}

if (menuToggleBtn) menuToggleBtn.addEventListener('click', openMobileDrawer);
if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeMobileDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeMobileDrawer);

// ==========================================================================
// PWA INSTALLATION & SERVICE WORKER
// ==========================================================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;

  if (pwaBanner) pwaBanner.classList.remove('hidden');
  if (installSidebarBtn) installSidebarBtn.classList.remove('hidden');
});

if (installPwaBtn) {
  installPwaBtn.addEventListener('click', async () => {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        if (pwaBanner) pwaBanner.classList.add('hidden');
      }
      state.deferredInstallPrompt = null;
    }
  });
}

if (installSidebarBtn) {
  installSidebarBtn.addEventListener('click', async () => {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      state.deferredInstallPrompt = null;
    } else {
      alert('Para instalar Nora en iOS / Safari: Pulsa "Compartir" y luego "Añadir a pantalla de inicio".');
    }
  });
}

if (dismissPwaBtn) {
  dismissPwaBtn.addEventListener('click', () => {
    if (pwaBanner) pwaBanner.classList.add('hidden');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.warn);
  });
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getBestFemaleVoice();
  };
}

updateAudioUI();
loadSession();
