import { useEffect, useMemo, useRef, useState } from 'react';
import { listCryptoAssets } from './coingecko';
import { history, adjustPossibleRatios, type HistoryPoint } from './AssetPerformance';
import { INDEXES, cedearName, listCedears, type SearchAsset } from './assets';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChevronRight, LoaderIcon, Refresh04Icon, Search02Icon, XIcon } from '@hugeicons/core-free-icons';

export type AssetKind = 'crypto' | 'cedear' | 'index';
export type PickedAsset = { kind: AssetKind; id: string; name: string };
type Row = { id: string; title: string; sub: string };
type Catalog = { status: 'ready'; rows: Row[] } | { status: 'error'; message: string };

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const commonCrypto = ['bitcoin', 'ethereum', 'solana', 'tether', 'usd-coin', 'ripple', 'binancecoin', 'dogecoin'];
const tabs: { id: AssetKind; label: string; color: string; hint: string; placeholder: string; source: string }[] = [
    { id: 'crypto', label: 'Cripto', color: 'var(--c-crypto)', hint: 'Nombre, símbolo o ID', placeholder: 'Ej: Bitcoin, ETH, solana…', source: 'CoinGecko' },
    { id: 'cedear', label: 'CEDEARs', color: 'var(--c-cedear)', hint: 'Empresa o ticker', placeholder: 'Ej: Apple, MELI, KO…', source: 'Data912' },
    { id: 'index', label: 'Índices', color: 'var(--c-index)', hint: 'Índice o ticker', placeholder: 'Ej: S&P 500, QQQ…', source: 'Data912' },
];

