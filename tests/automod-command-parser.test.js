const assert = require('assert');
const { parseAutomodAction } = require('../commands/automod');

function run() {
  assert.deepStrictEqual(parseAutomodAction('status'), { type: 'status' });
  assert.deepStrictEqual(parseAutomodAction('estado'), { type: 'status' });
  assert.deepStrictEqual(parseAutomodAction('on'), { type: 'enable' });
  assert.deepStrictEqual(parseAutomodAction('activar'), { type: 'enable' });
  assert.deepStrictEqual(parseAutomodAction('off'), { type: 'disable' });
  assert.deepStrictEqual(parseAutomodAction('desactivar'), { type: 'disable' });
  assert.deepStrictEqual(parseAutomodAction('words list'), { type: 'list' });
  assert.deepStrictEqual(parseAutomodAction('palabras lista'), { type: 'list' });
  assert.deepStrictEqual(parseAutomodAction('words add spoiler'), { type: 'add', word: 'spoiler' });
  assert.deepStrictEqual(parseAutomodAction('palabras agregar spam pesado'), { type: 'add', word: 'spam pesado' });
  assert.deepStrictEqual(parseAutomodAction('words remove spoiler'), { type: 'remove', word: 'spoiler' });
  assert.deepStrictEqual(parseAutomodAction('palabras eliminar spam'), { type: 'remove', word: 'spam' });
  assert.deepStrictEqual(parseAutomodAction('algo raro'), { type: 'help' });

  console.log('automod parser tests ok');
}

run();
