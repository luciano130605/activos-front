// Modelo del escenario proyectado. Es una estimación estadística, no un pronóstico:
// 1. Rendimiento base: mezcla el historial del activo (hasta 10 años, con tope) con lo que
//    paga el mercado por su riesgo (tasa de EE.UU. a 10 años + beta × prima de acciones).
// 2. Rango pesimista/optimista: volatilidad propia del activo, ajustada por el VIX de hoy.
// 3. Escenario mundial: aplica la caída (o suba) que tuvo el activo en crisis pasadas
//    comparables y la va diluyendo con el tiempo, como ocurrió históricamente.

export type Point = { time: number; price: number };
export type AssetKind = 'stock' | 'cedear' | 'crypto';
export type ScenarioId = 'base' | 'war' | 'recession' | 'rates' | 'tailwind';
export type ScenarioChoice = ScenarioId | 'auto';
export type Indicator = { last: number; time: number; prev3m: number; high52w: number; low52w: number; median: number };
type IndicatorName = 'sp500' | 'vix' | 'oil' | 'gold' | 'us10y' | 'us3m';
export type World = { updatedAt: number; market: Point[]; indicators: Partial<Record<IndicatorName, Indicator | null>> };

const DAY = 86400000;
const YEAR = 365.25 * DAY;
const WEEK = 7 * DAY;
const EQUITY_PREMIUM = 0.045;
const DEFAULT_RISK_FREE = 0.0425;
const HISTORY_CAP = { min: -0.15, max: 0.35 };
const Z80 = 1.2816; // Percentiles 10 y 90 de una normal.

export const SCENARIOS: Record<ScenarioId, { label: string; short: string; description: string; halfLife: number; volatility: number }> = {
    base: { label: 'Sin sobresaltos', short: 'Base', description: 'El mundo sigue como viene: sin crisis ni euforia.', halfLife: 1, volatility: 1 },
    war: { label: 'Guerra o shock geopolítico', short: 'Guerra', description: 'Conflicto armado, guerra comercial o aranceles. Caída brusca que históricamente se recuperó en meses.', halfLife: 0.5, volatility: 1.15 },
    recession: { label: 'Recesión global', short: 'Recesión', description: 'Caída fuerte de la economía mundial, como en la crisis del COVID.', halfLife: 1, volatility: 1.3 },
    rates: { label: 'Inflación y tasas altas', short: 'Tasas altas', description: 'La inflación vuelve y los bancos centrales suben tasas, como en 2022.', halfLife: 1.25, volatility: 1.15 },
    tailwind: { label: 'Viento a favor', short: 'A favor', description: 'Baja de tasas, menos conflictos y mercados en alza, como en 2019 o 2023-24.', halfLife: 2, volatility: 0.95 },
};
export const SCENARIO_ORDER: ScenarioId[] = ['base', 'war', 'recession', 'rates', 'tailwind'];

