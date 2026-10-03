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
