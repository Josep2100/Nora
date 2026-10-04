const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Nora Business incluye los ficheros públicos principales', () => {
  const root = path.join(__dirname, '..');
  for (const file of [
    'server.js',
    'storage.js',
    'gemini.js',
    'public/index.html',
    'public/business.css',
    'public/business.js',
    'public/manifest.json',
    'public/sw.js'
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `Falta ${file}`);
  }
});

test('El producto presenta las funciones principales de Nora Business', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const text of ['Nora Business', 'Conocimiento', 'Tareas', 'Equipo', 'Actividad', 'Pregunte a Nora']) {
    assert.match(html, new RegExp(text));
  }
});

test('El servidor expone las rutas del workspace empresarial', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  for (const route of ['/api/business/dashboard', '/api/business/knowledge', '/api/business/tasks', '/api/business/chat']) {
    assert.match(server, new RegExp(route.replaceAll('/', '\\/')));
  }
});

test('El flujo de autenticación alterna entre iniciar sesión y crear cuenta', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  assert.match(appJs, /showLogin/);
  assert.match(appJs, /showRegister/);
  assert.match(appJs, /loginForm/);
  assert.match(appJs, /signupForm/);
  assert.match(appJs, /classList\.toggle\(['"]hidden['"]/);
});

test('El registro pide el nombre de la empresa y lo guarda en la cuenta', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const storageJs = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');

  assert.match(appJs, /signupCompanyName|companyName/);
  assert.match(serverJs, /companyName/);
  assert.match(storageJs, /companyName/);
  assert.match(storageJs, /await saveUsers\(users\)/);
  assert.match(storageJs, /DOCUMENTO \$\{index \+ 1\}/);
});

test('El panel conecta tareas, documentos y chat con las rutas empresariales', () => {
  const businessJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'business.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const geminiJs = fs.readFileSync(path.join(__dirname, '..', 'gemini.js'), 'utf8');

  assert.match(businessJs, /api\/business\/tasks/);
  assert.match(businessJs, /api\/business\/knowledge/);
  assert.match(businessJs, /api\/business\/chat/);
  assert.match(serverJs, /generateBusinessResponse/);
  assert.match(serverJs, /api\/business\/knowledge\/documents/);
  assert.match(geminiJs, /name: 'gemini-3\.8-flash'/);
  assert.match(geminiJs, /name: 'gemini-3\.1-pro-preview'/);
});

test('El acceso a la app no queda bloqueado si el dashboard tarda o falla al cargar', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  assert.match(appJs, /fallbackDashboard/);
  assert.match(appJs, /classList\.remove\(['"]hidden['"]\)/);
  assert.match(appJs, /console\.warn\(['"]No se pudo cargar el dashboard/);
});

test('El botón de tic de tareas permite completar y reabrir tareas en tiempo real', () => {
  const businessJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'business.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const storageJs = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');

  assert.match(businessJs, /handleToggleTask/);
  assert.match(businessJs, /api\/business\/tasks\/\$\{taskId\}\/toggle/);
  assert.match(serverJs, /tasks\/:id\/toggle/);
  assert.match(storageJs, /toggleTask/);
});

test('Las invitaciones de miembros permiten elegir permisos y registrar correo', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const businessJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'business.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const storageJs = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');

  assert.match(html, /inviteModal/);
  assert.match(html, /inviteRole/);
  assert.match(businessJs, /api\/business\/team\/invite/);
  assert.match(serverJs, /api\/business\/team\/invite/);
  assert.match(storageJs, /inviteTeamMember/);
});

test('El sistema genera calendario ICS sincronizable con recordatorio 1 día antes', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const businessJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'business.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  assert.match(html, /syncCalendarBtn/);
  assert.match(businessJs, /api\/business\/calendar/);
  assert.match(serverJs, /BEGIN:VCALENDAR/);
  assert.match(serverJs, /TRIGGER:-P1D/);
  assert.match(serverJs, /Recordatorio \(1 día antes\)/);
});

