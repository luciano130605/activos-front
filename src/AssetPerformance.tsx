import { useEffect, useState } from 'react';
import type { Investment } from './portfolio';
import { adjustLocalSplits } from './localSplits';
import { apiUrl, request } from './account';
import type { Rates } from './Cauciones';
import { morphoHistory } from './morpho';
import { CRYPTO_TICKERS, SCENARIOS, SCENARIO_ORDER, addMonths, horizonLabel, parseWorld, project, readClimate, sameAsset, yearsBetween, type Climate, type Outcome, type Projection, type ScenarioChoice, type World } from './projection';

export type HistoryPoint = { time: number; price: number };
type Point = HistoryPoint;
type Data = Record<string, { points: Point[]; long?: Point[]; error?: string }>;
const DAY = 86400000;
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const date = (time: number) => new Date(time).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const money = (value: number, currency: string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const keyOf = (item: Investment) => `${item.kind}:${item.coin}`;
const SETTINGS_KEY = 'activos:scenario-settings';
const PRESETS = [{ months: 3, label: '3M' }, { months: 6, label: '6M' }, { months: 12, label: '1A' }, { months: 24, label: '2A' }, { months: 36, label: '3A' }, { months: 60, label: '5A' }, { months: 120, label: '10A' }];
const today = () => new Date().toLocaleDateString('en-CA');
type Settings = { months: number | null; date: string; scenario: ScenarioChoice };
function readSettings(): Settings {
    const fallback: Settings = { months: 12, date: '', scenario: 'auto' };
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
        if (!saved || typeof saved !== 'object') return fallback;
        const scenario: ScenarioChoice = saved.scenario === 'auto' || SCENARIO_ORDER.includes(saved.scenario) ? saved.scenario : 'auto';
        if (PRESETS.some(preset => preset.months === saved.months)) return { months: saved.months, date: '', scenario };
        // Una fecha guardada que ya quedó a menos de un mes vuelve al plazo de 1 año.
        return typeof saved.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.date) && saved.date >= addMonths(today(), 1) ? { months: null, date: saved.date, scenario } : { ...fallback, scenario };
    } catch { return fallback; }
}
function ProjectionHelp({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    return <span className="group relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <button type="button" className="grid h-5 w-5 place-items-center rounded-full border border-[var(--line2)] text-[10px] text-[var(--muted)]" aria-label="Cómo se calcula el escenario" aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}>?</button>
        {open && <span role="tooltip" className="absolute right-0 top-full z-40 mt-2 w-[min(300px,74vw)] rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-3 text-left text-[11px] leading-5 text-[var(--muted)] shadow-xl">{text}</span>}
    </span>;
}
function explain(result: Projection, hasWorld: boolean): string {
    if (result.stable) return 'Este activo casi no varía de precio, por eso el escenario lo mantiene estable y no le aplica crisis ni subas del mercado.';
    const history = `lo que rindió en ${result.years >= 1.5 ? `${Math.round(result.years)} años` : `${Math.round(result.years * 12)} meses`} (${pct(result.historyAnnual)} anual)`;
    const base = `Rendimiento base de ${pct(result.expectedAnnual)} anual: combina ${history} con lo que paga el mercado por su riesgo (beta ${result.beta.toFixed(2)}${result.betaMeasured ? '' : ', estimada'}). El historial pesa como máximo la mitad, porque los años extremos rara vez se repiten.`;
    const range = ` El rango pesimista–optimista cubre 8 de cada 10 resultados posibles según su volatilidad (${result.volatility.toFixed(0)}% anual${hasWorld ? ', ajustada por el VIX de hoy' : ''}).`;
    const world = result.scenario === 'base' ? '' : ` Escenario «${SCENARIOS[result.scenario].label}»: se aplica el movimiento promedio que tuvo en episodios comparables (${pct(result.shock)}) y se diluye con el tiempo; al final del plazo quedan ${pct(result.effect)}.`;
    return `${base}${range}${world} Es una simulación, no una garantía.`;
}
function ClimatePanel({ climate, loading }: { climate: Climate | null; loading: boolean }) {
    if (!climate) return <p className="mu mt-4 border-t border-[var(--line)] pt-4 text-[11px] leading-5">{loading ? 'Consultando el clima de los mercados…' : 'No se pudo consultar el clima de los mercados: «Auto» usa el escenario base y el rango no se ajusta por el miedo actual del mercado.'}</p>;
    const tone = climate.level === 'tense' || climate.level === 'stress' ? 'text-[var(--neg)]' : 'text-[var(--sig)]';
    const cells: { name: string; value: string; note: string }[] = [];
    if (climate.drawdown != null) cells.push({ name: 'S&P 500', value: pct(climate.drawdown), note: 'contra su máximo de 52 semanas' });
    if (climate.vix != null) cells.push({ name: 'VIX · miedo del mercado', value: climate.vix.toFixed(1), note: climate.vix >= 30 ? 'pánico' : climate.vix >= 22 ? 'nervios' : climate.vix < 15 ? 'calma' : 'normal' });
    if (climate.oil3m != null) cells.push({ name: 'Petróleo', value: pct(climate.oil3m), note: 'en 3 meses' });
    if (climate.gold3m != null) cells.push({ name: 'Oro · refugio', value: pct(climate.gold3m), note: 'en 3 meses' });
    if (climate.us10y != null) cells.push({ name: 'Tasa EE.UU. 10 años', value: `${climate.us10y.toFixed(2)}%`, note: climate.us10yChange == null ? '' : `${climate.us10yChange >= 0 ? '+' : ''}${climate.us10yChange.toFixed(2)} pts en 3 meses` });
    return <div className="mt-4 border-t border-[var(--line)] pt-4">
        <div className="flex flex-wrap items-center gap-2"><p className="lb">CLIMA MUNDIAL HOY</p><span className={`rounded-full border border-[var(--line2)] px-2.5 py-0.5 text-[10px] ${tone}`}>{climate.label}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{cells.map(cell => <div key={cell.name} className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><p className="mu text-[10px]">{cell.name}</p><p className="mt-1.5 font-mono text-[15px]">{cell.value}</p><p className="mu mt-0.5 text-[10px]">{cell.note}</p></div>)}</div>
    </div>;
}
function historicalPoint(points: Point[], target: number): Point | undefined {
    // Allow weekends and the one-day limit of CoinGecko's free history.
    let best: Point | undefined;
    for (const point of points) {
        if (point.time > target + DAY * 2) break;
        if (!best || Math.abs(point.time - target) < Math.abs(best.time - target)) best = point;
    }
    return best && Math.abs(best.time - target) <= 7 * DAY ? best : undefined;
}
export function adjustPossibleRatios(points: Point[]) {
    const adjusted = points.map(point => ({ ...point }));
    const changes: number[] = [];
    let factor = 1;
    for (let i = points.length - 1; i >= 0; i--) {
        adjusted[i].price *= factor;
        if (i === 0 || points[i].time - points[i - 1].time > 7 * DAY) continue;
        const ratio = points[i - 1].price / points[i].price;
        const multiple = ratio < 1 ? 1 / ratio : ratio;
        const rounded = Math.round(multiple);
        if (rounded >= 2 && rounded <= 10 && Math.abs(multiple / rounded - 1) < 0.02) { factor *= ratio > 1 ? 1 / rounded : rounded; changes.push(points[i].time); }
    }
    return { points: adjusted, changes };
}
// Índice simulado de una caución renovada: tasas diarias registradas por el radar y, antes de eso, la tasa actual.
async function caucionHistory(id: string): Promise<Point[]> {
    const plazo = Number(id);
    const rates = await request<Rates>('rates');
    const row = rates.cauciones.find(item => item.plazo === plazo);
    if (!row) throw new Error('El proveedor no informa ese plazo de caución.');
    const recorded = new Map((rates.history ?? []).filter(item => item.bucket === row.bucket).map(item => [item.date, item.tasa]));
    const firstRecorded = [...recorded.keys()].sort()[0] ?? '';
    const day = 86400000, end = Date.parse(`${new Date().toLocaleDateString('en-CA')}T12:00:00Z`);
    const points: Point[] = [];
    let price = 100, tasa = row.tasa;
    for (let time = end - 6 * 366 * day; time <= end; time += day) {
        points.push({ time: Math.min(time, Date.now()), price });
        const date = new Date(time).toISOString().slice(0, 10);
        if (firstRecorded && date >= firstRecorded) tasa = recorded.get(date) ?? tasa;
        // Interés simple por plazo, capitalizado en cada renovación.
        price *= Math.pow(1 + tasa / 100 * plazo / 365, 1 / plazo);
    }
    return points;
}
export async function history(kind: 'cedear' | 'crypto' | 'stock' | 'arg-stock' | 'bond' | 'fund' | 'morpho' | 'caucion', id: string, signal: AbortSignal): Promise<Point[]> {
    if (kind === 'caucion') return caucionHistory(id);
    const key = `activos:asset-history:${kind === 'stock' ? 'stock-v2' : kind}:${id}`;
    try { const cache = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (cache && Date.now() - cache.time < 30 * 60 * 1000 && Array.isArray(cache.points)) return kind === 'arg-stock' ? adjustLocalSplits(id, cache.points) : cache.points; } catch { /* Sin caché. */ }
    if (kind === 'morpho') {
        const points = await morphoHistory(id, signal);
        if (!points.length) throw new Error('El proveedor no tiene datos para este activo.');
        try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), points })); } catch { /* Sin caché. */ }
        return points;
    }
    const [fundSlug, fundId, classId] = id.split('~');
    const url = kind === 'fund' ? `https://api.argentinadatos.com/v1/finanzas/fci/fondos/${encodeURIComponent(fundSlug)}/historico` : kind === 'bond' ? `https://data912.com/historical/bonds/${encodeURIComponent(id)}` : kind === 'stock' ? `/api/stocks/history?symbol=${encodeURIComponent(id)}` : kind === 'cedear' || kind === 'arg-stock' ? `https://data912.com/historical/${kind === 'arg-stock' ? 'stocks' : 'cedears'}/${encodeURIComponent(id)}` : `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=365`;
    const response = await fetch(apiUrl(url), { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) throw new Error(response.status === 429 ? 'Límite de consultas del proveedor.' : 'Historial no disponible.');
    const raw: unknown = await response.json();
    if (kind === 'fund' && (String((raw as { fondoId?: unknown }).fondoId) !== fundId || String((raw as { claseId?: unknown }).claseId) !== classId)) throw new Error('La clase del fondo no coincide con el historial.');
    const rows = kind === 'fund' ? (raw as { historico?: unknown }).historico : kind !== 'crypto' ? raw : (raw as { prices?: unknown })?.prices;
    if (!Array.isArray(rows)) throw new Error('Respuesta histórica inválida.');
    const points: Point[] = rows.flatMap(row => {
        const time = kind === 'fund' ? Date.parse(`${String(row?.fecha ?? '').slice(0, 10)}T12:00:00Z`) : kind === 'stock' ? Number(row?.time) : kind !== 'crypto' ? Date.parse(`${String(row?.date ?? '').slice(0, 10)}T12:00:00Z`) : Number(row?.[0]);
        const price = Number(kind === 'fund' ? row?.valorCuotaparte : kind === 'stock' ? row?.price : kind !== 'crypto' ? row?.c : row?.[1]) / (kind === 'bond' ? 100 : 1);
        return Number.isFinite(time) && Number.isFinite(price) && price > 0 && time <= Date.now() ? [{ time, price }] : [];
    }).sort((a, b) => a.time - b.time);
    if (!points.length) throw new Error('El proveedor no tiene datos para este activo.');
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), points })); } catch { /* Sin caché. */ }
    return kind === 'arg-stock' ? adjustLocalSplits(id, points) : points;
}

