import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAppPath } from '../src/navigation.ts';

test('Tu espacio es una ruta de la aplicación, incluso con barra final', () => {
    assert.equal(isAppPath('/espacio'), true);
    assert.equal(isAppPath('/espacio/'), true);
    assert.equal(isAppPath('/'), true);
    assert.equal(isAppPath('/inexistente'), false);
});
