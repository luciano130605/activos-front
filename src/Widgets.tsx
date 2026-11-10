import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { ApiError, request, type Account } from './account';
import { history, type HistoryPoint } from './AssetPerformance';
import { cedearPricesNow, stockPricesNow } from './cedears';
import { coinPricesNow, usdcArsNow } from './coingecko';
import { fixedTermValue } from './fixed-term';
import { localQuotes, type LocalKind } from './local-market';
import { morphoQuotes } from './morpho';
import type { Currency, Investment, Kind, Portfolio } from './portfolio';
import './Widgets.css';

type WidgetKind = 'market' | 'portfolio' | 'dollar' | 'asset';
type AssetKind = Exclude<Kind, 'rate'>;
type DollarRate = { casa: string; nombre: string; compra: number | null; venta: number; change?: number | null };
type Snapshot = { portfolio: Portfolio; prices: Record<string, number>; rates: DollarRate[]; fx: number | null; updatedAt: number; error: string };
type Position = { item: Investment; value: number | null; missing: boolean };
type PortfolioSummary = { value: number | null; invested: number | null; gain: number | null; performance: number | null; dailyValue: number | null; dailyPercent: number | null; positions: Position[]; missing: number };

const MINUTE = 60_000;
const DAY = 86_400_000;
const MONTH = DAY * 30.4375;
const HISTORY_LIMIT = 12;
const REFRESH_KEY = 'activos:widgets:refresh-seconds';
const rateLabels: Record<string, string> = { bolsa: 'Dólar MEP', contadoconliqui: 'Dólar CCL', blue: 'Dólar blue', oficial: 'Dólar oficial', mayorista: 'Dólar mayorista', cripto: 'Dólar cripto', tarjeta: 'Dólar tarjeta' };
let mepHistoryCache: { loadedAt: number; points: HistoryPoint[] } | null = null;

function readRefreshSeconds() {
    try {
        const value = Number(localStorage.getItem(REFRESH_KEY));
        return [30, 60, 120, 300].includes(value) ? value : 60;
    } catch { return 60; }
}

function validKind(value: string | null): value is AssetKind {
    return value === 'crypto' || value === 'cedear' || value === 'stock' || value === 'arg-stock' || value === 'bond' || value === 'fund' || value === 'morpho';
}

function emptyAsset(kind: AssetKind, id: string): Investment {
    const local = kind === 'arg-stock' || kind === 'bond' || kind === 'fund';
    return { id: `widget:${kind}:${id}`, name: id, kind, coin: id, units: 1, amount: 1, currency: local || kind === 'cedear' ? 'ARS' : 'USD', date: new Date().toLocaleDateString('en-CA') };
}

