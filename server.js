require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const pdfParse = require('pdf-parse');

// Módulos internos
const storage = require('./storage');
const gemini = require('./gemini');

const app = express();
const PORT = process.env.PORT || 3000;

// Confianza en el proxy inverso de Render para cookies HTTPS seguras
app.set('trust proxy', 1);

// ==========================================
// 1. CONFIGURACIÓN DE MIDDLEWARES BASE
// ==========================================

// Parseo de JSON y UrlEncoded con límites de seguridad
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const url = req.path || '';
  if (url.endsWith('.html') || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.json') || url.endsWith('.svg') || url.endsWith('.png') || url.endsWith('.webmanifest')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesiones
const sessionSecret = process.env.SESSION_SECRET || 'nora-secret-key-change-in-prod';
const sessionStore = storage.getSessionStore();
app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
  })
);

// Inicialización de Passport (Autenticación)
app.use(passport.initialize());
app.use(passport.session());

// Configuración de la estrategia local de Passport
passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: 'No existe una cuenta con este correo electrónico.' });
        }
        const hash = user.password_hash || user.passwordHash || user.password;
        if (!hash) {
          return done(null, false, { 
            message: 'Esta cuenta se creó con Google o no tiene contraseña. Por favor regístrese con este correo y una contraseña para activarla.' 
          });
        }
        const isMatch = await bcrypt.compare(password, hash);
        if (!isMatch) {
          return done(null, false, { message: 'Contraseña incorrecta.' });
        }
        return done(null, user);
      } catch (err) {
        console.error('Error en LocalStrategy:', err);
        return done(err);
      }
    }
  )
);

// Configuración opcional de Google OAuth
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (googleClientId && googleClientSecret) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          if (!email) return done(new Error('No se pudo obtener el correo de Google'));
          
          let user = await storage.getUserByEmail(email);
          if (!user) {
            user = await storage.createUser({
              name: profile.displayName || email.split('@')[0],
              companyName: 'Mi Empresa',
              email: email
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await storage.getUserById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Middleware de verificación de autenticación
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
}

// ==========================================
// HEALTH CHECK (REQUERIDO POR RENDER)
// ==========================================
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ==========================================
// 2. RUTAS DE AUTENTICACIÓN
// ==========================================

app.post('/api/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Error en login:', err);
      return res.status(500).json({ error: 'Error interno en el servidor. Inténtelo de nuevo.' });
    }
    if (!user) return res.status(400).json({ error: info?.message || 'Credenciales inválidas' });

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Error creando sesión:', loginErr);
        return res.status(500).json({ error: 'Error al iniciar sesión. Inténtelo de nuevo.' });
      }
      return res.json({
        message: 'Sesión iniciada correctamente',
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          companyName: user.companyName || user.company_name || 'Mi empresa'
        }
      });
    });
  })(req, res, next);
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { name, companyName, email, password, consentAccepted } = req.body || {};

    if (!name || !companyName || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos requeridos para crear la cuenta.' });
    }

    const normalizedCompanyName = String(companyName).trim();

    if (!normalizedCompanyName) {
      return res.status(400).json({ error: 'Debe indicar el nombre de la empresa.' });
    }

    if (normalizedCompanyName.length > 100) {
      return res.status(400).json({ error: 'El nombre de la empresa no puede superar los 100 caracteres.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    if (consentAccepted !== true && consentAccepted !== 'true') {
      return res.status(400).json({ error: 'Debe aceptar la política de privacidad y los términos.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    const hasPassword = existingUser && (existingUser.password_hash || existingUser.passwordHash || existingUser.password);
    
    if (existingUser && hasPassword) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico. Inicie sesión con su contraseña.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      name: String(name).trim(),
      companyName: normalizedCompanyName,
      email: normalizedEmail,
      passwordHash: passwordHash
    });

    req.logIn(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ error: 'Error al crear la sesión del usuario.' });
      return res.status(201).json({
        message: 'Cuenta creada correctamente',
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          companyName: user.companyName || user.company_name || normalizedCompanyName
        }
      });
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: 'No se pudo crear la cuenta en este momento.' });
  }
});

// Rutas para inicio de sesión con Google
if (googleClientId && googleClientSecret) {
  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/?auth=google-error' }),
    (req, res) => {
      res.redirect('/');
    }
  );
  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/?auth=google-error' }),
    (req, res) => {
      res.redirect('/');
    }
  );
} else {
  app.get(['/api/auth/google', '/auth/google'], (req, res) => {
    res.status(501).json({ 
      error: 'La autenticación directa con Google no está configurada. Por favor inicie sesión con correo y contraseña.' 
    });
  });
}

