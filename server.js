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

// ==========================================
// 1. CONFIGURACIÓN DE MIDDLEWARES BASE
// ==========================================

// Parseo de JSON y UrlEncoded con límites de seguridad
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesiones
const sessionSecret = process.env.SESSION_SECRET || 'nora-secret-key-change-in-prod';
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
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
          return done(null, false, { message: 'Usuario no encontrado' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash || user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Contraseña incorrecta' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

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
    if (err) return res.status(500).json({ error: 'Error interno en el servidor' });
    if (!user) return res.status(400).json({ error: info?.message || 'Credenciales inválidas' });

    req.logIn(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ error: 'Error al iniciar sesión' });
      return res.json({
        message: 'Sesión iniciada correctamente',
        user: { id: user.id, email: user.email, name: user.name || user.email }
      });
    });
  })(req, res, next);
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { name, email, password, consentAccepted } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos requeridos para crear la cuenta.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    if (consentAccepted !== true && consentAccepted !== 'true') {
      return res.status(400).json({ error: 'Debe aceptar la política de privacidad y los términos.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
    }

    const user = await storage.createUser({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10)
    });

    req.logIn(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ error: 'Error al crear la sesión del usuario.' });
      return res.status(201).json({
        message: 'Cuenta creada correctamente',
        user: { id: user.id, email: user.email, name: user.name || user.email }
      });
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: 'No se pudo crear la cuenta en este momento.' });
  }
});

// Ruta para inicio de sesión con Google
app.get('/api/auth/google', (req, res) => {
  res.status(501).json({ 
    error: 'La autenticación con Google no está configurada actualmente. Por favor inicie sesión con correo y contraseña.' 
  });
});

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
      user: { id: req.user.id, email: req.user.email, name: req.user.name || req.user.email }
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
      companyName: process.env.COMPANY_NAME || 'Mi Empresa'
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
    if (!message) {
      return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    const knowledgeContext = await storage.getKnowledgeContext(req.user.id);
    const reply = await gemini.generateResponse(message, knowledgeContext);

    return res.json({ reply });
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

app.post('/api/business/knowledge', ensureAuthenticated, async (req, res) => {
  try {
    const { pdfBase64, filename, content } = req.body;
    let extractedText = content || '';

    if (pdfBase64) {
      const buffer = Buffer.from(pdfBase64, 'base64');
      if (buffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (8MB)' });
      }
      const parsedPdf = await pdfParse(buffer);
      extractedText = parsedPdf.text || '';
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'No se pudo extraer texto del documento' });
    }

    const docName = filename || `Documento_${Date.now()}.pdf`;
    await storage.saveDocument(req.user.id, {
      title: docName,
      content: extractedText,
      createdAt: new Date().toISOString()
    });

    return res.json({
      message: `Documento "${docName}" guardado en la base de conocimiento.`,
      characterCount: extractedText.length
    });
  } catch (error) {
    console.error('Error en /api/business/knowledge:', error);
    return res.status(500).json({ error: 'Error al procesar el documento' });
  }
});

// Compatibilidad con subida de PDF previa
app.post('/api/knowledge/upload-pdf', ensureAuthenticated, async (req, res) => {
  req.url = '/api/business/knowledge';
  return app._router.handle(req, res);
});

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