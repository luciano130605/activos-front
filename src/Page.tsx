import { createPasskey, passkeyStatus, preparePasskey, supportsPasskeys, type RegistrationOptions } from './passkeys';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { coinPriceOn, coinPricesNow, usdcArsNow } from './coingecko';
import { cedearPriceOn, cedearPricesNow } from './cedears';
import AssetSearchDialog, { type AssetKind, type PickedAsset } from './AssetSearchDialog';
import ContextMenu, { type MenuItem } from './ContextMenu';
import { INDEXES, indexName, isIndexTicker } from './assets';
import Distribution from './Distribution';
import MacroDashboard from './MacroDashboard';
import ContributionStreak from './ContributionStreak';
import Benchmarks from './Benchmarks';
import Dividends from './Dividends';
import Inflation from './Inflation';
import AssetPerformance from './AssetPerformance';
import PanelEditor from './PanelEditor';
import TopBar from './TopBar';
import Select from './Select';
import QuoteSource from './QuoteSource';
import { pages, usePage } from './navigation';
import { cleanInvestment, cleanSale, readLegacyPortfolio, type Currency, type Investment, type Kind, type Period, type Sale } from './portfolio';
import { request, type Account, type Snapshot } from './account';
import { usePortfolio } from './usePortfolio';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowReloadHorizontalIcon, Bitcoin, ChartDecreaseIcon, ChartIncreaseIcon, ChartLineIcon, CoinsBitcoinIcon, Copy01Icon, Copy02Icon, CopyPlusIcon, Delete02Icon, Edit01Icon, Edit02Icon, Estimate01Icon, LandmarkFreeIcons, LinkSquare02Icon, LoaderIcon, MoreHorizontalIcon, PlusIcon, Refresh04Icon, Search01Icon, XIcon } from '@hugeicons/core-free-icons';
type Filter = 'all' | Kind | 'index';
type AssetQuote = { id: string; date: string; kind: 'crypto' | 'cedear' } & ({ status: 'loading' } | { status: 'ready'; price: number; sourceDate?: string } | { status: 'error'; message: string });
type DollarRate = { nombre: string; compra: number | null; venta: number };
type Rates = Record<string, DollarRate>;
const MASK = '****';
const MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;
const kinds: { id: Filter; label: string; color: string }[] = [
    { id: 'all', label: 'Todas las inversiones', color: 'var(--muted)' },
    { id: 'rate', label: 'Con tasa', color: 'var(--c-rate)' },
    { id: 'cedear', label: 'CEDEARs', color: 'var(--c-cedear)' },
    { id: 'index', label: 'Índices', color: 'var(--c-index)' },
    { id: 'crypto', label: 'Criptomonedas', color: 'var(--c-crypto)' },
];
// Nombres de los tipos de dólar que devuelve dolarapi.com (campo "casa")
const dollarLabels: Record<string, string> = { bolsa: 'MEP', contadoconliqui: 'CCL', blue: 'Blue', oficial: 'Oficial', mayorista: 'Mayorista', cripto: 'Cripto', tarjeta: 'Tarjeta' };
// Dólares que se comparan contra USDC (la referencia de conversión de la app)
const compareOrder = ['oficial', 'bolsa', 'contadoconliqui', 'blue'];
type Usdc = { price: number; source: 'coingecko' | 'mep' };
const titleFor = (kind: Kind) => kind === 'rate' ? 'Con tasa' : kind === 'cedear' ? 'CEDEAR' : 'Cripto';
const categoryOf = (investment: Investment): Exclude<Filter, 'all'> => investment.kind === 'cedear' && isIndexTicker(investment.coin) ? 'index' : investment.kind;
const localISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateMillis = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
const money = (n: number, c: Currency) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const percent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
const chartDate = (time: number) => new Date(time).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' });
const monthlyRate = (i: Investment) => { const r = (i.rate ?? 0) / 100; return i.period === 'month' ? r : r > -1 ? Math.pow(1 + r, 1 / 12) - 1 : -1; };
function valueAt(i: Investment, t: number, prices: Record<string, number>, now: number, officialRate?: number) {
    const start = dateMillis(i.date);
    if (t < start) return 0;
    if (i.kind === 'rate') return i.amount * Math.pow(1 + monthlyRate(i), (t - start) / MONTH_MS);
    const price = i.coin ? prices[`${i.kind}:${i.coin}`] : undefined;
    const quoteCurrency = i.kind === 'cedear' ? 'ARS' : 'USD';
    const quotedValue = i.units != null && price != null ? i.units * price : null;
    const current = quotedValue == null ? i.amount : quoteCurrency === i.currency ? quotedValue : !officialRate ? NaN : i.currency === 'ARS' ? quotedValue * officialRate : quotedValue / officialRate;
    if (t >= now) return current; // Sin inventar un pronóstico de mercado.
    if (now <= start) return current;
    const k = Math.max(0, Math.min(1, (t - start) / (now - start)));
    return i.amount + (current - i.amount) * k; // Aproximación visual, no historial real.
}
// Todas las cotizaciones del dólar en una sola consulta (dolarapi.com)
async function dollarsNow(): Promise<Rates> {
    const res = await fetch('https://dolarapi.com/v1/dolares');
    if (!res.ok) throw new Error('No se pudieron consultar las cotizaciones del dólar.');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Respuesta inesperada de dolarapi.com.');
    const out: Rates = {};
    for (const d of data) {
        if (d && typeof d.casa === 'string' && typeof d.venta === 'number' && d.venta > 0) {
            out[d.casa] = { nombre: dollarLabels[d.casa] ?? String(d.nombre ?? d.casa), compra: typeof d.compra === 'number' && d.compra > 0 ? d.compra : null, venta: d.venta };
        }
    }
    return out;
}
const field = 'w-full min-w-0 rounded-[10px] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--muted)]';
const label = 'mb-1.5 block text-[12px] text-[var(--muted)]';
const panel = 'rounded-[20px] border border-[var(--line)] bg-[var(--surface)]';

