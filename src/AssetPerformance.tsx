import { useEffect, useState } from 'react';
import type { Investment } from './portfolio';

export type HistoryPoint = { time: number; price: number };
type Point = HistoryPoint;
type Data = Record<string, { points: Point[]; error?: string }>;
const DAY = 86400000;
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const date = (time: number) => new Date(time).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const money = (value: number, currency: string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const keyOf = (item: Investment) => `${item.kind}:${item.coin}`;
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
export async function history(kind: 'cedear' | 'crypto' | 'stock' | 'arg-stock', id: string, signal: AbortSignal): Promise<Point[]> {
    const key = `activos:asset-history:${kind}:${id}`;
    try { const cache = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (cache && Date.now() - cache.time < 30 * 60 * 1000 && Array.isArray(cache.points)) return cache.points; } catch { /* Sin caché. */ }
    const url = kind === 'stock' ? `/api/stocks/history?symbol=${encodeURIComponent(id)}` : kind === 'cedear' || kind === 'arg-stock' ? `https://data912.com/historical/${kind === 'arg-stock' ? 'stocks' : 'cedears'}/${encodeURIComponent(id)}` : `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=365`;
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) throw new Error(response.status === 429 ? 'Límite de consultas del proveedor.' : 'Historial no disponible.');
    const raw: unknown = await response.json();
    const rows = kind !== 'crypto' ? raw : (raw as { prices?: unknown })?.prices;
    if (!Array.isArray(rows)) throw new Error('Respuesta histórica inválida.');
    const points: Point[] = rows.flatMap(row => {
        const time = kind === 'stock' ? Number(row?.time) : kind !== 'crypto' ? Date.parse(`${String(row?.date ?? '').slice(0, 10)}T12:00:00Z`) : Number(row?.[0]);
        const price = Number(kind === 'stock' ? row?.price : kind !== 'crypto' ? row?.c : row?.[1]);
        return Number.isFinite(time) && Number.isFinite(price) && price > 0 && time <= Date.now() ? [{ time, price }] : [];
    }).sort((a, b) => a.time - b.time);
    if (!points.length) throw new Error('El proveedor no tiene datos para este activo.');
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), points })); } catch { /* Sin caché. */ }
    return points;
}

