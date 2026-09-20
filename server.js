const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
require('dotenv').config();

const {
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
} = require('./gemini');

console.log('🔍 Verificando configuración del sistema Nora:');
console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓' : '✗');
console.log('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓' : '✗');
console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓' : '✗');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['SESSION_SECRET', 'DATA_ENCRYPTION_KEY'];
  const missing = required.filter((key) => !process.env[key] || process.env[key].length < 32);
  const hasManagedStorage = Boolean(
    process.env.DATABASE_URL || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  if (!hasManagedStorage) {
    missing.push('DATABASE_URL o SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CALLBACK_URL && !process.env.GOOGLE_CALLBACK_URL.startsWith('https://')) {
    missing.push('GOOGLE_CALLBACK_URL HTTPS');
  }
  if (missing.length) {
    throw new Error(`Configuración de producción incompleta: ${missing.join(', ')}`);
  }
}

validateProductionConfig();

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]', 'utf8');
}

app.set('trust proxy', 1);

// 🛡️ SECURITY HEADERS MIDDLEWARE
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  next();
});

// 🛡️ RATE LIMITING / BRUTE FORCE PROTECTION
const authAttempts = new Map(); // IP -> { count, lastAttempt }
function rateLimitAuth(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = authAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 15 * 60 * 1000;
  }

  if (record.count >= 10) {
    const minutesLeft = Math.ceil((record.resetAt - now) / 60000);
    return res.status(429).json({
      message: `Demasiados intentos. Por seguridad, espera ${minutesLeft} minutos antes de volver a intentarlo.`
    });
  }

  record.count++;
  authAttempts.set(ip, record);
  next();
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(
  session({
    secret: sessionSecret,
    store: storage.getSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

function loadUsers() {
  return storage.loadUsers();
}

function saveUsers(users) {
  storage.saveUsers(users);
}

function findUserByEmail(email) {
  return loadUsers().find(
    (user) => user.email && user.email.toLowerCase() === String(email).toLowerCase()
  );
}

function findUserById(id) {
  return loadUsers().find((user) => user.id === id);
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider || 'local',
    personality: user.personality || 'affectionate',
    hasSeenOnboarding: user.hasSeenOnboarding !== false, // boolean
    isNewUser: Boolean(user.isNewUser),
    tasks: Array.isArray(user.tasks) ? user.tasks : [],
    memoryVault: Array.isArray(user.memoryVault) ? user.memoryVault : [],
    shoppingList: Array.isArray(user.shoppingList) ? user.shoppingList : [],
    emergencyContact: user.emergencyContact || { name: '', phone: '' },
    privacyConsentAt: user.privacyConsentAt || null,
    termsConsentAt: user.termsConsentAt || null
  };
}

function persistUserUpdate(userId, updater) {
  const users = loadUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return null;
  
  if (!Array.isArray(users[index].tasks)) users[index].tasks = [];
  if (!Array.isArray(users[index].memoryVault)) users[index].memoryVault = [];
  if (!Array.isArray(users[index].shoppingList)) users[index].shoppingList = [];
  if (!users[index].personality) users[index].personality = 'affectionate';
  if (!users[index].emergencyContact) users[index].emergencyContact = { name: '', phone: '' };

  const updated = updater(users[index]);
  users[index] = updated;
  saveUsers(users);
  return updated;
}

/**
 * 🔒 Validación estricta de requisitos de contraseña
 */
function validatePasswordStrength(password) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'La contraseña debe incluir al menos una letra mayúscula (A-Z).';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'La contraseña debe incluir al menos una letra minúscula (a-z).';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'La contraseña debe incluir al menos un número (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)) {
    return 'La contraseña debe incluir al menos un carácter especial (@, $, !, %, *, #, etc.).';
  }
  return null; // Válida
}

