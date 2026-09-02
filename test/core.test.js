const test = require('node:test');
const assert = require('node:assert/strict');
const { inferCategory, cleanReminderTitle, categorizeShoppingItem, parseVoiceReminderFast } = require('../gemini');

test('categoriza recordatorios por intención', () => {
  assert.equal(inferCategory('tomar la pastilla a las 9'), 'salud');
  assert.equal(inferCategory('comprar leche'), 'compras');
  assert.equal(inferCategory('reunión con el cliente'), 'trabajo');
});

test('limpia recordatorios hablados', () => {
  assert.equal(cleanReminderTitle('Nora, recuérdame comprar pan'), 'Comprar pan');
  assert.equal(parseVoiceReminderFast('recuérdame llamar al médico').category, 'salud');
});

test('clasifica productos por pasillo', () => {
  assert.equal(categorizeShoppingItem('leche').aisle, 'lacteos');
  assert.equal(categorizeShoppingItem('tomates').aisle, 'frutas');
});
