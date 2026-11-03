import { useEffect, useMemo, useState } from 'react';

type Row = { fecha: string; valor?: number; venta?: number };
type Series = { dollar: Row[]; uva: Row[]; inflation: Row[]; deposit: Row[] };
type Point = { t: number; value: number };
const DAY = 86400000;
const endpoints = { dollar: 'cotizaciones/dolares/bolsa', uva: 'finanzas/indices/uva', inflation: 'finanzas/indices/inflacion', deposit: 'finanzas/tasas/depositos30Dias' } as const;
const labels = { dollar: 'Dólar MEP', uva: 'UVA', inflation: 'Inflación', deposit: 'Plazo fijo' } as const;
const colors = { cartera: 'var(--sig)', dollar: '#e2b86e', uva: '#8ab2ed', inflation: '#de8fa9', deposit: '#ae9ce6' };
const time = (date: string) => Date.parse(`${date.slice(0, 10)}T12:00:00Z`);
const dateLabel = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const at = (rows: Point[], t: number) => { let result: Point | undefined; for (const p of rows) { if (p.t > t) break; result = p; } return result; };

export default function Benchmarks({ start, end, valueAt, available }: { start: number; end: number; valueAt: (t: number) => number; available: boolean }) {
    const [data, setData] = useState<Partial<Series> | null>(null);
    const [retry, setRetry] = useState(0);
    const [visible, setVisible] = useState<Record<keyof Series, boolean>>({ dollar: true, uva: true, inflation: true, deposit: true });
    useEffect(() => {
        const controller = new AbortController();
        setData(null);
        void Promise.allSettled(Object.entries(endpoints).map(async ([key, path]) => {
            const response = await fetch(`https://api.argentinadatos.com/v1/${path}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
            if (!response.ok) throw new Error('No disponible');
            const raw: unknown = await response.json();
            if (!Array.isArray(raw)) throw new Error('Respuesta inválida');
            const rows: Row[] = raw.filter((x): x is Row => x && typeof x.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x.fecha) && Number.isFinite(key === 'dollar' ? x.venta : x.valor)).sort((a, b) => a.fecha.localeCompare(b.fecha));
            if (!rows.length) throw new Error('Sin datos');
            return [key, rows] as const;
        })).then(results => { if (!controller.signal.aborted) setData(Object.fromEntries(results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []))); });
        return () => controller.abort();
    }, [retry]);
    const result = useMemo(() => {
        if (!data || !available || start >= end) return null;
        const convert = (rows: Row[] | undefined, key: 'valor' | 'venta') => (rows ?? []).map(row => ({ t: time(row.fecha), value: Number(row[key]) })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.value));
        const dollar = convert(data.dollar, 'venta').filter(p => p.value > 0);
        const uva = convert(data.uva, 'valor').filter(p => p.value > 0);
        const rates = convert(data.deposit, 'valor').filter(p => p.value >= 0);
        // La variación mensual se aplica al cierre del mes que describe.
        const monthly = (data.inflation ?? []).map(r => { const [year, month] = r.fecha.slice(0, 7).split('-').map(Number); return { t: Date.UTC(year, month, 0, 12), value: Number(r.valor) }; }).filter(p => Number.isFinite(p.t) && Number.isFinite(p.value) && p.value > -100).sort((a, b) => a.t - b.t);
        const initial = valueAt(start);
        if (!(initial > 0)) return null;
        const times = Array.from({ length: 101 }, (_, i) => start + (end - start) * i / 100);
        const lines: { key: keyof typeof colors; label: string; points: Point[]; lastDate: number }[] = [];
        const portfolio = times.map(t => ({ t, value: valueAt(t) / initial * 100 })).filter(p => Number.isFinite(p.value));
        if (portfolio.length) lines.push({ key: 'cartera', label: 'Cartera estimada', points: portfolio, lastDate: end });
        const addRatio = (key: 'dollar' | 'uva', rows: Point[]) => {
            const base = at(rows, start); if (!base || !rows.length) return;
            const last = rows[rows.length - 1].t;
            const points = times.filter(t => t <= last + DAY).flatMap(t => { const p = at(rows, t); return p ? [{ t, value: 100 * p.value / base.value }] : []; });
            if (points.length > 1) lines.push({ key, label: labels[key], points, lastDate: Math.min(last, end) });
        };
        if (visible.dollar) addRatio('dollar', dollar);
        if (visible.uva) addRatio('uva', uva);
        if (visible.inflation && monthly.length && at(monthly, start)) {
            const last = monthly[monthly.length - 1].t;
            const points = times.filter(t => t <= last + DAY).map(t => ({ t, value: 100 * monthly.filter(p => p.t > start && p.t <= t).reduce((v, p) => v * (1 + p.value / 100), 1) }));
            if (points.length > 1) lines.push({ key: 'inflation', label: labels.inflation, points, lastDate: Math.min(last, end) });
        }
        if (visible.deposit && at(rates, start)) {
            const last = rates[rates.length - 1].t;
            const points = times.filter(t => t <= last + DAY).map(t => {
                let cursor = start, value = 100;
                while (cursor < t) { const rate = at(rates, cursor); if (!rate) break; const days = Math.min(30, (t - cursor) / DAY); value *= 1 + rate.value / 100 * days / 365; cursor += days * DAY; }
                return { t, value };
            });
            if (points.length > 1) lines.push({ key: 'deposit', label: labels.deposit, points, lastDate: Math.min(last, end) });
        }
        const values = lines.flatMap(l => l.points.map(p => p.value));
        const min = Math.min(...values, 100), max = Math.max(...values, 100), span = Math.max(1, max - min);
        const x = (t: number) => 48 + (t - start) / (end - start) * 790;
        const y = (v: number) => 214 - (v - min + span * .08) / (span * 1.16) * 200;
        return { lines, x, y, min, max };
    }, [data, available, start, end, valueAt, visible]);
    return <section className="card mb-3.5 p-5 sm:p-6" aria-labelledby="benchmark-title">
        <p className="lb">COMPARACIÓN EN PESOS</p><h2 id="benchmark-title" className="mt-2 text-[20px] font-light">Cartera y referencias</h2>
        <p className="mu mt-2 text-[12px]">Base 100 al inicio del período. La cartera es estimada e incluye solo las posiciones existentes al comienzo; las conversiones usan el dólar actual.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Referencias visibles">{(Object.keys(labels) as (keyof Series)[]).map(key => <button key={key} type="button" aria-pressed={visible[key]} onClick={() => setVisible(v => ({ ...v, [key]: !v[key] }))} className={`rounded-lg border px-3 py-1.5 text-[12px] ${visible[key] ? 'border-[var(--line2)] text-[var(--ink)]' : 'border-[var(--line)] text-[var(--muted)] opacity-60'}`}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[key] }} />{labels[key]}</button>)}</div>
        {!data ? <p className="mu py-12 text-center" role="status">Consultando referencias…</p> : !result ? <p className="mu py-12 text-center">No hay posiciones o cotizaciones suficientes al inicio del período.</p> : <><svg viewBox="0 0 850 240" className="mt-5 h-[240px] w-full overflow-visible" role="img" aria-label="Comparación de cartera estimada con referencias, base 100"><line x1="48" x2="838" y1={result.y(100)} y2={result.y(100)} stroke="var(--line2)" strokeDasharray="4 5"/><text x="4" y={result.y(100) + 4} fill="var(--muted)" fontSize="11">100</text>{result.lines.map(line => <path key={line.key} d={line.points.map((p, i) => `${i ? 'L' : 'M'} ${result.x(p.t).toFixed(2)} ${result.y(p.value).toFixed(2)}`).join(' ')} fill="none" stroke={colors[line.key]} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}</svg><div className="mu flex justify-between text-[11px]"><span>{dateLabel(start)}</span><span>{dateLabel(end)}</span></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{result.lines.map(line => <span key={line.key} className="text-[12px]"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[line.key] }} />{line.label}: <strong>{(line.points[line.points.length - 1].value - 100).toFixed(2)}%</strong> <span className="mu">al {dateLabel(line.lastDate)}</span></span>)}</div></>}
        {data && result && (Object.keys(labels) as (keyof Series)[]).filter(key => visible[key] && data[key] && !result.lines.some(line => line.key === key)).map(key => <p key={key} className="mu mt-2 text-[11px]">{labels[key]}: sin datos suficientes para el período seleccionado.</p>)}
        {data && Object.keys(labels).some(key => !data[key as keyof Series]) && <p className="mt-3 text-[12px] text-[var(--neg)]">No se pudieron consultar algunas referencias. <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>Reintentar</button></p>}
        <p className="mu mt-4 text-[11px] leading-5">Dólar MEP y UVA: última observación disponible. Inflación: variaciones mensuales al cierre de cada mes, sin estimar meses no publicados. Plazo fijo: simulación con tasas de depósitos a 30 días, renovadas cada 30 días, sin impuestos ni comisiones. Las líneas terminan en el último dato disponible. Fuente: <a href="https://argentinadatos.com/docs/" target="_blank" rel="noopener noreferrer" className="underline">ArgentinaDatos</a>.</p>
    </section>;
}