export default function AssetPerformance({ items, hidden }: { items: Investment[]; hidden: boolean }) {
    const [data, setData] = useState<Data>({});
    const [dollar, setDollar] = useState<Point[]>([]);
    const [loading, setLoading] = useState(false);
    const [retry, setRetry] = useState(0);
    const assets = items.filter(i => i.kind !== 'rate' && i.coin);
    const signature = [...new Set(assets.map(keyOf))].sort().join('|');
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
            try { return [key, { points: await history(kind as 'cedear' | 'crypto' | 'stock', id, controller.signal) }] as const; }
            catch (error) { return [key, { points: [], error: error instanceof Error ? error.message : 'Historial no disponible.' }] as const; }
        })), dollarRequest]).then(([entries, dollarPoints]) => { if (!controller.signal.aborted) { setData(Object.fromEntries(entries)); setDollar(dollarPoints); setLoading(false); } });
        return () => controller.abort();
    }, [signature, retry]);
    if (!assets.length) return null;
    return <section className="mt-5" aria-label="Rendimiento histórico y proyección">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><p className="lb">ANÁLISIS DE TU CARTERA</p><h2 className="mt-2 text-[clamp(1.4rem,2.5vw,1.9rem)] font-light tracking-tight">Rendimiento de tus activos<span className="sig">.</span></h2><p className="mu mt-2 max-w-2xl text-[12px] leading-5">Una mirada al último mes y año, con un escenario sencillo para el próximo año.</p></div><div className="seg" role="group" aria-label="Moneda de análisis"><button type="button" aria-pressed="true">USD</button><button type="button" disabled title="Disponible próximamente" className="cursor-not-allowed opacity-35">ARS</button></div></div>
        {loading ? <div className="card grid min-h-40 place-items-center text-[12px] text-[var(--muted)]" role="status">Consultando precios históricos…</div> : <div className="grid gap-3.5 xl:grid-cols-2">{assets.map(item => {
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
            const projection = end && safeYearReturn != null && Number.isFinite(end.price * (1 + safeYearReturn / 100)) ? end.price * (1 + safeYearReturn / 100) : null;
            const positionProjection = projection != null && item.units != null && Number.isFinite(projection * item.units) ? projection * item.units : null;
            const adjustedYear = !!end && adjusted.changes.some(time => time > (year?.time ?? earliest?.time ?? end.time) && time <= end.time);
            const estimated = annualized || adjustedYear;
            const needsMessage = !!record?.error || !fresh || !month || safeYearReturn == null || estimated;
            let message = record?.error ?? '';
            if (!message && item.kind === 'cedear' && !dollar.length) message = 'No se pudo consultar el dólar MEP histórico.';
            else if (!message && !fresh) message = 'El último precio histórico no está disponible o está desactualizado.';
            else if (!message && safeYearReturn == null) message = 'Falta historial suficiente para estimar el rendimiento anual.';
            else if (!message && !month) message = 'Falta historial suficiente para calcular el último mes.';
            const ticker = item.kind !== 'crypto' ? item.coin?.toUpperCase() : (item.coin ?? '').slice(0, 4).toUpperCase();
            const positiveColor = (value: number | null) => value == null ? 'text-[var(--faint)]' : value < 0 ? 'text-[var(--neg)]' : 'text-[var(--sig)]';
            return <article key={item.id} className="card flex min-w-0 flex-col p-5 sm:p-6">
                <div className="flex items-start gap-3"><div className="grid h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-1 font-mono text-[10px] font-medium text-[var(--sig)]">{ticker}</div><div className="min-w-0 flex-1"><p className="truncate text-[15px] font-medium">{item.name}</p><p className="mu mt-1 text-[11px]">{item.kind === 'cedear' ? 'CEDEAR · USD MEP' : item.kind === 'stock' ? 'Acción · USD' : 'Cripto · USD'} <span aria-hidden="true">·</span> {item.kind !== 'crypto' ? 'Data912' : 'CoinGecko'}</p></div>{estimated && <span className="rounded-full border border-[var(--line2)] px-2.5 py-1 text-[10px] text-[var(--muted)]">Estimado</span>}</div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><p className="mu text-[10px]">ÚLTIMO MES</p><p className={`mt-2 font-mono text-[clamp(1rem,2vw,1.25rem)] ${positiveColor(monthReturn)}`}>{monthReturn == null ? '—' : pct(monthReturn)}</p><p className="mu mt-1 text-[10px]">30 días</p></div><div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><p className="mu text-[10px]">ÚLTIMO AÑO</p><p className={`mt-2 font-mono text-[clamp(1rem,2vw,1.25rem)] ${positiveColor(safeYearReturn)}`}>{safeYearReturn == null ? '—' : pct(safeYearReturn)}</p><p className="mu mt-1 text-[10px]">{annualized ? `Estimado · ${availableDays} días` : '365 días'}</p></div><div className="col-span-2 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3 sm:col-span-1"><p className="mu text-[10px]">ESCENARIO A 1 AÑO</p><p className="mt-2 break-all font-mono text-[clamp(1rem,2vw,1.25rem)]">{positionProjection == null ? '—' : hidden ? '****' : money(positionProjection, 'USD')}</p><p className="mu mt-1 text-[10px]">Tu posición · estimado</p><p className="mu mt-2 text-[10px]">Por unidad: {projection == null ? '—' : hidden ? '****' : money(projection, 'USD')}</p>{projection != null && item.units == null && <p className="mu mt-1 text-[10px]">Sin unidades registradas</p>}</div></div>
                <div className="mu mt-4 flex flex-wrap items-center justify-between gap-2 text-[10.5px]"><span>{end ? `Último dato · ${date(end.time)}` : 'Sin cotización histórica'}</span><span>{end && !hidden ? `Cierre ${money(end.price, 'USD')}` : ''}</span></div>
                {needsMessage && <div className="mu mt-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[11px] leading-5">{message && <p>{message}</p>}{annualized && <p>El anual es una proyección calculada con {availableDays} días disponibles, no un rendimiento real de 365 días.</p>}{adjustedYear && <p>Se ajustó un salto que podría ser un cambio de ratio del CEDEAR. La corrección es aproximada y requiere confirmación.</p>}</div>}
            </article>;
        })}</div>}
        {!loading && Object.values(data).some(row => row.error) && <button type="button" className="mu mt-4 text-[12px] underline" onClick={() => setRetry(value => value + 1)}>Reintentar historiales</button>}
        <p className="mu mt-4 text-[10.5px] leading-5">El escenario supone que el rendimiento anual se repite y no garantiza resultados. No incluye dividendos, comisiones ni impuestos. Para CEDEARs se usa una conversión aproximada con dólar MEP, que puede diferir del precio del activo en el exterior.</p>
    </section>;
}
