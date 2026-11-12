import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, betaOf, episodeReturn, horizonLabel, yearsBetween, parseWorld, project, readClimate, sameAsset } from '../src/projection.ts';

const DAY = 86400000;
const end = Date.parse('2026-11-10T12:00:00Z');
// Generador determinista para series diarias con tendencia y ruido.
function random(seed) { let state = seed; return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; }; }
function gaussian(next) { return Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next()); }
function marketSeries(years = 10, growth = 0.09, volatility = 0.16, seed = 7) {
    const next = random(seed), days = Math.round(years * 365.25), points = [];
    let price = 100;
    for (let i = 0; i <= days; i++) {
        const time = end - (days - i) * DAY, weekday = new Date(time).getUTCDay();
        price *= Math.exp(Math.log(1 + growth) / 365.25 + volatility / Math.sqrt(365.25) * gaussian(next));
        if (weekday !== 0 && weekday !== 6) points.push({ time, price });
    }
    return points;
}
// Activo que amplifica al mercado: retorno diario = beta × retorno del índice.
function leveraged(market, beta) {
    let price = 50;
    return market.map((point, i) => { if (i) price *= Math.pow(point.price / market[i - 1].price, beta); return { time: point.time, price }; });
}
const market = marketSeries();
const world = (overrides = {}) => parseWorld({ updatedAt: end, sp500: market.map(point => [Math.round(point.time / DAY), point.price]), indicators: {
    sp500: { last: 6000, time: end, prev3m: 5900, high52w: 6100, low52w: 5000, median: 4000 }, vix: { last: 17, time: end, prev3m: 16, high52w: 40, low52w: 12, median: 17 },
    oil: { last: 70, time: end, prev3m: 68, high52w: 85, low52w: 60, median: 65 }, gold: { last: 4000, time: end, prev3m: 3900, high52w: 4100, low52w: 3000, median: 2000 },
    us10y: { last: 4.2, time: end, prev3m: 4.1, high52w: 4.8, low52w: 3.9, median: 3 }, us3m: { last: 3.9, time: end, prev3m: 4, high52w: 4.5, low52w: 3.8, median: 2 }, ...overrides } });

test('mide la beta y reconoce series del mismo activo', () => {
    const asset = leveraged(market, 1.5);
    const { beta, measured } = betaOf(asset, market, 'stock');
    assert.equal(measured, true);
    assert.ok(Math.abs(beta - 1.5) < 0.05, `beta ${beta}`);
    assert.deepEqual(betaOf(asset.slice(-20), market, 'crypto'), { beta: 1.5, measured: false });
    assert.equal(sameAsset(asset.slice(-250).map(point => ({ ...point, price: point.price * 20 })), asset), true);
    assert.equal(sameAsset(asset.slice(-250), marketSeries(10, -0.3, 0.5, 99)), false);
});

test('el escenario base combina historial y mercado, y ordena pesimista < base < optimista', () => {
    const result = project({ points: leveraged(market, 1.2), market, kind: 'stock', horizonYears: 1, scenario: 'base', world: world() });
    assert.ok(result.years > 9.9 && result.years <= 10);
    assert.ok(result.low.factor < result.base.factor && result.base.factor < result.high.factor);
    assert.ok(Math.abs(result.base.annual - result.expectedAnnual) < 1e-9);
    assert.ok(Math.abs(result.base.total - result.base.annual) < 1e-9);
    // Entre lo que rindió (con tope) y lo que paga el mercado por su riesgo.
    const prior = (0.042 + result.beta * 0.045) * 100, capped = Math.min(35, Math.max(-15, result.historyAnnual));
    assert.ok(result.expectedAnnual >= Math.min(prior, capped) - 1e-9 && result.expectedAnnual <= Math.max(prior, capped) + 1e-9);
    assert.ok(result.lossProbability > 5 && result.lossProbability < 50);
    assert.equal(result.shock, 0);
});

test('un rendimiento histórico extremo no se extrapola', () => {
    const rocket = marketSeries(10, 0.9, 0.5, 3);
    const result = project({ points: rocket, market, kind: 'stock', horizonYears: 5, scenario: 'base', world: null });
    assert.ok(result.historyAnnual > 50);
    assert.ok(result.expectedAnnual < 25, `esperado ${result.expectedAnnual}`);
    assert.ok(Math.abs(Math.pow(1 + result.base.annual / 100, 5) - result.base.factor) < 1e-9);
});

test('los escenarios mundiales mueven el resultado y se diluyen con el plazo', () => {
    const asset = leveraged(market, 1.3), run = (scenario, horizonYears) => project({ points: asset, market, kind: 'stock', horizonYears, scenario, world: world() });
    const base = run('base', 1), war = run('war', 1), recession = run('recession', 1), rates = run('rates', 1), tailwind = run('tailwind', 1);
    assert.equal(war.episodes.length, 3);
    assert.ok(war.episodes.every(episode => episode.own));
    for (const stressed of [war, recession, rates]) {
        assert.ok(Math.abs(stressed.effect) < Math.abs(stressed.shock) || stressed.shock === 0);
        assert.ok(stressed.volatility > base.volatility);
    }
    // El efecto es proporcional a lo que quede del shock medido en la serie.
    assert.ok(Math.abs(war.base.factor / base.base.factor - (1 + war.effect / 100)) < 1e-9);
    assert.ok(Math.abs(tailwind.base.factor / base.base.factor - (1 + tailwind.effect / 100)) < 1e-9);
    // A 5 años queda una fracción menor del mismo shock que a 1 año.
    const warLong = run('war', 5);
    assert.ok(Math.abs(warLong.shock - war.shock) < 1e-9);
    assert.ok(Math.abs(warLong.effect) < Math.abs(war.effect) * 0.5 || war.shock === 0);
});

