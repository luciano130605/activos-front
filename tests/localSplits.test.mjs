import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustLocalSplits } from '../src/localSplits.ts';

const point = (date, price) => ({ time: Date.parse(`${date}T12:00:00Z`), price });

test('ajusta YPFD por el split aun con variación de precio y conserva la rentabilidad', () => {
    const raw = [point('2025-11-04', 100000), point('2026-07-31', 110000), point('2026-08-03', 11600), point('2026-11-04', 13530)];
    const adjusted = adjustLocalSplits('YPFD', raw);
    assert.deepEqual(adjusted.map(p => p.price), [10000, 11000, 11600, 13530]);
    assert.equal(raw[0].price, 100000);
    assert.equal((adjusted.at(-1).price / adjusted[0].price - 1).toFixed(4), '0.3530');
    assert.deepEqual(adjustLocalSplits('YPFD', adjusted), adjusted);
});

test('no modifica otros activos, series ya ajustadas ni datos alejados del evento', () => {
    const raw = [point('2026-07-31', 100000), point('2026-08-03', 10000)];
    assert.deepEqual(adjustLocalSplits('GGAL', raw), raw);
    const adjusted = [point('2026-07-31', 10000), point('2026-08-03', 10100)];
    assert.deepEqual(adjustLocalSplits('YPFD', adjusted), adjusted);
    const sparse = [point('2026-01-01', 100000), point('2026-11-01', 10000)];
    assert.deepEqual(adjustLocalSplits('YPFD', sparse), sparse);
});

test('ajusta el salto real publicado por Data912 sin dividir el precio del 3 de agosto', () => {
    const raw = [point('2026-07-31', 83000), point('2026-08-03', 8105), point('2026-08-04', 7855)];
    const adjusted = adjustLocalSplits('YPFD', raw);
    assert.deepEqual(adjusted.map(p => p.price), [8300, 8105, 7855]);
    assert.deepEqual(adjustLocalSplits('YPFD', adjusted), adjusted);
});

test('también reconoce un proveedor que registra el ajuste el día efectivo', () => {
    const raw = [point('2026-08-03', 83000), point('2026-08-04', 8105)];
    assert.deepEqual(adjustLocalSplits('YPFD', raw).map(p => p.price), [8300, 8105]);
});