export default function AssetSearchDialog({ initial = 'crypto', onClose, onSelect, benchmarkMode = false, footer = 'Elegí un activo para consultar su precio y cargar la inversión.' }: { initial?: AssetKind; onClose: () => void; onSelect: (asset: PickedAsset) => void; benchmarkMode?: boolean; footer?: string }) {
    const [tab, setTab] = useState<AssetKind>(initial);
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(40);
    const [attempt, setAttempt] = useState(0);
    const [filtering, setFiltering] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [qualified, setQualified] = useState<Set<string> | null>(null);
    const filterController = useRef<AbortController | null>(null);
    useEffect(() => () => filterController.current?.abort(), []);
    const dialog = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const current = tabs.find(t => t.id === tab)!;
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        return () => { previousFocus?.focus(); };
    }, []);
    useEffect(() => { input.current?.focus(); }, [tab]);
    useEffect(() => {
        const controller = new AbortController();
        const toRows = (list: SearchAsset[], fallback: string): Row[] => list.map(a => ({ id: a.symbol, title: a.name || a.symbol, sub: a.name ? a.symbol : fallback }));
        const load = tab === 'crypto'
            ? listCryptoAssets(controller.signal).then(coins => coins.map<Row>(c => ({ id: c.id, title: c.name, sub: `${c.symbol.toUpperCase()} · ${c.id}` })))
            : tab === 'cedear' ? listCedears(controller.signal).then(list => toRows(list, 'CEDEAR en pesos'))
                : Promise.resolve(toRows(INDEXES, 'ETF'));
        load.then(rows => { if (!controller.signal.aborted) setCatalog({ status: 'ready', rows }); })
            .catch(error => { if (!controller.signal.aborted) setCatalog({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo cargar el catálogo. Volvé a intentar.' }); });
        return () => controller.abort();
    }, [tab, attempt]);
    const matches = useMemo(() => {
        if (catalog?.status !== 'ready') return [];
        const term = normalize(query);
        const score = (row: Row) => !term ? 0 : normalize(row.title) === term || normalize(row.id) === term ? -2 : normalize(row.sub).startsWith(term) || normalize(row.title).startsWith(term) ? -1 : 0;
        const common = (row: Row) => tab === 'crypto' && commonCrypto.includes(row.id) ? commonCrypto.indexOf(row.id) - commonCrypto.length : 0;
        return catalog.rows.filter(row => !term || normalize(`${row.title} ${row.sub} ${row.id}`).includes(term)).sort((a, b) => score(a) - score(b) || common(a) - common(b));
    }, [catalog, query, tab]);
    const resetFilter = () => { filterController.current?.abort(); setFiltering(false); setQualified(null); setFilterStatus(''); };
    const filterByInflation = async () => {
        const controller = new AbortController();
        filterController.current?.abort(); filterController.current = controller;
        setQualified(new Set()); setFiltering(true); setFilterStatus('Consultando inflación…');
        const day = 86400000;
        try {
            const responses = await Promise.all([
                fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion', { signal: controller.signal }),
                ...(tab === 'crypto' ? [fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa', { signal: controller.signal })] : []),
            ]);
            if (responses.some(response => !response.ok)) throw new Error();
            const inflationRows: { fecha: string; valor: number }[] = await responses[0].json();
            const monthly = inflationRows.map(row => { const [year, month] = row.fecha.slice(0, 7).split('-').map(Number); return { time: Date.UTC(year, month, 0, 12), value: Number(row.valor) }; }).filter(row => Number.isFinite(row.time) && Number.isFinite(row.value) && row.value > -100).sort((a, b) => a.time - b.time);
            const now = Date.now(), startDate = new Date(now); startDate.setFullYear(startDate.getFullYear() - 1);
            const start = startDate.getTime(), end = Math.min(now, monthly.at(-1)?.time ?? 0);
            if (!monthly.some(row => row.time <= start) || end <= start) throw new Error();
            const inflation = (monthly.filter(row => row.time > start && row.time <= end).reduce((value, row) => value * (1 + row.value / 100), 1) - 1) * 100;
            let dollar: HistoryPoint[] = [];
            if (tab === 'crypto') {
                const rows: { fecha: string; venta: number }[] = await responses[1].json();
                dollar = rows.map(row => ({ time: Date.parse(`${row.fecha.slice(0, 10)}T12:00:00Z`), price: Number(row.venta) })).filter(row => Number.isFinite(row.time) && row.price > 0).sort((a, b) => a.time - b.time);
            }
            const quote = (points: HistoryPoint[], t: number) => {
                const previous = points.filter(point => point.time <= t).at(-1);
                if (previous && t - previous.time <= 7 * day) return previous.price;
                if (!previous && points[0] && points[0].time - t <= 3 * day) return points[0].price;
                return NaN;
            };
            const dollarStart = tab === 'crypto' ? quote(dollar, start) : 1;
            const dollarEnd = tab === 'crypto' ? quote(dollar, end) : 1;
            if (!(dollarStart > 0 && dollarEnd > 0)) throw new Error();
            let next = 0, finished = 0, failed = 0;
            const found = new Set<string>();
            const worker = async () => {
                while (!controller.signal.aborted) {
                    const index = next++;
                    if (index >= matches.length) return;
                    const row = matches[index];
                    try {
                        const kind = tab === 'crypto' ? 'crypto' : 'cedear';
                        const raw = await history(kind, row.id, controller.signal);
                        const points = kind === 'cedear' ? adjustPossibleRatios(raw).points : raw;
                        const first = quote(points, start), last = quote(points, end), recent = points.at(-1);
                        const complete = !!recent && now - recent.time <= 7 * day && Array.from({ length: 53 }, (_, i) => quote(points, start + (now - start) * i / 52)).every(value => value > 0);
                        if (complete && first > 0 && last > 0 && (last * dollarEnd / (first * dollarStart) - 1) * 100 >= inflation - 5) found.add(row.id);
                    } catch { if (!controller.signal.aborted) failed++; }
                    if (!controller.signal.aborted) { finished++; setQualified(new Set(found)); setFilterStatus(`Analizados ${finished} de ${matches.length}${failed ? ` · ${failed} sin consultar` : ''}.`); }
                }
            };
            await Promise.all(Array.from({ length: Math.min(4, matches.length) }, worker));
            if (!controller.signal.aborted) { setFiltering(false); setFilterStatus(`Análisis terminado: ${finished} activos${failed ? ` · ${failed} no se pudieron consultar` : ''}.`); }
        } catch {
            if (!controller.signal.aborted) { setFiltering(false); setQualified(null); setFilterStatus('No se pudo consultar la inflación o el dólar. Probá nuevamente.'); }
        }
    };
    const displayed = qualified === null ? matches : matches.filter(row => qualified.has(row.id));
    const switchTab = (next: AssetKind) => { if (next === tab) return; resetFilter(); setCatalog(null); setQuery(''); setLimit(40); setTab(next); };
    return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-[5px] sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="asset-search-title" className="flex max-h-[90dvh] w-full flex-col rounded-t-[22px] border border-[var(--line2)] bg-[var(--surface)] shadow-2xl sm:max-w-[560px] sm:rounded-[22px]" onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
            if (event.key !== 'Tab') return;
            const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
            const first = elements[0], last = elements.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
            <div className="shrink-0 border-b border-[var(--line)] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><p className="lb mb-2">BUSCADOR DE ACTIVOS</p><h2 id="asset-search-title" className="text-[24px] font-light tracking-tight">Buscar activo<span className="text-[var(--faint)]">.</span></h2></div><button type="button" onClick={onClose} aria-label="Cerrar buscador" className="rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={XIcon} size={19} /></button></div>
                <div className="tabs mt-5" role="group" aria-label="Tipo de activo">{tabs.map(t => <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => switchTab(t.id)}><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: t.color }} />{t.label}</button>)}</div>
                <label htmlFor="asset-search" className="mb-1.5 mt-4 block text-[12px] text-[var(--muted)]">{current.hint}</label>
                <div className="relative"><HugeiconsIcon icon={Search02Icon} size={17} className="pointer-events-none absolute left-3 top-3 text-[var(--muted)]" /><input ref={input} id="asset-search" type="search" value={query} onChange={event => { resetFilter(); setQuery(event.target.value); setLimit(40); }} placeholder={current.placeholder} autoComplete="off" spellCheck={false} className="w-full rounded-[10px] border border-[var(--line2)] bg-[var(--raised)] py-2.5 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--muted)]" /></div>
            </div>
            {benchmarkMode && <div className="border-b border-[var(--line)] px-5 py-3">
                <button type="button" disabled={filtering || catalog?.status !== 'ready'} onClick={qualified === null ? filterByInflation : resetFilter} className="rounded-lg border border-[var(--line2)] px-3 py-2 text-[12px] disabled:opacity-50">{qualified === null ? 'Mostrar los que igualaron o superaron la inflación' : filtering ? 'Consultando…' : 'Mostrar todos'}</button>
                <p className="mu mt-2 text-[11px]">Analiza los resultados de la búsqueda; admite hasta 5 puntos porcentuales por debajo de la inflación. Puede tardar y algunos proveedores limitan las consultas.</p>
                {filterStatus && <p role="status" className="mu mt-1 text-[11px]">{filterStatus}</p>}
            </div>}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:px-4">
                {!catalog ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--muted)]"><HugeiconsIcon icon={LoaderIcon} size={17} className="animate-spin" />Cargando {current.label.toLowerCase()}…</p> : catalog.status === 'error' ? <div className="p-4"><p role="alert" className="text-[13px] text-[var(--neg)]">{catalog.message}</p><button type="button" onClick={() => { setCatalog(null); setAttempt(value => value + 1); }} className="mt-4 inline-flex items-center gap-2 text-[12px] underline"><HugeiconsIcon icon={Refresh04Icon} size={14} />Reintentar</button></div> : <>
                    <p role="status" className="mu px-2 pb-2 text-[10px]">{displayed.length.toLocaleString('es-AR')} {query.trim() ? 'resultados' : 'disponibles'} · {current.source}</p>
                    {displayed.length === 0 ? <p className="px-2 py-10 text-center text-[13px] text-[var(--muted)]">No encontramos coincidencias. Probá otro nombre o ticker.</p> : displayed.slice(0, limit).map(row => <button key={row.id} type="button" onClick={() => onSelect({ kind: tab, id: row.id, name: tab === 'cedear' ? (cedearName(row.id) || row.id) : tab === 'index' ? `${row.title} (${row.id})` : row.title })} className="group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[var(--raised)] focus-visible:bg-[var(--raised)]">
                        <span className="tk !h-9 !w-9 !rounded-[10px] !text-[9.5px]" style={{ ['--c' as string]: current.color }}>{(tab === 'crypto' ? row.sub.split(' ')[0] : row.id).slice(0, 5)}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{row.title}</span><span className="mu mt-1 block truncate text-[10px]">{row.sub}</span></span><HugeiconsIcon icon={ChevronRight} size={16} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--ink)]" />
                    </button>)}
                    {displayed.length > limit && <button type="button" onClick={() => setLimit(value => value + 40)} className="my-3 w-full rounded-lg border border-[var(--line2)] py-2.5 text-[12px]">Mostrar más</button>}
                </>}
            </div>
            <p className="shrink-0 border-t border-[var(--line)] px-5 py-4 text-[11px] text-[var(--muted)]">{footer}</p>
        </div>
    </div>;
}