app.post('/api/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.json({ message: 'Sesión cerrada correctamente' });
    });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name || req.user.email,
        companyName: req.user.companyName || req.user.company_name || 'Mi empresa'
      }
    });
  }
  return res.status(401).json({ user: null });
});

// ==========================================
// 3. RUTAS DE WORKSPACE Y DASHBOARD EMPRESARIAL
// ==========================================

app.get('/api/business/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await storage.getTasks(userId);
    const memory = await storage.getMemoryVault(userId);
    const companyName = req.user.companyName || req.user.company_name || process.env.COMPANY_NAME || 'Mi Empresa';

    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    return res.json({
      summary: {
        totalTasks: tasks.length,
        pendingTasks: pendingTasks.length,
        completedTasks: completedTasks.length,
        memoryItems: memory.length
      },
      recentTasks: tasks.slice(0, 5),
      companyName,
      companySector: req.user.companySector || 'Servicios profesionales'
    });
  } catch (error) {
    console.error('Error en /api/business/dashboard:', error);
    return res.status(500).json({ error: 'Error al cargar los datos del panel empresarial' });
  }
});

// ==========================================
// 4. RUTAS DE NORA BUSINESS (IA, KNOWLEDGE & TAREAS)
// ==========================================

// Endpoint de Chat con IA (Requerido por los tests de Node.js)
app.post('/api/business/chat', ensureAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    const trimmed = String(message).trim();
    const userId = req.user.id;
    const lower = trimmed.toLowerCase();

    let createdTask = null;
    if (/(calendario|agenda|partido|reuni[oó]n|cita|tarea|recordatorio|comprar|llamar|ponme|anota|apunta|recu[eé]rda|agrega|a[ñn]ade)/i.test(lower)) {
      const parsed = gemini.parseVoiceReminderFast(trimmed, req.user.name || 'Usuario');
      if (parsed && parsed.title && parsed.title.length > 2) {
        createdTask = await storage.saveTask(userId, {
          title: parsed.title,
          description: `Registrado automáticamente desde el asistente Nora`,
          dueDate: parsed.dueDate || null,
          priority: 'medium',
          completed: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    const knowledgeContext = await storage.getKnowledgeContext(userId);
    const tasks = await storage.getTasks(userId);
    const companyName = req.user.companyName || req.user.company_name || 'la empresa';
    const result = await gemini.generateBusinessResponse(
      trimmed,
      knowledgeContext,
      tasks,
      companyName,
      req.user.name || req.user.email || 'Usuario'
    );

    let reply = result.response;
    if (createdTask) {
      const dueFormatted = createdTask.dueDate 
        ? new Date(createdTask.dueDate).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
        : null;
      const confirmText = dueFormatted 
        ? `He registrado en su agenda y tareas: **${createdTask.title}** para el **${dueFormatted}**.` 
        : `He registrado en sus tareas pendientes: **${createdTask.title}**.`;

      if (!reply || reply.includes('no puede consultar') || reply.includes('saturado')) {
        reply = confirmText;
      }
    }

    return res.json({ 
      reply: reply, 
      sources: result.sources || [],
      createdTask: createdTask || null 
    });
  } catch (error) {
    console.error('Error en /api/business/chat:', error);
    return res.status(500).json({ error: 'Error al procesar el mensaje con la IA' });
  }
});

// Endpoint de Tareas Empresariales
app.get('/api/business/tasks', ensureAuthenticated, async (req, res) => {
  try {
    const tasks = await storage.getTasks(req.user.id);
    return res.json({ tasks });
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    return res.status(500).json({ error: 'Error al obtener la lista de tareas' });
  }
});

app.post('/api/business/tasks', ensureAuthenticated, async (req, res) => {
  try {
    const { title, description, dueDate, priority } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'El título de la tarea es obligatorio' });
    }

    const newTask = await storage.saveTask(req.user.id, {
      title,
      description: description || '',
      dueDate: dueDate || null,
      priority: priority || 'normal',
      completed: false,
      createdAt: new Date().toISOString()
    });

    return res.json({ message: 'Tarea creada correctamente', task: newTask });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    return res.status(500).json({ error: 'Error al guardar la tarea' });
  }
});

// Marcar tarea como completada / pendiente (Tic de tarea)
app.all(['/api/business/tasks/:id/toggle', '/api/tasks/:id/toggle'], ensureAuthenticated, async (req, res) => {
  try {
    const taskId = req.params.id;
    const updated = await storage.toggleTask(req.user.id, taskId);
    if (!updated) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    return res.json({
      message: updated.completed ? 'Tarea completada' : 'Tarea reabierta',
      task: updated
    });
  } catch (error) {
    console.error('Error al cambiar estado de tarea:', error);
    return res.status(500).json({ error: 'Error al actualizar el estado de la tarea' });
  }
});

