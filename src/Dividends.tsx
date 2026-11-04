import { useEffect, useMemo, useState } from 'react';
import { request } from './account';
import { cedearName } from './assets';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Calendar03Icon, CalendarMinusIcon, ChevronLeftIcon, ChevronRightIcon, ListViewIcon, RightToLeftListBulletIcon } from '@hugeicons/core-free-icons';

type Event = { payDate: string; exDate: string; amountPerShare: number; eligible: boolean; estimatedGross: number; estimated?: boolean; sourcePayDate?: string };
type Position = { id: string; name: string; ticker: string; kind: 'stock' | 'cedear'; units: number; ratio?: number; status: 'ok' | 'missing_ratio' | 'unavailable'; events?: Event[] };
type Result = { configured: boolean; items: Position[] };
type Row = Event & { position: Position };
const at = (value: string) => new Date(`${value}T12:00:00`);
const date = (value: string) => at(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const usd = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const daysUntil = (iso: string) => Math.round((at(iso).getTime() - at(isoDate(new Date())).getTime()) / 86_400_000);

const CACHE_AGE = 24 * 60 * 60 * 1000;
const pendingRequests = new Map<string, Promise<unknown>>();
function cachedDividends<T>(key: string, fingerprint: string, path: string, cacheable: (value: T) => boolean): Promise<T> {
    try {
        const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (cached && cached.fingerprint === fingerprint && typeof cached.time === 'number' && Date.now() >= cached.time && Date.now() - cached.time < CACHE_AGE && cacheable(cached.data)) return Promise.resolve(cached.data as T);
    } catch { /* Si el almacenamiento no está disponible, se consulta normalmente. */ }
    const requestKey = `${key}:${fingerprint}`;
    const existing = pendingRequests.get(requestKey);
    if (existing) return existing as Promise<T>;
    const promise = request<T>(path).then(data => {
        if (cacheable(data)) {
            try { localStorage.setItem(key, JSON.stringify({ fingerprint, time: Date.now(), data })); } catch { /* El almacenamiento puede estar lleno o bloqueado. */ }
        }
        return data;
    }).finally(() => { pendingRequests.delete(requestKey); });
    pendingRequests.set(requestKey, promise);
    return promise;
}

function PortfolioDividends({ dirty, hidden, userId, portfolioKey }: { dirty: boolean; hidden: boolean; userId: string; portfolioKey: string }) {
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'agenda' | 'calendar'>('agenda');
    const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        cachedDividends<Result>(`activos:dividendos:v2:${userId}`, portfolioKey, 'dividends', data => Boolean(data?.configured && Array.isArray(data.items) && data.items.every(item => item.status !== 'unavailable'))).then(data => { if (active) setResult(data); }).catch(() => { if (active) setError('No se pudieron consultar los dividendos. Volvé a intentar más tarde.'); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [userId, portfolioKey]);
    const money = (n: number) => hidden ? '****' : usd(n);
    const events = useMemo<Row[]>(() => (result?.items ?? []).flatMap(position => (position.events ?? []).map(event => ({ ...event, position }))).sort((a, b) => a.payDate.localeCompare(b.payDate)), [result]);
    const todayIso = isoDate(new Date());
    const upcoming = events.filter(e => e.payDate >= todayIso);
    const next = upcoming.find(e => e.eligible) ?? upcoming[0];
    const upcomingTotal = upcoming.reduce((s, e) => s + (e.eligible && !e.estimated ? e.estimatedGross : 0), 0);
    const monthKey = isoDate(month).slice(0, 7);
    const monthEvents = events.filter(e => e.payDate.startsWith(monthKey));
    const monthTotal = monthEvents.reduce((s, e) => s + (e.eligible ? e.estimatedGross : 0), 0);
    const shownEvents = selected ? monthEvents.filter(e => e.payDate === selected) : monthEvents;
    const offset = (month.getDay() + 6) % 7;
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((offset + dayCount) / 7) * 7 }, (_, i) => i - offset + 1);
    const changeMonth = (step: number) => { setMonth(v => new Date(v.getFullYear(), v.getMonth() + step, 1)); setSelected(null); };
    const unavailable = result?.items.filter(i => i.status !== 'ok') ?? [];
    const byMonth = useMemo(() => {
        const map = new Map<string, Row[]>();
        for (const e of upcoming) { const k = e.payDate.slice(0, 7); map.set(k, [...(map.get(k) ?? []), e]); }
        return [...map.entries()];
    }, [upcoming]);
    const byTicker = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of upcoming) if (e.eligible) map.set(e.position.ticker, (map.get(e.position.ticker) ?? 0) + e.estimatedGross);
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }, [upcoming]);
    const ready = !loading && !error && result?.configured;
    const kpi = (label: string, value: string, note: string, accent = false) => <section className="card p-5 sm:p-6"><p className="lb">{label}</p><p className={`mt-4 text-[clamp(1.7rem,3.6vw,2.4rem)] font-light tracking-tight tabular-nums ${accent ? 'sig' : ''}`}>{value}</p><p className="mu mt-2 text-[11px]">{note}</p></section>;
    const when = (iso: string) => { const d = daysUntil(iso); return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d > 0 ? `en ${d} días` : `hace ${-d} días`; };
    const payRow = (e: Row, key: string) => <article key={key} className="flex items-start gap-4 border-t border-[var(--line)] py-4 first:border-0">
        <div className="dd">{at(e.payDate).getDate()}<small>{at(e.payDate).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</small></div>
        <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium">{e.position.name} <span className="mu ml-1">{e.position.ticker}</span></p>
            <p className="mu mt-1 text-[11px]">{when(e.payDate)} · {e.estimated ? 'fecha ex estimada' : 'fecha ex'} {date(e.exDate)}{e.position.kind === 'cedear' && ` · ratio ${e.position.ratio}:1`}</p>
            <p className="mu mt-1 text-[11px]">{money(e.amountPerShare)} por acción{e.position.kind === 'cedear' ? ' subyacente' : ''} · {e.position.units.toLocaleString('es-AR', { maximumFractionDigits: 6 })} {e.position.kind === 'cedear' ? 'CEDEARs' : 'acciones'}</p>
            {e.estimated && <p className="mt-1 text-[11px] text-[var(--sig)]">Estimado · basado en el pago del {date(e.sourcePayDate!)}. Fecha y monto sin confirmar.</p>}
            {!e.eligible && !e.estimated && <p className="mt-1 text-[11px] text-[var(--neg)]">Tu compra es posterior a la fecha de corte: sin derecho.</p>}</div>
        <span className={`pill ${e.estimated ? 'border border-dashed border-[var(--sig)]' : e.eligible ? '' : 'neg'}`}>{e.estimated ? `Est. ${money(e.estimatedGross)}` : e.eligible ? money(e.estimatedGross) : 'Sin derecho'}</span>
    </article>;

    return <div className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {kpi('01 — PRÓXIMO PAGO', ready && next ? date(next.payDate) : '—', next ? `${next.position.ticker} · ${next.estimated ? 'estimado · ' : ''}${when(next.payDate)}` : 'Sin pagos anunciados')}
            {kpi('02 — A COBRAR (ANUNCIADO)', ready ? money(upcomingTotal) : '—', 'Bruto · pagos futuros con derecho', true)}
            {kpi('03 — ESTIMADO DEL MES', ready ? money(monthTotal) : '—', month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))}
            {kpi('04 — PAGOS ANUNCIADOS', ready ? String(upcoming.filter(e => !e.estimated).length) : '—', 'Solo pagos anunciados')}
        </div>
        {dirty && <p className="rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-4 py-3 text-[12px]">Hay cambios sin guardar: los dividendos usan la última cartera guardada en tu cuenta.</p>}
        {loading ? <p className="p-4 text-[13px] text-[var(--muted)]" role="status">Consultando dividendos…</p> : error ? <p className="p-4 text-[13px] text-[var(--neg)]" role="alert">{error}</p> : !result?.configured ? <p className="card p-5 text-[13px] text-[var(--muted)]">Para consultar dividendos, configurá MASSIVE_API_KEY en el backend.</p> : <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
            <section className="card p-5 sm:p-6" aria-label="Pagos de dividendos">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[20px] font-light tracking-tight">{view === 'agenda' ? 'Próximos pagos' : 'Calendario de pagos'}</h2>
                    <div className="seg" role="group" aria-label="Vista"><button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><HugeiconsIcon icon={RightToLeftListBulletIcon} size={14} className="mr-1.5 inline" />Lista</button><button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><HugeiconsIcon icon={Calendar01Icon} size={14} className="mr-1.5 inline" />Calendario</button></div>
                </div>
                {view === 'agenda' ? (byMonth.length ? byMonth.map(([key, rows]) => <div key={key} className="mb-5 last:mb-0"><div className="mb-1 flex items-center justify-between"><h3 className="lb capitalize">{at(`${key}-01`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3><span className="mu text-[11px]">{money(rows.reduce((s, e) => s + (e.eligible ? e.estimatedGross : 0), 0))}</span></div>{rows.map((e, i) => payRow(e, `${e.position.id}-${e.exDate}-${i}`))}</div>) : <div className="grid min-h-[200px] place-items-center text-center"><div><HugeiconsIcon icon={CalendarMinusIcon} size={24} className="mx-auto mb-3 text-[var(--faint)]" /><p className="text-[13px] text-[var(--muted)]">{result.items.length ? 'No hay pagos futuros anunciados ni estimados.' : 'No hay acciones ni CEDEARs en tu cartera guardada.'}</p></div></div>) : <>
                    <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-[16px] font-medium capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3><div className="flex items-center gap-1">{selected && <button type="button" onClick={() => setSelected(null)} className="mu mr-2 underline">Ver todo el mes</button>}<button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="ibtn !h-9 !w-9"><HugeiconsIcon icon={ChevronLeftIcon} size={16} /></button><button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente" className="ibtn !h-9 !w-9"><HugeiconsIcon icon={ChevronRightIcon} size={16} /></button></div></div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Días de ${month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}>
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} className="mu pb-2 text-center text-[10px]">{d}</div>)}
                        {cells.map((day, index) => { if (day < 1 || day > dayCount) return <div key={`b-${index}`} />; const key = `${monthKey}-${String(day).padStart(2, '0')}`; const daily = monthEvents.filter(e => e.payDate === key); return <button key={key} type="button" onClick={() => setSelected(selected === key ? null : key)} aria-pressed={selected === key} aria-label={`${date(key)}: ${daily.length} pagos${daily.some(e => e.estimated) ? ', incluye estimados' : ''}`} className={`relative flex min-h-[53px] flex-col items-center rounded-lg border p-1 text-[12px] transition-colors sm:min-h-[76px] sm:items-start sm:p-2 ${selected === key ? 'border-[var(--sig)] bg-[var(--sigbg)]' : 'border-[var(--line)] hover:bg-[var(--raised)]'} ${key === todayIso ? 'font-semibold text-[var(--sig)]' : 'text-[var(--muted)]'}`}><span>{day}</span>{daily.length > 0 && <><span className="mt-auto hidden max-w-full truncate rounded bg-[var(--sigbg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--sig)] sm:block">{daily[0].estimated ? 'Est. ' : ''}{daily[0].position.ticker}{daily.length > 1 ? ` +${daily.length - 1}` : ''}</span><span className="mb-1 mt-auto h-1.5 w-1.5 rounded-full bg-[var(--sig)] sm:hidden" /></>}</button>; })}
                    </div>
                    {shownEvents.length > 0 && <div className="mt-5">{shownEvents.map((e, i) => payRow(e, `c-${e.position.id}-${e.exDate}-${i}`))}</div>}
                </>}
            </section>
            <section className="card p-5 sm:p-6"><p className="lb">POR ACTIVO</p><h2 className="mt-2 text-[20px] font-light tracking-tight">Quién paga más</h2>
                {byTicker.length ? <ul className="mt-5 space-y-4">{byTicker.map(([ticker, amount]) => <li key={ticker}><div className="mb-1.5 flex items-baseline justify-between"><span className="font-mono text-[12px]">{ticker}</span><span className="font-mono text-[12px] tabular-nums">{money(amount)}</span></div><div className="trk !h-2"><b style={{ left: 0, width: `${amount / byTicker[0][1] * 100}%`, right: 'auto' }} /></div></li>)}</ul> : <p className="mu mt-6 text-[12px]">Todavía no hay pagos con derecho para mostrar.</p>}
                {unavailable.length > 0 && <div className="mt-6 rounded-xl border border-[var(--line2)] bg-[var(--raised)] p-3 text-[11px] leading-5 text-[var(--muted)]">No se pudo calcular {unavailable.map(i => i.ticker).join(', ')}: falta el ratio o la cotización de dividendos.</div>}
            </section>
        </div>}
        <p className="px-1 text-[11px] leading-5 text-[var(--muted)]">Los pagos estimados repiten la fecha y el monto del año anterior y no están confirmados. Los totales mensuales y por activo incluyen estimaciones. La fecha corresponde al pago del activo de origen; la acreditación del CEDEAR puede ser posterior. El monto es estimado, bruto, antes de impuestos y comisiones. La elegibilidad depende de la fecha de corte y las tenencias efectivas. Ratios orientativos de <a className="underline" href="https://ferminrp.github.io/google-sheets-argento/" target="_blank" rel="noreferrer">Google Sheets Argento</a>; dividendos de <a className="underline" href="https://massive.com/docs/rest/stocks/corporate-actions/dividends" target="_blank" rel="noreferrer">Massive</a>. Verificá el pago en tu bróker.</p>
    </div>;
}