export default function AssetPerformance({ items, hidden }: { items: Investment[]; hidden: boolean }) {
    const [data, setData] = useState<Data>({});
    const [dollar, setDollar] = useState<Point[]>([]);
    const [loading, setLoading] = useState(false);
    const [retry, setRetry] = useState(0);
    const [settings, setSettings] = useState<Settings>(readSettings);
    const [world, setWorld] = useState<World | null>(null);
    const [fallbackMarket, setFallbackMarket] = useState<Point[]>([]);
    const [worldLoading, setWorldLoading] = useState(true);
    const assets = items.filter(i => (i.kind === 'crypto' || i.kind === 'cedear' || i.kind === 'stock') && i.coin);
    const signature = [...new Set(assets.map(keyOf))].sort().join('|');
    const hasAssets = assets.length > 0;
    useEffect(() => {
        const controller = new AbortController();
        const keys = signature ? signature.split('|') : [];
        if (!keys.length) { setData({}); setLoading(false); return () => controller.abort(); }
        setLoading(true); setData({});
        const dollarRequest = keys.some(key => key.startsWith('cedear:')) ? fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then((rows: unknown) => Array.isArray(rows) ? rows.flatMap(row => {
            const time = Date.parse(`${String(row?.fecha ?? '').slice(0, 10)}T12:00:00Z`), price = Number(row?.venta);
            return Number.isFinite(time) && Number.isFinite(price) && price > 0 && time <= Date.now() ? [{ time, price }] : [];
        }).sort((a, b) => a.time - b.time) : []).catch(() => []) : Promise.resolve([]);
        void Promise.all([Promise.all(keys.map(async key => {
            const [kind, id] = key.split(':');
            // Historial largo en dólares para simular: la acción de EE.UU. detrás del CEDEAR o el par cripto/USD.
            const longTicker = kind === 'cedear' ? id.toUpperCase() : kind === 'crypto' ? CRYPTO_TICKERS[id] : undefined;
            const longRequest = longTicker ? history('stock', longTicker, controller.signal).catch(() => undefined) : Promise.resolve(undefined);
            try { return [key, { points: await history(kind as 'cedear' | 'crypto' | 'stock', id, controller.signal), long: await longRequest }] as const; }
            catch (error) { return [key, { points: [], error: error instanceof Error ? error.message : 'Historial no disponible.' }] as const; }
        })), dollarRequest]).then(([entries, dollarPoints]) => { if (!controller.signal.aborted) { setData(Object.fromEntries(entries)); setDollar(dollarPoints); setLoading(false); } });
        return () => controller.abort();
    }, [signature, retry]);
    useEffect(() => {
        if (!hasAssets) return;
        const controller = new AbortController();
        void request<unknown>('world').then(parseWorld).catch(() => null).then(async result => {
            // Sin clima mundial, el S&P 500 (ETF SPY) alcanza para medir la beta y las crisis pasadas.
            const spy = result ? [] : await history('stock', 'SPY', controller.signal).catch(() => []);
            if (!controller.signal.aborted) { setWorld(result); setFallbackMarket(spy); setWorldLoading(false); }
        });
        return () => controller.abort();
    }, [hasAssets, retry]);
    if (!assets.length) return null;
    const update = (next: Settings) => { setSettings(next); try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* Sin almacenamiento. */ } };
    const now = today(), minDate = addMonths(now, 1), maxDate = addMonths(now, 120);
    const targetDate = settings.months != null ? addMonths(now, settings.months) : settings.date < minDate ? minDate : settings.date > maxDate ? maxDate : settings.date;
    const horizonYears = settings.months != null ? settings.months / 12 : yearsBetween(now, targetDate);
    const horizonName = horizonLabel(horizonYears);
    // En plazos menores a un año se muestra la rentabilidad del período: anualizar unos pocos meses exagera el número.
    const short = horizonYears < 0.99;
    const headline = (value: Outcome) => short ? value.total : value.annual;
    const climate = readClimate(world);
    const scenario = settings.scenario === 'auto' ? climate?.suggested ?? 'base' : settings.scenario;
    const market = world?.market ?? fallbackMarket;
    return <section className="mt-5" aria-label="Rendimiento histórico y proyección">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><p className="lb">ANÁLISIS DE TU CARTERA</p><h2 className="mt-2 text-[clamp(1.4rem,2.5vw,1.9rem)] font-light tracking-tight">Rendimiento de tus activos<span className="sig">.</span></h2><p className="mu mt-2 max-w-2xl text-[12px] leading-5">El último mes y año de cada activo, y una simulación a futuro según su historial, el clima de los mercados y el escenario mundial que elijas.</p></div><div className="seg" role="group" aria-label="Moneda de análisis"><button type="button" aria-pressed="true">USD</button><button type="button" disabled title="Disponible próximamente" className="cursor-not-allowed opacity-35">ARS</button></div></div>
        <div className="card mb-3.5 p-5 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-2">
                <div className="min-w-0">
                    <p className="lb">PLAZO DE LA SIMULACIÓN</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                        <div className="seg" role="group" aria-label="Plazo de la simulación">{PRESETS.map(preset => <button key={preset.months} type="button" aria-pressed={settings.months === preset.months} onClick={() => update({ ...settings, months: preset.months, date: '' })}>{preset.label}</button>)}</div>
                        <label className="mu flex items-center gap-2 text-[11px]">o hasta el<input type="date" value={targetDate} min={minDate} max={maxDate} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) update({ ...settings, months: null, date: event.target.value }); }} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)]" /></label>
                    </div>
                    <p className="mu mt-2.5 text-[11px] leading-5">Elegí de 1 mes a 10 años. Cuanto más largo el plazo, más amplio el rango de resultados posibles.</p>
                </div>
                <div className="min-w-0">
                    <p className="lb">ESCENARIO MUNDIAL</p>
                    <div className="seg mt-2.5" role="group" aria-label="Escenario mundial"><button type="button" aria-pressed={settings.scenario === 'auto'} onClick={() => update({ ...settings, scenario: 'auto' })}>Auto</button>{SCENARIO_ORDER.map(id => <button key={id} type="button" aria-pressed={settings.scenario === id} onClick={() => update({ ...settings, scenario: id })}>{SCENARIOS[id].short}</button>)}</div>
                    <p className="mu mt-2.5 text-[11px] leading-5">{settings.scenario === 'auto' ? <>Según el clima de hoy se usa <span className="text-[var(--ink)]">{SCENARIOS[scenario].label}</span>. {climate ? climate.reason : worldLoading ? '' : 'No hay datos del clima de mercado.'}</> : <><span className="text-[var(--ink)]">{SCENARIOS[scenario].label}.</span> {SCENARIOS[scenario].description}</>}</p>
                </div>
            </div>
            <ClimatePanel climate={climate} loading={worldLoading} />
        </div>
        {loading ? <div className="card grid min-h-40 place-items-center text-[12px] text-[var(--muted)]" role="status">Consultando precios históricos…</div> : <div className="flex snap-x snap-proximity gap-3.5 overflow-x-auto overscroll-x-contain pb-2 sm:grid sm:overflow-visible sm:pb-0 xl:grid-cols-2">{assets.map(item => {
            const record = data[keyOf(item)]; const rawPoints = record?.points ?? [];
            const adjusted = item.kind === 'cedear' ? adjustPossibleRatios(rawPoints) : { points: rawPoints, changes: [] };
            const points = item.kind === 'cedear' ? adjusted.points.flatMap(point => { const fx = historicalPoint(dollar, point.time); return fx ? [{ time: point.time, price: point.price / fx.price }] : []; }) : adjusted.points;
            const end = points[points.length - 1];
            const fresh = !!end && Date.now() - end.time <= 7 * DAY;
            const month = end && historicalPoint(points, end.time - 30 * DAY);
            const year = end && historicalPoint(points, end.time - 365 * DAY);
            const earliest = points[0];
            const availableDays = end && earliest ? Math.floor((end.time - earliest.time) / DAY) : 0;
            const annualized = !year && availableDays >= 90 && !!earliest && !!end;
            const monthReturn = fresh && month && end ? (end.price / month.price - 1) * 100 : null;
            const yearReturn = !fresh || !end ? null : year ? (end.price / year.price - 1) * 100 : annualized ? (Math.pow(end.price / earliest.price, 365 / availableDays) - 1) * 100 : null;
            const safeYearReturn = yearReturn != null && Number.isFinite(yearReturn) ? yearReturn : null;
            // El historial largo solo se usa si coincide con lo que rindió el activo de la cartera.
            const long = record?.long && sameAsset(points, record.long) ? record.long : points;
            const result = fresh && end ? project({ points: long, market, kind: item.kind as 'cedear' | 'crypto' | 'stock', horizonYears, scenario, world }) : null;
            const show = (factor: number) => !end || !Number.isFinite(end.price * factor) ? '—' : hidden ? '****' : money(end.price * factor * (item.units ?? 1), 'USD');
            const perUnit = (factor: number) => !end || hidden ? '****' : money(end.price * factor, 'USD');
            const adjustedYear = !!end && adjusted.changes.some(time => time > (year?.time ?? earliest?.time ?? end.time) && time <= end.time);
            const estimated = annualized || adjustedYear;
            const needsMessage = !!record?.error || !fresh || !month || safeYearReturn == null || estimated || !result;
            let message = record?.error ?? '';
            if (!message && item.kind === 'cedear' && !dollar.length) message = 'No se pudo consultar el dólar MEP histórico.';
            else if (!message && !fresh) message = 'El último precio histórico no está disponible o está desactualizado.';
            else if (!message && safeYearReturn == null) message = 'Falta historial suficiente para estimar el rendimiento anual.';
            else if (!message && !month) message = 'Falta historial suficiente para calcular el último mes.';
            else if (!message && !result) message = 'Falta historial suficiente para simular el escenario (se necesitan al menos 3 meses).';
            const ticker = item.kind !== 'crypto' ? item.coin?.toUpperCase() : (item.coin ?? '').slice(0, 4).toUpperCase();
            const positiveColor = (value: number | null) => value == null ? 'text-[var(--faint)]' : value < 0 ? 'text-[var(--neg)]' : 'text-[var(--sig)]';
            // Dónde queda el valor de hoy dentro del rango pesimista–optimista (escala logarítmica).
            const todayMark = result && result.high.factor > result.low.factor ? Math.min(100, Math.max(0, -Math.log(result.low.factor) / Math.log(result.high.factor / result.low.factor) * 100)) : null;
            return <article key={item.id} className="card flex w-[88%] min-w-0 shrink-0 snap-start flex-col p-5 sm:w-auto sm:p-6">
                <div className="flex items-start gap-3"><div className="grid h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-1 font-mono text-[10px] font-medium text-[var(--sig)]">{ticker}</div><div className="min-w-0 flex-1"><p className="truncate text-[15px] font-medium">{item.name}</p><p className="mu mt-1 text-[11px]">{item.kind === 'cedear' ? 'CEDEAR · USD MEP' : item.kind === 'stock' ? 'Acción · USD' : 'Cripto · USD'} <span aria-hidden="true">·</span> {item.kind !== 'crypto' ? 'Data912' : 'CoinGecko'}</p></div>{estimated && <span className="rounded-full border border-[var(--line2)] px-2.5 py-1 text-[10px] text-[var(--muted)]">Estimado</span>}</div>
                <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><p className="mu text-[10px]">ÚLTIMO MES</p><p className={`mt-2 font-mono text-[clamp(1rem,2vw,1.25rem)] ${positiveColor(monthReturn)}`}>{monthReturn == null ? '—' : pct(monthReturn)}</p><p className="mu mt-1 text-[10px]">30 días</p></div><div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><p className="mu text-[10px]">ÚLTIMO AÑO</p><p className={`mt-2 font-mono text-[clamp(1rem,2vw,1.25rem)] ${positiveColor(safeYearReturn)}`}>{safeYearReturn == null ? '—' : pct(safeYearReturn)}</p><p className="mu mt-1 text-[10px]">{annualized ? `Estimado · ${availableDays} días` : '365 días'}</p></div></div>
                <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2"><p className="mu text-[10px]">ESCENARIO A {horizonName} <span aria-hidden="true">·</span> {date(Date.parse(`${targetDate}T12:00:00Z`)).toUpperCase()}</p><ProjectionHelp text={result ? explain(result, !!world) : 'Falta historial o un precio reciente para simular este activo.'} /></div>
                    {result ? <>
                        <div className="mt-2.5 flex items-end justify-between gap-4">
                            <div className="min-w-0"><p className="break-all font-mono text-[clamp(1.15rem,2.4vw,1.5rem)]">{show(result.base.factor)}</p><p className="mu mt-1 text-[10px]">{item.units != null ? 'Tu posición · estimado' : 'Por unidad · sin unidades registradas'}</p></div>
                            <div className="shrink-0 text-right"><p className={`font-mono text-[clamp(1.15rem,2.4vw,1.5rem)] ${positiveColor(headline(result.base))}`}>{pct(headline(result.base))}</p><p className="mu mt-1 text-[10px]">{short ? 'rentabilidad del período' : 'rentabilidad anual'}</p></div>
                        </div>
                        <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">{([['Pesimista', result.low], ['Base', result.base], ['Optimista', result.high]] as const).map(([name, value], index) => <div key={name} className={`min-w-0 ${index === 1 ? 'text-center' : index === 2 ? 'text-right' : ''}`}><p className="mu text-[10px]">{name}</p><p className="mt-1 break-all font-mono text-[12.5px]">{show(value.factor)}</p><p className={`mt-0.5 font-mono text-[11px] ${positiveColor(headline(value))}`}>{pct(headline(value))}{!short && <span className="text-[var(--muted)]"> /año</span>}</p></div>)}</div>
                        {todayMark != null && !result.stable && <div className="mt-3" aria-hidden="true"><div className="relative h-1.5 rounded-full bg-[var(--line2)]"><span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--sig)]" style={{ left: '50%' }} /><span className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[var(--ink)]" style={{ left: `${todayMark}%` }} /></div><p className="mu relative mt-1.5 h-3 text-[9.5px]"><span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(92, Math.max(8, todayMark))}%` }}>valor de hoy</span></p></div>}
                        <p className="mu mt-3 text-[10.5px] leading-5">{item.units != null && <>Por unidad: {perUnit(result.base.factor)} (de {perUnit(result.low.factor)} a {perUnit(result.high.factor)}). </>}{short ? <>Equivale a {pct(result.base.annual)} anualizado. </> : horizonYears > 1.01 && <>Total del período: <span className={positiveColor(result.base.total)}>{pct(result.base.total)}</span>. </>}{!result.stable && <>Probabilidad de terminar por debajo de hoy: {result.lossProbability.toFixed(0)}%.</>}</p>
                        {result.scenario !== 'base' && <p className="mu mt-1 text-[10.5px] leading-5">{SCENARIOS[result.scenario].label}: {result.episodes.map(episode => `${episode.label} ${pct(episode.value)}${episode.own ? '' : ' (estimado por beta)'}`).join(' · ')}.</p>}
                    </> : <><p className="mt-2 font-mono text-[clamp(1.15rem,2.4vw,1.5rem)] text-[var(--faint)]">—</p><p className="mu mt-1 text-[10px]">Sin datos suficientes</p></>}
                </div>
                <div className="mu mt-4 flex flex-wrap items-center justify-between gap-2 text-[10.5px]"><span>{end ? `Último dato · ${date(end.time)}` : 'Sin cotización histórica'}{result && !result.stable ? ` · Simulado con ${result.years >= 1.5 ? `${Math.round(result.years)} años` : `${Math.round(result.years * 12)} meses`} de historial` : ''}</span><span>{end && !hidden ? `Cierre ${money(end.price, 'USD')}` : ''}</span></div>
                {needsMessage && <div className="mu mt-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[11px] leading-5">{message && <p>{message}</p>}{annualized && <p>El anual es una proyección calculada con {availableDays} días disponibles, no un rendimiento real de 365 días.</p>}{adjustedYear && <p>Se ajustó un salto que podría ser un cambio de ratio del CEDEAR. La corrección es aproximada y requiere confirmación.</p>}</div>}
            </article>;
        })}</div>}
        {!loading && Object.values(data).some(row => row.error) && <button type="button" className="mu mt-4 text-[12px] underline" onClick={() => setRetry(value => value + 1)}>Reintentar historiales</button>}
        <p className="mu mt-4 text-[10.5px] leading-5">La simulación es una estimación estadística, no una predicción ni una recomendación de inversión: nadie puede anticipar guerras, crisis ni precios. Combina el historial de cada activo (hasta 10 años), su sensibilidad al S&P 500, la volatilidad que hoy espera el mercado y lo que pasó en crisis anteriores. No incluye comisiones ni impuestos. Para CEDEARs se usa una conversión aproximada con dólar MEP, que puede diferir del precio del activo en el exterior.</p>
    </section>;
}
