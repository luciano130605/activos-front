import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, ChevronRight, LoaderIcon } from '@hugeicons/core-free-icons';
import { cedearName } from './assets';
import type { Investment } from './portfolio';
import type { HistoryPoint } from './AssetPerformance';

export type ArgentineKind = 'bonds' | 'corp' | 'notes' | 'stocks' | 'funds';
type Kind = ArgentineKind;
export type LocalSelection = { kind: 'arg-stock' | 'bond' | 'fund'; id: string; name: string; price: number; currency?: string; sourceDate?: string };
type Row = { symbol: string; price: number; name?: string; currency?: string; fundId?: string; classId?: string; date?: string };
const slug = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const kinds: { id: Kind; name: string; endpoint: string }[] = [
    { id: 'funds', name: 'Fondos comunes', endpoint: '' },
    { id: 'stocks', name: 'Acciones argentinas', endpoint: 'arg_stocks' },
    { id: 'bonds', name: 'Bonos', endpoint: 'arg_bonds' },
    { id: 'notes', name: 'Letras', endpoint: 'arg_notes' },
    { id: 'corp', name: 'Obligaciones negociables', endpoint: 'arg_corp' },
];

export default function ArgentineMarket({ onAdd, onChoose, initialKind = 'bonds', hideTabs = false, confirmBondCurrency = false }: { onAdd: (investment: Investment) => void; onChoose?: (asset: LocalSelection) => void; initialKind?: ArgentineKind; hideTabs?: boolean; confirmBondCurrency?: boolean }) {
    const [kind, setKind] = useState<Kind>(initialKind);
    const [query, setQuery] = useState('');
    const [pendingBond, setPendingBond] = useState<LocalSelection | null>(null);
    const [limit, setLimit] = useState(40);
    const [adding, setAdding] = useState(false);
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const [confirmed, setConfirmed] = useState(false);
    const [addError, setAddError] = useState('');
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
        setLoading(true); setRows([]); setSelected(null); setError(''); setAdding(false);
        const endpoint = kinds.find(item => item.id === kind)!.endpoint;
        fetch(kind === 'funds' ? 'https://api.argentinadatos.com/v1/finanzas/fci/fondos' : `https://data912.com/live/${endpoint}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
            .then(response => { if (!response.ok) throw new Error(); return response.json(); })
            .then((data: unknown) => {
                const list = kind === 'funds' && data && typeof data === 'object' ? (data as { fondos?: unknown }).fondos : data;
                if (!Array.isArray(list)) throw new Error();
                const found = new Map<string, Row>();
                for (const row of list) {
                    if (kind === 'funds') {
                        const name = typeof row?.nombre === 'string' ? row.nombre.trim() : '';
                        const fundId = String(row?.fondoId ?? ''), classId = String(row?.claseId ?? '');
                        const currency = String(row?.moneda ?? row?.monedaInversion ?? '').trim();
                        const price = Number(row?.rendimientos?.valorCuotaparte);
                        if (name && fundId && classId && Number.isFinite(price) && price > 0) found.set(`${fundId}:${classId}`, { symbol: slug(name), name, fundId, classId, price, currency, date: typeof row?.fecha === 'string' ? row.fecha.slice(0, 10) : '' });
                        continue;
                    }
                    const symbol = typeof row?.symbol === 'string' ? row.symbol.toUpperCase().trim() : '';
                    const price = Number(row?.c);
                    if (/^[A-Z0-9.\-]{1,20}$/.test(symbol) && Number.isFinite(price) && price > 0) found.set(symbol, { symbol, price, ...(kind === 'stocks' && cedearName(symbol) ? { name: cedearName(symbol) } : {}) });
                }
                if (!controller.signal.aborted) setRows([...found.values()].sort((a, b) => (a.name ?? a.symbol).localeCompare(b.name ?? b.symbol)));
            }).catch(() => { if (!controller.signal.aborted) setError('No se pudo consultar el listado. Volvé a intentar más tarde.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [kind]);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController(); setPoints([]); setHistoryError(''); setHistoryLoading(true); setHover(null);
        const url = kind === 'funds' ? `https://api.argentinadatos.com/v1/finanzas/fci/fondos/${encodeURIComponent(selected.symbol)}/historico` : `https://data912.com/historical/${kind === 'stocks' ? 'stocks' : 'bonds'}/${encodeURIComponent(selected.symbol)}`;
        fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
            .then(response => { if (!response.ok) throw new Error(); return response.json(); })
            .then((data: unknown) => {
                const body = data as { fondoId?: unknown; claseId?: unknown; historico?: unknown };
                if (kind === 'funds' && (String(body?.fondoId) !== selected.fundId || String(body?.claseId) !== selected.classId)) throw new Error('La clase del historial no coincide con la seleccionada.');
                const list = kind === 'funds' ? body.historico : data;
                if (!Array.isArray(list)) throw new Error();
                const points = list.flatMap(row => { const price = Number(kind === 'funds' ? row?.valorCuotaparte : row?.c), time = Date.parse(`${String(kind === 'funds' ? row?.fecha ?? '' : row?.date ?? '').slice(0, 10)}T12:00:00Z`); return Number.isFinite(time) && Number.isFinite(price) && price > 0 ? [{ time, price }] : []; }).sort((a, b) => a.time - b.time);
                if (!controller.signal.aborted) { setPoints(points); if (points.length < 2) setHistoryError('No hay historial suficiente para este instrumento.'); }
            }).catch(error => { if (!controller.signal.aborted) setHistoryError(error instanceof Error && error.message.startsWith('La clase') ? error.message : 'El proveedor no tiene historial disponible para este instrumento.'); })
            .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
        return () => controller.abort();
    }, [selected?.symbol, selected?.fundId, selected?.classId, kind]);
    function addInvestment() {
        if (!selected || !['stocks', 'bonds', 'funds'].includes(kind)) return;
        const units = Number(quantity), amount = Number(cost);
        if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(amount) || amount <= 0 || !purchaseDate) return setAddError('Ingresá cantidad, costo y fecha válidos.');
        if (!confirmed) return setAddError('Confirmá que la especie y la cotización corresponden a pesos.');
        const currency = selected.currency?.toLowerCase() ?? '';
        if (kind === 'funds' && !/peso|ars/.test(currency)) return setAddError('La fuente no confirma que este fondo cotice en pesos.');
        const id = kind === 'funds' ? `${selected.symbol}~${selected.fundId}~${selected.classId}` : selected.symbol;
        if (id.length > 150) return setAddError('El identificador del instrumento es demasiado largo para guardarlo.');
        const checkDate = new Date(`${purchaseDate}T12:00:00Z`);
        if (!Number.isFinite(checkDate.getTime()) || checkDate.toISOString().slice(0, 10) !== purchaseDate || purchaseDate > new Date().toLocaleDateString('en-CA')) return setAddError('Ingresá una fecha de compra válida que no sea futura.');
        onAdd({ id: crypto.randomUUID(), name: (selected.name ?? selected.symbol).slice(0, 70), amount, date: purchaseDate, currency: 'ARS', kind: kind === 'funds' ? 'fund' : kind === 'bonds' ? 'bond' : 'arg-stock', coin: id, units });
        setAdding(false); setAddError(''); setQuantity(''); setCost(''); setConfirmed(false);
    }
    function choose(row: Row) {
        if (onChoose && (kind === 'stocks' || kind === 'funds' || kind === 'bonds')) {
            if (kind === 'funds' && !/peso|ars/i.test(row.currency ?? '')) { setError('Este fondo no informa una cotización en pesos.'); return; }
            const id = kind === 'funds' ? `${row.symbol}~${row.fundId}~${row.classId}` : row.symbol;
            if (id.length > 150) { setError('El identificador del instrumento es demasiado largo.'); return; }
            const asset: LocalSelection = { kind: kind === 'stocks' ? 'arg-stock' : kind === 'funds' ? 'fund' : 'bond', id, name: row.name ?? row.symbol, price: kind === 'bonds' ? row.price / 100 : row.price, currency: row.currency, sourceDate: row.date };
            if (kind === 'bonds' && confirmBondCurrency) { setPendingBond(asset); return; }
            onChoose(asset);
            return;
        }
        setSelected(row); setAdding(false); setQuantity(''); setCost(''); setConfirmed(false); setAddError('');
    }
    const term = slug(query);
    const matches = rows.filter(row => !term || slug(`${row.name ?? ''} ${row.symbol}`).includes(term));
    const shown = matches.slice(0, limit);
    const min = Math.min(...points.map(point => point.price)), max = Math.max(...points.map(point => point.price));
    const delta = max - min || 1;
    const chart = points.map((point, index) => ({ ...point, x: 10 + index / (points.length - 1) * 830, y: 210 - (point.price - min) / delta * 190 }));
    const focus = hover == null ? null : chart[hover];
    return <section className={hideTabs ? "" : "card p-5 sm:p-6"}>{!hideTabs && <><p className="lb">MERCADO ARGENTINO</p><h2 className="mt-2 text-[20px] font-light">Explorar instrumentos</h2><p className="mu mt-2 text-[12px] leading-5">Consultá fondos, acciones argentinas, bonos, letras y obligaciones negociables.</p></>}
        {!hideTabs && <div className="tabs mt-4" role="group" aria-label="Tipo de instrumento argentino">{kinds.map(item => <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => { setKind(item.id); setQuery(''); }}>{item.name}</button>)}</div>}
        <label className="mb-1.5 mt-4 block text-[12px] text-[var(--muted)]" htmlFor="local-asset-search">{kind === 'funds' ? 'Nombre del fondo o clase' : 'Empresa o ticker'}</label><div className="relative"><label className="sr-only" htmlFor="local-asset-search">Buscar instrumento argentino</label><HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-3 top-3.5 text-[var(--muted)]" /><input id="local-asset-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} placeholder={kind === 'funds' ? 'Buscar fondo o clase…' : 'Ej: Galicia, GGAL…'} className="w-full rounded-[10px] border border-[var(--line2)] bg-[var(--raised)] py-2.5 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--muted)]" /></div>
        <div className="mt-3 max-h-[240px] overflow-y-auto">{loading ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--muted)]"><HugeiconsIcon icon={LoaderIcon} size={17} className="animate-spin" />Cargando activos…</p> : error ? <p role="alert" className="p-4 text-[13px] text-[var(--neg)]">{error}</p> : shown.length ? <><p role="status" className="mu px-2 pb-2 text-[10px]">{shown.length.toLocaleString('es-AR')} {query.trim() ? 'resultados' : 'disponibles'} · {kind === 'funds' ? 'ArgentinaDatos' : 'Data912'}</p>{shown.map(row => <button key={`${row.fundId ?? row.symbol}:${row.classId ?? ''}`} type="button" aria-pressed={selected?.symbol === row.symbol && selected?.classId === row.classId && selected?.fundId === row.fundId} onClick={() => choose(row)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[var(--raised)] focus-visible:bg-[var(--raised)]"><span className="tk !h-9 !w-9 !rounded-[10px] !text-[9.5px]" style={{ ['--c' as string]: kind === 'stocks' ? '#7bb5d5' : kind === 'funds' ? '#b8d8a3' : '#e1b77b' }}>{row.symbol.slice(0, 5).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{row.name ?? row.symbol}</span><span className="mu mt-1 block truncate text-[10px]">{kind === 'funds' ? `Clase ${row.classId}${row.currency ? ` · ${row.currency}` : ''}` : `${row.symbol} · ${kind === 'bonds' ? 'Bono' : kind === 'stocks' ? 'Acción argentina' : 'Instrumento'} · Data912`}</span></span><HugeiconsIcon icon={ChevronRight} size={16} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--ink)]" /></button>)}{matches.length > limit && <button type="button" onClick={() => setLimit(value => value + 40)} className="my-3 w-full rounded-lg border border-[var(--line2)] py-2.5 text-[12px]">Mostrar más</button>}</> : <p className="px-2 py-10 text-center text-[13px] text-[var(--muted)]">No encontramos activos disponibles. Probá otro nombre o ticker.</p>}</div>
        {pendingBond && onChoose && <div className="mt-4 rounded-xl border border-[var(--line2)] bg-[var(--raised)] p-4 text-[12px]"><p>¿La especie {pendingBond.name} cotiza en pesos?</p><p className="mu mt-2 text-[11px] leading-5">El proveedor no identifica la moneda en su listado. Confirmala antes de comparar.</p><div className="mt-3 flex gap-2"><button type="button" className="btn-primary" onClick={() => { onChoose(pendingBond); setPendingBond(null); }}>Sí, en pesos</button><button type="button" className="btn-ghost" onClick={() => setPendingBond(null)}>Cancelar</button></div></div>}
        {selected && <div className="mt-5 border-t border-[var(--line)] pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[14px]">Historial · {selected.name ?? selected.symbol}</p>{['stocks', 'bonds', 'funds'].includes(kind) && <button type="button" className="btn-ghost text-[12px]" onClick={() => { setAdding(!adding); setAddError(''); }}>Agregar inversión</button>}</div>{adding && <div className="mt-4 space-y-3 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4"><label className="mu block text-[11px]">{kind === 'funds' ? 'Cuotapartes' : kind === 'bonds' ? 'Valor nominal' : 'Cantidad de acciones'}<input type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[14px] text-[var(--ink)]" /></label><label className="mu block text-[11px]">Costo total en pesos (ARS)<input type="number" inputMode="decimal" min="0" step="any" value={cost} onChange={e => setCost(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[14px] text-[var(--ink)]" /></label><label className="mu block text-[11px]">Fecha de compra<input type="date" value={purchaseDate} max={new Date().toLocaleDateString('en-CA')} onChange={e => setPurchaseDate(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[14px] text-[var(--ink)]" /></label><label className="flex items-start gap-2 text-[11px] text-[var(--muted)]"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>Confirmo que la especie y el precio mostrado corresponden a pesos{kind === 'bonds' ? ' por cada 100 nominales' : ''}.</span></label>{addError && <p role="alert" className="text-[12px] text-[var(--neg)]">{addError}</p>}<button type="button" onClick={addInvestment} className="btn-primary">Guardar inversión</button></div>}{historyLoading ? <p role="status" className="mu py-12 text-center text-[12px]">Consultando historial…</p> : historyError ? <p className="mu py-10 text-center text-[12px]">{historyError}</p> : chart.length > 1 && <><div className="relative mt-4 touch-pan-y" onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(chart.length - 1, Math.round((event.clientX - rect.left) / rect.width * (chart.length - 1))))); }} onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(chart.length - 1, Math.round((event.clientX - rect.left) / rect.width * (chart.length - 1))))); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setHover(null); }}><svg viewBox="0 0 850 220" preserveAspectRatio="none" className="h-[200px] w-full" role="img" aria-label={`Historial de ${selected.symbol}`}><path d={chart.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} fill="none" stroke="var(--sig)" strokeWidth="2" vectorEffect="non-scaling-stroke" />{focus && <><line x1={focus.x} x2={focus.x} y1="0" y2="220" stroke="var(--muted)" strokeDasharray="4 4" /><circle cx={focus.x} cy={focus.y} r="5" fill="var(--sig)" /></>}</svg>{focus && <div className="pointer-events-none absolute top-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[11px]" style={{ left: `${Math.min(70, focus.x / 850 * 100)}%` }}>{new Date(focus.time).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · {focus.price.toLocaleString('es-AR', { maximumFractionDigits: 4 })}</div>}</div><div className="mu flex justify-between text-[10px]"><span>{new Date(points[0].time).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span><span>{new Date(points.at(-1)!.time).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span></div></>}</div>}

    </section>;
}