test('sin datos propios del período usa la beta y los valores históricos del S&P 500', () => {
    const young = leveraged(market, 2).slice(-300);
    const result = project({ points: young, market: [], kind: 'crypto', horizonYears: 1, scenario: 'recession', world: null });
    assert.equal(result.betaMeasured, false);
    assert.deepEqual(result.episodes.map(episode => episode.own), [false]);
    assert.ok(Math.abs(result.shock - 1.5 * -33.9) < 1e-9);
    assert.ok(result.base.annual < result.expectedAnnual);
});

test('una moneda estable no recibe prima ni shocks, y poco historial no se proyecta', () => {
    const flat = market.map((point, i) => ({ time: point.time, price: 1 + (i % 2) * 0.0005 }));
    const result = project({ points: flat, market, kind: 'crypto', horizonYears: 2, scenario: 'recession', world: world() });
    assert.equal(result.stable, true);
    assert.equal(result.scenario, 'base');
    assert.ok(Math.abs(result.base.annual) < 0.1);
    assert.equal(project({ points: market.slice(-40), market, kind: 'stock', horizonYears: 1, scenario: 'base', world: null }), null);
    assert.equal(project({ points: [], market, kind: 'stock', horizonYears: 1, scenario: 'base', world: null }), null);
});

test('más miedo en el mercado amplía el rango sin mover el escenario base', () => {
    const asset = leveraged(market, 1), run = vix => project({ points: asset, market, kind: 'stock', horizonYears: 1, scenario: 'base', world: world({ vix: { last: vix, time: end, prev3m: 16, high52w: 40, low52w: 12, median: 17 } }) });
    const calm = run(17), scared = run(34);
    assert.ok(Math.abs(calm.base.factor - scared.base.factor) < 1e-9);
    assert.ok(scared.volatility > calm.volatility * 1.2);
    assert.ok(scared.low.factor < calm.low.factor && scared.high.factor > calm.high.factor);
});

test('lee el clima y sugiere un escenario', () => {
    assert.equal(readClimate(null), null);
    const calm = readClimate(world());
    assert.equal(calm.suggested, 'base');
    assert.equal(calm.level, 'normal');
    assert.ok(Math.abs(calm.drawdown - (6000 / 6100 - 1) * 100) < 1e-9);
    assert.ok(Math.abs(calm.curve - 0.3) < 1e-9);
    const war = readClimate(world({ oil: { last: 100, time: end, prev3m: 70, high52w: 100, low52w: 60, median: 65 }, vix: { last: 27, time: end, prev3m: 16, high52w: 40, low52w: 12, median: 17 } }));
    assert.equal(war.suggested, 'war');
    assert.equal(war.level, 'tense');
    assert.equal(readClimate(world({ us10y: { last: 4.9, time: end, prev3m: 4.1, high52w: 4.9, low52w: 3.9, median: 3 } })).suggested, 'rates');
    assert.equal(readClimate(world({ us3m: { last: 4.8, time: end, prev3m: 4.7, high52w: 4.9, low52w: 3.8, median: 2 } })).suggested, 'recession');
    assert.equal(readClimate(world({ vix: { last: 13, time: end, prev3m: 16, high52w: 40, low52w: 12, median: 17 }, sp500: { last: 6090, time: end, prev3m: 5900, high52w: 6100, low52w: 5000, median: 4000 }, us10y: { last: 3.6, time: end, prev3m: 4.1, high52w: 4.8, low52w: 3.5, median: 3 }, us3m: { last: 3.2, time: end, prev3m: 3.9, high52w: 4.5, low52w: 3.2, median: 2 } })).suggested, 'tailwind');
    // Tasas informadas ×10 se normalizan.
    assert.ok(Math.abs(readClimate(world({ us10y: { last: 42, time: end, prev3m: 41, high52w: 48, low52w: 39, median: 30 } })).us10y - 4.2) < 1e-9);
    // Un indicador faltante no rompe la lectura.
    assert.equal(readClimate(world({ oil: null, us3m: null })).curve, null);
    assert.equal(parseWorld({ sp500: [] }), null);
    assert.equal(parseWorld(null), null);
});

test('mide episodios y rotula plazos', () => {
    const series = [{ time: Date.parse('2020-02-19T12:00:00Z'), price: 100 }, { time: Date.parse('2020-03-20T12:00:00Z'), price: 70 }, { time: Date.parse('2020-03-23T12:00:00Z'), price: 66 }];
    assert.ok(Math.abs(episodeReturn(series, '2020-02-19', '2020-03-23') + 0.34) < 1e-9);
    assert.equal(episodeReturn(series, '2018-09-20', '2018-12-24'), null);
    assert.equal(horizonLabel(0.25), '3 MESES');
    assert.equal(horizonLabel(1 / 12), '1 MES');
    assert.equal(horizonLabel(1), '1 AÑO');
    assert.equal(horizonLabel(2.25), '2 AÑOS Y 3 MESES');
    assert.equal(horizonLabel(5), '5 AÑOS');
    assert.equal(addMonths('2026-11-11', 12), '2027-11-11');
    assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.ok(Math.abs(yearsBetween('2026-11-11', '2028-11-11') - 2) < 0.01);
});