function createTaskObject(title, details = '', category = null, dueDate = null, recurrence = null) {
  const cleanTitle = String(title || '').trim();
  const cat = category || inferCategory(cleanTitle);
  return {
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: cleanTitle,
    details: String(details || '').trim(),
    category: cat,
    dueDate: dueDate || null,
    recurrence: recurrence || null,
    completed: false,
    createdAt: new Date().toISOString()
  };
}

function getTaskSummary(tasks) {
  if (!tasks || tasks.length === 0) {
    return 'Todavía no tienes tareas guardadas. Pulsa el micrófono para dictarme tu primer recordatorio.';
  }

  const pending = tasks.filter((task) => !task.completed);
  if (!pending.length) {
    return '¡Enhorabuena, corazón! Has completado todas tus tareas de hoy.';
  }

  const nextTask = pending[0];
  const remaining = pending.length;
  return `Tienes ${remaining} tarea${remaining > 1 ? 's' : ''} pendiente${remaining > 1 ? 's' : ''}. La más prioritaria es: “${nextTask.title}”.`;
}

function generateWhatsappReply(message, personality = 'affectionate') {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (!text) {
    return '“Gracias por tu mensaje. Lo he recibido y te respondo en cuanto me sea posible.”';
  }

  if (personality === 'executive') {
    if (lower.includes('gracias')) return '“Agradezco tu mensaje. Quedo a tu disposición.”';
    if (lower.includes('mañana') || lower.includes('hora') || lower.includes('cita')) {
      return `“Confirmada la disponibilidad para: ${cleaned}. Saludos cordiales.”`;
    }
    return `“Recibido tu mensaje sobre: ${cleaned}. Procedo a gestionarlo.”`;
  }

  if (lower.includes('gracias')) {
    return '“¡Muchísimas gracias a ti! Me alegra haber podido ayudarte. Quedo a tu disposición para lo que necesites.”';
  }
  if (lower.includes('mañana') || lower.includes('hora') || lower.includes('cita')) {
    return `“Perfecto, tomo nota de la fecha y hora: ${cleaned}. Te confirmo que estaré disponible. ¡Hablamos pronto!”`;
  }
  if (lower.includes('no puedo') || lower.includes('imposible') || lower.includes('cancelar')) {
    return '“Entiendo perfectamente. No te preocupes por el cambio, lo reprogramamos para otro día que te venga mejor. Avísame cuando tengas un hueco.”';
  }
  if (lower.includes('urgente') || lower.includes('importante')) {
    return '“Recibido con máxima prioridad. Ya me pongo con ello para resolvértelo lo más pronto posible.”';
  }

  return `“Hola, gracias por escribirme. He revisado tu mensaje sobre: '${cleaned}'. Te confirmo la gestión y te mantengo al tanto.”`;
}

// Passport Auth Setup
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = findUserById(id);
  done(null, user ? sanitizeUser(user) : null);
});

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    const user = findUserByEmail(email);
    if (!user) {
      return done(null, false, { message: 'Ese correo electrónico no está registrado.' });
    }

    if (user.provider && user.provider !== 'local') {
      return done(null, false, {
        message: 'Este usuario usa una cuenta de Google. Inicia sesión con el botón de Google.'
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash || '');
    if (!valid) {
      return done(null, false, { message: 'La contraseña introducida es incorrecta.' });
    }

    return done(null, sanitizeUser(user));
  })
);

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          if (!email) {
            return done(new Error('No se pudo obtener el correo de Google.'));
          }

          let users = loadUsers();
          let user = users.find(
            (item) => item.email && item.email.toLowerCase() === email.toLowerCase()
          );

          if (!user) {
            user = {
              id: `google-${Date.now()}`,
              name: profile.displayName || 'Usuario de Google',
              email,
              provider: 'google',
              personality: 'affectionate',
              hasSeenOnboarding: false,
              isNewUser: true,
              tasks: [],
              memoryVault: [],
              shoppingList: [],
              emergencyContact: { name: '', phone: '' },
              privacyConsentAt: null,
              termsConsentAt: null
            };
            users.push(user);
            saveUsers(users);
          }

          storage.trackEvent(user.id, 'login', { provider: 'google' });
          return done(null, sanitizeUser(user));
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.path !== '/api/user/consent' && (!req.user.privacyConsentAt || !req.user.termsConsentAt)) {
      return res.status(428).json({
        code: 'CONSENT_REQUIRED',
        message: 'Debes aceptar la política de privacidad y los términos para continuar.'
      });
    }
    return next();
  }
  return res.status(401).json({ message: 'Debes iniciar sesión primero para usar Nora.' });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'Nora | Tu Asistente Personal',
    status: 'online',
    version: '3.2.0',
    security: 'Hardened + Password Policy Active',
    aiProvider: process.env.GEMINI_API_KEY ? 'Gemini 3.6 Flash Active' : 'Fast Heuristic Active',
    storage: storage.getStatus()
  });
});

