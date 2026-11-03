import { useEffect, useState } from 'react';
import type { Investment } from './portfolio';

type Point = { time: number; price: number };
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
function suspiciousRatio(points: Point[], from: number, to: number) {
    for (let i = 1; i < points.length; i++) {
        if (points[i].time < from || points[i].time > to || points[i].time - points[i - 1].time > 7 * DAY) continue;
        const ratio = points[i - 1].price / points[i].price;
        const multiple = ratio < 1 ? 1 / ratio : ratio;
        const rounded = Math.round(multiple);
        if (rounded >= 2 && rounded <= 10 && Math.abs(multiple / rounded - 1) < 0.03) return true;
    }
    return false;
}
async function history(kind: 'cedear' | 'crypto', id: string, signal: AbortSignal): Promise<Point[]> {
    const key = `activos:asset-history:${kind}:${id}`;
    try { const cache = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (cache && Date.now() - cache.time < 30 * 60 * 1000 && Array.isArray(cache.points)) return cache.points; } catch { /* Sin caché. */ }
    const url = kind === 'cedear' ? `https://data912.com/historical/cedears/${encodeURIComponent(id)}` : `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=365`;
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) throw new Error(response.status === 429 ? 'Límite de consultas del proveedor.' : 'Historial no disponible.');
    const raw: unknown = await response.json();
    const rows = kind === 'cedear' ? raw : (raw as { prices?: unknown })?.prices;
    if (!Array.isArray(rows)) throw new Error('Respuesta histórica inválida.');
    const points: Point[] = rows.flatMap(row => {
        const time = kind === 'cedear' ? Date.parse(`${String(row?.date ?? '').slice(0, 10)}T12:00:00Z`) : Number(row?.[0]);
        const price = Number(kind === 'cedear' ? row?.c : row?.[1]);
        return Number.isFinite(time) && Number.isFinite(price) && price > 0 && time <= Date.now() ? [{ time, price }] : [];
    }).sort((a, b) => a.time - b.time);
    if (!points.length) throw new Error('El proveedor no tiene datos para este activo.');
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), points })); } catch { /* Sin caché. */ }
    return points;
}

export default function AssetPerformance({ items, hidden }: { items: Investment[]; hidden: boolean }) {
    const [data, setData] = useState<Data>({});
    const [dollar, setDollar] = useState<Point[]>([]);
    const [cedearCurrency, setCedearCurrency] = useState<'ARS' | 'USD'>('USD');
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
            try { return [key, { points: await history(kind as 'cedear' | 'crypto', id, controller.signal) }] as const; }
            catch (error) { return [key, { points: [], error: error instanceof Error ? error.message : 'Historial no disponible.' }] as const; }
        })), dollarRequest]).then(([entries, dollarPoints]) => { if (!controller.signal.aborted) { setData(Object.fromEntries(entries)); setDollar(dollarPoints); setLoading(false); } });
        return () => controller.abort();
    }, [signature, retry]);
    if (!assets.length) return null;
    return <section className="card mt-4 overflow-hidden" aria-label="Rendimiento histórico y proyección"><div className="p-5 sm:p-6"><p className="lb">RENDIMIENTO DE TUS ACTIVOS</p><p className="mu mt-2 text-[12px] leading-5">Variación del precio del activo en el último mes y año. La proyección supone que el rendimiento del último año se repite una vez; es una hipótesis, no una predicción confiable.</p>{assets.some(item => item.kind === 'cedear') && <div className="seg mt-4 inline-flex" role="group" aria-label="Moneda del rendimiento de CEDEARs"><button type="button" aria-pressed={cedearCurrency === 'USD'} onClick={() => setCedearCurrency('USD')}>Dólares MEP</button><button type="button" aria-pressed={cedearCurrency === 'ARS'} onClick={() => setCedearCurrency('ARS')}>Pesos</button></div>}</div>
        {loading ? <p className="mu px-6 pb-6 text-[12px]" role="status">Consultando precios históricos…</p> : <div className="divide-y divide-[var(--line)]">{assets.map(item => {
            const record = data[keyOf(item)]; const rawPoints = record?.points ?? [];
            const points = item.kind === 'cedear' && cedearCurrency === 'USD' ? rawPoints.flatMap(point => { const fx = historicalPoint(dollar, point.time); return fx ? [{ time: point.time, price: point.price / fx.price }] : []; }) : rawPoints;
            const end = points[points.length - 1];
            const fresh = end && Date.now() - end.time <= 7 * DAY;
            const month = end && historicalPoint(points, end.time - 30 * DAY);
            const year = end && historicalPoint(points, end.time - 365 * DAY);
            const monthSplit = item.kind === 'cedear' && !!month && !!end && suspiciousRatio(rawPoints, month.time, end.time);
            const yearSplit = item.kind === 'cedear' && !!year && !!end && suspiciousRatio(rawPoints, year.time, end.time);
            const monthReturn = fresh && month && !monthSplit ? (end.price / month.price - 1) * 100 : null;
            const yearReturn = fresh && year && !yearSplit ? (end.price / year.price - 1) * 100 : null;
            const projection = end && yearReturn != null ? end.price * (1 + yearReturn / 100) : null;
            const currency = item.kind === 'cedear' ? cedearCurrency : 'USD';
            return <article key={item.id} className="px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[13px] font-medium">{item.name}</p><p className="mu mt-1 text-[11px]">{item.kind === 'cedear' ? `CEDEAR ${item.coin} · ${cedearCurrency === 'USD' ? 'equivalente en dólares MEP' : 'precios en pesos'} · Data912` : `${item.coin} · precios en dólares · CoinGecko`}{end ? ` · último cierre ${date(end.time)}` : ''}</p></div></div><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div><dt className="mu text-[11px]">Últimos 30 días</dt><dd className="mt-1 text-[14px]">{monthReturn == null ? '—' : pct(monthReturn)}</dd></div><div><dt className="mu text-[11px]">Últimos 365 días</dt><dd className="mt-1 text-[14px]">{yearReturn == null ? '—' : pct(yearReturn)}</dd></div><div><dt className="mu text-[11px]">Escenario a 1 año / unidad</dt><dd className="mt-1 text-[14px]">{projection == null ? '—' : hidden ? '****' : money(projection, currency)}</dd></div></dl>{(record?.error || !fresh || !month || !year || monthSplit || yearSplit) && <p className="mu mt-3 text-[11px]">{record?.error || (item.kind === 'cedear' && cedearCurrency === 'USD' && !dollar.length ? 'No se pudo consultar el dólar MEP histórico.' : !fresh ? 'El último precio histórico está desactualizado.' : monthSplit || yearSplit ? 'Se detectó un salto que podría corresponder a un cambio de ratio; no se calcula ese período sin datos ajustados.' : 'No hay suficiente historial para todos los períodos.')}</p>}{yearReturn != null && <p className="mu mt-2 text-[10.5px]">Escenario: último cierre × (1 + rendimiento anual). No incluye dividendos, comisiones ni impuestos. Los dólares MEP son una conversión aproximada del CEDEAR, no el rendimiento del ETF en el exterior.</p>}</article>;
        })}</div>}
        {!loading && Object.values(data).some(row => row.error) && <button type="button" className="mu mx-6 mb-5 mt-4 text-[12px] underline" onClick={() => setRetry(value => value + 1)}>Reintentar historiales</button>}
    </section>;
}
