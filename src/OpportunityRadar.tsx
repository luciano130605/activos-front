import { useEffect, useMemo, useState } from 'react';
import { history, adjustPossibleRatios, type HistoryPoint } from './AssetPerformance';
import { request } from './account';
import type { Investment } from './portfolio';

const DAY = 86_400_000;
type Asset = { key: string; kind: 'stock' | 'cedear' | 'crypto'; id: string; name: string };
type Earnings = { date: string; items: { ticker: string; name: string; time: string }[] };
type DividendResult = { configured: boolean; items: { id: string; ticker: string; name: string; status: string; events?: { payDate: string; estimated?: boolean }[] }[] };
type Signal = { key: string; category: 'drop' | 'high' | 'event'; name: string; ticker: string; title: string; detail: string; value: string; date?: string };
const localIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const aliases: Record<string, string> = { BRKB: 'BRK.B', GOOGLE: 'GOOGL' };
const pct = (n: number) => `${n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export default function OpportunityRadar({ items, dirty }: { items: Investment[]; dirty: boolean }) {
    const [filter, setFilter] = useState<'all' | Signal['category']>('all');
    const [period, setPeriod] = useState<7 | 30>(30);
    const [threshold, setThreshold] = useState(10);
    const [refresh, setRefresh] = useState(0);
    const [records, setRecords] = useState<Record<string, HistoryPoint[] | null>>({});
    const [events, setEvents] = useState<Signal[]>([]);
    const [eventWarning, setEventWarning] = useState('');
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const assets: Asset[] = useMemo(() => [...new Map(items.filter((item): item is Investment & { kind: Asset['kind']; coin: string } => item.kind !== 'rate' && !!item.coin).map(item => { const key = `${item.kind}:${item.coin}`; return [key, { key, kind: item.kind, id: item.coin, name: item.name }] as const; })).values()], [items]);
    const signature = assets.map(asset => asset.key).sort().join('|');
    const positionIds = items.map(item => item.id).sort().join('|');
    useEffect(() => {
        const controller = new AbortController();
        const keys = signature ? signature.split('|') : [];
        if (!keys.length) { setRecords({}); setLoadingPrices(false); return () => controller.abort(); }
        setLoadingPrices(true); setRecords({});
        void Promise.all(keys.map(async key => { const [kind, id] = key.split(':'); try { return [key, await history(kind as Asset['kind'], id, controller.signal)] as const; } catch { return [key, null] as const; } })).then(rows => { if (!controller.signal.aborted) { setRecords(Object.fromEntries(rows)); setLoadingPrices(false); } });
        return () => controller.abort();
    }, [signature, refresh]);
    useEffect(() => {
        let active = true;
        const keys = signature ? signature.split('|') : [];
        const stockKeys = keys.filter(key => key.startsWith('cedear:') || key.startsWith('stock:'));
        if (!stockKeys.length) { setEvents([]); setEventWarning(''); setLoadingEvents(false); return () => { active = false; }; }
        setLoadingEvents(true); setEvents([]); setEventWarning('');
        const dates = Array.from({ length: 8 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return localIso(date); });
        void Promise.allSettled([request<DividendResult>('dividends'), ...dates.map(date => request<Earnings>(`market-calendar/earnings?date=${date}`))]).then(results => {
            if (!active) return;
            const signals: Signal[] = []; const warnings: string[] = [];
            const dividend = results[0];
            if (dividend.status === 'rejected') warnings.push('No se pudieron consultar dividendos');
            else if (!('configured' in dividend.value) || !dividend.value.configured) warnings.push('Dividendos no configurados');
            else {
                if (dividend.value.items.some(item => item.status !== 'ok')) warnings.push('Cobertura de dividendos incompleta');
                const seen = new Set<string>();
                for (const position of dividend.value.items.filter(position => positionIds.split('|').includes(position.id))) for (const event of position.events ?? []) {
                    const key = `${position.ticker}:${event.payDate}:${!!event.estimated}`;
                    if (seen.has(key) || event.payDate < dates[0] || event.payDate > dates[7]) continue;
                    seen.add(key); signals.push({ key: `div:${key}`, category: 'event', name: position.name, ticker: position.ticker, title: event.estimated ? 'Dividendo estimado' : 'Pago de dividendo', detail: event.estimated ? 'Fecha estimada a partir del año anterior, sin confirmar.' : 'Fecha de pago anunciada del activo de origen; la acreditación puede variar.', value: dateLabel(event.payDate), date: event.payDate });
                }
            }
            const tickerMap = new Map(stockKeys.map(key => { const id = key.slice(key.indexOf(':') + 1).toUpperCase(); return [aliases[id] ?? id, id]; }));
            let failedDays = 0;
            for (const result of results.slice(1)) {
                if (result.status === 'rejected' || !('date' in result.value)) { failedDays++; continue; }
                for (const item of result.value.items) { const ticker = tickerMap.get(item.ticker.toUpperCase()); if (ticker) signals.push({ key: `earn:${ticker}:${result.value.date}`, category: 'event', name: item.name, ticker, title: 'Presentación de balance', detail: `${item.time} · Fecha sujeta a cambios.`, value: dateLabel(result.value.date), date: result.value.date }); }
            }
            if (failedDays) warnings.push(`Balances no disponibles para ${failedDays} ${failedDays === 1 ? 'día' : 'días'}`);
            setEvents(signals); setEventWarning(warnings.join(' · ')); setLoadingEvents(false);
        });
        return () => { active = false; };
    }, [signature, positionIds, refresh]);
    const signals = useMemo(() => {
        const result: Signal[] = [];
        for (const asset of assets) {
            let points = records[asset.key]; if (!points?.length) continue;
            if (asset.kind === 'cedear') points = adjustPossibleRatios(points).points;
            const end = points[points.length - 1]; if (Date.now() - end.time > 7 * DAY) continue;
            const target = end.time - period * DAY;
            const earlier = points.reduce<HistoryPoint | null>((best, point) => Math.abs(point.time - target) < Math.abs((best?.time ?? 0) - target) ? point : best, null);
            const label = asset.kind === 'cedear' ? 'ARS · CEDEAR' : 'USD';
            if (earlier && Math.abs(earlier.time - target) <= 4 * DAY && earlier.time < end.time) {
                const change = (end.price / earlier.price - 1) * 100;
                if (change <= -threshold) result.push({ key: `drop:${asset.key}`, category: 'drop', name: asset.name, ticker: asset.id, title: `Caída en ${period} días`, detail: `Variación entre ${dateLabel(localIso(new Date(earlier.time)))} y ${dateLabel(localIso(new Date(end.time)))} · ${label}`, value: pct(change) });
            }
            const annual = points.filter(point => point.time >= end.time - 365 * DAY);
            if (annual.length > 1 && end.time - annual[0].time >= 300 * DAY) {
                const high = Math.max(...annual.map(point => point.price)); const distance = (end.price / high - 1) * 100;
                if (distance >= -5) result.push({ key: `high:${asset.key}`, category: 'high', name: asset.name, ticker: asset.id, title: 'Cerca de su máximo anual', detail: `A ${pct(Math.abs(distance))} del máximo de los últimos 365 días · ${label}`, value: distance === 0 ? 'Máximo' : pct(distance) });
            }
        }
        return [...result, ...events.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))];
    }, [assets, records, events, period, threshold]);
    const filtered = signals.filter(signal => filter === 'all' || signal.category === filter);
    const unavailable = assets.filter(asset => records[asset.key] === null || (records[asset.key]?.length && Date.now() - records[asset.key]![records[asset.key]!.length - 1].time > 7 * DAY)).length;
    const counts = { drop: signals.filter(s => s.category === 'drop').length, high: signals.filter(s => s.category === 'high').length, event: signals.filter(s => s.category === 'event').length };
    return <div className="space-y-3.5">
        <section className="card hero-glow overflow-hidden p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="lb">SEÑALES DE TU CARTERA</p><h2 className="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] font-light tracking-tight">Lo que está pasando con tus activos<span className="sig">.</span></h2><p className="mu mt-2 max-w-xl text-[12px] leading-5">Movimientos destacados y fechas próximas, en un solo lugar. Ajustá los filtros para ver solo lo que te interesa.</p></div><button type="button" onClick={() => { for (const asset of assets) { try { sessionStorage.removeItem(`activos:asset-history:${asset.kind}:${asset.id}`); } catch { /* Sin almacenamiento disponible. */ } } setRefresh(n => n + 1); }} className="btn-ghost text-[12px]" disabled={loadingPrices || loadingEvents}>Actualizar</button></div><div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">{([['CAÍDAS', counts.drop], ['CERCA DEL MÁXIMO', counts.high], ['PRÓXIMOS EVENTOS', counts.event]] as const).map(([label, count]) => <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3 sm:p-4"><p className="mu text-[9px] tracking-wide sm:text-[10px]">{label}</p><p className="mt-2 text-[25px] font-light tabular-nums">{loadingPrices && label !== 'PRÓXIMOS EVENTOS' || loadingEvents && label === 'PRÓXIMOS EVENTOS' ? '—' : count}</p></div>)}</div></section>
        <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="seg flex-wrap" role="group" aria-label="Filtrar señales">{([['all','Todas'],['drop','Caídas'],['high','Máximos'],['event','Eventos']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]"><label>Período <select value={period} onChange={e => setPeriod(Number(e.target.value) as 7 | 30)} className="ml-1 rounded-lg border border-[var(--line)] bg-[var(--raised)] px-2 py-1.5 text-[var(--ink)]"><option value={7}>7 días</option><option value={30}>30 días</option></select></label><label>Caída desde <select value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="ml-1 rounded-lg border border-[var(--line)] bg-[var(--raised)] px-2 py-1.5 text-[var(--ink)]"><option value={5}>5%</option><option value={10}>10%</option><option value={20}>20%</option></select></label></div></div>
            {(loadingPrices || loadingEvents) && <p role="status" className="mu mt-5 text-[12px]">Consultando {loadingPrices && loadingEvents ? 'precios y eventos' : loadingPrices ? 'precios' : 'eventos'}…</p>}
            {dirty && <p className="mu mt-4 text-[11px]">Los dividendos corresponden a la última cartera guardada.</p>}
            {(unavailable > 0 || eventWarning) && <p role="status" className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--raised)] p-3 text-[11px] text-[var(--muted)]">{[unavailable ? `${unavailable} ${unavailable === 1 ? 'activo sin historial reciente' : 'activos sin historial reciente'}` : '', eventWarning].filter(Boolean).join(' · ')}.</p>}
            <div className="mt-5 divide-y divide-[var(--line)]">{filtered.map(signal => <article key={signal.key} className="flex items-center gap-4 py-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[16px] ${signal.category === 'drop' ? 'bg-[#ef4444]/10 text-[#ef7777]' : signal.category === 'high' ? 'bg-[var(--sigbg)] text-[var(--sig)]' : 'bg-[#8d9fff]/10 text-[#8d9fff]'}`}>{signal.category === 'drop' ? '↘' : signal.category === 'high' ? '↗' : '◷'}</div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{signal.name} <span className="mu ml-1 text-[11px]">{signal.ticker}</span></p><p className="mt-1 text-[12px]">{signal.title}</p><p className="mu mt-1 text-[10.5px] leading-4">{signal.detail}</p></div><span className={`shrink-0 font-mono text-[13px] ${signal.category === 'drop' ? 'text-[var(--neg)]' : signal.category === 'high' ? 'text-[var(--sig)]' : ''}`}>{signal.value}</span></article>)}</div>
            {!filtered.length && !loadingPrices && !loadingEvents && <div className="py-14 text-center"><p className="text-[14px]">{assets.length ? 'No hay señales con estos filtros' : 'Todavía no hay activos para explorar'}</p><p className="mu mt-2 text-[12px]">{assets.length ? 'Probá ajustar el período o el porcentaje de caída.' : 'Agregá acciones, CEDEARs o criptomonedas a tu cartera.'}</p></div>}
            <p className="mu mt-5 border-t border-[var(--line)] pt-4 text-[10.5px] leading-5">Las caídas se calculan entre cierres disponibles; el máximo usa los últimos 365 días y requiere al menos 300 días de historial. CEDEARs en pesos; acciones y cripto en dólares. Se intenta ajustar cambios de ratio en CEDEARs. Eventos de los próximos 7 días: balances de Nasdaq y dividendos de Massive, sujetos a disponibilidad. Son señales informativas, no recomendaciones de inversión.</p>
        </section>
    </div>;
}