// Admin / Bot Telemetry & Security Status
app.get('/api/admin/security-status', ensureAuthenticated, (req, res) => {
  const users = loadUsers();
  const backupsDir = path.join(dataDir, 'backups');
  let backupsCount = 0;
  if (fs.existsSync(backupsDir)) {
    backupsCount = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json')).length;
  }

  res.json({
    ok: true,
    server: 'Nora Production Node Service',
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    registeredUsersCount: users.length,
    automatedBackupsCount: backupsCount,
    rateLimiterActive: true,
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user ? sanitizeUser(req.user) : null });
});

// 🔒 REGISTRO CON REQUISITOS ESTRICTOS DE CONTRASEÑA Y RATE LIMITING
app.post('/api/auth/signup', rateLimitAuth, async (req, res) => {
  const { name, email, password, consentAccepted } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios.' });
  }
  if (!consentAccepted) {
    return res.status(400).json({ message: 'Debes aceptar la política de privacidad para crear tu cuenta.' });
  }

  // 🔒 Validación estricta de seguridad
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ message: passwordError });
  }

  const users = loadUsers();
  if (users.some((user) => user.email && user.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ message: 'Ya existe una cuenta registrada con este correo.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const newUser = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: String(name).trim(),
    email: String(email).trim(),
    passwordHash,
    provider: 'local',
    personality: 'affectionate',
    hasSeenOnboarding: false, // Flag para activar Onboarding guiado
    isNewUser: true,
    tasks: [],
    memoryVault: [],
    shoppingList: [],
    emergencyContact: { name: '', phone: '' },
    privacyConsentAt: new Date().toISOString(),
    termsConsentAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  storage.trackEvent(newUser.id, 'signup', { provider: 'local' });

  req.login(sanitizeUser(newUser), (error) => {
    if (error) {
      return res.status(500).json({ message: 'No se pudo iniciar la sesión automáticamente.' });
    }
    res.json({ ok: true, user: sanitizeUser(newUser), isNewUser: true });
  });
});

app.post('/api/auth/login', rateLimitAuth, (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      return res.status(401).json({
        message: info && info.message ? info.message : 'No se pudo iniciar sesión.'
      });
    }

    req.login(user, (loginError) => {
      if (loginError) return next(loginError);
      storage.trackEvent(user.id, 'login', { provider: 'local' });
      return res.json({ ok: true, user });
    });
  })(req, res, next);
});

app.get('/api/auth/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    res.json({ ok: true });
  });
});

app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({
      message: 'Google OAuth aún no está configurado.'
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=google-error' }),
  (req, res) => {
    res.redirect('/');
  }
);

// User Settings & Onboarding Completion
app.post('/api/user/onboarding-complete', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.hasSeenOnboarding = true;
    user.isNewUser = false;
    return user;
  });
  res.json({ ok: true, user: sanitizeUser(updatedUser) });
});

app.get('/api/user/settings', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  res.json({
    personality: user.personality || 'affectionate',
    emergencyContact: user.emergencyContact || { name: '', phone: '' },
    hasSeenOnboarding: user.hasSeenOnboarding !== false
  });
});