type MarketEvent = { ticker: string; payDate: string; exDate: string | null; amountPerShare: number; currency: string | null };
type MarketResult = { configured: boolean; items: MarketEvent[]; truncated: boolean; start?: string; end?: string };

async function loadMarketNames(): Promise<Record<string, string>> {
    const key = 'activos:nombres-mercado:v1';
    try {
        const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (cached && Date.now() >= cached.time && Date.now() - cached.time < CACHE_AGE && cached.names && typeof cached.names === 'object') return cached.names;
    } catch { /* Se vuelve a consultar el catálogo. */ }
    const exchanges = ['nasdaq', 'nyse', 'amex'];
    const responses = await Promise.allSettled(exchanges.map(async exchange => {
        const response = await fetch(`https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/${exchange}/${exchange}_full_tickers.json`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Catálogo no disponible');
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error('Catálogo inválido');
        return rows as { symbol?: unknown; name?: unknown }[];
    }));
    const names: Record<string, string> = {};
    for (const response of responses) if (response.status === 'fulfilled') for (const row of response.value) {
        if (typeof row.symbol === 'string' && typeof row.name === 'string' && row.symbol && row.name) names[row.symbol.toUpperCase()] = row.name;
    }
    if (responses.every(response => response.status === 'fulfilled') && Object.keys(names).length) {
        try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), names })); } catch { /* Almacenamiento no disponible. */ }
    }
    return names;
}