export default function Page({ account, onLogout }: { account: Account; onLogout: () => void }) {
    const { sync, view, preference, items, setItems } = usePortfolio(account);
    const [leaving, setLeaving] = useState(false);
    const [legacy, setLegacy] = useState(() => {
        try {
            if (localStorage.getItem('inversiones:migrated-to')) return null;
            const data = readLegacyPortfolio(localStorage);
            return data.investments.length ? data : null;
        } catch { return null; }
    });
    const [passkeyCount, setPasskeyCount] = useState<number | null>(null);
    const [passkeyDialog, setPasskeyDialog] = useState(false);
    const [passkeyOptions, setPasskeyOptions] = useState<RegistrationOptions | null>(null);
    const [passkeyMessage, setPasskeyMessage] = useState('');
    const [passkeyBusy, setPasskeyBusy] = useState(false);
    useEffect(() => { void passkeyStatus().then(result => setPasskeyCount(result.count)).catch(() => setPasskeyCount(null)); }, []);
    async function preparePasskeyDialog() {
        setPasskeyDialog(true); setPasskeyOptions(null); setPasskeyMessage('');
        if (!supportsPasskeys()) { setPasskeyMessage('Este dispositivo o navegador no admite passkeys. Abrí la app en Safari con HTTPS.'); return; }
        setPasskeyBusy(true);
        try { setPasskeyOptions(await preparePasskey()); }
        catch (error) { setPasskeyMessage(error instanceof Error ? error.message : 'No se pudo preparar la passkey.'); }
        finally { setPasskeyBusy(false); }
    }
    async function enablePasskey() {
        if (!passkeyOptions || passkeyBusy) return;
        setPasskeyBusy(true); setPasskeyMessage('');
        try {
            await createPasskey(passkeyOptions);
            setPasskeyOptions(null);
            setPasskeyCount(count => count === null ? 1 : count + 1);
            void passkeyStatus().then(result => setPasskeyCount(result.count)).catch(() => { });
            setPasskeyMessage('Passkey activada. Ya podés usarla para ingresar.');
        } catch (error) {
            setPasskeyOptions(null);
            const name = error instanceof Error ? error.name : '';
            setPasskeyMessage(name === 'NotAllowedError' ? 'La operación se canceló o venció. Volvé a intentar.' : name === 'InvalidStateError' ? 'Esta passkey ya está registrada en este dispositivo.' : error instanceof Error && error.message ? error.message : 'No se pudo activar la passkey. Volvé a intentar.');
        } finally { setPasskeyBusy(false); }
    }
    const page = usePage();
    const pageInfo = pages[page];
    const titleRef = useRef<HTMLHeadingElement>(null);
    const previousPage = useRef(page);
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [display, setDisplay] = preference('display');
    const [range, setRange] = useState<'7d' | '1m' | '6m' | '1a' | 'todo'>('1a');
    const [chartIndex, setChartIndex] = useState<number | null>(null);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [rates, setRates] = useState<Rates>({});
    const [usdc, setUsdc] = useState<Usdc | null>(null);
    const [hidden, setHidden] = preference('hidden');
    const [updated, setUpdated] = useState<string>('');
    const [priceError, setPriceError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [theme, setTheme] = preference('theme');
    const [modal, setModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [assetSearch, setAssetSearch] = useState<AssetKind | null>(null);
    const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null);
    const closeCtx = useCallback(() => setCtx(null), []);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [importPreview, setImportPreview] = useState<{ items: Investment[]; sales: Sale[]; skipped: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(localISO());
    const [kind, setKind] = useState<Kind>('rate');
    const [indexMode, setIndexMode] = useState(false);
    const [rate, setRate] = useState('');
    const [period, setPeriod] = useState<Period>('year');
    const [coin, setCoin] = useState('bitcoin');
    const [assetQuote, setAssetQuote] = useState<AssetQuote | null>(null);
    const [quoteRequest, setQuoteRequest] = useState(0);
    const [currency, setCurrency] = useState<Currency>('USD');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [sellId, setSellId] = useState<string | null>(null);
    const [sellPercent, setSellPercent] = useState('100');
    const [sellInputMode, setSellInputMode] = useState<'percent' | 'amount'>('percent');
    const [sellInputAmount, setSellInputAmount] = useState('');
    const [sellCurrency, setSellCurrency] = useState<Currency>('ARS');
    const [sellError, setSellError] = useState('');
    const [panelEditor, setPanelEditor] = useState(false);
    const closePanelEditor = useCallback(() => setPanelEditor(false), []);
    const [panels, setPanels] = preference('panels');
    const visiblePanels = panels ? (panels.includes('panel-v2') ? panels.filter(id => id !== 'panel-v2') : [...panels.filter(id => id !== 'inflation'), ...(panels.includes('value') ? ['macro', 'streak'] : [])]) : ['value', 'macro', 'streak', 'evolution', 'distribution', 'investments'];
    const today = Date.now();
    const fxRate = usdc?.price; // 1 USDC en pesos: referencia única de conversión
    const fxSource = usdc?.source === 'mep' ? 'DolarAPI · MEP (CoinGecko no respondió)' : 'CoinGecko · USDC/ARS';
    const cryptos = useMemo(() => [...new Set(items.filter(i => i.kind === 'crypto' && i.coin).map(i => i.coin!))], [items]);
    const cedears = useMemo(() => [...new Set(items.filter(i => i.kind === 'cedear' && i.coin).map(i => i.coin!))], [items]);
    const assetId = kind === 'cedear' ? coin.trim().toUpperCase() : coin.trim().toLowerCase();
    const quoteSource = kind === 'cedear' ? 'Data912' : 'CoinGecko';
    const todayDate = localISO();
    const activeQuote = modal && kind !== 'rate' && assetQuote?.id === assetId && assetQuote.date === todayDate && assetQuote.kind === kind ? assetQuote : null;
    const quotePrice = activeQuote?.status === 'ready' ? activeQuote.price : undefined;
    const officialRate = fxRate;
    const quoteCurrency: Currency = kind === 'cedear' ? 'ARS' : 'USD';
    const convertedAmount = currency === quoteCurrency ? Number(amount) : !fxRate ? NaN : currency === 'USD' ? Number(amount) * fxRate : Number(amount) / fxRate;
    const previewUnits = quotePrice && Number.isFinite(convertedAmount) && convertedAmount > 0 ? convertedAmount / quotePrice : undefined;
    useEffect(() => {
        if (!modal || kind === 'rate' || !assetId) {
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setAssetQuote({ id: assetId, date: todayDate, kind, status: 'loading' });
            try {
                const quote = kind === 'crypto' ? { price: await coinPriceOn(assetId, todayDate, todayDate, controller.signal) } : await cedearPriceOn(assetId, todayDate, todayDate, controller.signal);
                if (!controller.signal.aborted) setAssetQuote({ id: assetId, date: todayDate, kind, status: 'ready', ...quote });
            } catch (error) {
                if (!controller.signal.aborted) setAssetQuote({ id: assetId, date: todayDate, kind, status: 'error', message: error instanceof Error ? error.message : 'No se pudo consultar el precio. Volvé a intentar.' });
            }
        }, 600);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [modal, kind, assetId, todayDate, quoteRequest]);
    useEffect(() => {
        document.title = `${pageInfo.label} · Inversiones`;
        if (previousPage.current !== page) {
            window.scrollTo({ top: 0, behavior: 'instant' });
            titleRef.current?.focus({ preventScroll: true });
            previousPage.current = page;
        }
    }, [page, pageInfo.label]);
    const refresh = useCallback(async () => {
        setRefreshing(true); setPriceError(false);
        const results = await Promise.allSettled([coinPricesNow(cryptos), cedearPricesNow(cedears), dollarsNow(), usdcArsNow()]);
        const [cryptoResult, cedearResult, dollarResult, usdcResult] = results;
        setPrices(prev => ({ ...prev, ...(cryptoResult.status === 'fulfilled' ? cryptoResult.value : {}), ...(cedearResult.status === 'fulfilled' ? cedearResult.value : {}) }));
        const gotDollars = dollarResult.status === 'fulfilled' && Object.keys(dollarResult.value).length > 0;
        if (dollarResult.status === 'fulfilled' && gotDollars) setRates(prev => ({ ...prev, ...dollarResult.value }));
        if (usdcResult.status === 'fulfilled') setUsdc({ price: usdcResult.value, source: 'coingecko' });
        else if (dollarResult.status === 'fulfilled' && dollarResult.value.bolsa) setUsdc({ price: dollarResult.value.bolsa.venta, source: 'mep' });
        setPriceError(results.some(r => r.status === 'rejected') || (dollarResult.status === 'fulfilled' && !gotDollars));
        setUpdated(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
        setRefreshing(false);
    }, [cryptos, cedears]);
    useEffect(() => { void refresh(); }, [refresh]);
    const fx = (v: number, from: Currency) => from === display ? v : !fxRate ? NaN : display === 'USD' ? v / fxRate : v * fxRate;
    // Con "ocultar montos" activo, todo importe se muestra como ****
    const fmt = (v: number) => hidden ? MASK : Number.isFinite(v) ? money(v, display) : '—';
    const mny = (n: number, c: Currency) => hidden ? MASK : Number.isFinite(n) ? money(n, c) : '—';
    const invested = items.reduce((s, i) => s + (dateMillis(i.date) <= today ? fx(i.amount, i.currency) : 0), 0);
    const current = items.reduce((s, i) => s + fx(valueAt(i, today, prices, today, officialRate), i.currency), 0);
    const gain = current - invested;
    const gainPct = invested > 0 ? gain / invested * 100 : 0;
    const filtered = items.filter(i => (filter === 'all' || categoryOf(i) === filter) && `${i.name} ${i.coin ?? ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
    const allCount = (kind: Filter) => kind === 'all' ? items.length : items.filter(i => categoryOf(i) === kind).length;
    const colorOf = (k: Filter) => kinds.find(v => v.id === k)!.color;
    const valueOf = (list: Investment[]) => list.reduce((s, i) => s + fx(valueAt(i, today, prices, today, officialRate), i.currency), 0);
    const byKind = (['rate', 'cedear', 'index', 'crypto'] as const).map(k => { const list = items.filter(i => categoryOf(i) === k); return { label: kinds.find(v => v.id === k)!.label, color: colorOf(k), value: valueOf(list), count: list.length }; });
    const byCurrency = [
        { label: 'Dólares (USD)', color: 'var(--sig)', value: valueOf(items.filter(i => i.currency === 'USD')), count: items.filter(i => i.currency === 'USD').length },
        { label: 'Pesos (ARS)', color: 'var(--c-rate)', value: valueOf(items.filter(i => i.currency === 'ARS')), count: items.filter(i => i.currency === 'ARS').length },
    ];
    const palette = ['#a8d5ba', '#e7b77d', '#91b5e8', '#d49cba', '#c6b5e4', '#e1d38d', '#80c7c1', '#e49e8c'];
    // Datos del emisor del CEDEAR; los ETF no se atribuyen a un solo sector o país.
    const classifications: Record<string, [string, string]> = {
        AAPL: ['Tecnología', 'Estados Unidos'], MSFT: ['Tecnología', 'Estados Unidos'], NVDA: ['Tecnología', 'Estados Unidos'], AMD: ['Tecnología', 'Estados Unidos'], INTC: ['Tecnología', 'Estados Unidos'], ORCL: ['Tecnología', 'Estados Unidos'], AVGO: ['Tecnología', 'Estados Unidos'], CRM: ['Tecnología', 'Estados Unidos'], ADBE: ['Tecnología', 'Estados Unidos'],
        GOOGL: ['Comunicación', 'Estados Unidos'], META: ['Comunicación', 'Estados Unidos'], DIS: ['Comunicación', 'Estados Unidos'], NFLX: ['Comunicación', 'Estados Unidos'], T: ['Comunicación', 'Estados Unidos'], VZ: ['Comunicación', 'Estados Unidos'],
        AMZN: ['Consumo discrecional', 'Estados Unidos'], TSLA: ['Consumo discrecional', 'Estados Unidos'], MCD: ['Consumo discrecional', 'Estados Unidos'], NKE: ['Consumo discrecional', 'Estados Unidos'], UBER: ['Industriales', 'Estados Unidos'],
        KO: ['Consumo básico', 'Estados Unidos'], PEP: ['Consumo básico', 'Estados Unidos'], WMT: ['Consumo básico', 'Estados Unidos'], COST: ['Consumo básico', 'Estados Unidos'],
        JPM: ['Finanzas', 'Estados Unidos'], BAC: ['Finanzas', 'Estados Unidos'], V: ['Finanzas', 'Estados Unidos'], MA: ['Finanzas', 'Estados Unidos'], PYPL: ['Finanzas', 'Estados Unidos'], COIN: ['Finanzas', 'Estados Unidos'], BRKB: ['Finanzas', 'Estados Unidos'],
        XOM: ['Energía', 'Estados Unidos'], CVX: ['Energía', 'Estados Unidos'], PFE: ['Salud', 'Estados Unidos'], JNJ: ['Salud', 'Estados Unidos'], BA: ['Industriales', 'Estados Unidos'], MSTR: ['Tecnología', 'Estados Unidos'],
        MELI: ['Consumo discrecional', 'Uruguay'], SHOP: ['Tecnología', 'Canadá'], SPOT: ['Comunicación', 'Luxemburgo'], TSM: ['Tecnología', 'Taiwán'], ASML: ['Tecnología', 'Países Bajos'], SAP: ['Tecnología', 'Alemania'], BABA: ['Consumo discrecional', 'China'], VALE: ['Materiales', 'Brasil'], PBR: ['Energía', 'Brasil'], ITUB: ['Finanzas', 'Brasil'], ITUB1: ['Finanzas', 'Brasil'], GOLD: ['Materiales', 'Canadá'], NEM: ['Materiales', 'Estados Unidos'],
        YPF: ['Energía', 'Argentina'], GGAL: ['Finanzas', 'Argentina'], BMA: ['Finanzas', 'Argentina'], PAM: ['Servicios públicos', 'Argentina'], TEO: ['Comunicación', 'Argentina'], VIST: ['Energía', 'México'],
        SPY: ['Diversificado', 'Estados Unidos'], QQQ: ['Diversificado', 'Estados Unidos'], DIA: ['Diversificado', 'Estados Unidos'], IWM: ['Diversificado', 'Estados Unidos'], EEM: ['Diversificado', 'Mercados emergentes'], EWZ: ['Diversificado', 'Brasil'], VEA: ['Diversificado', 'Mercados desarrollados'], ARKK: ['Diversificado', 'Diversificado'], IBIT: ['Criptoactivos', 'Sin clasificar'], XLE: ['Energía', 'Estados Unidos'], XLF: ['Finanzas', 'Estados Unidos'], XLK: ['Tecnología', 'Estados Unidos'], XLV: ['Salud', 'Estados Unidos'],
    };
    const groupDistribution = (key: (i: Investment) => string) => {
        const groups = new Map<string, Investment[]>();
        items.forEach(i => { const label = key(i); groups.set(label, [...(groups.get(label) ?? []), i]); });
        return [...groups].map(([label, list], index) => ({ label, color: palette[index % palette.length], value: valueOf(list), count: list.length }));
    };
    const byAsset = groupDistribution(i => i.kind === 'rate' ? i.name : `${i.kind === 'cedear' ? 'CEDEAR' : 'Cripto'} · ${i.coin}`);
    const bySector = groupDistribution(i => i.kind === 'crypto' ? 'Criptomonedas' : i.kind === 'cedear' ? classifications[i.coin ?? '']?.[0] ?? 'Sin clasificar' : 'Sin clasificar');
    const byCountry = groupDistribution(i => i.kind === 'crypto' ? 'Sin país asociado' : i.kind === 'cedear' ? classifications[i.coin ?? '']?.[1] ?? 'Sin clasificar' : 'Sin clasificar');
    const chart = useMemo(() => {
        if (!items.length || !Number.isFinite(current) || !fxRate && items.some(i => i.currency !== display)) return null;
        const earliest = Math.min(today, ...items.map(i => dateMillis(i.date)));
        const days = { '7d': 7, '1m': 30, '6m': 182, '1a': 365 };
        const start = range === 'todo' ? Math.min(earliest, today - 86400000) : today - days[range] * 86400000;
        const end = today;
        const len = 72, w = 850, h = 230, pad = 12;
        const samples = Array.from({ length: len + 1 }, (_, idx) => { const t = start + (end - start) * idx / len; return { t, value: items.reduce((s, i) => s + fx(valueAt(i, t, prices, today, officialRate), i.currency), 0) }; });
        const max = Math.max(1, ...samples.map(s => s.value)) * 1.12;
        const px = (t: number) => pad + (t - start) / (end - start || 1) * (w - 2 * pad);
        const py = (v: number) => h - pad - v / max * (h - 2 * pad);
        const line = samples.map((s, i) => `${i ? 'L' : 'M'} ${px(s.t).toFixed(1)} ${py(s.value).toFixed(1)}`).join(' ');
        const baseline = h - pad;
        const area = `${line} L ${px(end)} ${baseline} L ${px(start)} ${baseline} Z`;
        const nowX = Math.min(w - pad, px(today));
        return { w, h, line, area, nowX, nowY: py(current), first: chartDate(start), points: samples.map(sample => ({ ...sample, x: px(sample.t), y: py(sample.value) })) };
    }, [items, prices, range, display, fxRate, officialRate, today, current]);
    const benchmarkDate = new Date(today);
    benchmarkDate.setFullYear(benchmarkDate.getFullYear() - 1);
    const benchmarkStart = benchmarkDate.getTime();
    const benchmarkItems = items;
    const benchmarkValue = (t: number) => benchmarkItems.reduce((sum, i) => {
        const purchaseTime = dateMillis(i.date);
        const v = t < purchaseTime
            ? i.kind === 'rate' ? i.amount * Math.pow(1 + monthlyRate(i), (t - purchaseTime) / MONTH_MS) : i.amount
            : valueAt(i, t, prices, today, fxRate);
        return sum + (i.currency === 'ARS' ? v : v * (fxRate ?? NaN));
    }, 0);
    const chartPoint = chartIndex == null ? null : chart?.points[chartIndex] ?? null;
    const pickKind = (k: Kind) => { if (k === kind && !indexMode) return; setIndexMode(false); setKind(k); setCoin(k === 'cedear' ? 'AAPL' : 'bitcoin'); setAssetQuote(null); setError(''); };
    function openModal() {
        setError(''); setEditingId(null); setName(''); setAmount(''); setRate(''); setDate(localISO());
        setIndexMode(false); setAssetQuote(null); setModal(true);
    }
    function openEdit(i: Investment) {
        setError(''); setEditingId(i.id); setIndexMode(i.kind === 'cedear' && isIndexTicker(i.coin)); setKind(i.kind); setName(i.name); setAmount(String(i.amount)); setDate(i.date);
        setCurrency(i.currency); setRate(i.rate != null ? String(i.rate) : ''); setPeriod(i.period ?? 'year');
        setCoin(i.coin ?? (i.kind === 'cedear' ? 'AAPL' : 'bitcoin'));
        setAssetQuote(null); setQuoteRequest(v => v + 1); setModal(true);
    }
    function closeModal() { setModal(false); setEditingId(null); }
    function selectAsset(asset: PickedAsset) {
        const isIndex = asset.kind === 'index';
        setIndexMode(isIndex); setKind(asset.kind === 'crypto' ? 'crypto' : 'cedear'); setCoin(asset.id); setName(asset.name.slice(0, 70));
        setAssetQuote(null); setQuoteRequest(value => value + 1); setError(''); setAssetSearch(null); setModal(true);
    }
    function duplicate(i: Investment) { setItems(prev => [...prev, { ...i, id: crypto.randomUUID(), name: `${i.name} (copia)`.slice(0, 70) }]); setNotice('Inversión duplicada.'); }
    function add(e: FormEvent<HTMLFormElement>) {
        e.preventDefault(); setError('');
        const value = Number(amount); const todayDate = localISO();
        if (!name.trim() || !Number.isFinite(value) || value <= 0) return setError('Ingresá un nombre y un monto válido mayor a cero.');
        if (!date || date > todayDate || !Number.isFinite(dateMillis(date))) return setError('Ingresá una fecha válida que no sea futura.');
        const cur: Currency = currency;
        const investment: Investment = { id: editingId ?? crypto.randomUUID(), name: name.trim(), amount: value, currency: cur, date, kind };
        if (kind === 'rate') {
            const r = Number(rate);
            if (!rate.trim() || !Number.isFinite(r) || r <= -100) return setError('Ingresá una tasa válida superior a -100%.');
            investment.rate = r; investment.period = period;
        } else {
            const id = kind === 'cedear' ? coin.trim().toUpperCase() : coin.trim().toLowerCase();
            if (!id) return setError('Ingresá el ticker o identificador del activo.');
            const original = editingId ? items.find(item => item.id === editingId) : undefined;
            const unchangedPosition = original && original.kind === kind && original.coin === id && original.amount === value && original.currency === currency && original.date === date;
            if (!unchangedPosition && (!quotePrice || !Number.isFinite(quotePrice) || quotePrice <= 0)) return setError('Esperá a que se consulte la cotización actual.');
            if (!unchangedPosition && currency !== quoteCurrency && !fxRate) return setError('No está disponible la cotización de USDC para convertir el monto.');
            investment.coin = id; investment.units = unchangedPosition ? original.units : convertedAmount / quotePrice!;
            if (investment.units == null || !Number.isFinite(investment.units) || investment.units <= 0) return setError('El monto es demasiado grande o pequeño para calcular las unidades.');
            if (activeQuote?.status === 'ready') setPrices(prev => ({ ...prev, [`${kind}:${id}`]: activeQuote.price }));
        }
        setItems(prev => editingId ? prev.map(x => x.id === editingId ? investment : x) : [...prev, investment]);
        setNotice(editingId ? 'Inversión actualizada.' : '');
        setName(''); setAmount(''); setRate(''); setModal(false); setEditingId(null);
    }
    async function exportJSON() {
        const data = {
            version: 2,
            exportedAt: new Date().toISOString(),
            investments: items,
            sales: view.portfolio.sales ?? [],
            preferences: view.portfolio.preferences,
        };

        const file = new File(
            [JSON.stringify(data, null, 2)],
            `inversiones-${localISO()}.json`,
            { type: "application/json" }
        );

        // Compartir archivo mediante el menú nativo
        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "Mis inversiones",
                    text: "Exportación de inversiones",
                });

                return;
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    return;
                }

                console.error("Error al compartir:", error);
            }
        }

        // Alternativa: descargar el JSON
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");

        a.href = url;
        a.download = file.name;
        a.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = ''; // permite volver a elegir el mismo archivo
        if (!file) return;
        try {
            if (file.size > 2_000_000) throw new Error('size');
            const data = JSON.parse(await file.text());
            const list = Array.isArray(data) ? data : data?.investments;
            if (!Array.isArray(list)) throw new Error('format');
            const seen = new Set<string>(); const valid: Investment[] = [];
            for (const raw of list.slice(0, 5000)) {
                const inv = cleanInvestment(raw);
                if (inv && !seen.has(inv.id)) { seen.add(inv.id); valid.push(inv); }
            }
            const sales: Sale[] = [];
            const saleIds = new Set<string>();
            if (Array.isArray(data?.sales)) for (const raw of data.sales.slice(0, 10000)) {
                const sale = cleanSale(raw);
                if (sale && !saleIds.has(sale.id)) { saleIds.add(sale.id); sales.push(sale); }
            }
            if (!valid.length && !sales.length) { setNotice('El archivo no contiene inversiones ni ventas válidas.'); return; }
            setImportPreview({ items: valid, sales, skipped: list.length - valid.length + (Array.isArray(data?.sales) ? data.sales.length - sales.length : 0) });
        } catch {
            setNotice('No se pudo leer el archivo. Elegí un JSON exportado desde esta app (máx. 2 MB).');
        }
    }
    function applyImport(mode: 'merge' | 'replace') {
        if (!importPreview) return;
        const incoming = importPreview.items;
        if (mode === 'replace') {
            sync.update(current => ({ ...current, investments: incoming, sales: importPreview.sales }));
            setNotice(`Cartera reemplazada: ${incoming.length} inversiones importadas.`);
        } else {
            const ids = new Set(items.map(i => i.id));
            const fresh = incoming.filter(i => !ids.has(i.id));
            const dup = incoming.length - fresh.length;
            sync.update(current => {
                const saleIds = new Set((current.sales ?? []).map(sale => sale.id));
                return { ...current, investments: [...current.investments, ...fresh], sales: [...(current.sales ?? []), ...importPreview.sales.filter(sale => !saleIds.has(sale.id))] };
            });
            setNotice(`Se agregaron ${fresh.length} inversiones${dup ? ` (${dup} ya existían y se omitieron)` : ''}.`);
        }
        setImportPreview(null);
    }
    async function logout() {
        if (leaving) return;
        setLeaving(true);
        try {
            if (!await sync.flush()) return;
            await request('logout', 'POST', {});
            onLogout();
        } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.'); }
        finally { setLeaving(false); }
    }
    async function importLegacy() {
        if (!legacy) return;
        sync.update(current => {
            const ids = new Set(current.investments.map(item => item.id));
            return { ...current, investments: [...current.investments, ...legacy.investments.filter(item => !ids.has(item.id))], preferences: current.investments.length ? current.preferences : legacy.preferences };
        });
        if (await sync.flush()) {
            try { localStorage.setItem('inversiones:migrated-to', account.user.id); } catch { /* El respaldo original permanece disponible. */ }
            setLegacy(null);
            setNotice('Las inversiones de este navegador ya están guardadas en tu cuenta.');
        }
    }
    async function reloadPortfolio() {
        if (view.dirty && !window.confirm('Se van a descartar los cambios pendientes de esta pestaña y cargar la cartera guardada. Podés exportarlos antes de continuar. ¿Querés recargar?')) return;
        try { sync.reset(await request<Snapshot>('portfolio')); }
        catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo cargar tu cartera.'); }
    }
    const syncLabel = view.status === 'saved' ? 'Guardado en tu cuenta' : view.status === 'saving' ? 'Guardando…' : view.status === 'pending' ? 'Cambios pendientes' : 'Sin guardar';
    const goTo = (path: string) => { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };
    const cryptoSymbols: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', tether: 'USDT', 'usd-coin': 'USDC', ripple: 'XRP', binancecoin: 'BNB', dogecoin: 'DOGE', cardano: 'ADA' };
    const tickerOf = (i: Investment) => i.kind === 'rate' ? 'TASA' : i.kind === 'cedear' ? (i.coin ?? '').slice(0, 5) : (cryptoSymbols[i.coin ?? ''] ?? (i.coin ?? '').slice(0, 4).toUpperCase());
    const summaryOf = (i: Investment) => { const v = valueAt(i, today, prices, today, officialRate); return `${i.name} · ${titleFor(i.kind)} · invertido ${money(i.amount, i.currency)} · hoy ${Number.isFinite(v) ? money(v, i.currency) : '—'} (${percent(i.amount > 0 ? (v - i.amount) / i.amount * 100 : 0)})`; };
    const copySummary = async (i: Investment) => { try { await navigator.clipboard.writeText(summaryOf(i)); setNotice('Resumen copiado al portapapeles.'); } catch { setNotice('No se pudo copiar. Tu navegador bloqueó el portapapeles.'); } };
    const menuFor = (i: Investment): MenuItem[] => [
        { label: 'Registrar venta', icon: Estimate01Icon, onSelect: () => { setSellId(i.id); setSellPercent('100'); setSellInputMode('percent'); setSellInputAmount(''); setSellCurrency(i.currency); setSellError(''); } },
        { label: 'Editar', icon: Edit01Icon, onSelect: () => openEdit(i) },
        { label: 'Duplicar', icon: CopyPlusIcon, onSelect: () => duplicate(i) },
        { label: 'Copiar resumen', icon: Copy01Icon, onSelect: () => void copySummary(i) },
        ...(i.kind === 'crypto' && i.coin ? [{ label: 'Ver en CoinGecko', icon: LinkSquare02Icon, href: `https://www.coingecko.com/en/coins/${encodeURIComponent(i.coin)}` }] : []),
        ...(i.kind === 'cedear' && i.coin ? [{ label: 'Ver dividendos', icon: Estimate01Icon, onSelect: () => goTo('/dividendos') }, { label: 'Ver en Data912', icon: LinkSquare02Icon, href: `https://data912.com/historical/cedears/${encodeURIComponent(i.coin)}` }] : []),
        { sep: true },
        { label: 'Eliminar', icon: Delete02Icon, danger: true, onSelect: () => setConfirmDelete(i.id) },
    ] as MenuItem[];
    const sellItem = items.find(item => item.id === sellId);
    const sellValue = sellItem ? valueAt(sellItem, today, prices, today, officialRate) : NaN;
    const sellAvailable = !!sellItem && (sellItem.kind === 'rate' || !!(sellItem.coin && prices[`${sellItem.kind}:${sellItem.coin}`] != null)) && Number.isFinite(sellValue) && (sellItem.currency === sellCurrency || !!fxRate);
    const sellTotal = sellItem && sellAvailable ? (sellItem.currency === sellCurrency ? sellValue : sellCurrency === 'ARS' ? sellValue * fxRate! : sellValue / fxRate!) : NaN;
    const sellFraction = sellInputMode === 'percent' ? Number(sellPercent) / 100 : Number(sellInputAmount) / sellTotal;
    const sellAmount = sellInputMode === 'percent' ? sellTotal * sellFraction : Number(sellInputAmount);
    function registerSale() {
        if (!sellItem || !sellAvailable) return setSellError('No hay una cotización disponible para registrar la venta.');
        const fraction = sellFraction;
        if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1 || !Number.isFinite(sellAmount) || sellAmount <= 0) return setSellError(sellInputMode === 'percent' ? 'Ingresá un porcentaje mayor a 0 y hasta 100.' : 'Ingresá un importe mayor a 0 que no supere el valor total de la inversión.');
        const sale = { id: crypto.randomUUID(), name: sellItem.name, date: localISO(), fraction, proceeds: sellAmount, currency: sellCurrency, cost: sellItem.amount * fraction, costCurrency: sellItem.currency };
        sync.update(current => ({ ...current, sales: [...(current.sales ?? []), sale], investments: current.investments.flatMap(item => item.id !== sellItem.id ? [item] : fraction === 1 ? [] : [{ ...item, amount: item.amount * (1 - fraction), ...(item.units == null ? {} : { units: item.units * (1 - fraction) }) }]) }));
        setSellId(null); setNotice('Venta registrada. El importe no se suma como efectivo a la cartera.');
    }
    const ctxItem = ctx ? items.find(i => i.id === ctx.id) : undefined;
    const bigParts = (v: number) => {
        if (hidden) return { cur: '', int: MASK, dec: '' };
        if (!Number.isFinite(v)) return { cur: '', int: '—', dec: '' };
        const [int, dec] = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v).split(',');
        return { cur: display === 'USD' ? 'US$' : '$', int, dec: `,${dec}` };
    };
    const big = bigParts(current);
    const capShare = gain >= 0 ? (current > 0 ? invested / current : 1) : (invested > 0 ? current / invested : 1);
    const slicesForBar = byKind.filter(k => Number.isFinite(k.value) && k.value > 0);
    const slicesTotal = slicesForBar.reduce((s, k) => s + k.value, 0);
    const statusDot = view.status === 'saved' ? 'live' : 'live warn';
    const compare = compareOrder.filter(k => rates[k]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable], [role=dialog], [role=menu]')) return;
            event.preventDefault(); setAssetSearch('crypto');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    const locked = !!assetSearch || !!sellItem || panelEditor || leaving;
    const panelOrder = (id: string) => { const index = visiblePanels.indexOf(id); return index < 0 ? 99 : index; };
    return <div data-theme={theme} className="app min-h-dvh [&_input[type=date]]:[color-scheme:dark] data-[theme=light]:[&_input[type=date]]:[color-scheme:light]">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} aria-label="Importar archivo JSON" />
        <div inert={locked} className="mx-auto max-w-[1360px] px-4 pb-20 sm:px-8">
            <TopBar page={page} count={items.length} theme={theme} onTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} hidden={hidden} onHidden={() => setHidden(v => !v)}
                display={display} onDisplay={setDisplay} onSearch={() => setAssetSearch('crypto')} onExport={exportJSON} onImport={() => fileRef.current?.click()}
                email={account.user.email} syncLabel={syncLabel} onLogout={() => void logout()} leaving={leaving} onCustomize={() => setPanelEditor(true)} onPasskey={() => void preparePasskeyDialog()} passkeyCount={passkeyCount} />
            <div className="ticker" role="group" aria-label="Cotizaciones de referencia">
                <span title={`Fuente: ${fxSource}`}>USDC <b>{fxRate ? money(fxRate, 'ARS') : '—'}</b></span>
                {compare.map(k => <span key={k}>{dollarLabels[k]} <b>{money(rates[k].venta, 'ARS')}</b></span>)}
                <span role="status">{priceError ? 'Cotizaciones parciales' : updated ? `Actualizado ${updated}` : 'Consultando…'}</span>
                <span className="ml-auto"><span className={statusDot} aria-hidden="true" style={{ alignSelf: 'center' }} />{syncLabel}</span>
            </div>
            <main inert={false}>
                <header className="mb-5 mt-8 flex flex-wrap items-end justify-between gap-4">
                    <div><p className="lb mb-2">PANEL PERSONAL / {pageInfo.label.toUpperCase()}</p><h1 ref={titleRef} tabIndex={-1} className="text-[clamp(2.2rem,5vw,3.3rem)] font-light leading-none tracking-[-.045em] outline-none">{pageInfo.title}<span className="sig">.</span></h1><p className="mu mt-3">{pageInfo.description}</p></div>
                    <div className="flex items-center gap-2"><button type="button" onClick={() => setAssetSearch('crypto')} className="btn-ghost hidden sm:inline-flex"><HugeiconsIcon icon={Search01Icon} size={16} />Buscar activos</button><button type="button" onClick={openModal} className="btn-primary hidden sm:inline-flex"><HugeiconsIcon icon={PlusIcon} size={16} />Nueva inversión</button></div>
                </header>
                {view.error && view.status !== 'expired' && <div role="alert" className="mb-4 rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-4 py-3 text-[12px]"><p>{view.error}</p><div className="mt-3 flex flex-wrap gap-4">{view.status === 'conflict' ? <button onClick={() => void reloadPortfolio()} className="underline">Cargar versión guardada</button> : <button onClick={() => void sync.flush()} className="underline">Reintentar guardado</button>}<button onClick={() => void exportJSON()} className="underline">Exportar mis cambios</button></div></div>}
                {legacy && <div className="card mb-4 p-4 text-[12px]"><p>Encontramos {legacy.investments.length} inversiones guardadas en este navegador. Podés agregarlas a la cuenta de <strong>{account.user.email}</strong>.</p><div className="mt-3 flex gap-4"><button disabled={view.status === 'saving'} onClick={() => void importLegacy()} className="underline disabled:opacity-50">Guardar en mi cuenta</button><button onClick={() => setLegacy(null)} className="text-[var(--muted)]">Ahora no</button></div></div>}
                {notice && <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-4 py-3 text-[12px]"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar aviso" className="text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={XIcon} size={14} /></button></div>}
                {priceError && <div role="status" className="mb-4 rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-4 py-3 text-[12px] text-[var(--muted)]">Algunas cotizaciones no están disponibles. Los valores pueden estar incompletos o usar el monto original. <button onClick={() => void refresh()} className="ml-1 text-[var(--ink)] underline">Reintentar</button></div>}
                {!fxRate && items.some(i => i.currency !== display) && <div className="mb-4 rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-4 py-3 text-[12px]">No se puede convertir toda la cartera a {display} sin la cotización de USDC en pesos. Los totales se muestran como —.</div>}
                {page === 'dividends' && <Dividends dirty={view.dirty} hidden={hidden} />}

                <div className="flex flex-col">
                    <div style={{ order: panelOrder('value') }} hidden={page !== 'summary' || !visiblePanels.includes('value')}>
                        <section className="mb-3.5 grid gap-3.5 lg:grid-cols-[1.5fr_1fr]" aria-label="Valor de la cartera">
                            <article className="card hero-glow flex min-h-[360px] flex-col overflow-hidden p-6">
                                <div className="flex items-center justify-between"><span className="lb">01 — VALOR ACTUAL</span><span className="lb sig">● {priceError ? 'parcial' : 'en vivo'}</span></div>
                                <p className="big mt-6" aria-label={hidden ? 'Monto oculto' : undefined}>{big.cur && <span className="cur">{big.cur}</span>}{big.int}{big.dec && <span className="dec">{big.dec}</span>}</p>
                                <div className="mt-4 flex flex-wrap items-center gap-3"><span className={`pill ${gain >= 0 ? '' : 'neg'}`}>
                                    <HugeiconsIcon
                                        icon={gain >= 0 ? ChartIncreaseIcon : ChartDecreaseIcon}
                                        size={16}
                                        color={gain >= 0 ? "#22c55e" : "#ef4444"}
                                        strokeWidth={2}
                                    />
                                    {Number.isFinite(gainPct) ? percent(gainPct) : '—'}</span><span className="mu">{fmt(gain)} respecto al capital aportado</span></div>
                                {slicesForBar.length > 0 && <div className="mt-7"><div className="dm" role="img" aria-label={`Distribución: ${slicesForBar.map(k => `${k.label} ${(k.value / slicesTotal * 100).toFixed(0)}%`).join(', ')}`}>{slicesForBar.map(k => <i key={k.label} style={{ ['--c' as string]: k.color, flex: k.value }} />)}</div><div className="lg mt-3">{slicesForBar.map(k => <span key={k.label} style={{ ['--c' as string]: k.color }}>{k.label} {(k.value / slicesTotal * 100).toFixed(0)}%</span>)}</div></div>}
                                {chart && <svg className="mt-auto -mx-6 -mb-6 block h-[100px] w-[calc(100%+3rem)] pt-4" viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--sig)', stopOpacity: .28 }} /><stop offset="100%" style={{ stopColor: 'var(--sig)', stopOpacity: 0 }} /></linearGradient></defs><path d={chart.area} fill="url(#hero-fill)" /><path d={chart.line} fill="none" style={{ stroke: 'var(--sig)' }} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>}
                            </article>
                            <div className="grid gap-3.5">
                                <article className="card p-6">
                                    <p className="lb">02 — CAPITAL Y RESULTADO</p>
                                    <div className="mt-4 grid grid-cols-2 gap-4"><div><p className="mu">Aportado</p><p className="mt-1 break-all text-[clamp(1.2rem,2.4vw,1.8rem)] font-light tabular-nums tracking-tight">{fmt(invested)}</p></div><div><p className="mu">Resultado</p><p className="mt-1 break-all text-[clamp(1.2rem,2.4vw,1.8rem)] font-light tabular-nums tracking-tight" style={{ color: gain >= 0 ? 'var(--sig)' : 'var(--neg)' }}>{fmt(gain)}</p></div></div>
                                    <div className="trk mt-5" role="img" aria-label={`Capital ${(capShare * 100).toFixed(0)}% del valor actual`}><i style={{ width: `${Math.min(100, capShare * 100)}%` }} /><b style={{ width: `${Math.max(0, 100 - capShare * 100)}%`, background: gain >= 0 ? 'var(--sig)' : 'var(--neg)' }} /></div>
                                    <div className="mu mt-2 flex justify-between text-[11px]"><span>capital</span><span style={{ color: gain >= 0 ? 'var(--sig)' : 'var(--neg)' }}>{gain >= 0 ? 'ganancia' : 'pérdida'}</span></div>
                                </article>
                                <article className="card side-glow p-6">
                                    <div className="flex items-center justify-between"><p className="lb">03 — REFERENCIA USDC</p><button type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Actualizar cotizaciones" title="Actualizar" className="text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"><HugeiconsIcon icon={Refresh04Icon} size={15} className={refreshing ? 'animate-spin' : ''} /></button></div>
                                    <p className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-light leading-none tracking-tight tabular-nums">{fxRate ? money(fxRate, 'ARS') : 'No disponible'}</p>
                                    <p className="mu mt-2 flex items-center gap-1 text-[11px]">
                                        1 USDC en pesos · convierte USD
                                        <HugeiconsIcon
                                            icon={ArrowReloadHorizontalIcon}
                                            size={13}
                                            className="inline-block"
                                        />
                                        ARS en toda la app
                                    </p>
                                    {compare.length > 0 && <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--line)]">{compare.map(k => { const gap = fxRate ? (fxRate / rates[k].venta - 1) * 100 : NaN; return <div key={k} className="flex items-center justify-between py-2 font-mono text-[12px]"><span className="text-[var(--muted)]">{dollarLabels[k]}</span><span className="tabular-nums">{money(rates[k].venta, 'ARS')}</span><span className={`pill ${gap >= 0 || !Number.isFinite(gap) ? '' : 'neg'}`} title={`USDC ${Number.isFinite(gap) ? percent(gap) : '—'} respecto al dólar ${dollarLabels[k]}`}>{Number.isFinite(gap) ? percent(gap) : '—'}</span></div>; })}</div>}
                                    <div className="mt-3 space-y-1"><p className="mu text-[10.5px]">Precio de USDC: <a href="https://www.coingecko.com/en/coins/usd-coin" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">{usdc ? fxSource : 'CoinGecko'}</a></p><QuoteSource source="dollar" label="Dólares comparados" /></div>
                                </article>
                            </div>
                        </section>
                    </div>

                    <div style={{ order: panelOrder('macro') }} hidden={page !== 'summary' || !visiblePanels.includes('macro')}>{page === 'summary' && visiblePanels.includes('macro') && <MacroDashboard rates={rates} refreshDollars={() => void refresh()} dollarLoading={refreshing} />}</div>

                    <div style={{ order: panelOrder('streak') }} hidden={page !== 'summary' || !visiblePanels.includes('streak')}><ContributionStreak items={items} hidden={hidden} /></div>

                    <div style={{ order: panelOrder('evolution') }} hidden={page !== 'evolution' && (page !== 'summary' || !visiblePanels.includes('evolution'))}>
                        <section className="card mb-3.5 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="lb">04 — EVOLUCIÓN</p><p className="mu mt-2 text-[11.5px]">Estimada · no es un historial real de precios</p></div><div role="group" aria-label="Período de evolución" className="seg">{([['7d', '7D'], ['1m', '1M'], ['6m', '6M'], ['1a', '1A'], ['todo', 'Todo']] as const).map(([id, text]) => <button key={id} type="button" onClick={() => setRange(id)} aria-pressed={range === id}>{text}</button>)}</div></div>
                            {chart ? <><div className="relative mt-7 touch-pan-y" role="slider" tabIndex={0} aria-label="Explorar evolución estimada con las flechas" aria-valuemin={0} aria-valuemax={chart.points.length - 1} aria-valuenow={chartIndex ?? chart.points.length - 1} aria-valuetext={chartPoint ? `${chartDate(chartPoint.t)}: ${fmt(chartPoint.value)}` : `Hoy: ${fmt(current)}`} onBlur={() => setChartIndex(null)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setChartIndex(index => Math.max(0, Math.min(chart.points.length - 1, (index ?? chart.points.length - 1) + (event.key === 'ArrowRight' ? 1 : -1)))); } }} onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * chart.w; setChartIndex(Math.max(0, Math.min(chart.points.length - 1, Math.round((x - 12) / (chart.w - 24) * (chart.points.length - 1))))); }} onPointerLeave={() => setChartIndex(null)}>
                                <svg viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" className="h-[230px] w-full overflow-visible" aria-hidden="true"><defs><linearGradient id="invest-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--sig)', stopOpacity: .24 }} /><stop offset="100%" style={{ stopColor: 'var(--sig)', stopOpacity: 0 }} /></linearGradient></defs>{[.25, .5, .75, 1].map(n => <line key={n} x1="12" x2={chart.w - 12} y1={chart.h * n - 5} y2={chart.h * n - 5} stroke="var(--line2)" strokeDasharray="4 6" />)}<path d={chart.area} fill="url(#invest-fill)" /><path d={chart.line} fill="none" style={{ stroke: 'var(--sig)' }} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />{chartPoint ? <><line x1={chartPoint.x} x2={chartPoint.x} y1="4" y2={chart.h - 12} stroke="var(--muted)" strokeOpacity=".7" strokeDasharray="4 5" /><circle cx={chartPoint.x} cy={chartPoint.y} r="5" style={{ fill: 'var(--sig)' }} stroke="var(--surface)" strokeWidth="3" /></> : <circle cx={chart.nowX} cy={chart.nowY} r="5" style={{ fill: 'var(--sig)' }} stroke="var(--surface)" strokeWidth="3" />}</svg>
                                {chartPoint && <div className="pointer-events-none absolute top-2 z-10 rounded-lg border border-[var(--line2)] bg-[var(--raised)] px-3 py-2 shadow-lg" style={{ left: `${Math.max(2, Math.min(98, chartPoint.x / chart.w * 100))}%`, transform: chartPoint.x > chart.w / 2 ? 'translateX(-100%)' : 'none' }}><p className="mu whitespace-nowrap text-[10px]">{chartDate(chartPoint.t)}</p><p className="mt-1 whitespace-nowrap font-mono text-[12px]">{fmt(chartPoint.value)}</p><p className="mu mt-0.5 text-[10px]">Estimado</p></div>}
                            </div><div className="mu mt-2 flex justify-between text-[11px]"><span>{chart.first}</span><span>Hoy</span></div></> : <div className="grid h-[240px] place-items-center text-center text-[13px] text-[var(--muted)]">{items.length ? 'Sin conversión de moneda disponible.' : 'Agregá tu primera inversión para visualizar la evolución.'}</div>}
                            <p className="mu mt-5 border-t border-[var(--line)] pt-4 text-[10.5px] leading-5">Los valores anteriores de CEDEARs y cripto se interpolan entre la compra y el precio actual. La conversión usa el USDC actual; no refleja rendimientos históricos reales.</p>
                        </section>
                        {page === 'evolution' && <Benchmarks start={benchmarkStart} end={today} valueAt={benchmarkValue} available={benchmarkItems.length > 0 && (Boolean(fxRate) || benchmarkItems.every(i => i.currency === 'ARS' && i.kind !== 'crypto'))} />}
                    </div>

                    {page === 'inflation' && <Inflation />}
                    <div style={{ order: panelOrder('distribution') }} hidden={page !== 'summary' || !visiblePanels.includes('distribution')}>{items.length > 0 && <Distribution byKind={byKind} byCurrency={byCurrency} byAsset={byAsset} bySector={bySector} byCountry={byCountry} format={fmt} />}</div>

                    <div style={{ order: panelOrder('investments') }} hidden={page !== 'investments' && (page !== 'summary' || !visiblePanels.includes('investments'))}>
                        <section className="card overflow-hidden" aria-label="Mis inversiones">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6"><div><p className="lb">05 — MIS INVERSIONES <span className="ml-2 text-[var(--faint)]">{filtered.length}</span></p><p className="mu mt-2 text-[11.5px]">Clic derecho o ⋯ en una fila para editar, duplicar o eliminar</p></div>
                                <div className="flex items-center gap-2"><label className="relative hidden sm:block"><HugeiconsIcon icon={Search01Icon} size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" /><input aria-label="Buscar en mis inversiones" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en mi cartera…" className="w-52 rounded-[10px] border border-[var(--line)] bg-[var(--raised)] py-2 pl-9 pr-3 text-[12px] outline-none focus:border-[var(--muted)]" /></label><button onClick={() => void refresh()} disabled={refreshing} title="Actualizar precios" aria-label="Actualizar precios" className="ibtn !h-[38px] !w-[38px] disabled:opacity-50"><HugeiconsIcon icon={Refresh04Icon} size={15} className={refreshing ? 'animate-spin' : ''} /></button></div></div>
                            <div className="tabs px-4 pb-1 pt-4 sm:px-5" role="group" aria-label="Filtrar por tipo">{kinds.map(k => <button key={k.id} type="button" aria-pressed={filter === k.id} onClick={() => setFilter(k.id)}>{k.id !== 'all' && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: k.color }} />}{k.id === 'all' ? 'Todas' : k.label}<em>{allCount(k.id)}</em></button>)}</div>
                            <div className="px-5 pt-3 sm:hidden"><input aria-label="Buscar en mis inversiones" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en mi cartera…" className={field} /></div>
                            <div className="mt-3">{filtered.length ? filtered.map(i => {
                                const v = valueAt(i, today, prices, today, officialRate); const change = i.amount > 0 ? (v - i.amount) / i.amount * 100 : 0; const missing = i.kind !== 'rate' && (i.coin && prices[`${i.kind}:${i.coin}`] == null); const cat = categoryOf(i); const sub = i.kind === 'rate' ? `Con tasa · ${i.rate}% ${i.period === 'year' ? 'anual' : 'mensual'}` : cat === 'index' ? `Índice · ${indexName(i.coin ?? '')}` : i.kind === 'cedear' ? `CEDEAR · ${i.coin}` : `Cripto · ${i.coin}`;
                                return <div key={i.id} className={`li ${ctx?.id === i.id ? 'menu-open' : ''}`} onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, id: i.id }); }}>
                                    <div className="tk" style={{ ['--c' as string]: colorOf(cat) }} aria-hidden="true">{tickerOf(i)}</div>
                                    <div className="min-w-0"><p className="truncate text-[14px] font-medium">{i.name}</p><p className="mu mt-1 truncate text-[11.5px]">{sub} <span className="hidden sm:inline">· {formatDate(i.date)}</span></p>{missing && <p className="mu mt-0.5 text-[10px]">Sin precio · se muestra el monto original</p>}</div>
                                    <div className="r hid"><p>{mny(i.amount, i.currency)}</p><p className="mu mt-1 text-[10px]">Invertido</p></div>
                                    <div className="r hid"><p>{mny(v, i.currency)}</p><div className="mt-1 text-[10px] text-[var(--muted)]">{i.kind === 'rate' ? <span title="Valor calculado con el monto, la fecha y la tasa que ingresaste">Tasa ingresada por vos</span> : <QuoteSource source={i.kind} asset={i.coin} label={missing ? 'Proveedor' : 'Fuente'} className="justify-end" />}</div></div>
                                    <div className="r"><span className={`pill ${change >= 0 ? '' : 'neg'}`}>{missing ? '—' : percent(change)}</span><p className="mu mt-1 text-[10px] sm:hidden">{mny(v, i.currency)}</p></div>
                                    <button type="button" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setCtx(ctx?.id === i.id ? null : { x: r.right - 220, y: r.bottom + 6, id: i.id }); }} aria-haspopup="menu" aria-expanded={ctx?.id === i.id} aria-label={`Acciones de ${i.name}`} className="ibtn !h-9 !w-9 !border-transparent !bg-transparent"><HugeiconsIcon icon={MoreHorizontalIcon} size={17} /></button>
                                </div>;
                            }) : <div className="flex flex-col items-center px-4 py-16 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--raised)]"><HugeiconsIcon icon={CoinsBitcoinIcon} size={21} className="text-[var(--muted)]" /></div><h3 className="text-[14px] font-medium">{items.length ? 'No hay inversiones con este filtro' : 'Tu cartera está vacía'}</h3><p className="mt-2 max-w-xs text-[12px] text-[var(--muted)]">{items.length ? 'Probá otra categoría o búsqueda.' : 'Empezá cargando una inversión o importá un archivo exportado.'}</p>{!items.length && <div className="mt-5 flex gap-2"><button onClick={openModal} className="btn-primary !min-h-10 !text-[13px]">Agregar inversión</button><button onClick={() => fileRef.current?.click()} className="btn-ghost">Importar datos</button></div>}</div>}</div>
                        </section>
                    </div>
                </div>
                {page === 'investments' && <AssetPerformance items={items} hidden={hidden} />}
                {page === 'investments' && (view.portfolio.sales?.length ?? 0) > 0 && <section className="card mt-4 p-5"><p className="lb">VENTAS REGISTRADAS</p><div className="mt-3 divide-y divide-[var(--line)]">{[...(view.portfolio.sales ?? [])].reverse().map(sale => <div key={sale.id} className="flex flex-wrap justify-between gap-2 py-3 text-[12px]"><span>{sale.name} · {formatDate(sale.date)} · {(sale.fraction * 100).toFixed(2)}%</span><span>{mny(sale.proceeds, sale.currency)} · costo {mny(sale.cost, sale.costCurrency)}</span></div>)}</div></section>}
                <footer className="mu mt-8 space-y-2 text-[10px]">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span>ACTIVOS / PANEL PERSONAL</span><span>Precios orientativos · No es asesoramiento financiero.</span></div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Fuentes de las cotizaciones"><QuoteSource source="usdc" label="USDC" /><QuoteSource source="dollar" label="Dólares" /><QuoteSource source="crypto" label="Cripto" /><QuoteSource source="cedear" label="CEDEARs e índices" /></div>
                </footer>
            </main>
        </div>
        <button inert={locked} onClick={openModal} aria-label="Nueva inversión" className="fixed bottom-6 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-[var(--ink)] text-[var(--bg)] shadow-[0_6px_24px_rgba(0,0,0,.38)] sm:hidden"><HugeiconsIcon icon={PlusIcon} size={24} /></button>
        {ctx && ctxItem && <ContextMenu x={ctx.x} y={ctx.y} title={ctxItem.name} items={menuFor(ctxItem)} onClose={closeCtx} />}
        {passkeyDialog && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !passkeyBusy) setPasskeyDialog(false); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="passkey-title" className="card w-full max-w-md p-6 shadow-2xl">
                <h2 id="passkey-title" className="text-xl font-light">Passkeys y llaves de seguridad</h2>
                <p className="mu mt-3 text-[13px] leading-6">{passkeyCount === null ? 'No se pudo consultar el estado de tus passkeys.' : passkeyCount ? `Tenés ${passkeyCount} ${passkeyCount === 1 ? 'passkey registrada' : 'passkeys registradas'} en tu cuenta.` : 'Todavía no tenés passkeys registradas.'}</p>
                <p className="mu mt-2 text-[12px] leading-5">Podés agregar una passkey para ingresar con Face ID, otro dispositivo o una llave de seguridad.</p>
                {passkeyMessage && <p role="status" className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3 text-[12px]">{passkeyMessage}</p>}
                <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className="btn-ghost" disabled={passkeyBusy} onClick={() => setPasskeyDialog(false)}>Cerrar</button>{passkeyOptions ? <button type="button" className="btn-primary" disabled={passkeyBusy} onClick={() => void enablePasskey()}>{passkeyBusy ? 'Activando…' : 'Crear passkey'}</button> : <button type="button" className="btn-primary" disabled={passkeyBusy} onClick={() => void preparePasskeyDialog()}>{passkeyBusy ? 'Preparando…' : 'Agregar passkey'}</button>}</div>
            </section>
        </div>}
        {panelEditor && <PanelEditor selected={visiblePanels} onClose={closePanelEditor} onSave={next => { setPanels([...next, 'panel-v2']); setPanelEditor(false); if (page !== 'summary') goTo('/'); }} />}
        {sellItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSellId(null); }}>
            <section role="dialog" aria-modal="true" aria-label="Registrar venta" className="card w-full max-w-md p-6">
                <h2 className="text-xl">Registrar venta</h2>
                <p className="mu mt-2">{sellItem.name} · valor estimado actual {sellAvailable ? mny(sellValue, sellItem.currency) : 'no disponible'}</p>
                <label className={`${label} mt-5`}>Moneda de la venta<select className={`${field} mt-1`} value={sellCurrency} onChange={e => { setSellCurrency(e.target.value as Currency); setSellInputAmount(''); setSellError(''); }}><option value="ARS">Pesos argentinos (ARS)</option><option value="USD">Dólares (USD)</option></select></label>
                <div className="mt-4"><p className={label}>Ingresar venta por</p><div className="seg" role="group" aria-label="Forma de ingresar la venta"><button type="button" aria-pressed={sellInputMode === 'percent'} onClick={() => { setSellInputMode('percent'); setSellError(''); }}>Porcentaje</button><button type="button" aria-pressed={sellInputMode === 'amount'} onClick={() => { setSellInputMode('amount'); setSellError(''); }}>Importe</button></div></div>
                {sellInputMode === 'percent' ? <label className={`${label} mt-4`}>Porcentaje a vender<input className={`${field} mt-1`} type="number" min="0" max="100" step="any" value={sellPercent} onChange={e => setSellPercent(e.target.value)} /></label> : <label className={`${label} mt-4`}>Importe a vender ({sellCurrency})<input className={`${field} mt-1`} type="number" min="0" step="any" value={sellInputAmount} onChange={e => setSellInputAmount(e.target.value)} /><span className="mt-2 flex flex-wrap items-center justify-between gap-2">Valor disponible: {sellAvailable ? mny(sellTotal, sellCurrency) : 'No disponible'}<button type="button" className="underline" disabled={!sellAvailable} onClick={() => setSellInputAmount(String(sellTotal))}>Vender todo</button></span></label>}
                <p className="mt-4 text-[14px]">Importe estimado: {sellAvailable && Number.isFinite(sellAmount) ? mny(sellAmount, sellCurrency) : 'No disponible'}</p>
                {sellInputMode === 'amount' && Number.isFinite(sellFraction) && sellFraction > 0 && <p className="mu mt-1 text-[12px]">Equivale al {(sellFraction * 100).toFixed(2)}% de la inversión.</p>}
                <p className="mu mt-2 text-[11px]">Se usa la última cotización disponible y USDC para convertir monedas. No incluye comisiones ni ejecuta una orden en tu broker.</p>{sellError && <p role="alert" className="mt-3 text-[var(--neg)]">{sellError}</p>}
                <div className="mt-5 flex gap-3"><button className="btn-primary" onClick={registerSale}>Registrar venta</button><button className="btn-ghost" onClick={() => setSellId(null)}>Cancelar</button></div>
            </section>
        </div>}
        {modal && <div inert={!!assetSearch} className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-[5px] sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}>
            <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] border border-[var(--line2)] bg-[var(--surface)] p-5 shadow-[0_25px_90px_rgba(0,0,0,.5)] sm:max-w-[470px] sm:rounded-[22px] sm:p-6">
                <div className="mb-5 flex items-start justify-between"><div><h2 id="modal-title" className="text-[24px] font-light tracking-tight">{editingId ? 'Editar inversión' : 'Nueva inversión'}</h2><p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{editingId ? 'Modificá los datos de esta posición' : 'Registrá una posición en tu cartera'}</p></div><button onClick={closeModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={XIcon} size={19} /></button></div>
                <form onSubmit={add} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['rate', 'cedear', 'crypto'] as const).map(k => <button type="button" key={k} onClick={() => pickKind(k)} aria-pressed={kind === k && !indexMode} className={`flex items-center justify-center gap-2 rounded-[10px] border px-2 py-2.5 text-[12px] ${kind === k && !indexMode ? 'border-[var(--line2)] bg-[var(--raised)]' : 'border-[var(--line)] text-[var(--muted)]'}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(k) }} />{titleFor(k)}</button>)}<button type="button" aria-pressed={indexMode} onClick={() => { setIndexMode(true); setKind('cedear'); setCoin('SPY'); setName('S&P 500 (SPY)'); setAssetQuote(null); setError(''); }} className={`rounded-[10px] border px-2 py-2.5 text-[12px] ${indexMode ? 'border-[var(--line2)] bg-[var(--raised)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>Índices</button></div>
                    {indexMode && <div><label htmlFor="invest-index" className={label}>Índice de referencia</label><Select id="invest-index" label="Índice de referencia" value={coin} onChange={ticker => { setCoin(ticker); setName(`${indexName(ticker)} (${ticker})`.slice(0, 70)); setAssetQuote(null); setError(''); }} options={INDEXES.map(i => ({ value: i.symbol, label: `${i.name} · ${i.symbol}` }))} /><p className="mt-2 text-[11px] text-[var(--muted)]">Se registra el CEDEAR del ETF en pesos, que sigue al índice de referencia.</p></div>}
                    <div><label htmlFor="invest-name" className={label}>Nombre</label><input id="invest-name" required maxLength={70} className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: S&P 500, plazo fijo..." /></div>
                    <div className="grid grid-cols-2 gap-3"><div><label htmlFor="invest-amount" className={label}>{kind === 'rate' ? 'Monto' : 'Valor actual'} ({currency})</label><input id="invest-amount" required type="number" min="0.000001" step="any" className={field} value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" /></div><div><label htmlFor="invest-currency" className={label}>Moneda</label><Select<Currency> id="invest-currency" label="Moneda" value={currency} onChange={setCurrency} options={[{ value: 'USD', label: 'USD' }, { value: 'ARS', label: 'ARS' }]} /></div><div><label htmlFor="invest-date" className={label}>Fecha de compra</label><input id="invest-date" required type="date" max={localISO()} className={field} value={date} onChange={e => { setDate(e.target.value); setError(''); }} /></div></div>
                    {kind !== 'rate' && currency !== quoteCurrency && <p className="text-[11px] text-[var(--muted)]">Para calcular las unidades y el valor en {currency} se usa el precio actual de USDC en pesos{officialRate ? ` (${money(officialRate, 'ARS')})` : ', no disponible en este momento'}. En compras anteriores no se usa la cotización histórica.</p>}
                    {kind === 'rate' ? <div className="grid grid-cols-2 gap-3"><div><label htmlFor="invest-rate" className={label}>Tasa (%)</label><input id="invest-rate" type="number" step="any" className={field} value={rate} onChange={e => setRate(e.target.value)} placeholder="8" /></div><div><label htmlFor="invest-period" className={label}>Período</label><Select<Period> id="invest-period" label="Período" value={period} onChange={setPeriod} options={[{ value: 'year', label: 'Anual' }, { value: 'month', label: 'Mensual' }]} /></div></div> : <div>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label htmlFor="invest-coin" className="text-[12px] text-[var(--muted)]">{kind === 'cedear' ? 'Ticker del CEDEAR' : 'ID de CoinGecko'}</label>{<button type="button" onClick={() => setAssetSearch(indexMode ? 'index' : kind === 'cedear' ? 'cedear' : 'crypto')} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink)] underline underline-offset-4"><HugeiconsIcon icon={Search01Icon} size={13} />Buscar {kind === 'crypto' ? 'criptomoneda' : indexMode ? 'índice' : 'CEDEAR'}</button>}</div>
                        <input id="invest-coin" className={field} required readOnly={indexMode} value={coin} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="coin-help" onChange={e => { const nextId = kind === 'cedear' ? e.target.value.trim().toUpperCase() : e.target.value.trim().toLowerCase(); if (nextId !== assetId) setAssetQuote(null); setCoin(e.target.value); setError(''); }} placeholder={kind === 'cedear' ? 'AAPL, SPY, MELI' : 'bitcoin, ethereum, solana'} />
                        <p id="coin-help" className="mt-2 font-mono text-[10px] text-[var(--muted)]">{kind === 'crypto' ? 'Se consulta el precio actual en CoinGecko.' : 'Ingresá el ticker en pesos. Se consulta su última cotización.'}</p>
                        <div className="mt-3 rounded-xl border border-[var(--line2)] bg-[var(--raised)] p-3.5" aria-live="polite" aria-atomic="true">
                            {!assetId ? <p className="text-[12px] text-[var(--muted)]">Ingresá {kind === 'cedear' ? 'un ticker' : 'un ID'} para consultar su precio.</p> : activeQuote?.status === 'error' ? <>
                                <p role="alert" className="text-[12px] text-[var(--neg)]">{activeQuote.message}</p>
                                <button type="button" onClick={() => { setAssetQuote(null); setQuoteRequest(value => value + 1); setError(''); }} className="mt-3 inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4"><HugeiconsIcon icon={Refresh04Icon} size={13} />Reintentar consulta</button>
                            </> : activeQuote?.status === 'ready' ? <>
                                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-[var(--muted)]">{kind === 'cedear' ? 'Última cotización por unidad' : 'Precio actual por unidad'}</p><p className="mt-1 break-words font-mono text-[22px] leading-tight tracking-tight">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: kind === 'cedear' ? 'ARS' : 'USD', currencyDisplay: 'code', ...(activeQuote.price < 1 ? { maximumSignificantDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }).format(activeQuote.price)}</p></div><QuoteSource source={kind === 'cedear' ? 'cedear' : 'crypto'} asset={assetId} className="shrink-0 rounded-md bg-[var(--sig)]/10 px-2 py-1" /></div>
                                {kind === 'crypto' ? <a href={`https://www.coingecko.com/en/coins/${encodeURIComponent(assetId)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all font-mono text-[11px] text-[var(--muted)] underline underline-offset-4">{assetId} ↗</a> : <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">{assetId} · CEDEAR en pesos</p>}
                                {previewUnits != null && Number.isFinite(previewUnits) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[12px]"><span className="text-[var(--muted)]">Unidades estimadas</span><span className="break-all font-mono">{new Intl.NumberFormat('es-AR', { maximumSignificantDigits: 10 }).format(previewUnits)}</span></div>}
                                <p className="mt-2 text-[10px] text-[var(--muted)]">Se usa el precio actual para estimar las unidades; el monto ingresado se toma como valor actual.</p>
                            </> : <p role="status" className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><HugeiconsIcon icon={LoaderIcon} size={15} className="animate-spin" />Consultando {quoteSource}...</p>}
                        </div>
                    </div>}
                    {error && <p role="alert" className="rounded-lg bg-[var(--neg)]/10 p-3 text-[12px] text-[var(--neg)]">{error}</p>}
                    <div className="flex gap-2 border-t border-[var(--line)] pt-5"><button type="button" onClick={closeModal} className="flex-1 rounded-[10px] border border-[var(--line2)] bg-[var(--raised)] py-3 text-[13px]">Cancelar</button><button type="submit" disabled={kind !== 'rate' && quotePrice == null} className="flex-[1.3] rounded-[10px] bg-[var(--ink)] py-3 text-[13px] font-medium text-[var(--bg)] disabled:opacity-50">{editingId ? 'Guardar cambios' : 'Guardar inversión'}</button></div>
                </form>
            </div>
        </div>}
        {assetSearch && <AssetSearchDialog initial={assetSearch} onClose={() => setAssetSearch(null)} onSelect={selectAsset} />}
        {confirmDelete && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className={`${panel} w-full max-w-[390px] p-6 shadow-2xl`}><h2 id="delete-title" className="text-[20px] font-medium">Eliminar inversión</h2><p className="mt-2 text-[13px] text-[var(--muted)]">Esta acción no se puede deshacer. ¿Querés eliminar esta posición de tu cartera?</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-[var(--line2)] px-4 py-2.5 text-[13px]">Cancelar</button><button onClick={() => { setItems(prev => prev.filter(i => i.id !== confirmDelete)); setConfirmDelete(null) }} className="rounded-lg bg-[var(--neg)] px-4 py-2.5 text-[13px] font-medium text-white">Eliminar</button></div></div></div>}
        {importPreview && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="import-title" className={`${panel} w-full max-w-[430px] p-6 shadow-2xl`}><h2 id="import-title" className="text-[20px] font-medium">Importar inversiones</h2><p className="mt-2 text-[13px] text-[var(--muted)]">Se encontraron <strong className="font-medium text-[var(--ink)]">{importPreview.items.length}</strong> inversiones válidas{importPreview.skipped > 0 ? ` (${importPreview.skipped} inválidas se van a omitir)` : ''}. Tenés {items.length} cargadas ahora.</p><ul className="mt-4 space-y-1.5 text-[12px] text-[var(--muted)]"><li><strong className="font-medium text-[var(--ink)]">Combinar:</strong> suma las nuevas y omite las que ya existen.</li><li><strong className="font-medium text-[var(--ink)]">Reemplazar:</strong> borra tu cartera actual y deja solo el archivo.</li></ul><div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={() => setImportPreview(null)} className="rounded-lg border border-[var(--line2)] px-4 py-2.5 text-[13px]">Cancelar</button><button onClick={() => applyImport('replace')} className="rounded-lg border border-[var(--neg)]/40 px-4 py-2.5 text-[13px] text-[var(--neg)]">Reemplazar</button><button onClick={() => applyImport('merge')} className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-[var(--bg)]">Combinar</button></div></div></div>}
    </div>;
}
