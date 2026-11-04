import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';
import type { HistoryPoint } from './AssetPerformance';

type Kind = 'bonds' | 'corp' | 'notes';
type Row = { symbol: string; price: number };
const kinds: { id: Kind; name: string; endpoint: string }[] = [
    { id: 'bonds', name: 'Bonos', endpoint: 'arg_bonds' },
    { id: 'notes', name: 'Letras', endpoint: 'arg_notes' },
    { id: 'corp', name: 'Obligaciones negociables', endpoint: 'arg_corp' },
];

export default function ArgentineMarket() {
    const [kind, setKind] = useState<Kind>('bonds');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState<Row[]>([]);
    const [selected, setSelected] = useState<Row | null>(null);
    const [points, setPoints] = useState<HistoryPoint[]>([]);
    const [error, setError] = useState('');
    const [historyError, setHistoryError] = useState('');
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [hover, setHover] = useState<number | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setRows([]); setSelected(null); setError('');
        const endpoint = kinds.find(item => item.id === kind)!.endpoint;
        fetch(`https://data912.com/live/${endpoint}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
            .then(response => { if (!response.ok) throw new Error(); return response.json(); })
            .then((data: unknown) => {
                if (!Array.isArray(data)) throw new Error();
                const found = new Map<string, Row>();
                for (const row of data) {
                    const symbol = typeof row?.symbol === 'string' ? row.symbol.toUpperCase().trim() : '';
                    const price = Number(row?.c);
                    if (/^[A-Z0-9.\-]{1,20}$/.test(symbol) && Number.isFinite(price) && price > 0) found.set(symbol, { symbol, price });
                }
                if (!controller.signal.aborted) setRows([...found.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)));
            }).catch(() => { if (!controller.signal.aborted) setError('No se pudo consultar el listado. Volvé a intentar más tarde.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [kind]);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController(); setPoints([]); setHistoryError(''); setHistoryLoading(true); setHover(null);
        fetch(`https://data912.com/historical/bonds/${encodeURIComponent(selected.symbol)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
            .then(response => { if (!response.ok) throw new Error(); return response.json(); })
            .then((data: unknown) => {
                if (!Array.isArray(data)) throw new Error();
                const points = data.flatMap(row => { const price = Number(row?.c), time = Date.parse(`${String(row?.date ?? '').slice(0,10)}T12:00:00Z`); return Number.isFinite(time) && Number.isFinite(price) && price > 0 ? [{ time, price }] : []; }).sort((a, b) => a.time - b.time);
                if (!controller.signal.aborted) { setPoints(points); if (points.length < 2) setHistoryError('No hay historial suficiente para este instrumento.'); }
            }).catch(() => { if (!controller.signal.aborted) setHistoryError('El proveedor no tiene historial disponible para este instrumento.'); })
            .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
        return () => controller.abort();
    }, [selected?.symbol]);
    const shown = rows.filter(row => row.symbol.includes(query.toUpperCase().trim())).slice(0, 30);
    const min = Math.min(...points.map(point => point.price)), max = Math.max(...points.map(point => point.price));
    const delta = max - min || 1;
    const chart = points.map((point, index) => ({ ...point, x: 10 + index / (points.length - 1) * 830, y: 210 - (point.price - min) / delta * 190 }));
    const focus = hover == null ? null : chart[hover];
    return <section className="card p-5 sm:p-6"><p className="lb">MERCADO ARGENTINO</p><h2 className="mt-2 text-[20px] font-light">Explorar instrumentos</h2><p className="mu mt-2 text-[12px] leading-5">Consultá bonos, letras y obligaciones negociables de Data912.</p>
        <div className="tabs mt-4" role="group" aria-label="Tipo de instrumento argentino">{kinds.map(item => <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => { setKind(item.id); setQuery(''); }}>{item.name}</button>)}</div>
        <label className="relative mt-4 block"><span className="sr-only">Buscar ticker argentino</span><HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-3 top-3.5 text-[var(--muted)]" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por ticker…" className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--raised)] py-2.5 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--muted)]" /></label>
        <div className="mt-3 max-h-[240px] overflow-y-auto rounded-xl border border-[var(--line)]">{loading ? <p role="status" className="mu p-4 text-[12px]">Consultando instrumentos…</p> : error ? <p role="alert" className="p-4 text-[12px] text-[var(--neg)]">{error}</p> : shown.length ? shown.map(row => <button key={row.symbol} type="button" aria-pressed={selected?.symbol === row.symbol} onClick={() => setSelected(row)} className={`flex w-full items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3 text-left text-[12px] last:border-0 hover:bg-[var(--raised)] ${selected?.symbol === row.symbol ? 'bg-[var(--raised)]' : ''}`}><span>{row.symbol}</span><span className="font-mono">{row.price.toLocaleString('es-AR', { maximumFractionDigits: 4 })}</span></button>) : <p className="mu p-4 text-[12px]">No se encontraron instrumentos.</p>}</div>
        {selected && <div className="mt-5 border-t border-[var(--line)] pt-4"><p className="text-[14px]">Historial · {selected.symbol}</p>{historyLoading ? <p role="status" className="mu py-12 text-center text-[12px]">Consultando historial…</p> : historyError ? <p className="mu py-10 text-center text-[12px]">{historyError}</p> : chart.length > 1 && <><div className="relative mt-4 touch-pan-y" onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(chart.length - 1, Math.round((event.clientX - rect.left) / rect.width * (chart.length - 1))))); }} onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(chart.length - 1, Math.round((event.clientX - rect.left) / rect.width * (chart.length - 1))))); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setHover(null); }}><svg viewBox="0 0 850 220" preserveAspectRatio="none" className="h-[200px] w-full" role="img" aria-label={`Historial de ${selected.symbol}`}><path d={chart.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} fill="none" stroke="var(--sig)" strokeWidth="2" vectorEffect="non-scaling-stroke" />{focus && <><line x1={focus.x} x2={focus.x} y1="0" y2="220" stroke="var(--muted)" strokeDasharray="4 4"/><circle cx={focus.x} cy={focus.y} r="5" fill="var(--sig)"/></>}</svg>{focus && <div className="pointer-events-none absolute top-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[11px]" style={{left: `${Math.min(70, focus.x / 850 * 100)}%`}}>{new Date(focus.time).toLocaleDateString('es-AR', {timeZone:'UTC'})} · {focus.price.toLocaleString('es-AR', {maximumFractionDigits:4})}</div>}</div><div className="mu flex justify-between text-[10px]"><span>{new Date(points[0].time).toLocaleDateString('es-AR', {timeZone:'UTC'})}</span><span>{new Date(points.at(-1)!.time).toLocaleDateString('es-AR', {timeZone:'UTC'})}</span></div></>}</div>}
        <p className="mu mt-5 border-t border-[var(--line)] pt-4 text-[10.5px] leading-5">Datos orientativos de Data912, sin garantía de tiempo real. El proveedor no identifica aquí la moneda ni la unidad de cotización; verificá la especie y sus condiciones antes de usar el precio. El historial puede no estar disponible para todas las especies.</p>
    </section>;
}