app.post('/api/user/settings', ensureAuthenticated, (req, res) => {
  const { personality, emergencyContact } = req.body || {};
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    if (personality) user.personality = personality;
    if (emergencyContact) user.emergencyContact = emergencyContact;
    return user;
  });
  res.json({ ok: true, user: sanitizeUser(updatedUser) });
});

app.post('/api/user/consent', ensureAuthenticated, (req, res) => {
  const now = new Date().toISOString();
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.privacyConsentAt = now;
    user.termsConsentAt = now;
    return user;
  });
  storage.trackEvent(req.user.id, 'consent_updated');
  res.json({ ok: true, user: sanitizeUser(updatedUser) });
});

app.get('/api/metrics', ensureAuthenticated, async (req, res) => {
  res.json({ ok: true, metrics: await storage.getMetrics(), storage: storage.getStatus() });
});

app.get('/api/billing/checkout', ensureAuthenticated, (req, res) => {
  if (!process.env.STRIPE_PAYMENT_LINK) return res.status(503).json({ message: 'El plan de pago todavía no está configurado.' });
  res.redirect(process.env.STRIPE_PAYMENT_LINK);
});

app.get('/api/calendar.ics', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  const escapeIcs = (value) => String(value || '').replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, '\\n');
  const toIcsDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
  const events = (user?.tasks || []).filter(task => task.dueDate).map(task => {
    const start = toIcsDate(task.dueDate); if (!start) return '';
    const end = toIcsDate(new Date(new Date(task.dueDate).getTime() + 30 * 60000));
    return `BEGIN:VEVENT\r\nUID:${escapeIcs(task.id)}@nora\r\nDTSTAMP:${toIcsDate(new Date())}\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${escapeIcs(task.title)}\r\nDESCRIPTION:${escapeIcs(task.details)}\r\nEND:VEVENT`;
  }).filter(Boolean).join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nora-calendario.ics"');
  res.send(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Nora//ES\r\n${events}\r\nEND:VCALENDAR`);
});

app.post('/api/pilot/apply', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  const message = String(req.body?.message || '').trim().slice(0, 500);
  storage.trackEvent(req.user.id, 'pilot_application', { hasMessage: Boolean(message) });
  res.json({ ok: true, message: `Gracias, ${user?.name?.split(' ')[0] || 'cielo'}. Hemos registrado tu interés en el piloto de Nora.` });
});

app.get('/api/user/export', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
  res.setHeader('Content-Disposition', 'attachment; filename="nora-mis-datos.json"');
  res.json({ exportedAt: new Date().toISOString(), user: sanitizeUser(user) });
});

app.delete('/api/user/account', ensureAuthenticated, (req, res) => {
  saveUsers(loadUsers().filter((user) => user.id !== req.user.id));
  req.logout((error) => {
    if (error) return res.status(500).json({ message: 'No se pudo cerrar la cuenta.' });
    req.session.destroy(() => res.json({ ok: true }));
  });
});

// Tasks API
app.get('/api/tasks', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  res.json({ tasks: user ? user.tasks || [] : [] });
});

app.post('/api/tasks', ensureAuthenticated, (req, res) => {
  const { title, details, category, dueDate, recurrence } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'La tarea necesita un título.' });
  }

  const task = createTaskObject(title, details, category, dueDate || null, recurrence || null);
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.tasks = Array.isArray(user.tasks) ? user.tasks : [];
    user.tasks.unshift(task);
    return user;
  });

  storage.trackEvent(req.user.id, 'task_created', { recurrence: Boolean(recurrence), hasDueDate: Boolean(dueDate) });

  res.json({ ok: true, task, tasks: updatedUser ? updatedUser.tasks : [] });
});

app.put('/api/tasks/:id', ensureAuthenticated, (req, res) => {
  const { title, details, dueDate, recurrence, category } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ message: 'La tarea necesita un título.' });
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.tasks = (user.tasks || []).map((task) => task.id === req.params.id ? {
      ...task,
      title: String(title).trim(),
      details: String(details || '').trim(),
      dueDate: dueDate || null,
      recurrence: recurrence || null,
      category: category || inferCategory(title)
    } : task);
    return user;
  });
  res.json({ ok: true, tasks: updatedUser ? updatedUser.tasks : [] });
});

