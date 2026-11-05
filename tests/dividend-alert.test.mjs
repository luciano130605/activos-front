import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dividendAlertStatus, portfolioDividendAlertStatus } from '../src/dividend-alert.ts';

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


test('explica por qué faltan los dividendos de una alerta', () => {
    const alert = { assetId: 'ITUB', assetKind: 'cedear', threshold: 1 };
    const result = (status) => ({ configured: true, items: [{ ticker: 'ITUB', kind: 'cedear', status }] });
    assert.match(portfolioDividendAlertStatus(null, alert).message, /Consultando/);
    assert.match(portfolioDividendAlertStatus(null, alert, true).message, /No se pudieron consultar/);
    assert.match(portfolioDividendAlertStatus({ configured: false, items: [] }, alert).message, /configurar/);
    assert.match(portfolioDividendAlertStatus({ configured: true, items: [] }, alert).message, /unidades/);
    assert.match(portfolioDividendAlertStatus(result('missing_ratio'), alert).message, /ratio/);
    assert.match(portfolioDividendAlertStatus(result('unavailable'), alert).message, /proveedor/);
    assert.equal(portfolioDividendAlertStatus(result('ok'), alert).state, 'waiting');
});