async function readDollars(signal?: AbortSignal): Promise<DollarRate[]> {
    const response = await fetch('https://dolarapi.com/v1/dolares', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('No se pudieron consultar las cotizaciones del dólar.');
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('El proveedor devolvió una respuesta inválida.');
    const rates = data.flatMap((row): DollarRate[] => {
        const casa = typeof row?.casa === 'string' ? row.casa : '';
        const venta = Number(row?.venta);
        const compra = Number(row?.compra);
        return casa && Number.isFinite(venta) && venta > 0
            ? [{ casa, nombre: rateLabels[casa] ?? String(row?.nombre ?? casa), venta, compra: Number.isFinite(compra) && compra > 0 ? compra : null }]
            : [];
    });
    const mep = rates.find(rate => rate.casa === 'bolsa');
    if (mep) {
        try {
            const prior = previousPoint(await readMepHistory(signal), Date.now() - DAY);
            mep.change = prior ? (mep.venta / prior.price - 1) * 100 : null;
        } catch { mep.change = null; }
    }
    return rates;
}

async function readMepHistory(signal?: AbortSignal): Promise<HistoryPoint[]> {
    if (mepHistoryCache && Date.now() - mepHistoryCache.loadedAt < 30 * MINUTE) return mepHistoryCache.points;
    const response = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('No se pudo consultar el historial del MEP.');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('El historial del MEP no es válido.');
    const points: HistoryPoint[] = rows.flatMap((row): HistoryPoint[] => {
        const time = Date.parse(`${String(row?.fecha ?? '').slice(0, 10)}T12:00:00Z`);
        const price = Number(row?.venta);
        return Number.isFinite(time) && Number.isFinite(price) && price > 0 && time <= Date.now() ? [{ time, price }] : [];
    }).sort((a, b) => a.time - b.time);
    mepHistoryCache = { loadedAt: Date.now(), points };
    return points;
}

function uniqueIds(items: Investment[], kind: Kind) {
    return [...new Set(items.filter(item => item.kind === kind && item.coin).map(item => item.coin!))];
}

async function loadPrices(items: Investment[], display: Currency, signal: AbortSignal) {
    const crypto = uniqueIds(items, 'crypto');
    const cedears = uniqueIds(items, 'cedear');
    const stocks = uniqueIds(items, 'stock');
    const morphos = uniqueIds(items, 'morpho');
    const localItems = items.filter(item => (item.kind === 'arg-stock' || item.kind === 'bond' || item.kind === 'fund') && item.coin) as (Investment & { kind: LocalKind; coin: string })[];
    const needsFx = items.some(item => item.kind === 'rate' ? item.currency !== display : quoteCurrency(item) !== display || item.currency !== display);
    const groups = await Promise.allSettled([
        coinPricesNow(crypto, signal), cedearPricesNow(cedears, signal), stockPricesNow(stocks, signal),
        localQuotes(localItems, signal), morphoQuotes(morphos, signal),
        needsFx ? readDollars(signal) : Promise.resolve([] as DollarRate[]),
        needsFx ? usdcArsNow(signal) : Promise.resolve(null),
    ]);
    const prices = Object.assign({}, ...groups.slice(0, 5).flatMap(result => result.status === 'fulfilled' ? [result.value] : []));
    const rates = groups[5].status === 'fulfilled' ? groups[5].value : [];
    const fx = (groups[6].status === 'fulfilled' ? groups[6].value : null) ?? rates.find(rate => rate.casa === 'bolsa')?.venta ?? null;
    const failures = groups.slice(0, 5).filter(result => result.status === 'rejected').length;
    const unavailable = items.some(item => item.kind !== 'rate' && item.coin && prices[`${item.kind}:${item.coin}`] == null);
    return { prices, rates, fx, error: failures || unavailable ? 'Algunas cotizaciones no están disponibles.' : '' };
}

function quoteCurrency(item: Investment): Currency {
    return item.kind === 'cedear' || item.kind === 'arg-stock' || item.kind === 'bond' || item.kind === 'fund' ? 'ARS' : 'USD';
}

function convert(value: number, from: Currency, to: Currency, fx: number | null) {
    if (from === to) return value;
    if (!fx || !Number.isFinite(fx) || fx <= 0) return null;
    return from === 'ARS' ? value / fx : value * fx;
}

function valueAt(item: Investment, at: number, now: number) {
    if (at < Date.parse(`${item.date}T00:00:00Z`)) return 0;
    if (item.kind === 'rate') {
        if (item.maturityDate) return fixedTermValue(item.amount, item.rate ?? 0, item.date, item.maturityDate, at);
        const monthly = item.period === 'month' ? (item.rate ?? 0) / 100 : Math.pow(1 + (item.rate ?? 0) / 100, 1 / 12) - 1;
        return item.amount * Math.pow(1 + monthly, (at - Date.parse(`${item.date}T00:00:00Z`)) / MONTH);
    }
    return null;
}

function summarize(snapshot: Snapshot, histories: Record<string, HistoryPoint[]>, historiesReady: boolean, historiesLimited: boolean): PortfolioSummary {
    const now = Date.now();
    const display = snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD';
    const positions = snapshot.portfolio.investments.map(item => {
        const rateValue = item.kind === 'rate' ? valueAt(item, now, now) : null;
        const quote = item.coin ? snapshot.prices[`${item.kind}:${item.coin}`] : undefined;
        const rawValue = rateValue ?? (quote != null && item.units != null ? quote * item.units : null);
        const currentCurrency = rateValue != null ? item.currency : quoteCurrency(item);
        const value = rawValue == null ? null : convert(rawValue, currentCurrency, display, snapshot.fx);
        return { item, value, missing: value == null && Date.parse(`${item.date}T00:00:00Z`) <= now };
    });
    const currentComplete = positions.every(position => !position.missing);
    const value = currentComplete ? positions.reduce((sum, position) => sum + (position.value ?? 0), 0) : null;
    const unknownCost = snapshot.portfolio.investments.some(item => item.costUnknown);
    const investedValues = snapshot.portfolio.investments.map(item => Date.parse(`${item.date}T00:00:00Z`) > now ? 0 : convert(item.amount, item.currency, display, snapshot.fx));
    const invested = !unknownCost && investedValues.every(item => item != null) ? investedValues.reduce<number>((sum, item) => sum + (item ?? 0), 0) : null;
    const gain = value != null && invested != null ? value - invested : null;
    const performance = value != null && invested != null && invested > 0 ? (value / invested - 1) * 100 : null;

    let dailyValue: number | null = null;
    let dailyPercent: number | null = null;
    const target = now - DAY;
    if (historiesReady && !historiesLimited && value != null) {
        let previousTotal = 0;
        let complete = true;
        for (const item of snapshot.portfolio.investments) {
            if (item.kind === 'rate') {
                const prior = valueAt(item, target, now);
                const converted = convert(prior ?? 0, item.currency, display, snapshot.fx);
                if (converted == null) complete = false; else previousTotal += converted;
                continue;
            }
            if (!item.coin || !item.units) { complete = false; continue; }
            const points = histories[`${item.kind}:${item.coin}`] ?? [];
            const prior = previousPoint(points, target);
            const converted = prior ? convert(prior.price * item.units, quoteCurrency(item), display, snapshot.fx) : null;
            if (converted == null) complete = false; else previousTotal += converted;
        }
        if (complete && previousTotal > 0) {
            dailyValue = value - previousTotal;
            dailyPercent = dailyValue / previousTotal * 100;
        }
    }
    return { value, invested, gain, performance, dailyValue, dailyPercent, positions, missing: positions.filter(position => position.missing).length };
}

function previousPoint(points: HistoryPoint[], target: number) {
    let prior: HistoryPoint | undefined;
    for (const point of points) { if (point.time > target + 6 * 60 * 60_000) break; prior = point; }
    return prior && prior.time >= target - 4 * DAY ? prior : undefined;
}

function dailyChange(item: Investment, quote: number, points: HistoryPoint[]) {
    const prior = previousPoint(points, Date.now() - DAY);
    return prior && prior.price > 0 ? (quote / prior.price - 1) * 100 : null;
}

function money(value: number | null, currency: Currency = 'USD') {
    if (value == null || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function percent(value: number | null) {
    return value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function Sparkline({ points, positive = true }: { points: HistoryPoint[]; positive?: boolean }) {
    if (points.length < 2) return <span className="widget-spark-empty" aria-label="Historial no disponible" />;
    const recent = points.slice(-30);
    const low = Math.min(...recent.map(point => point.price));
    const high = Math.max(...recent.map(point => point.price));
    const spread = high - low || 1;
    const path = recent.map((point, index) => `${index ? 'L' : 'M'} ${(index / (recent.length - 1)) * 100} ${(34 - ((point.price - low) / spread) * 30).toFixed(2)}`).join(' ');
    return <svg className={`widget-spark ${positive ? 'is-up' : 'is-down'}`} viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="Gráfico de evolución reciente"><path d={path} /></svg>;
}

function QuoteChange({ value }: { value: number | null }) {
    const sign = value == null ? 'neutral' : value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
    return <span className={`widget-change is-${sign}`}><span className="widget-change-mark" aria-hidden="true">{value == null || value === 0 ? '·' : value > 0 ? '↗' : '↘'}</span>{percent(value)}</span>;
}

function useAssetHistories(items: Investment[], enabled: boolean) {
    const signature = useMemo(() => [...new Set(items.filter(item => item.kind !== 'rate' && item.coin).map(item => `${item.kind}:${item.coin}`))].sort().join('|'), [items]);
    const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>({});
    const [loading, setLoading] = useState(false);
    const [limited, setLimited] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        const keys = enabled && signature ? signature.split('|') : [];
        setHistories({});
        if (!keys.length) { setLoading(false); setLimited(false); return () => controller.abort(); }
        if (keys.length > HISTORY_LIMIT) { setLoading(false); setLimited(true); return () => controller.abort(); }
        setLoading(true); setLimited(false);
        void Promise.all(keys.map(async key => {
            const separator = key.indexOf(':');
            const kind = key.slice(0, separator) as AssetKind;
            const id = key.slice(separator + 1);
            try { return [key, await history(kind, id, controller.signal)] as const; }
            catch { return [key, [] as HistoryPoint[]] as const; }
        })).then(entries => { if (!controller.signal.aborted) setHistories(Object.fromEntries(entries)); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [signature, enabled]);
    return { histories, loading, limited };
}

function TauriCloseButton() {
    const [error, setError] = useState('');
    return <button className="widget-close" type="button" title="Cerrar widget" aria-label="Cerrar widget" onClick={() => {
        const tauri = window.__TAURI__;
        if (!tauri) return;
        void tauri.core.invoke('close_widget').catch(() => setError('No se pudo cerrar la ventana.'));
    }}>{error ? '!' : <svg viewBox="0 0 18 18" aria-hidden="true"><path d="m4.5 4.5 9 9m0-9-9 9" /></svg>}</button>;
}

function WidgetFrame({ title, eyebrow, updatedAt, refreshing, error, onRefresh, children }: { title: string; eyebrow: string; updatedAt: number | null; refreshing: boolean; error: string; onRefresh: () => void; children: ReactNode }) {
    const [seconds, setSeconds] = useState(readRefreshSeconds);
    const startDragging = (event: ReactMouseEvent<HTMLElement>) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button, input, select, a')) return;
        const nativeWindow = window.__TAURI__?.window?.getCurrentWindow();
        if (nativeWindow) void nativeWindow.startDragging().catch(() => undefined);
    };
    const startResizing = (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const nativeWindow = window.__TAURI__?.window?.getCurrentWindow();
        if (nativeWindow) void nativeWindow.startResizeDragging('SouthEast').catch(() => undefined);
    };
    return <main className="app widget-app" data-theme="dark"><section className="widget-shell">
        <header className="widget-header" onMouseDown={startDragging}>
            <div className="widget-brand"><span className="widget-brand-mark" aria-hidden="true">A</span><span>activos<span className="widget-accent">.</span></span></div>
            <div className="widget-header-actions">
                <button type="button" className="widget-refresh" onClick={onRefresh} disabled={refreshing} aria-label="Actualizar cotizaciones" title="Actualizar ahora"><svg className={refreshing ? 'is-spinning' : ''} viewBox="0 0 20 20" aria-hidden="true"><path d="M16.2 7.4A6.5 6.5 0 0 0 4.6 5.8L3 7.3M3 7.3V3.8m0 3.5h3.6M3.8 12.6a6.5 6.5 0 0 0 11.6 1.6L17 12.7m0 0v3.5m0-3.5h-3.6" /></svg></button>
                <TauriCloseButton />
            </div>
        </header>
        <div className="widget-title-row" onMouseDown={startDragging}><div><p className="widget-eyebrow">{eyebrow}</p><h1>{title}</h1></div><span className={`widget-live-dot ${error ? 'has-error' : ''}`} title={error || 'Actualización automática activa'} /></div>
        {error && <p className="widget-warning" role="status">{error}</p>}
        {children}
        <footer className="widget-footer">
            <span>{updatedAt ? `Actualizado ${new Date(updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Esperando cotizaciones'}</span>
            <label>Actualizar<select aria-label="Frecuencia de actualización" value={seconds} onChange={event => { const next = Number(event.target.value); setSeconds(next); try { localStorage.setItem(REFRESH_KEY, String(next)); } catch { /* Preferencia de esta ventana. */ } }}><option value={30}>30 s</option><option value={60}>1 min</option><option value={120}>2 min</option><option value={300}>5 min</option></select></label>
        </footer>
        {window.__TAURI__?.window && <button type="button" className="widget-resize-handle" onMouseDown={startResizing} aria-label="Cambiar tamaño del widget" title="Arrastrá para cambiar el tamaño"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 5v9H5M14 9l-5 5M14 2v1M2 14h1" /></svg></button>}
    </section></main>;
}

function DollarWidget() {
    const [rates, setRates] = useState<DollarRate[]>([]);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [amount, setAmount] = useState('100000');
    const [direction, setDirection] = useState<'ars-usd' | 'usd-ars'>('ars-usd');
    const [casa, setCasa] = useState('bolsa');
    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const next = await readDollars();
            if (!next.length) throw new Error('El proveedor no informó cotizaciones disponibles.');
            setCasa(current => next.some(rate => rate.casa === current) ? current : next.some(rate => rate.casa === 'bolsa') ? 'bolsa' : next[0].casa);
            setRates(next); setError(''); setUpdatedAt(Date.now());
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'No se pudieron actualizar las cotizaciones.';
            setError(message);
        } finally { setRefreshing(false); }
    }, []);
    useAutoRefresh(refresh);
    const selectedRate = rates.find(rate => rate.casa === casa);
    const numericAmount = Number(amount);
    const rate = selectedRate?.[direction === 'ars-usd' ? 'venta' : 'compra'];
    const converted = amount.trim() && Number.isFinite(numericAmount) && numericAmount >= 0 && rate != null && rate > 0
        ? direction === 'ars-usd' ? numericAmount / rate : numericAmount * rate
        : null;
    const sourceCurrency: Currency = direction === 'ars-usd' ? 'ARS' : 'USD';
    const resultCurrency: Currency = direction === 'ars-usd' ? 'USD' : 'ARS';
    return <WidgetFrame title="Dólares" eyebrow="COTIZACIONES ARGENTINAS" updatedAt={updatedAt} refreshing={refreshing} error={error} onRefresh={() => void refresh()}>
        <section className="widget-converter" aria-label="Conversor de dólares">
            <div className="widget-section-heading"><h2>Conversión</h2><span>Según la cotización elegida</span></div>
            <div className="widget-converter-switch" role="group" aria-label="Dirección de conversión">
                <button type="button" aria-pressed={direction === 'ars-usd'} onClick={() => setDirection('ars-usd')}>ARS <span>→</span> USD</button>
                <button type="button" aria-pressed={direction === 'usd-ars'} onClick={() => setDirection('usd-ars')}>USD <span>→</span> ARS</button>
            </div>
            <label className="widget-converter-field">Importe en {sourceCurrency}<input type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-label={`Importe en ${sourceCurrency}`} /></label>
            <label className="widget-converter-field">Cotización<select value={casa} onChange={event => setCasa(event.target.value)} disabled={!rates.length}>{rates.map(item => <option value={item.casa} key={item.casa}>{item.nombre}</option>)}</select></label>
            <div className="widget-converter-result"><span>{resultCurrency === 'USD' ? 'Recibís aproximadamente' : 'Equivale a'}</span><strong>{converted == null ? 'No disponible' : money(converted, resultCurrency)}</strong>{rate != null && <small>{money(rate, 'ARS')} por USD · {direction === 'ars-usd' ? 'venta' : 'compra'}</small>}</div>
        </section>
        <div className="widget-dollar-list">{rates.length ? rates.map(rate => <article className={`widget-dollar-row ${rate.casa === 'bolsa' ? 'is-featured' : ''}`} key={rate.casa}>
            <div><h2>{rate.nombre}</h2><p>{rate.compra ? `Compra ${money(rate.compra, 'ARS')}` : rate.casa === 'bolsa' ? 'Contado inmediato' : 'Venta informada por la fuente'}{rate.casa === 'bolsa' && rate.change != null ? <> · <QuoteChange value={rate.change} /></> : null}</p></div>
            <strong>{money(rate.venta, 'ARS')}</strong>
        </article>) : <WidgetStatus loading={refreshing} message="Las cotizaciones van a aparecer cuando responda el proveedor." />}</div>
    </WidgetFrame>;
}

function WidgetStatus({ loading, message }: { loading: boolean; message: string }) {
    return <div className="widget-status" role={loading ? 'status' : undefined}><span className={loading ? 'widget-loader' : 'widget-status-mark'} aria-hidden="true">{loading ? '' : '—'}</span><p>{loading ? 'Consultando datos de mercado…' : message}</p></div>;
}

function useAutoRefresh(refresh: () => void) {
    useEffect(() => {
        let seconds = readRefreshSeconds();
        void refresh();
        let timer = window.setInterval(() => void refresh(), seconds * 1000);
        const onStorage = (event: StorageEvent) => {
            if (event.key !== REFRESH_KEY) return;
            const next = readRefreshSeconds();
            if (next === seconds) return;
            seconds = next; window.clearInterval(timer); timer = window.setInterval(() => void refresh(), seconds * 1000);
        };
        window.addEventListener('storage', onStorage);
        return () => { window.clearInterval(timer); window.removeEventListener('storage', onStorage); };
    }, [refresh]);
}

function PortfolioWidget({ marketOnly, asset }: { marketOnly: boolean; asset: { kind: AssetKind; id: string } | null }) {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [authRequired, setAuthRequired] = useState(false);
    const assetItem = asset ? emptyAsset(asset.kind, asset.id) : null;
    const assetQuote = assetItem && snapshot ? snapshot.prices[`${assetItem.kind}:${assetItem.coin}`] ?? null : null;
    const assetHoldings = asset && snapshot ? snapshot.portfolio.investments.filter(item => item.kind === asset.kind && item.coin === asset.id) : [];
    const assetUnits = assetHoldings.length ? assetHoldings.reduce((sum, item) => sum + (item.units ?? 0), 0) : 0;
    const assetDisplay = snapshot?.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD';
    const assetValue = assetQuote != null && assetUnits > 0 && snapshot ? convert(assetQuote * assetUnits, quoteCurrency(assetItem!), assetDisplay, snapshot.fx) : null;
    const assetCosts = assetHoldings.map(item => item.costUnknown ? null : convert(item.amount, item.currency, assetDisplay, snapshot?.fx ?? null));
    const assetCost = assetCosts.length && assetCosts.every(cost => cost != null) ? assetCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null;
    const assetGain = assetValue != null && assetCost != null ? assetValue - assetCost : null;

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            let portfolio: Portfolio;
            const account = await request<Account>('session');
            portfolio = account.portfolio;
            setAuthRequired(false);
            const items = asset ? [emptyAsset(asset.kind, asset.id)] : portfolio.investments;
            const quotes = await loadPrices(items, portfolio.preferences.display, new AbortController().signal);
            setSnapshot({ portfolio, ...quotes, updatedAt: Date.now(), error: quotes.error });
            setError('');
        } catch (cause) {
            if (cause instanceof ApiError && cause.status === 401) setAuthRequired(true);
            setError(cause instanceof Error ? cause.message : 'No se pudieron actualizar los datos.');
        } finally { setRefreshing(false); }
    }, [asset]);
    useAutoRefresh(refresh);

    const title = asset ? asset.id.toUpperCase() : marketOnly ? 'Mercado' : 'Mi cartera';
    const eyebrow = asset ? 'ACTIVO INDIVIDUAL' : marketOnly ? 'SEGUIMIENTO DE MERCADO' : 'RESUMEN DE CARTERA';
    const shownPositions = useMemo(() => {
        if (!snapshot || marketOnly === false) return [];
        return snapshot.portfolio.investments.filter(item => item.kind !== 'rate').map(item => {
            const price = item.coin ? snapshot.prices[`${item.kind}:${item.coin}`] : undefined;
            const quote = price != null && item.units != null ? price * item.units : null;
            const value = quote == null ? null : convert(quote, quoteCurrency(item), snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD', snapshot.fx);
            return { item, quote: price ?? null, value };
        }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).slice(0, 5);
    }, [snapshot, marketOnly]);
    const historyItems = useMemo(() => assetItem ? [assetItem] : marketOnly ? shownPositions.map(row => row.item) : snapshot?.portfolio.investments ?? [], [assetItem, marketOnly, shownPositions, snapshot?.portfolio.investments]);
    const { histories, loading: historiesLoading, limited } = useAssetHistories(historyItems, !!snapshot);
    const summary = useMemo(() => snapshot && !asset && !marketOnly ? summarize(snapshot, histories, !historiesLoading, limited) : null, [snapshot, histories, historiesLoading, limited, asset, marketOnly]);
    const assetPoints = assetItem && asset ? histories[`${asset.kind}:${asset.id}`] ?? [] : [];
    const assetChart = assetQuote != null && assetPoints.length ? [...assetPoints, { time: snapshot?.updatedAt ?? Date.now(), price: assetQuote }] : assetPoints;
    const change = assetItem && assetQuote != null ? dailyChange(assetItem, assetQuote, assetPoints) : null;

    return <WidgetFrame title={title} eyebrow={eyebrow} updatedAt={snapshot?.updatedAt ?? null} refreshing={refreshing} error={error || snapshot?.error || ''} onRefresh={() => void refresh()}>
        {authRequired ? <div className="widget-status"><span className="widget-status-mark" aria-hidden="true">!</span><p>Iniciá sesión en Activos para ver los datos de tu cuenta. Volvé a actualizar después de ingresar.</p></div> : null}
        {!snapshot && !authRequired ? <WidgetStatus loading={refreshing} message="Todavía no hay datos para mostrar." /> : null}
        {asset && snapshot && assetQuote != null && <section className="widget-asset-card">
            <p className="widget-asset-kind">{asset.kind === 'crypto' ? 'Criptomoneda' : asset.kind === 'cedear' ? 'CEDEAR' : asset.kind === 'stock' ? 'Acción · USD' : asset.kind === 'arg-stock' ? 'Acción argentina' : asset.kind === 'bond' ? 'Bono' : asset.kind === 'fund' ? 'Fondo común' : 'Morpho'}</p>
            <strong className="widget-asset-price">{money(assetQuote, quoteCurrency(assetItem!))}</strong>
            <QuoteChange value={change} />
            <Sparkline points={assetChart} positive={change == null || change >= 0} />
            <div className="widget-asset-holding"><div><span>Tenés</span><strong>{assetUnits > 0 ? `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 8 }).format(assetUnits)} unidades` : 'Sin posición en cartera'}</strong></div>{assetUnits > 0 && <><div><span>Valor actual</span><strong>{money(assetValue, assetDisplay)}</strong></div><div className={`widget-pnl ${assetGain == null ? '' : assetGain >= 0 ? 'is-up' : 'is-down'}`}><span>Ganancia / pérdida</span><strong>{assetGain == null ? 'Costo no disponible' : `${money(assetGain, assetDisplay)} · ${percent(assetCost && assetCost > 0 ? assetGain / assetCost * 100 : null)}`}</strong></div></>}</div>
            {assetPoints.length < 2 && <p className="widget-muted">El proveedor no ofrece historial suficiente para el gráfico.</p>}
        </section>}
        {asset && snapshot && assetQuote == null && <WidgetStatus loading={refreshing} message="El proveedor no informó una cotización para este activo." />}
        {summary && snapshot && <>
            <section className="widget-total-card"><p>Patrimonio total <span>{summary.missing ? '· parcial' : ''}</span></p><strong>{money(summary.value, snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD')}</strong><div className="widget-metrics"><div><span>Variación del día</span><QuoteChange value={summary.dailyPercent} /><small>{summary.dailyValue == null ? '—' : money(summary.dailyValue, snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD')}</small></div><div><span>Ganancia / pérdida</span><strong className={`widget-total-gain ${summary.gain == null ? '' : summary.gain >= 0 ? 'is-up' : 'is-down'}`}>{money(summary.gain, snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD')}</strong><small>{percent(summary.performance)} rendimiento</small></div></div>
                {summary.value == null && <p className="widget-muted">Faltan cotizaciones para calcular el patrimonio completo.</p>}
                {summary.dailyPercent == null && <p className="widget-muted">Variación diaria no disponible para todos los activos.</p>}
            </section>
            <div className="widget-section-heading"><h2>Principales activos</h2><span>{summary.positions.length}</span></div>
            <div className="widget-position-list">{summary.positions.sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).map(position => <PositionRow key={position.item.id} item={position.item} value={position.value} quote={position.item.kind !== 'rate' && position.item.coin ? snapshot.prices[`${position.item.kind}:${position.item.coin}`] ?? null : null} displayCurrency={snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD'} fx={snapshot.fx} points={histories[`${position.item.kind}:${position.item.coin}`] ?? []} />)}</div>
            {limited && <p className="widget-muted">La variación diaria se oculta en carteras con más de {HISTORY_LIMIT} activos para evitar consultas innecesarias.</p>}
        </>}
        {marketOnly && snapshot && <div className="widget-market-list">{shownPositions.length ? shownPositions.map(({ item, quote, value }) => <PositionRow key={item.id} item={item} value={value} quote={quote} displayCurrency={snapshot.portfolio.preferences.display === 'ARS' ? 'ARS' : 'USD'} fx={snapshot.fx} points={histories[`${item.kind}:${item.coin}`] ?? []} />) : <WidgetStatus loading={refreshing} message="Agregá activos a tu cartera para armar el seguimiento de mercado." />}</div>}
        {marketOnly && snapshot?.portfolio.investments.some(item => item.kind === 'rate') && <p className="widget-muted">Las posiciones de tasa fija se incluyen en el patrimonio, sin cotización de mercado.</p>}
    </WidgetFrame>;
}

function PositionRow({ item, value, quote, displayCurrency, fx, points }: { item: Investment; value: number | null; quote: number | null; displayCurrency: Currency; fx: number | null; points: HistoryPoint[] }) {
    const change = item.kind === 'rate' ? (() => { const now = Date.now(); const current = valueAt(item, now, now); const previous = valueAt(item, now - DAY, now); return current != null && previous != null && previous > 0 ? (current / previous - 1) * 100 : null; })() : quote != null ? dailyChange(item, quote, points) : null;
    const currency = item.kind === 'cedear' || item.kind === 'arg-stock' || item.kind === 'bond' || item.kind === 'fund' ? 'ARS' : 'USD';
    const basis = item.costUnknown || Date.parse(`${item.date}T00:00:00Z`) > Date.now() ? null : convert(item.amount, item.currency, displayCurrency, fx);
    const gain = value != null && basis != null ? value - basis : null;
    const quantity = item.kind === 'rate' ? `${item.rate}% ${item.period === 'year' ? 'anual' : 'mensual'}` : `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 8 }).format(item.units ?? 0)} unidades`;
    const chartPoints = quote != null && points.length ? [...points, { time: Date.now(), price: quote }] : points;
    return <article className="widget-position-row"><div className="widget-position-icon" aria-hidden="true">{(item.coin ?? item.kind).replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase()}</div><div className="widget-position-name"><strong>{item.name}</strong><span>{item.coin ?? quantity}</span></div><Sparkline points={chartPoints} positive={change == null || change >= 0} /><div className="widget-position-price"><strong>{money(value, displayCurrency)}</strong><span>{item.kind === 'rate' ? quantity : `${quantity} · ${quote == null ? 'Precio —' : money(quote, currency)}`}</span><span className={`widget-pnl ${gain == null ? '' : gain >= 0 ? 'is-up' : 'is-down'}`}>{gain == null ? item.costUnknown ? 'Costo desconocido' : percent(change) : `${money(gain, displayCurrency)} · ${percent(basis && basis > 0 ? gain / basis * 100 : null)}`}</span></div></article>;
}

export default function Widgets() {
    const params = new URLSearchParams(window.location.search);
    const widget = params.get('widget') as WidgetKind | null;
    const kind = params.get('kind');
    const id = params.get('id');
    const asset = widget === 'asset' && validKind(kind) && id && id.length <= 150 ? { kind, id } : null;
    if (widget === 'dollar') return <DollarWidget />;
    if (widget === 'asset' && !asset) return <main className="app widget-app" data-theme="dark"><section className="widget-shell"><p className="widget-warning">No se reconoció el activo solicitado.</p></section></main>;
    return <PortfolioWidget key={`${widget}:${asset?.kind ?? ''}:${asset?.id ?? ''}`} marketOnly={widget === 'market'} asset={asset} />;
}
