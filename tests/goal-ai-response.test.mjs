import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAllocationResponse } from '../src/goal-ai-response.ts';

test('acepta preguntas y distribuciones completas que suman 100', () => {
    assert.deepEqual(parseAllocationResponse('{"message":"¿A qué plazo?","allocation":null}'), { message: '¿A qué plazo?', allocation: null });
    const allocation = { rate: 10, cedear: 30, index: 10, stock: 0, crypto: 10, 'arg-stock': 5, bond: 20, fund: 15 };
    assert.deepEqual(parseAllocationResponse(JSON.stringify({ message: 'Propuesta', allocation })).allocation, allocation);
});

test('rechaza porcentajes incompletos, adicionales o inválidos', () => {
    const valid = { rate: 10, cedear: 30, index: 10, stock: 0, crypto: 10, 'arg-stock': 5, bond: 20, fund: 15 };
    for (const allocation of [{ ...valid, bond: 21 }, { ...valid, fund: -1 }, { ...valid, fund: '15' }, { ...valid, extra: 0 }, { rate: 100 }]) {
        assert.throws(() => parseAllocationResponse(JSON.stringify({ message: 'Propuesta', allocation })));
    }
});