app.post('/api/tasks/:id/toggle', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.tasks = Array.isArray(user.tasks) ? user.tasks : [];
    user.tasks = user.tasks.map((task) =>
      task.id === req.params.id ? { ...task, completed: !task.completed } : task
    );
    return user;
  });

  res.json({ ok: true, tasks: updatedUser ? updatedUser.tasks : [] });
});

app.delete('/api/tasks/:id', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.tasks = Array.isArray(user.tasks) ? user.tasks : [];
    user.tasks = user.tasks.filter((task) => task.id !== req.params.id);
    return user;
  });

  res.json({ ok: true, tasks: updatedUser ? updatedUser.tasks : [] });
});

// 🧠 Baúl de Nora (Memoria de Objetos) API
app.get('/api/memory', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  res.json({ memoryVault: user ? user.memoryVault || [] : [] });
});

app.post('/api/memory', ensureAuthenticated, (req, res) => {
  const { item, location, notes } = req.body || {};
  if (!item || !location) {
    return res.status(400).json({ message: 'Se requiere el nombre del objeto y la ubicación.' });
  }

  const mem = {
    id: `mem-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    item: String(item).trim(),
    location: String(location).trim(),
    notes: String(notes || '').trim(),
    createdAt: new Date().toISOString()
  };

  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.memoryVault = Array.isArray(user.memoryVault) ? user.memoryVault : [];
    user.memoryVault.unshift(mem);
    return user;
  });

  res.json({ ok: true, memory: mem, memoryVault: updatedUser.memoryVault });
});

app.delete('/api/memory/:id', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.memoryVault = Array.isArray(user.memoryVault) ? user.memoryVault : [];
    user.memoryVault = user.memoryVault.filter((m) => m.id !== req.params.id);
    return user;
  });
  res.json({ ok: true, memoryVault: updatedUser.memoryVault });
});

// 🛒 Lista de la Compra Inteligente por Pasillos API
app.get('/api/shopping', ensureAuthenticated, (req, res) => {
  const user = findUserById(req.user.id);
  res.json({ shoppingList: user ? user.shoppingList || [] : [] });
});

app.post('/api/shopping', ensureAuthenticated, (req, res) => {
  const rawText = String(req.body && req.body.text ? req.body.text : '').trim();
  if (!rawText) return res.status(400).json({ message: 'Indica los productos a añadir.' });

  const items = rawText.split(/,|\by\b/).map(s => s.trim()).filter(Boolean);
  const newEntries = items.map(name => {
    const cat = categorizeShoppingItem(name);
    return {
      id: `shop-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      aisle: cat.aisle,
      aisleLabel: cat.label,
      bought: false,
      createdAt: new Date().toISOString()
    };
  });

  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.shoppingList = Array.isArray(user.shoppingList) ? user.shoppingList : [];
    user.shoppingList.unshift(...newEntries);
    return user;
  });

  res.json({ ok: true, added: newEntries, shoppingList: updatedUser.shoppingList });
});

app.post('/api/shopping/:id/toggle', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.shoppingList = Array.isArray(user.shoppingList) ? user.shoppingList : [];
    user.shoppingList = user.shoppingList.map((item) =>
      item.id === req.params.id ? { ...item, bought: !item.bought } : item
    );
    return user;
  });
  res.json({ ok: true, shoppingList: updatedUser.shoppingList });
});

app.delete('/api/shopping/:id', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.shoppingList = Array.isArray(user.shoppingList) ? user.shoppingList : [];
    user.shoppingList = user.shoppingList.filter((item) => item.id !== req.params.id);
    return user;
  });
  res.json({ ok: true, shoppingList: updatedUser.shoppingList });
});

