import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dividendAlertStatus } from '../src/dividend-alert.ts';

test('muestra el próximo pago aunque falte para el aviso', () => {
    const result = dividendAlertStatus([{ payDate: '2026-12-08', eligible: true }], 1, Date.parse('2026-11-05T15:00:00Z'));
    assert.equal(result.state, 'waiting');
    assert.match(result.message, /8 de diciembre de 2026/);
    assert.match(result.message, /1 día antes/);
});
test('activa el aviso dentro del plazo y distingue pagos sin derecho', () => {
    assert.equal(dividendAlertStatus([{ payDate: '2026-12-08', eligible: true }], 1, Date.parse('2026-12-07T15:00:00Z')).state, 'triggered');
    assert.match(dividendAlertStatus([{ payDate: '2026-12-08', eligible: false }], 1, Date.parse('2026-11-05T15:00:00Z')).message, /no tiene derecho/);
});