// Ventanas medidas sobre el S&P 500 (cierres). `market` es el respaldo si no hay serie del índice.
type Episode = { scenario: ScenarioId; label: string; start: string; end: string; market: number };
export const EPISODES: Episode[] = [
    { scenario: 'war', label: 'Guerra comercial EE.UU.–China (2018)', start: '2018-09-20', end: '2018-12-24', market: -0.198 },
    { scenario: 'war', label: 'Invasión rusa a Ucrania (2022)', start: '2022-02-09', end: '2022-03-08', market: -0.091 },
    { scenario: 'war', label: 'Shock de aranceles (2025)', start: '2025-02-19', end: '2025-04-08', market: -0.189 },
    { scenario: 'recession', label: 'Crisis del COVID (2020)', start: '2020-02-19', end: '2020-03-23', market: -0.339 },
    { scenario: 'rates', label: 'Inflación y suba de tasas (2022)', start: '2022-01-03', end: '2022-10-12', market: -0.254 },
    { scenario: 'tailwind', label: 'Mercado alcista de 2017', start: '2016-12-30', end: '2017-12-29', market: 0.194 },
    { scenario: 'tailwind', label: 'Mercado alcista de 2019', start: '2018-12-31', end: '2019-12-31', market: 0.289 },
    { scenario: 'tailwind', label: 'Rally 2023-24', start: '2023-10-27', end: '2024-10-25', market: 0.411 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const noon = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

// Último precio conocido en `time` (tolera fines de semana y feriados).
function priceAt(points: Point[], time: number, tolerance = 6 * DAY): number | null {
    let low = 0, high = points.length - 1, found = -1;
    while (low <= high) { const mid = (low + high) >> 1; if (points[mid].time <= time + DAY / 2) { found = mid; low = mid + 1; } else high = mid - 1; }
    return found >= 0 && time - points[found].time <= tolerance ? points[found].price : null;
}

function standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

// Retornos logarítmicos semanales, del más reciente al más antiguo. null = sin dato esa semana.
function weeklyReturns(points: Point[], end: number, weeks: number): (number | null)[] {
    const prices = Array.from({ length: weeks + 1 }, (_, k) => priceAt(points, end - k * WEEK));
    return Array.from({ length: weeks }, (_, k) => prices[k] != null && prices[k + 1] != null ? Math.log(prices[k]! / prices[k + 1]!) : null);
}

function normalCdf(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const tail = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1 - tail : tail;
}

export function episodeReturn(points: Point[], start: string, end: string): number | null {
    const from = priceAt(points, noon(start)), to = priceAt(points, noon(end));
    return from != null && to != null ? to / from - 1 : null;
}

// Beta contra el S&P 500 con retornos semanales de hasta 5 años.
export function betaOf(points: Point[], market: Point[], kind: AssetKind): { beta: number; measured: boolean } {
    const fallback = { beta: kind === 'crypto' ? 1.5 : 1, measured: false };
    if (points.length < 2 || market.length < 2) return fallback;
    const end = Math.min(points[points.length - 1].time, market[market.length - 1].time);
    const asset = weeklyReturns(points, end, 260), index = weeklyReturns(market, end, 260);
    const pairs = asset.flatMap((value, i) => value != null && index[i] != null ? [[value, index[i]!]] : []);
    if (pairs.length < 30) return fallback;
    const meanAsset = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length, meanIndex = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
    const covariance = pairs.reduce((sum, pair) => sum + (pair[0] - meanAsset) * (pair[1] - meanIndex), 0), variance = pairs.reduce((sum, pair) => sum + (pair[1] - meanIndex) ** 2, 0);
    return variance > 0 ? { beta: clamp(covariance / variance, 0, 3), measured: true } : fallback;
}

// Dos series describen el mismo activo si rindieron parecido en el tramo que comparten.
export function sameAsset(reference: Point[], candidate: Point[]): boolean {
    if (reference.length < 2 || candidate.length < 2) return false;
    const end = Math.min(reference[reference.length - 1].time, candidate[candidate.length - 1].time);
    const start = Math.max(reference[0].time, candidate[0].time, end - YEAR);
    if (end - start < 45 * DAY) return false;
    const a0 = priceAt(reference, start), a1 = priceAt(reference, end), b0 = priceAt(candidate, start), b1 = priceAt(candidate, end);
    return a0 != null && a1 != null && b0 != null && b1 != null && Math.abs(Math.log(a1 / a0) - Math.log(b1 / b0)) < 0.25;
}

export function parseWorld(raw: unknown): World | null {
    const data = raw as { updatedAt?: unknown; sp500?: unknown; indicators?: Record<string, unknown> } | null;
    if (!data || !Array.isArray(data.sp500)) return null;
    const market = data.sp500.flatMap(row => Array.isArray(row) && Number.isFinite(row[0]) && Number.isFinite(row[1]) && row[1] > 0 ? [{ time: row[0] * DAY, price: row[1] as number }] : []).sort((a, b) => a.time - b.time);
    if (market.length < 2) return null;
    const names: IndicatorName[] = ['sp500', 'vix', 'oil', 'gold', 'us10y', 'us3m'];
    const indicators: World['indicators'] = {};
    for (const name of names) {
        const item = data.indicators?.[name] as Indicator | null | undefined;
        indicators[name] = item && [item.last, item.time, item.prev3m, item.high52w, item.low52w, item.median].every(value => Number.isFinite(value) && value > 0) ? item : null;
    }
    return { updatedAt: Number.isFinite(data.updatedAt) ? data.updatedAt as number : Date.now(), market, indicators };
}

export type Climate = {
    level: 'calm' | 'normal' | 'tense' | 'stress';
    label: string;
    drawdown: number | null; // S&P 500 contra su máximo de 52 semanas, en %.
    vix: number | null;
    oil3m: number | null; // Variación % en 3 meses.
    gold3m: number | null;
    us10y: number | null; // Tasa en %.
    us10yChange: number | null; // Puntos porcentuales en 3 meses.
    curve: number | null; // Tasa a 10 años menos tasa a 3 meses.
    suggested: ScenarioId;
    reason: string;
};

// Yahoo publica las tasas en %, pero algunas fuentes las multiplican por 10.
const yieldOf = (value: number) => value > 20 ? value / 10 : value;

export function readClimate(world: World | null): Climate | null {
    if (!world) return null;
    const { sp500, vix, oil, gold, us10y, us3m } = world.indicators;
    const change = (item?: Indicator | null) => item ? (item.last / item.prev3m - 1) * 100 : null;
    const drawdown = sp500 ? (sp500.last / sp500.high52w - 1) * 100 : null;
    const fear = vix?.last ?? null, oil3m = change(oil), gold3m = change(gold);
    const rate = us10y ? yieldOf(us10y.last) : null;
    const rateChange = us10y ? yieldOf(us10y.last) - yieldOf(us10y.prev3m) : null;
    const curve = us10y && us3m ? yieldOf(us10y.last) - yieldOf(us3m.last) : null;
    const level = (fear != null && fear >= 30) || (drawdown != null && drawdown <= -20) ? 'stress' : (fear != null && fear >= 22) || (drawdown != null && drawdown <= -10) ? 'tense' : fear != null && fear < 15 && drawdown != null && drawdown > -3 ? 'calm' : 'normal';
    const label = { calm: 'Calmo', normal: 'Normal', tense: 'Tenso', stress: 'Estrés' }[level];
    let suggested: ScenarioId = 'base', reason = level === 'tense' || level === 'stress' ? 'Hay nervios en el mercado, pero sin una señal clara de guerra, recesión o tasas: se usa el escenario base con un rango más amplio.' : 'No hay señales de estrés en petróleo, tasas ni volatilidad.';
    if (oil3m != null && oil3m >= 20 && ((fear != null && fear >= 20) || (gold3m != null && gold3m >= 8))) { suggested = 'war'; reason = `El petróleo subió ${oil3m.toFixed(0)}% en 3 meses junto con el miedo del mercado: patrón típico de conflicto geopolítico.`; }
    else if (rateChange != null && rateChange >= 0.6) { suggested = 'rates'; reason = `La tasa de EE.UU. a 10 años subió ${rateChange.toFixed(2)} puntos en 3 meses.`; }
    else if (curve != null && curve <= -0.25) { suggested = 'recession'; reason = 'La curva de tasas de EE.UU. está invertida (la tasa corta supera a la larga), una señal histórica de recesión que no siempre se cumple.'; }
    else if (level === 'calm' && rateChange != null && rateChange <= -0.4) { suggested = 'tailwind'; reason = 'Mercado calmo, cerca de máximos y con tasas en baja.'; }
    return { level, label, drawdown, vix: fear, oil3m, gold3m, us10y: rate, us10yChange: rateChange, curve, suggested, reason };
}

export type Outcome = { factor: number; annual: number; total: number };
export type Projection = {
    horizonYears: number;
    scenario: ScenarioId;
    base: Outcome; low: Outcome; high: Outcome;
    lossProbability: number;
    beta: number; betaMeasured: boolean;
    years: number; // Años de historial usados.
    historyAnnual: number; // Rendimiento anual compuesto del historial, en %.
    expectedAnnual: number; // Rendimiento base antes del escenario mundial, en %.
    volatility: number; // Anual, en %.
    shock: number; // Movimiento inicial del escenario, en %.
    effect: number; // Lo que queda de ese movimiento al final del plazo, en %.
    episodes: { label: string; value: number; own: boolean }[];
    stable: boolean;
};

const outcome = (factor: number, years: number): Outcome => ({ factor, total: (factor - 1) * 100, annual: (Math.pow(factor, 1 / years) - 1) * 100 });

export function project(input: { points: Point[]; market: Point[]; kind: AssetKind; horizonYears: number; scenario: ScenarioId; world: World | null }): Projection | null {
    const horizon = clamp(input.horizonYears, 1 / 12, 10);
    const last = input.points[input.points.length - 1];
    if (!last) return null;
    const points = input.points.filter(point => point.time >= last.time - 10 * YEAR);
    const first = points[0];
    const years = (last.time - first.time) / YEAR;
    if (years < 0.25) return null;
    const historyGrowth = Math.pow(last.price / first.price, 1 / years) - 1;
    const weeks = Math.min(520, Math.floor(years * 52.18));
    const returns = weeklyReturns(points, last.time, weeks).flatMap(value => value == null ? [] : [value]);
    if (returns.length < 12) return null;
    const longVolatility = standardDeviation(returns) * Math.sqrt(52);
    const recentVolatility = standardDeviation(returns.slice(0, 52)) * Math.sqrt(52);
    let volatility = Math.sqrt((longVolatility ** 2 + recentVolatility ** 2) / 2);
    // Monedas estables y similares: no tienen prima de riesgo ni reaccionan a las crisis.
    const stable = volatility < 0.03;
    const { beta, measured } = betaOf(points, input.market, input.kind);
    const riskFree = input.world?.indicators.us10y ? clamp(yieldOf(input.world.indicators.us10y.last) / 100, 0.01, 0.08) : DEFAULT_RISK_FREE;
    const marketGrowth = riskFree + clamp(beta, 0, 2.5) * EQUITY_PREMIUM;
    // El historial pesa como máximo la mitad: los rendimientos extremos rara vez se repiten.
    const weight = stable ? 1 : Math.min(0.5, years / 20);
    const growth = Math.exp(weight * Math.log(1 + clamp(historyGrowth, HISTORY_CAP.min, HISTORY_CAP.max)) + (1 - weight) * Math.log(1 + marketGrowth)) - 1;

    // El VIX mide la volatilidad que el mercado espera hoy; su efecto se diluye en plazos largos.
    const vix = input.world?.indicators.vix;
    if (vix && !stable) {
        const ratio = clamp(vix.last / vix.median, 0.75, 1.75), fade = 0.5 / horizon * (1 - Math.exp(-horizon / 0.5));
        volatility *= Math.sqrt(1 + (ratio ** 2 - 1) * fade);
    }
    const scenario = stable ? 'base' : input.scenario;
    const config = SCENARIOS[scenario];
    volatility *= config.volatility;

    const episodes = EPISODES.filter(episode => episode.scenario === scenario).map(episode => {
        const own = episodeReturn(points, episode.start, episode.end);
        const marketReturn = episodeReturn(input.market, episode.start, episode.end) ?? episode.market;
        const length = (noon(episode.end) - noon(episode.start)) / YEAR;
        // En los años buenos solo cuenta lo que rindió por encima de su ritmo base.
        const excess = (value: number, pace: number) => scenario === 'tailwind' ? (1 + value) / Math.pow(1 + pace, length) - 1 : value;
        const value = own != null ? excess(own, growth) : beta * excess(marketReturn, riskFree + EQUITY_PREMIUM);
        return { label: episode.label, value: clamp(value, -0.9, 3) * 100, own: own != null };
    });
    const shock = episodes.length ? episodes.reduce((sum, episode) => sum + episode.value, 0) / episodes.length / 100 : 0;
    // Promedio de lo que queda del shock según en qué momento del plazo ocurra.
    const remaining = config.halfLife / (horizon * Math.LN2) * (1 - Math.pow(0.5, horizon / config.halfLife));
    const effect = shock * remaining;

    const median = Math.pow(1 + growth, horizon) * Math.max(0.05, 1 + effect);
    const spread = volatility * Math.sqrt(horizon);
    return {
        horizonYears: horizon, scenario,
        base: outcome(median, horizon), low: outcome(median * Math.exp(-Z80 * spread), horizon), high: outcome(median * Math.exp(Z80 * spread), horizon),
        lossProbability: spread > 0 ? normalCdf(-Math.log(median) / spread) * 100 : median < 1 ? 100 : 0,
        beta, betaMeasured: measured, years, historyAnnual: historyGrowth * 100, expectedAnnual: growth * 100, volatility: volatility * 100,
        shock: shock * 100, effect: effect * 100, episodes, stable,
    };
}

export function horizonLabel(years: number): string {
    const months = Math.round(years * 12);
    if (months < 12) return `${months} ${months === 1 ? 'MES' : 'MESES'}`;
    const whole = Math.floor(months / 12), rest = months % 12;
    return `${whole} ${whole === 1 ? 'AÑO' : 'AÑOS'}${rest ? ` Y ${rest} ${rest === 1 ? 'MES' : 'MESES'}` : ''}`;
}

// Tickers de Yahoo Finance para tener más de un año de historial de las principales criptomonedas.
export const CRYPTO_TICKERS: Record<string, string> = {
    bitcoin: 'BTC-USD', ethereum: 'ETH-USD', solana: 'SOL-USD', binancecoin: 'BNB-USD', ripple: 'XRP-USD', cardano: 'ADA-USD', dogecoin: 'DOGE-USD',
    tron: 'TRX-USD', 'avalanche-2': 'AVAX-USD', chainlink: 'LINK-USD', polkadot: 'DOT-USD', litecoin: 'LTC-USD', 'bitcoin-cash': 'BCH-USD', stellar: 'XLM-USD', monero: 'XMR-USD',
};

// Suma meses a una fecha ISO sin pasarse de mes (31 ene + 1 mes = 28/29 feb).
export function addMonths(iso: string, months: number): string {
    const date = new Date(`${iso}T12:00:00Z`), day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
    return date.toISOString().slice(0, 10);
}

export function yearsBetween(fromIso: string, toIso: string): number {
    return (noon(toIso) - noon(fromIso)) / YEAR;
}