app.post('/api/shopping/clear-bought', ensureAuthenticated, (req, res) => {
  const updatedUser = persistUserUpdate(req.user.id, (user) => {
    user.shoppingList = Array.isArray(user.shoppingList) ? user.shoppingList : [];
    user.shoppingList = user.shoppingList.filter((item) => !item.bought);
    return user;
  });
  res.json({ ok: true, shoppingList: updatedUser.shoppingList });
});

// 🎙️ Podcast Mañanero de 60s
app.get('/api/conchi/morning-podcast', ensureAuthenticated, async (req, res) => {
  const user = findUserById(req.user.id);
  const userName = user ? user.name.split(' ')[0] : 'amigo';
  const personality = user ? user.personality || 'affectionate' : 'affectionate';

  const podcast = await generateMorningPodcast(userName, user ? user.tasks : [], personality);
  res.json({ ok: true, podcast });
});

// 📸 Escáner de Visión Multimodal con Gemini
app.post('/api/conchi/scan-document', ensureAuthenticated, async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ message: 'No se recibió ninguna imagen.' });
  }

  const user = findUserById(req.user.id);
  const userName = user ? user.name.split(' ')[0] : 'amigo';
  const personality = user ? user.personality || 'affectionate' : 'affectionate';

  try {
    const extracted = await scanDocumentWithVision(imageBase64, mimeType, userName, personality);
    const newTask = createTaskObject(
      extracted.title,
      `Escaneado con cámara: ${extracted.details || ''} ${extracted.date ? `(Fecha: ${extracted.date})` : ''}`,
      extracted.category
    );

    const updatedUser = persistUserUpdate(req.user.id, (currentUser) => {
      currentUser.tasks = Array.isArray(currentUser.tasks) ? currentUser.tasks : [];
      currentUser.tasks.unshift(newTask);
      return currentUser;
    });

    res.json({
      ok: true,
      task: newTask,
      tasks: updatedUser.tasks,
      extracted,
      responseText: extracted.responseText
    });
  } catch (error) {
    console.error('Error en /api/conchi/scan-document:', error);
    res.status(500).json({ message: 'No se pudo procesar el documento con visión IA.' });
  }
});

