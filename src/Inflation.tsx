import { useEffect, useMemo, useState } from 'react';
import type { Investment, Sale } from './portfolio';

type Point = { date: string; value: number };
type Series = Record<string, Point[]>;
type Historical = { uva: Point[]; fx: Point[]; assets: Series; errors: string[] };
const day = 86400000;
const ms = (s: string) => Date.parse(`${s}T12:00:00Z`);
const date = (t: number) => new Date(t).toISOString().slice(0, 10);
const fmtDate = (s: string) => new Date(ms(s)).toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
function at(rows: Point[], target: string): number | undefined {
    const t = ms(target);
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].date <= target) return t - ms(rows[i].date) <= 7 * day ? rows[i].value : undefined;
}
function normalize(rows: Point[]) { return rows.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && valid(x.value)).sort((a, b) => a.date.localeCompare(b.date)); }
async function json(url: string, signal: AbortSignal) {
    const key = `activos:historical:${url}`;
    try {
        const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        if (cached && Date.now() - cached.time < 3 * 60 * 60 * 1000) return cached.data;
    } catch { /* El almacenamiento puede no estar disponible. */ }
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch { /* El gráfico funciona sin caché. */ }
    return data;
}
async function historical(items: Investment[], signal: AbortSignal): Promise<Historical> {
    const ids = [...new Set(items.filter(i => i.kind !== 'rate' && i.coin).map(i => `${i.kind}:${i.coin}`))];
    const result: Historical = { uva: [], fx: [], assets: {}, errors: [] };
    const tasks: Promise<void>[] = [json('https://api.argentinadatos.com/v1/finanzas/indices/uva', signal).then(data => {
        if (!Array.isArray(data)) throw Error(); result.uva = normalize(data.map(x => ({ date: x.fecha?.slice(0, 10), value: x.valor })));
        if (!result.uva.length) throw Error();
    }).catch(() => { result.errors.push('índice UVA'); })];
    if (items.some(i => i.kind === 'crypto' || (i.kind === 'rate' && i.currency === 'USD'))) tasks.push(json('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa', signal).then(data => {
        if (!Array.isArray(data)) throw Error(); result.fx = normalize(data.map(x => ({ date: x.fecha?.slice(0, 10), value: x.venta })));
        if (!result.fx.length) throw Error();
    }).catch(() => { result.errors.push('dólar MEP histórico'); }));
    for (const key of ids) {
        const [kind, id] = key.split(':');
        const url = kind === 'cedear' ? `https://data912.com/historical/cedears/${encodeURIComponent(id)}` : `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=365&interval=daily`;
        tasks.push(json(url, signal).then(data => {
            const rows = kind === 'cedear' && Array.isArray(data) ? data.map(x => ({ date: x.date?.slice(0, 10), value: x.c })) : Array.isArray(data?.prices) ? data.prices.map((x: number[]) => ({ date: date(x[0]), value: x[1] })) : [];
            result.assets[key] = normalize(rows); if (!result.assets[key].length) throw Error();
        }).catch(() => { result.errors.push(id); }));
    }
    await Promise.all(tasks); return result;
}

