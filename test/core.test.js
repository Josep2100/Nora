const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Nora incluye los ficheros públicos principales', () => {
  const root = path.join(__dirname, '..');
  for (const file of [
    'server.js',
    'storage.js',
    'gemini.js',
    'public/index.html',
    'public/styles.css',
    'public/app.js',
    'public/manifest.json',
    'public/sw.js'
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `Falta ${file}`);
  }
});

test('El dashboard contiene las tarjetas comerciales de Nora', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const text of ['Agenda', 'Rutinas', 'Familia', 'Bienestar', 'Actividad reciente', 'Habla con Nora']) {
    assert.match(html, new RegExp(text));
  }
});