app.delete('/api/business/tasks/:id', ensureAuthenticated, async (req, res) => {
  try {
    const taskId = req.params.id;
    await storage.deleteTask(req.user.id, taskId);
    return res.json({ message: 'Tarea eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    return res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

// ==========================================
// RUTAS DE EQUIPO E INVITACIONES CON PERMISOS
// ==========================================
app.get('/api/business/team', ensureAuthenticated, async (req, res) => {
  try {
    const team = await storage.getTeam(req.user.id);
    return res.json({ team });
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    return res.status(500).json({ error: 'Error al obtener los miembros del equipo' });
  }
});

app.post('/api/business/team/invite', ensureAuthenticated, async (req, res) => {
  try {
    const { name, email, role, permissions } = req.body || {};
    if (!email || !String(email).trim() || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Debe indicar un correo electrónico válido (corporativo o personal).' });
    }

    const member = await storage.inviteTeamMember(req.user.id, {
      name: String(name || '').trim(),
      email: String(email).trim(),
      role: role || 'Miembro',
      permissions: permissions || 'editor'
    });

    return res.status(201).json({
      message: `Invitación registrada para ${member.email}. Se han configurado los permisos seleccionados.`,
      member
    });
  } catch (error) {
    console.error('Error al invitar miembro:', error);
    return res.status(500).json({ error: 'Error al registrar la invitación del miembro' });
  }
});

app.delete('/api/business/team/:id', ensureAuthenticated, async (req, res) => {
  try {
    const memberId = req.params.id;
    await storage.removeTeamMember(req.user.id, memberId);
    return res.json({ message: 'Acceso de miembro revocado correctamente' });
  } catch (error) {
    console.error('Error al eliminar miembro:', error);
    return res.status(500).json({ error: 'Error al revocar el acceso del miembro' });
  }
});

// ==========================================
// SINCRONIZACIÓN DE CALENDARIO (MÓVIL & PC) CON RECORDATORIO 1 DÍA ANTES
// ==========================================
function formatIcsDate(dateObj) {
  const d = new Date(dateObj);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function generateTasksIcs(tasks, companyName = 'Nora Business') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nora Business//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Nora Business - ${companyName}`,
    'X-WR-TIMEZONE:UTC'
  ];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const startDate = new Date(task.dueDate);
    if (isNaN(startDate.getTime())) continue;

    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const uid = `task-${task.id || Math.random().toString(36).slice(2)}@nora.business`;
    const dtStamp = formatIcsDate(new Date());
    const dtStart = formatIcsDate(startDate);
    const dtEnd = formatIcsDate(endDate);
    const summary = String(task.title || 'Tarea').replace(/[\r\n]+/g, ' ');
    const desc = String(task.description || `Tarea de ${companyName}`).replace(/[\r\n]+/g, '\\n');
    const status = task.completed ? 'COMPLETED' : 'CONFIRMED';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `STATUS:${status}`,
      // Recordatorio 1 día antes (24 horas)
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio (1 día antes): ${summary}`,
      'END:VALARM',
      // Recordatorio adicional 2 horas antes
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio (2 horas antes): ${summary}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

async function sendCalendarFeed(res, user) {
  const tasks = await storage.getTasks(user.id);
  const companyName = user.companyName || user.company_name || 'Mi Empresa';
  const icsContent = generateTasksIcs(tasks, companyName);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Disposition', `inline; filename="nora-tareas-${encodeURIComponent(companyName)}.ics"`);
  return res.send(icsContent);
}

// Feed público protegido por un token aleatorio. Las apps de calendario
// consultan esta URL periódicamente y reciben las tareas nuevas automáticamente.
app.get('/calendar/feed/:token.ics', async (req, res) => {
  try {
    const user = await storage.getUserByCalendarToken(req.params.token);
    if (!user) return res.status(404).send('Calendario no encontrado');
    return sendCalendarFeed(res, user);
  } catch (error) {
    console.error('Error sirviendo feed de calendario:', error);
    return res.status(500).send('Error del calendario');
  }
});

app.get('/api/business/calendar/feed', ensureAuthenticated, async (req, res) => {
  try {
    const token = await storage.getOrCreateCalendarToken(req.user.id);
    if (!token) return res.status(404).json({ error: 'No se pudo preparar el calendario' });

    const configuredBase = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
    const baseUrl = configuredBase || `${req.protocol}://${req.get('host')}`;
    const httpsUrl = `${baseUrl}/calendar/feed/${encodeURIComponent(token)}.ics`;
    return res.json({
      httpsUrl,
      webcalUrl: httpsUrl.replace(/^https?:/i, 'webcal:'),
      message: 'Suscriba esta URL en su calendario. Las nuevas tareas aparecerán cuando su aplicación actualice el calendario.'
    });
  } catch (error) {
    console.error('Error preparando feed de calendario:', error);
    return res.status(500).json({ error: 'No se pudo preparar la sincronización' });
  }
});

app.get('/api/business/calendar/tasks.ics', ensureAuthenticated, async (req, res) => {
  try {
    return sendCalendarFeed(res, req.user);
  } catch (error) {
    console.error('Error generando calendario ICS:', error);
    return res.status(500).json({ error: 'Error al generar el calendario' });
  }
});

app.get('/api/business/calendar/task/:id.ics', ensureAuthenticated, async (req, res) => {
  try {
    const tasks = await storage.getTasks(req.user.id);
    const task = tasks.find(t => String(t.id) === String(req.params.id));
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

    const companyName = req.user.companyName || req.user.company_name || 'Mi Empresa';
    const icsContent = generateTasksIcs([task], companyName);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tarea-${task.id}.ics"`);
    return res.send(icsContent);
  } catch (error) {
    console.error('Error generando archivo ICS de tarea:', error);
    return res.status(500).json({ error: 'Error al generar el archivo de calendario' });
  }
});

// Endpoint de Base de Conocimiento (Knowledge)
app.get('/api/business/knowledge', ensureAuthenticated, async (req, res) => {
  try {
    const knowledgeBase = await storage.getKnowledgeContext(req.user.id);
    return res.json({ knowledge: knowledgeBase });
  } catch (error) {
    console.error('Error al obtener base de conocimiento:', error);
    return res.status(500).json({ error: 'Error al obtener la base de conocimiento' });
  }
});

app.get('/api/business/knowledge/documents', ensureAuthenticated, async (req, res) => {
  try {
    const user = await storage.getUserById(req.user.id);
    const documents = Array.isArray(user?.knowledge) ? user.knowledge : [];
    return res.json({
      documents: documents.map(document => ({
        id: document.id,
        title: document.title || 'Documento',
        preview: String(document.content || '').slice(0, 240),
        createdAt: document.createdAt || null
      }))
    });
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    return res.status(500).json({ error: 'Error al obtener la lista de documentos' });
  }
});

async function handleKnowledgeUpload(req, res) {
  try {
    const { pdfBase64, filename, fileName, title, content, data } = req.body || {};
    let extractedText = content || '';
    const rawData = pdfBase64 || data;

    if (rawData) {
      let base64String = rawData;
      if (typeof rawData === 'string' && rawData.includes('base64,')) {
        base64String = rawData.split('base64,')[1];
      }
      const buffer = Buffer.from(base64String, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (10MB)' });
      }
      const parsedPdf = await pdfParse(buffer);
      extractedText = (parsedPdf.text || '').trim();
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'No se pudo extraer texto del documento o el contenido está vacío.' });
    }

    const docName = String(title || fileName || filename || `Documento_${Date.now()}.pdf`).trim();
    const savedDoc = await storage.saveDocument(req.user.id, {
      title: docName,
      content: extractedText,
      createdAt: new Date().toISOString()
    });

    return res.json({
      message: `Documento "${docName}" guardado en la base de conocimiento.`,
      characterCount: extractedText.length,
      document: savedDoc
    });
  } catch (error) {
    console.error('Error en carga de documento/PDF:', error);
    return res.status(500).json({ error: 'Error al procesar el documento: ' + error.message });
  }
}

app.post('/api/business/knowledge', ensureAuthenticated, handleKnowledgeUpload);
app.post('/api/business/knowledge/pdf', ensureAuthenticated, handleKnowledgeUpload);
app.post('/api/knowledge/upload-pdf', ensureAuthenticated, handleKnowledgeUpload);

// ==========================================
// 5. MANEJO DE ERRORES GLOBAL Y FALLBACK
// ==========================================

// Capturar cualquier ruta API no encontrada
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint API no encontrado' });
});

// Redireccionar frontend (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err.stack || err);
  res.status(500).json({ error: 'Ocurrió un error interno e inesperado en el servidor' });
});

// ==========================================
// 6. INICIALIZACIÓN DEL SERVIDOR
// ==========================================

storage.initStorage()
  .catch((error) => console.warn('No se pudo inicializar almacenamiento persistente:', error.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor Nora Business iniciado correctamente en el puerto ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  });