// Selección editorial de acciones y fondos conocidos; el calendario completo sigue disponible.
const POPULAR_DIVIDEND_TICKERS = new Set('AAPL MSFT GOOGL GOOG AMZN META NVDA JPM BAC V MA WMT COST KO PEP MCD SBUX NKE DIS T VZ XOM CVX PFE JNJ ABBV MRK LLY PG CL KMB MMM CAT BA IBM INTC CSCO ORCL AVGO QCOM TXN ADP HD LOW UPS UNP RTX LMT GE GS MS C WFC BLK BRK.B SPY QQQ DIA IWM VOO VTI SCHD VYM JEPI JEPQ O VNQ XLK XLF XLE XLV XLU XLP TLT BND AGG PBR VALE TSM ASML BABA MELI YPF'.split(' '));

function MarketDividends({ userId }: { userId: string }) {
    const [result, setResult] = useState<MarketResult | null>(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const [names, setNames] = useState<Record<string, string>>({});
    const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        cachedDividends<MarketResult>(`activos:dividendos-mercado:${userId}`, isoDate(new Date()), 'dividends/market', data => Boolean(data?.configured && Array.isArray(data.items) && !data.truncated)).then(data => { if (active) setResult(data); }).catch(() => { if (active) setError('No se pudo consultar el calendario. Volvé a intentar más tarde.'); });
        return () => { active = false; };
    }, [userId]);
    useEffect(() => { let active = true; void loadMarketNames().then(value => { if (active) setNames(value); }); return () => { active = false; }; }, []);
    const companyName = (ticker: string) => names[ticker.toUpperCase()] || cedearName(ticker.toUpperCase());
    const matches = (result?.items ?? []).filter(event => `${event.ticker} ${companyName(event.ticker)}`.toLowerCase().includes(search.trim().toLowerCase()));
    const events = matches.filter(event => showAll || POPULAR_DIVIDEND_TICKERS.has(event.ticker.toUpperCase()));
    const monthKey = isoDate(month).slice(0, 7);
    const monthEvents = events.filter(event => event.payDate.startsWith(monthKey));
    const shownEvents = (selected ? monthEvents.filter(event => event.payDate === selected) : monthEvents).slice().sort((a, b) => Number(POPULAR_DIVIDEND_TICKERS.has(b.ticker.toUpperCase())) - Number(POPULAR_DIVIDEND_TICKERS.has(a.ticker.toUpperCase())) || a.payDate.localeCompare(b.payDate) || a.ticker.localeCompare(b.ticker));
    const totalPages = Math.max(1, Math.ceil(shownEvents.length / 10));
    const currentPage = Math.min(page, totalPages);
    const pageEvents = shownEvents.slice((currentPage - 1) * 10, currentPage * 10);
    const offset = (month.getDay() + 6) % 7;
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((offset + dayCount) / 7) * 7 }, (_, i) => i - offset + 1);
    const changeMonth = (step: number) => { setMonth(value => new Date(value.getFullYear(), value.getMonth() + step, 1)); setSelected(null); setPage(1); };
    return <section className="card p-5 sm:p-6" aria-labelledby="market-dividends-title">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="lb">MERCADO</p><h2 id="market-dividends-title" className="mt-2 text-[20px] font-light tracking-tight">Calendario general</h2><p className="mu mt-2 text-[12px]">Pagos anunciados para las próximas 4 semanas, tengas o no el activo en tu cartera.</p></div>
        <label className="text-[11px] text-[var(--muted)]">Buscar empresa o ticker<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Ej. Apple o AAPL" className="mt-1 block w-full rounded-lg border border-[var(--line2)] bg-[var(--raised)] px-3 py-2 text-[13px] text-[var(--ink)]" /></label></div>
        <p className="mu mt-4 text-[11px] leading-5">Cobertura de Massive: principalmente valores de EE. UU. Se muestran pagos informados con fecha y monto; la cobertura no incluye todas las bolsas del mundo.</p>
        {error ? <p role="alert" className="mt-6 text-[12px] text-[var(--neg)]">{error}</p> : !result ? <p role="status" className="mu mt-6 text-[12px]">Consultando dividendos…</p> : !result.configured ? <p className="mu mt-6 text-[12px]">Para consultar dividendos, configurá MASSIVE_API_KEY en el backend.</p> : <>
            {result.truncated && <p role="status" className="mu mt-4 text-[11px]">La fuente devolvió muchos resultados: esta lista puede estar incompleta.</p>}
            <div className="mt-5 flex items-center justify-between gap-2"><h3 className="text-[16px] font-medium capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3><div className="flex items-center gap-1">{selected && <button type="button" onClick={() => { setSelected(null); setPage(1); }} className="mu mr-2 underline">Ver todo el mes</button>}<button type="button" onClick={() => changeMonth(-1)} disabled={!result.start || monthKey <= result.start.slice(0, 7)} aria-label="Mes anterior" className="ibtn !h-9 !w-9 disabled:opacity-30"><HugeiconsIcon icon={ChevronLeftIcon} size={16} /></button><button type="button" onClick={() => changeMonth(1)} disabled={!result.end || monthKey >= result.end.slice(0, 7)} aria-label="Mes siguiente" className="ibtn !h-9 !w-9 disabled:opacity-30"><HugeiconsIcon icon={ChevronRightIcon} size={16} /></button></div></div>
            <p className="mu mt-2 text-[11px]">Pagos disponibles {result.start && result.end ? `del ${date(result.start)} al ${date(result.end)}` : ''}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--raised)] px-3 py-2"><p className="mu text-[11px]">{showAll ? 'Mostrando todos los activos, con los principales primero.' : 'Mostrando una selección de activos principales.'}</p><button type="button" aria-pressed={showAll} onClick={() => { setShowAll(value => !value); setPage(1); }} className="text-[12px] font-medium text-[var(--sig)]">{showAll ? 'Ver solo principales' : 'Ver todos los activos'}</button></div>
            <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Días de ${month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="mu pb-2 text-center text-[10px]">{day}</div>)}
                {cells.map((day, index) => { if (day < 1 || day > dayCount) return <div key={`blank-${index}`} />; const key = `${monthKey}-${String(day).padStart(2, '0')}`; const daily = monthEvents.filter(event => event.payDate === key); return <button key={key} type="button" onClick={() => { setSelected(selected === key ? null : key); setPage(1); }} aria-pressed={selected === key} aria-label={`${date(key)}: ${daily.length} pagos`} className={`relative flex min-h-[53px] flex-col items-center rounded-lg border p-1 text-[12px] sm:min-h-[76px] sm:items-start sm:p-2 ${selected === key ? 'border-[var(--sig)] bg-[var(--sigbg)]' : 'border-[var(--line)] hover:bg-[var(--raised)]'} ${key === isoDate(new Date()) ? 'font-semibold text-[var(--sig)]' : 'text-[var(--muted)]'}`}><span>{day}</span>{daily.length > 0 && <><span className="mt-auto hidden max-w-full truncate rounded bg-[var(--sigbg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--sig)] sm:block">{daily[0].ticker}{daily.length > 1 ? ` +${daily.length - 1}` : ''}</span><span className="mb-1 mt-auto h-1.5 w-1.5 rounded-full bg-[var(--sig)] sm:hidden" /></>}</button>; })}
            </div>
            <p className="mu mt-5 text-[11px]">{shownEvents.length} pagos {selected ? `· ${date(selected)}` : 'en el mes'}</p>
            {shownEvents.length ? <div className="mt-2">{pageEvents.map((event, index) => <article key={`${event.ticker}-${event.payDate}-${event.exDate}-${index}`} className="flex items-start gap-4 border-t border-[var(--line)] py-4">
                <div className="dd">{at(event.payDate).getDate()}<small>{at(event.payDate).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</small></div>
                <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{companyName(event.ticker) || 'Nombre no disponible'} <span className="mu ml-1">{event.ticker}</span></p><p className="mu mt-1 text-[11px]">Pago: {date(event.payDate)} · Fecha ex: {event.exDate ? date(event.exDate) : 'no informada'}</p></div>
                <span className="text-right text-[12px] font-medium tabular-nums">{event.amountPerShare.toLocaleString('es-AR', { maximumFractionDigits: 6 })} {event.currency ?? 'moneda no informada'}<small className="mu mt-1 block text-[10px] font-normal">por acción · bruto</small></span>
            </article>)}</div> : <p className="mu mt-6 text-[12px]">{search ? (showAll ? 'No encontramos pagos para esa búsqueda en esta selección.' : 'No encontramos pagos entre los principales. Probá ver todos los activos.') : (showAll ? 'No hay pagos anunciados en esta selección.' : 'No hay pagos de activos principales en esta selección. Probá ver todos los activos.')}</p>}
            {shownEvents.length > 10 && <nav aria-label="Páginas de dividendos" className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="btn-ghost text-[12px] disabled:opacity-30">Anterior</button><span className="mu text-[12px]" aria-live="polite">Página {currentPage} de {totalPages}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className="btn-ghost text-[12px] disabled:opacity-30">Siguiente</button></nav>}
        </>}
        <p className="mu mt-5 text-[11px]">Nombres de <a className="underline" href="https://github.com/rreichel3/US-Stock-Symbols" target="_blank" rel="noreferrer">US Stock Symbols</a>. Dividendos de <a className="underline" href="https://massive.com/docs/rest/stocks/corporate-actions/dividends" target="_blank" rel="noreferrer">Massive</a>. Los montos y fechas pueden cambiar.</p>
    </section>;
}

export default function Dividends(props: { dirty: boolean; hidden: boolean; userId: string; portfolioKey: string }) {
    const [tab, setTab] = useState<'portfolio' | 'market'>('portfolio');
    return <div className="space-y-3.5">
        <div className="seg inline-flex" role="group" aria-label="Sección de dividendos"><button type="button" aria-pressed={tab === 'portfolio'} onClick={() => setTab('portfolio')}>Mi cartera</button><button type="button" aria-pressed={tab === 'market'} onClick={() => setTab('market')}>Calendario general</button></div>
        {tab === 'portfolio' ? <PortfolioDividends {...props} /> : <MarketDividends userId={props.userId} />}
    </div>;
}