// ⚡ ULTRA-FAST VOICE PIPELINE (<5ms latency path)
app.post('/api/conchi/voice-task', ensureAuthenticated, async (req, res) => {
  const transcript = String(req.body && req.body.transcript ? req.body.transcript : '').trim();
  if (!transcript) {
    return res.status(400).json({ message: 'No se recibió texto dictado.' });
  }

  const user = findUserById(req.user.id);
  const userName = user ? user.name.split(' ')[0] : 'amigo';
  const personality = user ? user.personality || 'affectionate' : 'affectionate';
  const lower = transcript.toLowerCase();

  if (/compra|súper|supermercado|añade a la lista/.test(lower) && !lower.includes('recordar comprar')) {
    const cleanItems = transcript.replace(/^(nora|por favor)?\s*(añade|apunta|pon|agrega)?\s*(a la lista de la compra|a la compra|al súper)?\s*/gi, '').trim();
    const items = cleanItems.split(/,|\by\b/).map(s => s.trim()).filter(Boolean);
    
    const newEntries = items.map(name => {
      const cat = categorizeShoppingItem(name);
      return {
        id: `shop-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        aisle: cat.aisle,
        aisleLabel: cat.label,
        bought: false,
        createdAt: new Date().toISOString()
      };
    });

    const updatedUser = persistUserUpdate(req.user.id, (u) => {
      u.shoppingList = Array.isArray(u.shoppingList) ? u.shoppingList : [];
      u.shoppingList.unshift(...newEntries);
      return u;
    });

    return res.json({
      ok: true,
      actionType: 'shopping',
      shoppingList: updatedUser.shoppingList,
      spokenConfirmation: `¡Añadido a tu lista de la compra, cielo: ${items.join(', ')}!`,
      responseText: `🛒 He añadido a tu lista de la compra: **${items.join(', ')}** (organizado por pasillos).`
    });
  }

  const memResult = await processMemoryInteraction(transcript, user.memoryVault || [], userName, personality);
  if (memResult.isMemoryAction) {
    let updatedVault = user.memoryVault || [];
    if (memResult.action === 'save' && memResult.memory) {
      const updatedUser = persistUserUpdate(req.user.id, (u) => {
        u.memoryVault = Array.isArray(u.memoryVault) ? u.memoryVault : [];
        u.memoryVault.unshift(memResult.memory);
        return u;
      });
      updatedVault = updatedUser.memoryVault;
    }

    return res.json({
      ok: true,
      actionType: 'memory',
      memoryVault: updatedVault,
      spokenConfirmation: memResult.spokenConfirmation,
      responseText: memResult.response
    });
  }

  try {
    const parsed = await parseVoiceReminder(transcript, userName, personality);
    const newTask = createTaskObject(parsed.title, `Dictado por voz: "${transcript}"`, parsed.category);

    const updatedUser = persistUserUpdate(req.user.id, (currentUser) => {
      currentUser.tasks = Array.isArray(currentUser.tasks) ? currentUser.tasks : [];
      currentUser.tasks.unshift(newTask);
      return currentUser;
    });

    return res.json({
      ok: true,
      actionType: 'task',
      task: newTask,
      tasks: updatedUser.tasks,
      spokenConfirmation: parsed.spokenConfirmation,
      responseText: parsed.responseText
    });
  } catch (error) {
    const fast = parseVoiceReminderFast(transcript, userName, personality);
    const fallbackTask = createTaskObject(fast.title, transcript, fast.category);

    const updatedUser = persistUserUpdate(req.user.id, (currentUser) => {
      currentUser.tasks = Array.isArray(currentUser.tasks) ? currentUser.tasks : [];
      currentUser.tasks.unshift(fallbackTask);
      return currentUser;
    });

    return res.json({
      ok: true,
      actionType: 'task',
      task: fallbackTask,
      tasks: updatedUser.tasks,
      spokenConfirmation: fast.spokenConfirmation,
      responseText: fast.responseText
    });
  }
});

// Nora Chat Assistant message endpoint
app.post('/api/conchi/message', ensureAuthenticated, async (req, res) => {
  const text = String(req.body && req.body.text ? req.body.text : '').trim();
  const user = findUserById(req.user.id);
  const userName = user ? user.name.split(' ')[0] : 'amigo';
  const personality = user ? user.personality || 'affectionate' : 'affectionate';
  const lower = text.toLowerCase();

  if (!text) {
    return res.json({
      response: `Estoy aquí para ayudarte, ${userName}, corazón. ¿Qué quieres hacer o recordar hoy?`
    });
  }

  const botQuickReplies = [
    [/agenda|organizar mi día|organizar mi dia/, 'agenda', 'Puedo ayudarte a ordenar tu agenda. Dime las citas o tareas y te las convierto en recordatorios claros, cielo.'],
    [/rutina|hábito|habito|recurrente/, 'rutinas', 'Claro, cariño. Añade una tarea con fecha y elige si se repite cada día, semana o mes.'],
    [/familia|compartir|cuidador/, 'familia', 'La función Familia está preparada para compartir tareas con personas de confianza. Primero dime qué tarea quieres preparar.'],
    [/documento|renovación|renovacion|caducidad/, 'documentos', 'Puedo leer documentos con la cámara y convertir sus fechas importantes en tareas. Pulsa el botón de cámara, corazón.'],
    [/bienestar|cómo estoy|como estoy|hábitos|habitos/, 'bienestar', 'Hagamos un check-in suave: ¿cómo te encuentras hoy y qué pequeño hábito quieres cuidar?'],
    [/seguridad|proteger mi cuenta|privacidad/, 'seguridad', 'Tu cuenta usa contraseña reforzada, sesiones protegidas y copias de seguridad. No compartas tus claves y activa los avisos del navegador.']
  ];
  const quickBot = botQuickReplies.find(([pattern]) => pattern.test(lower));
  if (quickBot) return res.json({ response: quickBot[2], bot: quickBot[1] });

  if (/whatsapp|responder a|redacta mensaje|excusa/i.test(lower)) {
    const reply = generateWhatsappReply(text, personality);
    return res.json({
      response: `Aquí tienes la respuesta redactada:\n\n${reply}`,
      whatsappText: reply.replace(/^“|”$/g, ''),
      hasWhatsappButton: true
    });
  }

  const memResult = await processMemoryInteraction(text, user.memoryVault || [], userName, personality);
  if (memResult.isMemoryAction) {
    if (memResult.action === 'save' && memResult.memory) {
      persistUserUpdate(req.user.id, (u) => {
        u.memoryVault = Array.isArray(u.memoryVault) ? u.memoryVault : [];
        u.memoryVault.unshift(memResult.memory);
        return u;
      });
    }
    return res.json({
      response: memResult.response,
      spokenConfirmation: memResult.spokenConfirmation
    });
  }

  if (/^(recuerda|recuérdame|recordatorio|apunta|apúntame|añade|agrega|anota|guarda tarea)\s+/i.test(text)) {
    const parsed = await parseVoiceReminder(text, userName, personality);
    const savedTask = createTaskObject(parsed.title, `Creado desde el chat: "${text}"`, parsed.category);

    const updatedUser = persistUserUpdate(req.user.id, (currentUser) => {
      currentUser.tasks = Array.isArray(currentUser.tasks) ? currentUser.tasks : [];
      currentUser.tasks.unshift(savedTask);
      return currentUser;
    });

    return res.json({
      response: parsed.responseText || `¡Hecho, cielo! He registrado tu recordatorio: “${savedTask.title}”.`,
      spokenConfirmation: parsed.spokenConfirmation,
      tasks: updatedUser ? updatedUser.tasks : []
    });
  }

  if (/qué tengo hoy|que tengo hoy|plan del día|mi día|orden del día|resumen de tareas/.test(lower)) {
    const summary = getTaskSummary(user ? user.tasks : []);
    return res.json({
      response: `Aquí tienes tu plan, ${userName}: ${summary}`
    });
  }

  try {
    const aiResponse = await generateConchiResponse(text, user.tasks, user.memoryVault, userName, personality);
    return res.json({
      response: aiResponse.response
    });
  } catch (error) {
    console.error('Error generando respuesta de Nora:', error);
    return res.json({
      response: `Entendido, ${userName} cariño. Estoy a tu disposición para ayudarte con tus tareas, compras y recordatorios.`
    });
  }
});

// WhatsApp reply direct endpoint
app.post('/api/conchi/whatsapp-reply', ensureAuthenticated, (req, res) => {
  const message = String(req.body && req.body.message ? req.body.message : '').trim();
  const user = findUserById(req.user.id);
  const personality = user ? user.personality || 'affectionate' : 'affectionate';

  if (!message) {
    return res.status(400).json({ message: 'Necesito el texto del mensaje para redactar una respuesta.' });
  }

  const reply = generateWhatsappReply(message, personality);
  return res.json({
    response: `Aquí tienes tu respuesta lista para enviar:\n\n${reply}`,
    whatsappText: reply.replace(/^“|”$/g, ''),
    hasWhatsappButton: true
  });
});

// PWA Assets
app.get('/manifest.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(publicDir, 'manifest.webmanifest'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(publicDir, 'sw.js'));
});

// Static files
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

storage.initStorage().then((status) => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`✨ Nora Tu Asistente Personal está activa y escuchando:`);
    console.log(`   💻 En tu ordenador: http://localhost:${port}`);
    console.log(`   📱 En tu móvil (misma Wi-Fi): http://192.168.1.140:${port}`);
    console.log(`   💾 Almacenamiento: ${status.mode}`);
  });
}).catch((error) => {
  console.error('No se pudo inicializar el almacenamiento:', error.message);
  process.exit(1);
});
