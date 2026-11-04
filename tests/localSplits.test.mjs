import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustLocalSplits } from '../src/localSplits.ts';

const point = (date, price) => ({ time: Date.parse(`${date}T12:00:00Z`), price });

test('ajusta YPFD por el split aun con variación de precio y conserva la rentabilidad', () => {
    const raw = [point('2025-11-04', 100000), point('2026-08-03', 110000), point('2026-08-04', 11600), point('2026-11-04', 13530)];
    const adjusted = adjustLocalSplits('YPFD', raw);
    assert.deepEqual(adjusted.map(p => p.price), [10000, 11000, 11600, 13530]);
    assert.equal(raw[0].price, 100000);
    assert.equal((adjusted.at(-1).price / adjusted[0].price - 1).toFixed(4), '0.3530');
    assert.deepEqual(adjustLocalSplits('YPFD', adjusted), adjusted);
});

test('no modifica otros activos, series ya ajustadas ni datos alejados del evento', () => {
    const raw = [point('2026-08-03', 100000), point('2026-08-04', 10000)];
    assert.deepEqual(adjustLocalSplits('GGAL', raw), raw);
    const adjusted = [point('2026-08-03', 10000), point('2026-08-04', 10100)];
    assert.deepEqual(adjustLocalSplits('YPFD', adjusted), adjusted);
    const sparse = [point('2026-01-01', 100000), point('2026-11-01', 10000)];
    assert.deepEqual(adjustLocalSplits('YPFD', sparse), sparse);
});