export default function Inflation({ items, sales, prices, fxRate, hidden }: { items: Investment[]; sales: Sale[]; prices: Record<string, number>; fxRate?: number; hidden: boolean }) {
    const [range, setRange] = useState<'day' | 'month' | 'year'>('month');
    const [data, setData] = useState<Historical | null>(null);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const signature = items.map(i => `${i.kind}:${i.coin ?? ''}:${i.currency}`).sort().join('|');
    useEffect(() => {
        const controller = new AbortController(); setLoading(true); setData(null);
        void historical(items, controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false); } });
        return () => controller.abort();
        // La consulta depende de las fuentes necesarias, no de las cantidades.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, retry]);
    const current = items.reduce((sum, i) => {
        const elapsed = Math.max(0, (Date.now() - ms(i.date)) / (day * 30.4375));
        if (ms(i.date) > Date.now()) return sum;
        if (i.kind === 'rate') { const r = (i.rate ?? 0) / 100; const monthly = i.period === 'month' ? r : Math.pow(1 + r, 1 / 12) - 1; return sum + i.amount * Math.pow(1 + monthly, elapsed) * (i.currency === 'USD' ? (fxRate ?? NaN) : 1); }
        const price = prices[`${i.kind}:${i.coin}`];
        return sum + (price == null || !i.units ? NaN : i.units * price * (i.kind === 'crypto' ? (fxRate ?? NaN) : 1));
    }, 0);
    const chart = useMemo(() => {
        if (!data || !data.uva.length || !items.length || data.errors.length) return null;
        const today = date(Date.now());
        const end = [...data.uva].reverse().find(p => p.date <= today)?.date;
        if (!end) return null;
        const endTime = ms(end);
        const startTime = endTime - (range === 'day' ? 1 : range === 'month' ? 30 : 365) * day;
        const start = date(startTime);
        if (items.some(i => i.date > start) || sales.some(s => s.date >= start && s.date <= end)) return null;
        const count = range === 'month' ? 31 : 74;
        const dates = range === 'day' ? [start, end] : Array.from({ length: count }, (_, i) => date(startTime + (endTime - startTime) * i / (count - 1)));
        const values = dates.map(d => {
            const uva = at(data.uva, d); const dollar = at(data.fx, d);
            const total = items.reduce((sum, i) => {
                if (i.kind === 'rate') { const r = (i.rate ?? 0) / 100; const monthly = i.period === 'month' ? r : Math.pow(1 + r, 1 / 12) - 1; return sum + i.amount * Math.pow(1 + monthly, (ms(d) - ms(i.date)) / (day * 30.4375)) * (i.currency === 'USD' ? (dollar ?? NaN) : 1); }
                const price = at(data.assets[`${i.kind}:${i.coin}`] ?? [], d);
                return sum + (i.units ?? NaN) * (price ?? NaN) * (i.kind === 'crypto' ? (dollar ?? NaN) : 1);
            }, 0);
            return { date: d, total, uva };
        });
        const base = values[0];
        if (!base.uva || !Number.isFinite(base.total) || base.total <= 0 || values.some(v => !v.uva || !Number.isFinite(v.total))) return null;
        const points = values.map(v => ({ date: v.date, portfolio: (v.total / base.total - 1) * 100, inflation: (v.uva! / base.uva! - 1) * 100 }));
        const min = Math.min(0, ...points.flatMap(p => [p.portfolio, p.inflation])); const max = Math.max(0, ...points.flatMap(p => [p.portfolio, p.inflation]));
        const y = (v: number) => 210 - (v - min) / (max - min || 1) * 185;
        const path = (key: 'portfolio' | 'inflation') => points.map((p, i) => `${i ? 'L' : 'M'} ${(12 + i / (points.length - 1) * 826).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
        return { start, end, points, portfolio: path('portfolio'), inflation: path('inflation'), last: points[points.length - 1] };
    }, [data, items, sales, range]);
    return <div className="space-y-3.5">
        <section className="card p-6"><p className="lb">TU CARTERA EN PESOS · VALOR ACTUAL</p><p className="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-light">{hidden ? '****' : items.length && Number.isFinite(current) ? money(current) : items.length ? 'No disponible' : money(0)}</p><p className="mu mt-2 text-[12px]">Cripto y posiciones en dólares convertidas al valor actual de USDC en pesos.</p></section>
        <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="lb">CARTERA VS. INFLACIÓN</p><p className="mu mt-2 text-[12px]">Variación porcentual desde el mismo punto de partida</p></div><div className="seg" role="group" aria-label="Período">{([['day','Diario'],['month','Mensual'],['year','Anual']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{label}</button>)}</div></div>
        {loading ? <p className="mu py-20 text-center">Consultando datos históricos…</p> : chart ? <><div className="mt-6 flex flex-wrap gap-4 text-[13px]"><span style={{color:'var(--sig)'}}>● Cartera {pct(chart.last.portfolio)}</span><span style={{color:'var(--c-cedear)'}}>● UVA {pct(chart.last.inflation)}</span><strong>{chart.last.portfolio >= chart.last.inflation ? 'Por encima de la referencia' : 'Por debajo de la referencia'}</strong></div><svg className="mt-6 h-[230px] w-full" viewBox="0 0 850 230" preserveAspectRatio="none" role="img" aria-label={`Cartera ${pct(chart.last.portfolio)}, UVA ${pct(chart.last.inflation)}`}><line x1="12" x2="838" y1="210" y2="210" stroke="var(--line2)"/><path d={chart.portfolio} fill="none" stroke="var(--sig)" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/><path d={chart.inflation} fill="none" stroke="var(--c-cedear)" strokeWidth="2.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/></svg><div className="mu flex justify-between text-[11px]"><span>{fmtDate(chart.start)}</span><span>{fmtDate(chart.end)}</span></div><p className="mu mt-4 text-[12px]">Rendimiento ajustado por UVA: {pct(((1 + chart.last.portfolio / 100) / (1 + chart.last.inflation / 100) - 1) * 100)}.</p></> : <div className="mu py-12 text-center text-[13px]">{!items.length ? 'Agregá inversiones para comparar tu cartera.' : data?.errors.length ? `No se pudieron obtener datos históricos: ${data.errors.join(', ')}.` : 'No hay datos suficientes para comparar toda la cartera en este período. Puede haber posiciones compradas durante el período, ventas registradas o cotizaciones históricas faltantes.'}<br/><button type="button" onClick={() => setRetry(x => x + 1)} className="mt-3 underline">Reintentar</button></div>}
        <p className="mu mt-5 border-t border-[var(--line)] pt-4 text-[11px] leading-5">La UVA es una referencia diaria que sigue al CER; no es inflación diaria oficial. Se compara la composición actual durante todo el período, sin aportes ni ventas. Precios históricos de CEDEARs: Data912; cripto: CoinGecko; conversión histórica: dólar MEP venta. La valuación actual usa USDC, por lo que puede diferir. Días sin cotización usan el último dato disponible hasta 7 días antes.</p><a className="mu mt-2 inline-block text-[11px] underline" href="https://argentinadatos.com/docs/operations/get-finanzas-indices-uva" target="_blank" rel="noopener noreferrer">Fuente UVA y dólar: ArgentinaDatos · BCRA / DolarApi</a></section>
    </div>;
}
