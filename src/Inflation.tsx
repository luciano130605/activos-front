import { request } from './account';
import { useEffect, useState } from 'react';

type Entry = { fecha: string; valor: number };
type Series = 'mensual' | 'interanual';
type Result = { monthly: Entry[]; yearly: Entry[]; errors: Series[] };
const endpoint = 'https://api.argentinadatos.com/v1/finanzas/indices/';
const percent = (value: number) => `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
const monthLabel = (date: string) => new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
async function fetchSeries(path: string, signal: AbortSignal): Promise<Entry[]> {
    const key = `activos:inflacion:${path}`;
    try {
        const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        if (cached && Date.now() - cached.time < 3 * 60 * 60 * 1000 && Array.isArray(cached.data)) return cached.data;
    } catch { /* La consulta funciona sin almacenamiento. */ }
    const response = await fetch(`${endpoint}${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) throw new Error('No se pudo obtener la inflación.');
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('Respuesta inválida.');
    const entries: Entry[] = data.filter((entry): entry is Entry => typeof entry?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.fecha) && typeof entry.valor === 'number' && Number.isFinite(entry.valor)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!entries.length) throw new Error('No hay datos disponibles.');
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data: entries })); } catch { /* El almacenamiento puede estar deshabilitado. */ }
    return entries;
}

export default function Inflation() {
    const [country, setCountry] = useState<'ar' | 'us'>('ar');
    const [data, setData] = useState<Result | null>(null);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setData(null);
        if (country === 'us') {
            void request<Result>('inflation/us').then(result => { if (!controller.signal.aborted) setData(result); }).catch(() => { if (!controller.signal.aborted) setData({ monthly: [], yearly: [], errors: ['mensual', 'interanual'] }); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
            return () => controller.abort();
        }
        void Promise.allSettled([fetchSeries('inflacion', controller.signal), fetchSeries('inflacionInteranual', controller.signal)]).then(([monthly, yearly]) => {
            if (controller.signal.aborted) return;
            setData({ monthly: monthly.status === 'fulfilled' ? monthly.value : [], yearly: yearly.status === 'fulfilled' ? yearly.value : [], errors: [...(monthly.status === 'rejected' ? ['mensual' as const] : []), ...(yearly.status === 'rejected' ? ['interanual' as const] : [])] });
            setLoading(false);
        });
        return () => controller.abort();
    }, [country, retry]);
    const months = data?.monthly.slice(0, 12) ?? [];
    const years = data?.yearly.filter(row => row.fecha.slice(5, 7) === '12').slice(0, 5) ?? [];
    const latestMonthly = months[0];
    const latestYearly = data?.yearly[0];
    const monthlyMax = Math.max(1, ...months.map(row => Math.abs(row.valor)));
    const yearlyMax = Math.max(1, ...years.map(row => Math.abs(row.valor)));
    return <div className="space-y-3.5">
        <div role="group" aria-label="País de inflación" className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--raised)] p-1">{(['ar', 'us'] as const).map(option => <button key={option} type="button" aria-label={option === 'ar' ? 'Argentina' : 'Estados Unidos'} aria-pressed={country === option} onClick={() => setCountry(option)} className={`rounded-lg px-4 py-2 text-[12px] transition-colors ${country === option ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'}`}><span aria-hidden="true" className="text-[20px] leading-none sm:hidden">{option === 'ar' ? '🇦🇷' : '🇺🇸'}</span><span className="hidden sm:inline">{option === 'ar' ? 'Argentina' : 'Estados Unidos'}</span></button>)}</div>
        {loading ? <div className="card grid min-h-[200px] place-items-center text-[13px] text-[var(--muted)]" role="status">Consultando inflación…</div> : <>
            {!!data?.errors.length && <div className="rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-4 py-3 text-[12px]" role="status">No se pudo consultar la inflación {data.errors.join(' ni ')}. <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
            <div className="grid gap-3.5 md:grid-cols-2"><article className="card p-6"><p className="lb">ÚLTIMA INFLACIÓN MENSUAL</p><p className="mt-4 text-[clamp(2rem,4vw,3rem)] font-light">{latestMonthly ? percent(latestMonthly.valor) : '—'}</p><p className="mu mt-2 text-[12px]">{latestMonthly ? monthLabel(latestMonthly.fecha) : 'Dato no disponible'}</p></article><article className="card p-6"><p className="lb">ÚLTIMA INFLACIÓN INTERANUAL</p><p className="mt-4 text-[clamp(2rem,4vw,3rem)] font-light">{latestYearly ? percent(latestYearly.valor) : '—'}</p><p className="mu mt-2 text-[12px]">{latestYearly ? `12 meses hasta ${monthLabel(latestYearly.fecha)}` : 'Dato no disponible'}</p></article></div>
            <div className="grid gap-3.5 lg:grid-cols-2"><section className="card p-6"><p className="lb">ÚLTIMOS 12 MESES</p><p className="mu mt-2 text-[12px]">Variación de precios de cada mes.</p><div className="mt-4 divide-y divide-[var(--line)]">{months.length ? months.map(row => <div key={row.fecha} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 py-2.5 text-[12px]"><span className="capitalize">{monthLabel(row.fecha)}</span><span className="h-1.5 overflow-hidden rounded-full bg-[var(--raised)]"><span className="block h-full rounded-full bg-[var(--sig)]" style={{ width: `${Math.abs(row.valor) / monthlyMax * 100}%` }} /></span><span className="font-mono tabular-nums">{percent(row.valor)}</span></div>) : <p className="mu py-8 text-[12px]">Sin datos mensuales disponibles.</p>}</div></section>
            <section className="card p-6"><p className="lb">ÚLTIMOS AÑOS</p><p className="mu mt-2 text-[12px]">Inflación de enero a diciembre de cada año completo.</p><div className="mt-4 divide-y divide-[var(--line)]">{years.length ? years.map(row => <div key={row.fecha} className="grid grid-cols-[50px_1fr_auto] items-center gap-3 py-3 text-[12px]"><span>{row.fecha.slice(0, 4)}</span><span className="h-1.5 overflow-hidden rounded-full bg-[var(--raised)]"><span className="block h-full rounded-full bg-[var(--c-cedear)]" style={{ width: `${Math.abs(row.valor) / yearlyMax * 100}%` }} /></span><span className="font-mono tabular-nums">{percent(row.valor)}</span></div>) : <p className="mu py-8 text-[12px]">Sin datos anuales disponibles.</p>}</div></section></div>
        </>}

        <p className="mu text-[11px]">{country === 'us' ? <>Fuente: <a className="underline" href="https://www.bls.gov/cpi/" target="_blank" rel="noopener noreferrer">Bureau of Labor Statistics</a> · IPC-U, todos los artículos, sin ajuste estacional. Variaciones calculadas a partir del índice.</> : <>Fuente: <a className="underline" href="https://argentinadatos.com/" target="_blank" rel="noopener noreferrer">ArgentinaDatos</a> · BCRA.</>} Los datos pueden actualizarse con demora.</p>
    </div>;
}
