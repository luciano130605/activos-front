import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { coinPriceOn, coinPricesNow, type CryptoAsset } from './coingecko';
import { cedearPriceOn, cedearPricesNow } from './cedears';
import CryptoSearchDialog from './CryptoSearchDialog';
import Simulator from './Simulator';
import Distribution from './Distribution';
import Sidebar from './Sidebar';
import Select from './Select';
import QuoteSource from './QuoteSource';
import { pages, usePage } from './navigation';
import { cleanInvestment, readLegacyPortfolio, type Currency, type Investment, type Kind, type Period } from './portfolio';
import { request, type Account, type Snapshot } from './account';
import { usePortfolio } from './usePortfolio';
import Login from './Login';
import { HugeiconsIcon } from '@hugeicons/react';
import { Bitcoin, ChartDecreaseFreeIcons, ChartIncreaseFreeIcons, ChartLineIcon, ChevronRightIcon, CoinsBitcoinIcon, DashboardCircleIcon, Delete02Icon, Dollar02Icon, Edit02Icon, LandmarkFreeIcons, LoaderPinwheelIcon, MenuTwoLineFreeIcons, PieChart02Icon, PlusIcon, Refresh04Icon, Search01Icon, ViewIcon, ViewOffIcon, XIcon } from '@hugeicons/core-free-icons';
type Filter = 'all' | Kind;
type AssetQuote = { id: string; date: string; kind: 'crypto' | 'cedear' } & ({ status: 'loading' } | { status: 'ready'; price: number; sourceDate?: string } | { status: 'error'; message: string });
type DollarRate = { nombre: string; compra: number | null; venta: number };
type Rates = Record<string, DollarRate>;
const MASK = '****';
const MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;
const kinds: { id: Filter; label: string; color: string }[] = [
    { id: 'all', label: 'Todas las inversiones', color: '#929292' },
    { id: 'rate', label: 'Con tasa', color: '#7f96ff' },
    { id: 'cedear', label: 'CEDEARs', color: '#ff7d52' },
    { id: 'crypto', label: 'Criptomonedas', color: '#f5c542' },
];
// Nombres de los tipos de dólar que devuelve dolarapi.com (campo "casa")
const dollarLabels: Record<string, string> = { bolsa: 'MEP', contadoconliqui: 'CCL', blue: 'Blue', oficial: 'Oficial', mayorista: 'Mayorista', cripto: 'Cripto', tarjeta: 'Tarjeta' };
const dollarOrder = ['bolsa', 'contadoconliqui', 'blue', 'oficial', 'mayorista', 'cripto', 'tarjeta'];
const titleFor = (kind: Kind) => kind === 'rate' ? 'Con tasa' : kind === 'cedear' ? 'CEDEAR' : 'Cripto';
const localISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateMillis = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
const money = (n: number, c: Currency) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const percent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
const monthName = (time: number) => new Date(time).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
const monthlyRate = (i: Investment) => { const r = (i.rate ?? 0) / 100; return i.period === 'month' ? r : r > -1 ? Math.pow(1 + r, 1 / 12) - 1 : -1; };
function valueAt(i: Investment, t: number, prices: Record<string, number>, now: number) {
    const start = dateMillis(i.date);
    if (t < start) return 0;
    if (i.kind === 'rate') return i.amount * Math.pow(1 + monthlyRate(i), (t - start) / MONTH_MS);
    const price = i.coin ? prices[`${i.kind}:${i.coin}`] : undefined;
    const current = i.units != null && price != null ? i.units * price : i.amount;
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
    const [reauthenticate, setReauthenticate] = useState(false);
    const [legacy, setLegacy] = useState(() => {
        try {
            if (localStorage.getItem('inversiones:migrated-to')) return null;
            const data = readLegacyPortfolio(localStorage);
            return data.investments.length ? data : null;
        } catch { return null; }
    });
    const page = usePage();
    const pageInfo = pages[page];
    const titleRef = useRef<HTMLHeadingElement>(null);
    const previousPage = useRef(page);
    const [sidebarCollapsed, setSidebarCollapsed] = preference('sidebarCollapsed');
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [display, setDisplay] = preference('display');
    const [horizon, setHorizon] = preference('horizon');
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [rates, setRates] = useState<Rates>({});
    const [dollar, setDollar] = preference('dollar');
    const [hidden, setHidden] = preference('hidden');
    const [updated, setUpdated] = useState<string>('');
    const [priceError, setPriceError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [theme, setTheme] = preference('theme');
    const [mobileNav, setMobileNav] = useState(false);
    const closeMobileNav = useCallback(() => setMobileNav(false), []);
    const [modal, setModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [cryptoSearch, setCryptoSearch] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [importPreview, setImportPreview] = useState<{ items: Investment[]; skipped: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(localISO());
    const [kind, setKind] = useState<Kind>('rate');
    const [rate, setRate] = useState('');
    const [period, setPeriod] = useState<Period>('year');
    const [coin, setCoin] = useState('bitcoin');
    const [assetQuote, setAssetQuote] = useState<AssetQuote | null>(null);
    const [quoteRequest, setQuoteRequest] = useState(0);
    const [currency, setCurrency] = useState<Currency>('USD');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const today = Date.now();
    const fxRate = rates[dollar]?.venta;
    const dollarName = dollarLabels[dollar] ?? dollar;
    const dollarOptions = dollarOrder.filter(k => rates[k] || k === dollar);
    const cryptos = useMemo(() => [...new Set(items.filter(i => i.kind === 'crypto' && i.coin).map(i => i.coin!))], [items]);
    const cedears = useMemo(() => [...new Set(items.filter(i => i.kind === 'cedear' && i.coin).map(i => i.coin!))], [items]);
    const assetId = kind === 'cedear' ? coin.trim().toUpperCase() : coin.trim().toLowerCase();
    const quoteSource = kind === 'cedear' ? 'Data912' : 'CoinGecko';
    const todayDate = localISO();
    const validQuoteDate = Boolean(date && date <= todayDate && Number.isFinite(dateMillis(date)));
    const activeQuote = modal && kind !== 'rate' && validQuoteDate && assetQuote?.id === assetId && assetQuote.date === date && assetQuote.kind === kind ? assetQuote : null;
    const quotePrice = activeQuote?.status === 'ready' ? activeQuote.price : undefined;
    const previewUnits = quotePrice && Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) / quotePrice : undefined;
    useEffect(() => {
        if (!modal || kind === 'rate' || !assetId || !validQuoteDate) {
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setAssetQuote({ id: assetId, date, kind, status: 'loading' });
            try {
                const quote = kind === 'crypto' ? { price: await coinPriceOn(assetId, date, todayDate, controller.signal) } : await cedearPriceOn(assetId, date, todayDate, controller.signal);
                if (!controller.signal.aborted) setAssetQuote({ id: assetId, date, kind, status: 'ready', ...quote });
            } catch (error) {
                if (!controller.signal.aborted) setAssetQuote({ id: assetId, date, kind, status: 'error', message: error instanceof Error ? error.message : 'No se pudo consultar el precio. Volvé a intentar.' });
            }
        }, 600);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [modal, kind, assetId, date, todayDate, validQuoteDate, quoteRequest]);
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
        const results = await Promise.allSettled([coinPricesNow(cryptos), cedearPricesNow(cedears), dollarsNow()]);
        const [cryptoResult, cedearResult, dollarResult] = results;
        setPrices(prev => ({ ...prev, ...(cryptoResult.status === 'fulfilled' ? cryptoResult.value : {}), ...(cedearResult.status === 'fulfilled' ? cedearResult.value : {}) }));
        const gotDollars = dollarResult.status === 'fulfilled' && Object.keys(dollarResult.value).length > 0;
        if (dollarResult.status === 'fulfilled' && gotDollars) setRates(prev => ({ ...prev, ...dollarResult.value }));
        setPriceError(results.some(r => r.status === 'rejected') || (dollarResult.status === 'fulfilled' && !gotDollars));
        setUpdated(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
        setRefreshing(false);
    }, [cryptos, cedears]);
    useEffect(() => { void refresh(); }, [refresh]);
    const fx = (v: number, from: Currency) => from === display ? v : !fxRate ? NaN : display === 'USD' ? v / fxRate : v * fxRate;
    // Con "ocultar montos" activo, todo importe se muestra como ****
    const fmt = (v: number) => hidden ? MASK : Number.isFinite(v) ? money(v, display) : '—';
    const mny = (n: number, c: Currency) => hidden ? MASK : money(n, c);
    const invested = items.reduce((s, i) => s + (dateMillis(i.date) <= today ? fx(i.amount, i.currency) : 0), 0);
    const current = items.reduce((s, i) => s + fx(valueAt(i, today, prices, today), i.currency), 0);
    const gain = current - invested;
    const gainPct = invested > 0 ? gain / invested * 100 : 0;
    const end = today + horizon * MONTH_MS;
    const projected = items.reduce((s, i) => s + fx(valueAt(i, end, prices, today), i.currency), 0);
    const filtered = items.filter(i => (filter === 'all' || i.kind === filter) && `${i.name} ${i.coin ?? ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
    const allCount = (kind: Filter) => kind === 'all' ? items.length : items.filter(i => i.kind === kind).length;
    const colorOf = (k: Filter) => kinds.find(v => v.id === k)!.color;
    const valueOf = (list: Investment[]) => list.reduce((s, i) => s + fx(valueAt(i, today, prices, today), i.currency), 0);
    const byKind = (['rate', 'cedear', 'crypto'] as const).map(k => ({ label: kinds.find(v => v.id === k)!.label, color: colorOf(k), value: valueOf(items.filter(i => i.kind === k)) }));
    const byCurrency = [
        { label: 'Dólares (USD)', color: '#71caa0', value: valueOf(items.filter(i => i.currency === 'USD')) },
        { label: 'Pesos (ARS)', color: '#7f96ff', value: valueOf(items.filter(i => i.currency === 'ARS')) },
    ];
    const chart = useMemo(() => {
        if (!items.length || !fxRate && items.some(i => i.currency !== display)) return null;
        const start = Math.min(today, ...items.map(i => dateMillis(i.date)));
        const len = 72, w = 850, h = 230, pad = 12;
        const samples = Array.from({ length: len + 1 }, (_, idx) => { const t = start + (end - start) * idx / len; return { t, value: items.reduce((s, i) => s + fx(valueAt(i, t, prices, today), i.currency), 0) }; });
        const max = Math.max(1, ...samples.map(s => s.value)) * 1.12;
        const px = (t: number) => pad + (t - start) / (end - start || 1) * (w - 2 * pad);
        const py = (v: number) => h - pad - v / max * (h - 2 * pad);
        const line = samples.map((s, i) => `${i ? 'L' : 'M'} ${px(s.t).toFixed(1)} ${py(s.value).toFixed(1)}`).join(' ');
        const baseline = h - pad;
        const area = `${line} L ${px(end)} ${baseline} L ${px(start)} ${baseline} Z`;
        const nowX = Math.min(w - pad, px(today));
        return { w, h, line, area, nowX, nowY: py(current), first: monthName(start), last: monthName(end) };
    }, [items, prices, horizon, display, fxRate, today, end, current]);
    const pickKind = (k: Kind) => { if (k === kind) return; setKind(k); setCoin(k === 'cedear' ? 'AAPL' : 'bitcoin'); setAssetQuote(null); setError(''); };
    function openModal() {
        setError(''); setEditingId(null); setName(''); setAmount(''); setRate(''); setDate(localISO());
        setAssetQuote(null); setModal(true); setMobileNav(false);
    }
    function openEdit(i: Investment) {
        setError(''); setEditingId(i.id); setKind(i.kind); setName(i.name); setAmount(String(i.amount)); setDate(i.date);
        setCurrency(i.currency); setRate(i.rate != null ? String(i.rate) : ''); setPeriod(i.period ?? 'year');
        setCoin(i.coin ?? (i.kind === 'cedear' ? 'AAPL' : 'bitcoin'));
        setAssetQuote(null); setQuoteRequest(v => v + 1); setModal(true); setMobileNav(false);
    }
    function closeModal() { setModal(false); setEditingId(null); }
    function selectCrypto(asset: CryptoAsset) {
        setKind('crypto'); setCoin(asset.id); setName(value => value.trim() ? value : asset.name.slice(0, 70));
        setAssetQuote(null); setQuoteRequest(value => value + 1); setError(''); setCryptoSearch(false); setModal(true);
    }
    function add(e: FormEvent<HTMLFormElement>) {
        e.preventDefault(); setError('');
        const value = Number(amount); const todayDate = localISO();
        if (!name.trim() || !Number.isFinite(value) || value <= 0) return setError('Ingresá un nombre y un monto válido mayor a cero.');
        if (!date || date > todayDate || !Number.isFinite(dateMillis(date))) return setError('Ingresá una fecha válida que no sea futura.');
        const cur: Currency = kind === 'crypto' ? 'USD' : kind === 'cedear' ? 'ARS' : currency;
        const investment: Investment = { id: editingId ?? crypto.randomUUID(), name: name.trim(), amount: value, currency: cur, date, kind };
        if (kind === 'rate') {
            const r = Number(rate);
            if (!rate.trim() || !Number.isFinite(r) || r <= -100) return setError('Ingresá una tasa válida superior a -100%.');
            investment.rate = r; investment.period = period;
        } else {
            const id = kind === 'cedear' ? coin.trim().toUpperCase() : coin.trim().toLowerCase();
            if (!id) return setError('Ingresá el ticker o identificador del activo.');
            if (quotePrice == null) return setError('Esperá a que se consulte el precio antes de guardar.');
            investment.coin = id; investment.units = value / quotePrice;
            if (!Number.isFinite(investment.units) || investment.units <= 0) return setError('El monto es demasiado grande o pequeño para calcular las unidades.');
            if (date === todayDate) setPrices(prev => ({ ...prev, [`${kind}:${id}`]: quotePrice }));
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
            if (!valid.length) { setNotice('El archivo no contiene inversiones válidas.'); return; }
            setImportPreview({ items: valid, skipped: list.length - valid.length });
        } catch {
            setNotice('No se pudo leer el archivo. Elegí un JSON exportado desde esta app (máx. 2 MB).');
        }
    }
    function applyImport(mode: 'merge' | 'replace') {
        if (!importPreview) return;
        const incoming = importPreview.items;
        if (mode === 'replace') {
            setItems(incoming);
            setNotice(`Cartera reemplazada: ${incoming.length} inversiones importadas.`);
        } else {
            const ids = new Set(items.map(i => i.id));
            const fresh = incoming.filter(i => !ids.has(i.id));
            const dup = incoming.length - fresh.length;
            setItems(prev => [...prev, ...fresh]);
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
            return { investments: [...current.investments, ...legacy.investments.filter(item => !ids.has(item.id))], preferences: current.investments.length ? current.preferences : legacy.preferences };
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
    if (reauthenticate) return <Login fixedEmail={account.user.email} onCancel={() => setReauthenticate(false)} onLogin={() => { setReauthenticate(false); void sync.flush(); }} />;
    const sidebarProps = {
        page, collapsed: sidebarCollapsed, onToggle: () => setSidebarCollapsed(value => !value),
        onClose: closeMobileNav, filter, onFilter: setFilter, kinds, count: allCount,
        theme, onTheme: () => setTheme(value => value === 'dark' ? 'light' : 'dark'),
        hidden, onHidden: () => setHidden(value => !value), onSearch: () => setCryptoSearch(true),
        onExport: exportJSON, onImport: () => fileRef.current?.click(),
        email: account.user.email, syncLabel, onLogout: () => void logout(), leaving,
    };
    return <div data-theme={theme} className="motion-reduce:[&_*]:animate-none! motion-reduce:[&_*]:transition-none! [&_input[type=date]]:[color-scheme:dark] data-[theme=light]:[&_input[type=date]]:[color-scheme:light] [background-image:radial-gradient(var(--line)_1px,transparent_1.2px)] [background-size:22px_22px] min-h-dvh bg-[var(--bg)] font-['Geist',sans-serif] text-[var(--ink)] [--bg:#0a0a0a] [--side:#0c0c0c] [--surface:#121212] [--raised:#1b1b1b] [--ink:#ededed] [--muted:#8c8c8c] [--faint:#575757] [--line:rgba(255,255,255,.075)] [--line2:rgba(255,255,255,.15)] data-[theme=light]:[--bg:#f2f2f1] data-[theme=light]:[--side:#f7f7f6] data-[theme=light]:[--surface:#fff] data-[theme=light]:[--raised:#efefee] data-[theme=light]:[--ink:#161616] data-[theme=light]:[--muted:#6a6a6a] data-[theme=light]:[--faint:#a5a5a5] data-[theme=light]:[--line:rgba(0,0,0,.09)] data-[theme=light]:[--line2:rgba(0,0,0,.17)]">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} aria-label="Importar archivo JSON" />
        <div inert={cryptoSearch || leaving} className="mx-auto flex min-h-dvh max-w-[1600px]">
            <Sidebar {...sidebarProps} />
            {mobileNav && <div className="fixed inset-0 z-40 bg-black/70 opacity-100 transition-opacity duration-[180ms] ease-out starting:opacity-0 motion-reduce:transition-none lg:hidden" onClick={event => { if (event.target === event.currentTarget) setMobileNav(false); }}><Sidebar {...sidebarProps} mobile /></div>}
            <main inert={mobileNav} className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-7 lg:px-9 lg:pt-7 xl:px-12">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[var(--muted)]"><span className="min-w-0 truncate" title={account.user.email}>{account.user.email}</span><span role="status" className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${view.status === 'saved' ? 'bg-[#71caa0]' : 'bg-[#f5c542]'}`} />{syncLabel}</span></div>
                {view.error && <div role="alert" className="mb-4 rounded-xl border border-[#ff7d52]/30 bg-[#ff7d52]/[.07] px-4 py-3 text-[12px]"><p>{view.error}</p><div className="mt-3 flex flex-wrap gap-4">{view.status === 'conflict' ? <button onClick={() => void reloadPortfolio()} className="underline">Cargar versión guardada</button> : view.status === 'expired' ? <button onClick={() => setReauthenticate(true)} className="underline">Ingresar de nuevo</button> : <button onClick={() => void sync.flush()} className="underline">Reintentar guardado</button>}<button onClick={() => void exportJSON()} className="underline">Exportar mis cambios</button></div></div>}
                {legacy && <div className="mb-4 rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-4 text-[12px]"><p>Encontramos {legacy.investments.length} inversiones guardadas en este navegador. Podés agregarlas a la cuenta de <strong>{account.user.email}</strong>.</p><div className="mt-3 flex gap-4"><button disabled={view.status === 'saving'} onClick={() => void importLegacy()} className="underline disabled:opacity-50">Guardar en mi cuenta</button><button onClick={() => setLegacy(null)} className="text-[var(--muted)]">Ahora no</button></div></div>}
                <div className="mb-7 flex items-center justify-between text-[12px] text-[var(--muted)]"><div className="flex items-center gap-2"><button className="mr-2 rounded-lg p-1 text-[var(--ink)] lg:hidden" aria-label="Abrir menú" aria-expanded={mobileNav} aria-controls="mobile-navigation" onClick={() => setMobileNav(true)}><HugeiconsIcon icon={MenuTwoLineFreeIcons} size={21} /></button><HugeiconsIcon icon={DashboardCircleIcon} size={15} fill="currentColor" /><HugeiconsIcon icon={ChevronRightIcon} size={13} /><span>{pageInfo.title}</span></div><div className="flex items-center gap-2 font-mono text-[11px]"><span className={`h-1.5 w-1.5 rounded-full ${priceError ? 'bg-[#ff7d52]' : 'bg-[#71caa0]'}`} />{priceError ? 'Cotizaciones parciales' : updated ? `Actualizado ${updated}` : 'Consultando cotizaciones'}</div></div>
                <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 font-mono text-[12px] text-[var(--muted)]">PANEL PERSONAL / INVERSIONES</p><h1 ref={titleRef} tabIndex={-1} className="text-[clamp(2rem,4vw,3.1rem)] font-light leading-[1.05] tracking-[-.04em] outline-none">{pageInfo.title}<span className="text-[var(--faint)]">.</span></h1><p className="mt-2 font-mono text-[12px] text-[var(--muted)]">{pageInfo.description}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setHidden(h => !h)} aria-pressed={hidden} aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'} title={hidden ? 'Mostrar montos' : 'Ocultar montos'} className="rounded-[10px] border border-[var(--line2)] bg-[var(--surface)] p-2.5 text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={hidden ? ViewOffIcon : ViewIcon} size={17} /></button><div className="inline-flex rounded-[10px] border border-[var(--line2)] bg-[var(--surface)] p-1">{(['USD', 'ARS'] as const).map(c => <button key={c} aria-pressed={display === c} onClick={() => setDisplay(c)} className={`rounded-[7px] px-3 py-1.5 font-mono text-[12px] ${display === c ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)]'}`}>{c}</button>)}</div><button type="button" onClick={openModal} className="hidden items-center gap-2 rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-[var(--bg)] transition-transform hover:-translate-y-0.5 sm:inline-flex"><HugeiconsIcon icon={PlusIcon} size={16} />Nueva inversión</button></div></header>
                {notice && <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-4 py-3 text-[12px]"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar aviso" className="text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={XIcon} size={14} /></button></div>}
                {priceError && <div role="status" className="mb-4 rounded-xl border border-[#ff7d52]/30 bg-[#ff7d52]/[.07] px-4 py-3 text-[12px] text-[var(--muted)]">Algunas cotizaciones no están disponibles. Los valores pueden estar incompletos o usar el monto original. <button onClick={() => void refresh()} className="ml-1 underline">Reintentar</button></div>}
                {!fxRate && items.some(i => i.currency !== display) && <div className="mb-4 rounded-xl border border-[#ff7d52]/30 bg-[#ff7d52]/[.07] px-4 py-3 text-[12px]">No se puede convertir toda la cartera a {display} sin la cotización del dólar {dollarName}. Los totales se muestran como —.</div>}
                <div hidden={page !== 'summary'}>
                <section className="mb-3.5 grid gap-3.5 md:grid-cols-[1.15fr_1fr]">
                    <article className={`${panel} relative flex min-h-[205px] flex-col overflow-hidden p-6 [background-image:radial-gradient(100%_110%_at_40%_150%,rgba(206,58,160,.24),transparent_75%)]`}><div className="flex items-center justify-between"><p className="text-[13px] text-[var(--muted)]">Valor actual de la cartera</p><HugeiconsIcon icon={Dollar02Icon} size={17} className="text-[var(--muted)]" /></div><p className="mt-6 break-all text-[clamp(2.2rem,4.2vw,3.55rem)] font-light leading-tight tracking-[-.045em] tabular-nums">{fmt(current)}</p><div className="mt-auto flex flex-wrap items-center gap-2 pt-4"><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[12px] ${gain >= 0 ? 'bg-[#4ade80]/10 text-[#4ade80]' : 'bg-[#ff7d52]/10 text-[#ff7d52]'}`}>{gain >= 0 ? <HugeiconsIcon icon={ChartIncreaseFreeIcons} size={14} /> : <HugeiconsIcon icon={ChartDecreaseFreeIcons} size={14} />} {Number.isFinite(gainPct) ? percent(gainPct) : '—'}</span><span className="font-mono text-[11px] text-[var(--muted)]">respecto al capital aportado</span></div></article>
                    <article className={`${panel} flex min-h-[205px] flex-col p-6 [background-image:radial-gradient(100%_100%_at_0%_0%,rgba(70,90,255,.16),transparent_72%)]`}><div className="flex items-center justify-between"><p className="text-[13px] text-[var(--muted)]">Panorama general</p><HugeiconsIcon icon={PieChart02Icon} size={17} className="text-[var(--muted)]" /></div><div className="mt-5 grid grid-cols-2 gap-4"><div><p className="font-mono text-[11px] text-[var(--muted)]">Capital invertido</p><p className="mt-1 break-all text-[clamp(1.1rem,2.2vw,1.65rem)] font-light tabular-nums">{fmt(invested)}</p></div><div><p className="font-mono text-[11px] text-[var(--muted)]">Resultado</p><p className={`mt-1 break-all text-[clamp(1.1rem,2.2vw,1.65rem)] font-light tabular-nums ${gain >= 0 ? 'text-[var(--ink)]' : 'text-[#ff7d52]'}`}>{fmt(gain)}</p></div></div>
                        <div className="mt-auto border-t border-[var(--line)] pt-4">
                            <div className="flex items-center justify-between gap-3"><label htmlFor="dollar-type" className="font-mono text-[11px] text-[var(--muted)]">Dólar para convertir</label><Select id="dollar-type" label="Dólar para convertir" size="compact" className="w-[112px] shrink-0 font-mono" value={dollar} onChange={setDollar} options={dollarOptions.map(k => ({ value: k, label: dollarLabels[k] }))} /></div>
                            <div className="mt-2 flex items-center justify-between font-mono text-[12px]"><span className="text-[var(--muted)]">Compra · Venta</span><span>{rates[dollar] ? `${rates[dollar].compra ? money(rates[dollar].compra!, 'ARS') : '—'} · ${money(rates[dollar].venta, 'ARS')}` : 'No disponible'}</span></div>
                            <QuoteSource source="dollar" label={rates[dollar] ? 'Fuente' : 'Proveedor'} className="mt-1.5" />
                            <p className="mt-1.5 font-mono text-[10px] text-[var(--faint)]">Se usa el valor de venta para convertir.</p>
                        </div></article>
                </section>
                </div>
                <div hidden={page !== 'summary' && page !== 'evolution'}>
                <section className={`${panel} mb-3.5 p-5 sm:p-6`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[16px] font-medium tracking-tight">Evolución de la cartera</h2><p className="mt-1 font-mono text-[11px] text-[var(--muted)]">Estimación de valor · no representa un historial real de mercado</p></div><div className="inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-1">{[0, 12, 36, 60].map(n => <button key={n} onClick={() => setHorizon(n)} aria-pressed={horizon === n} className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] ${horizon === n ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)]'}`}>{n === 0 ? 'Hoy' : `${n / 12}a`}</button>)}</div></div>
                    {chart ? <><div className="relative mt-7"><svg viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" className="h-[210px] w-full overflow-visible" role="img" aria-label="Gráfico estimado de evolución de la cartera"><defs><linearGradient id="invest-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7f96ff" stopOpacity=".23" /><stop offset="100%" stopColor="#7f96ff" stopOpacity="0" /></linearGradient></defs>{[.25, .5, .75, 1].map(n => <line key={n} x1="12" x2={chart.w - 12} y1={chart.h * n - 5} y2={chart.h * n - 5} stroke="var(--line)" strokeDasharray="4 5" />)}<path d={chart.area} fill="url(#invest-fill)" /><path d={chart.line} fill="none" stroke="#7f96ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /><line x1={chart.nowX} x2={chart.nowX} y1="4" y2={chart.h - 12} stroke="var(--muted)" strokeOpacity=".5" strokeDasharray="4 5" /><circle cx={chart.nowX} cy={chart.nowY} r="5" fill="#7f96ff" stroke="var(--surface)" strokeWidth="3" /></svg></div><div className="mt-2 flex justify-between font-mono text-[11px] text-[var(--muted)]"><span>{chart.first}</span><span>Hoy</span><span>{chart.last}</span></div></> : <div className="grid h-[240px] place-items-center text-center text-[13px] text-[var(--muted)]">{items.length ? 'Sin conversión de moneda disponible.' : 'Agregá tu primera inversión para visualizar la evolución.'}</div>}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4"><div><p className="font-mono text-[11px] text-[var(--muted)]">VALOR {horizon === 0 ? 'ACTUAL' : `ESTIMADO EN ${horizon} MESES`}</p><p className="mt-1 text-[21px] font-light tracking-tight tabular-nums">{fmt(projected)}</p></div><p className="max-w-xs text-right font-mono text-[10px] leading-5 text-[var(--faint)]">Solo las inversiones con tasa generan rendimiento proyectado. CEDEARs y cripto se mantienen a precio actual.</p></div>
                </section>
                </div>
                <div hidden={page !== 'summary'}>
                    {items.length > 0 && <Distribution byKind={byKind} byCurrency={byCurrency} format={fmt} />}
                </div>
                {/* <div hidden={page !== 'summary' && page !== 'evolution'}>
                    <Compare cryptos={cryptos} cedears={cedears} />
                </div> */}
                {/* <div hidden={page !== 'summary' && page !== 'simulation'}>
                    <Simulator currency={display} portfolio={hidden ? undefined : current} />
                </div> */}
                <div hidden={page !== 'summary' && page !== 'investments'}>
                <section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-5 sm:px-6"><div><h2 className="text-[16px] font-medium">Mis inversiones <span className="ml-1 font-mono text-[12px] font-normal text-[var(--faint)]">{filtered.length}</span></h2><p className="mt-1 font-mono text-[11px] text-[var(--muted)]">Activos y posiciones registradas</p></div><div className="flex items-center gap-2"><label className="relative hidden sm:block"><HugeiconsIcon icon={Search01Icon} size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" /><input aria-label="Buscar inversiones" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar activo..." className="w-44 rounded-[9px] border border-[var(--line)] bg-[var(--raised)] py-2 pl-9 pr-3 text-[12px] outline-none focus:border-[var(--muted)]" /></label><button onClick={() => void refresh()} disabled={refreshing} title="Actualizar precios" aria-label="Actualizar precios" className="rounded-[9px] border border-[var(--line)] bg-[var(--raised)] p-2.5 text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"><HugeiconsIcon icon={Refresh04Icon} size={15} className={refreshing ? 'animate-spin' : ''} /></button></div></div>
                    <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] px-4 py-3 sm:px-6">{kinds.map(k => <button key={k.id} aria-pressed={filter === k.id} onClick={() => setFilter(k.id)} className={`shrink-0 rounded-[8px] px-3 py-2 text-[12px] ${filter === k.id ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{k.id === 'all' ? 'Todas' : k.label} <span className="ml-1 font-mono text-[10px] opacity-60">{allCount(k.id)}</span></button>)}</div>
                    <div className="px-5 pt-3 sm:hidden"><input aria-label="Buscar inversiones" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar activo..." className={field} /></div>
                    {filtered.length ? <div className="divide-y divide-[var(--line)]">{filtered.map(i => { const v = valueAt(i, today, prices, today); const change = i.amount > 0 ? (v - i.amount) / i.amount * 100 : 0; const color = colorOf(i.kind); const missing = i.kind !== 'rate' && (i.coin && prices[`${i.kind}:${i.coin}`] == null); return <div key={i.id} className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-[var(--raised)]/40 sm:gap-4 sm:px-6"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: `${color}16`, color }}>{i.kind === 'rate' ? <HugeiconsIcon icon={LandmarkFreeIcons} size={19} /> : i.kind === 'cedear' ? <HugeiconsIcon icon={ChartLineIcon} size={19} /> : <HugeiconsIcon icon={Bitcoin} size={19} />}</div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{i.name}</p><p className="mt-1 truncate font-mono text-[11px] text-[var(--muted)]">{titleFor(i.kind)} · {i.kind === 'rate' ? `${i.rate}% ${i.period === 'year' ? 'anual' : 'mensual'}` : i.coin} <span className="hidden sm:inline">· {formatDate(i.date)}</span></p></div><div className="hidden text-right md:block"><p className="font-mono text-[12px] tabular-nums">{mny(i.amount, i.currency)}</p><p className="mt-1 font-mono text-[10px] text-[var(--faint)]">Invertido</p></div><div className="min-w-[110px] text-right"><p className="font-mono text-[12px] tabular-nums sm:text-[13px]">{mny(v, i.currency)}</p><p className={`mt-1 font-mono text-[11px] ${change >= 0 ? 'text-[#4ade80]' : 'text-[#ff7d52]'}`}>{missing ? 'Sin precio' : percent(change)}</p><div className="mt-1 font-mono text-[10px] text-[var(--muted)]">{i.kind === 'rate' ? <span title="Valor calculado con el monto, la fecha y la tasa que ingresaste">Tasa ingresada por vos</span> : <QuoteSource source={i.kind} asset={i.coin} label={missing ? 'Proveedor' : 'Fuente'} className="justify-end" />}</div>{missing && <p className="font-mono text-[10px] text-[var(--faint)]">Se muestra el monto original</p>}</div><div className="flex items-center"><button onClick={() => openEdit(i)} aria-label={`Editar ${i.name}`} title="Editar" className="rounded-lg p-2 text-[var(--faint)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"><HugeiconsIcon icon={Edit02Icon} size={16} /></button><button onClick={() => setConfirmDelete(i.id)} aria-label={`Eliminar ${i.name}`} title="Eliminar" className="rounded-lg p-2 text-[var(--faint)] hover:bg-[var(--surface)] hover:text-[#ff7d52]"><HugeiconsIcon icon={Delete02Icon} size={16} /></button></div></div>; })}</div> : <div className="flex flex-col items-center px-4 py-16 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--raised)]"><HugeiconsIcon icon={CoinsBitcoinIcon} size={21} className="text-[var(--muted)]" /></div><h3 className="text-[14px] font-medium">{items.length ? 'No hay inversiones con este filtro' : 'Tu cartera está vacía'}</h3><p className="mt-2 max-w-xs text-[12px] text-[var(--muted)]">{items.length ? 'Probá otra categoría o búsqueda.' : 'Empezá cargando una inversión o importá un archivo exportado.'}</p>{!items.length && <div className="mt-5 flex gap-2"><button onClick={openModal} className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-[12px] font-medium text-[var(--bg)]">Agregar inversión</button><button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line2)] bg-[var(--raised)] px-4 py-2 text-[12px]">Importar datos</button></div>}</div>}</section>
                </div>
                <footer className="mt-6 space-y-2 font-mono text-[10px] text-[var(--faint)]">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span>INVERSIONES / PANEL PERSONAL</span><span>Precios orientativos · No es asesoramiento financiero.</span></div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Fuentes de las cotizaciones"><QuoteSource source="dollar" label="Dólar" /><QuoteSource source="crypto" label="Cripto" /><QuoteSource source="cedear" label="CEDEARs" /></div>
                </footer>
            </main>
        </div>
        <button inert={mobileNav} onClick={openModal} aria-label="Nueva inversión" className="fixed bottom-6 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-[var(--ink)] text-[var(--bg)] shadow-[0_6px_24px_rgba(0,0,0,.38)] sm:hidden"><HugeiconsIcon icon={PlusIcon} size={24} /></button>
        {modal && <div inert={cryptoSearch} className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-[5px] sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}>
            <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] border border-[var(--line2)] bg-[var(--surface)] p-5 shadow-[0_25px_90px_rgba(0,0,0,.5)] sm:max-w-[470px] sm:rounded-[22px] sm:p-6">
                <div className="mb-5 flex items-start justify-between"><div><h2 id="modal-title" className="text-[24px] font-light tracking-tight">{editingId ? 'Editar inversión' : 'Nueva inversión'}</h2><p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{editingId ? 'Modificá los datos de esta posición' : 'Registrá una posición en tu cartera'}</p></div><button onClick={closeModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={XIcon} size={19} /></button></div>
                <form onSubmit={add} className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">{(['rate', 'cedear', 'crypto'] as const).map(k => <button type="button" key={k} onClick={() => pickKind(k)} aria-pressed={kind === k} className={`flex items-center justify-center gap-2 rounded-[10px] border px-2 py-2.5 text-[12px] ${kind === k ? 'border-[var(--line2)] bg-[var(--raised)]' : 'border-[var(--line)] text-[var(--muted)]'}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(k) }} />{titleFor(k)}</button>)}</div>
                    <div><label htmlFor="invest-name" className={label}>Nombre</label><input id="invest-name" required maxLength={70} className={field} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: S&P 500, plazo fijo..." /></div>
                    <div className="grid grid-cols-2 gap-3"><div><label htmlFor="invest-amount" className={label}>Monto ({kind === 'crypto' ? 'USD' : kind === 'cedear' ? 'ARS' : currency})</label><input id="invest-amount" required type="number" min="0.000001" step="any" className={field} value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" /></div><div><label htmlFor="invest-date" className={label}>Fecha de compra</label><input id="invest-date" required type="date" max={localISO()} className={field} value={date} onChange={e => { setDate(e.target.value); setAssetQuote(null); setError(''); }} /></div></div>
                    {kind === 'rate' ? <div className="grid grid-cols-3 gap-3"><div><label htmlFor="invest-rate" className={label}>Tasa (%)</label><input id="invest-rate" type="number" step="any" className={field} value={rate} onChange={e => setRate(e.target.value)} placeholder="8" /></div><div><label htmlFor="invest-currency" className={label}>Moneda</label><Select<Currency> id="invest-currency" label="Moneda" value={currency} onChange={setCurrency} options={[{ value: 'USD', label: 'USD' }, { value: 'ARS', label: 'ARS' }]} /></div><div><label htmlFor="invest-period" className={label}>Período</label><Select<Period> id="invest-period" label="Período" value={period} onChange={setPeriod} options={[{ value: 'year', label: 'Anual' }, { value: 'month', label: 'Mensual' }]} /></div></div> : <div>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label htmlFor="invest-coin" className="text-[12px] text-[var(--muted)]">{kind === 'cedear' ? 'Ticker del CEDEAR' : 'ID de CoinGecko'}</label>{kind === 'crypto' && <button type="button" onClick={() => setCryptoSearch(true)} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink)] underline underline-offset-4"><HugeiconsIcon icon={Search01Icon} size={13} />Buscar criptomoneda</button>}</div>
                        <input id="invest-coin" className={field} required value={coin} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="coin-help" onChange={e => { const nextId = kind === 'cedear' ? e.target.value.trim().toUpperCase() : e.target.value.trim().toLowerCase(); if (nextId !== assetId) setAssetQuote(null); setCoin(e.target.value); setError(''); }} placeholder={kind === 'cedear' ? 'AAPL, SPY, MELI' : 'bitcoin, ethereum, solana'} />
                        <p id="coin-help" className="mt-2 font-mono text-[10px] text-[var(--muted)]">{kind === 'crypto' ? 'El precio se consulta automáticamente en CoinGecko según la fecha de compra.' : 'Ingresá el ticker en pesos. Se consulta su cotización según la fecha de compra.'}</p>
                        <div className="mt-3 rounded-xl border border-[var(--line2)] bg-[var(--raised)] p-3.5" aria-live="polite" aria-atomic="true">
                            {!assetId ? <p className="text-[12px] text-[var(--muted)]">Ingresá {kind === 'cedear' ? 'un ticker' : 'un ID'} para consultar su precio.</p> : !validQuoteDate ? <p className="text-[12px] text-[var(--muted)]">Elegí una fecha de compra válida para consultar el precio.</p> : activeQuote?.status === 'error' ? <>
                                <p role="alert" className="text-[12px] text-[#ff7d52]">{activeQuote.message}</p>
                                <button type="button" onClick={() => { setAssetQuote(null); setQuoteRequest(value => value + 1); setError(''); }} className="mt-3 inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4"><HugeiconsIcon icon={Refresh04Icon} size={13} />Reintentar consulta</button>
                            </> : activeQuote?.status === 'ready' ? <>
                                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-[var(--muted)]">{date === todayDate ? kind === 'cedear' ? 'Última cotización por unidad' : 'Precio actual por unidad' : `Precio al ${formatDate(activeQuote.sourceDate ?? date)}`}</p><p className="mt-1 break-words font-mono text-[22px] leading-tight tracking-tight">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: kind === 'cedear' ? 'ARS' : 'USD', currencyDisplay: 'code', ...(activeQuote.price < 1 ? { maximumSignificantDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }).format(activeQuote.price)}</p></div><QuoteSource source={kind === 'cedear' ? 'cedear' : 'crypto'} asset={assetId} historical={date !== todayDate} className="shrink-0 rounded-md bg-[#71caa0]/10 px-2 py-1" /></div>
                                {kind === 'crypto' ? <a href={`https://www.coingecko.com/en/coins/${encodeURIComponent(assetId)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all font-mono text-[11px] text-[var(--muted)] underline underline-offset-4">{assetId} ↗</a> : <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">{assetId} · CEDEAR en pesos</p>}
                                {previewUnits != null && Number.isFinite(previewUnits) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[12px]"><span className="text-[var(--muted)]">Unidades estimadas</span><span className="break-all font-mono">{new Intl.NumberFormat('es-AR', { maximumSignificantDigits: 10 }).format(previewUnits)}</span></div>}
                                <p className="mt-2 text-[10px] text-[var(--muted)]">{date === todayDate ? 'Se usará esta cotización para calcular las unidades al guardar.' : kind === 'cedear' ? activeQuote.sourceDate !== date ? 'Se usa el cierre de la última rueda disponible anterior a la fecha elegida.' : 'Se usa el precio de cierre de la fecha de compra.' : 'Precio histórico de referencia a las 00:00 UTC. Se usará para calcular las unidades.'}</p>
                            </> : <p role="status" className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><HugeiconsIcon icon={LoaderPinwheelIcon} size={15} className="animate-spin" />Consultando {quoteSource}...</p>}
                        </div>
                    </div>}
                    {error && <p role="alert" className="rounded-lg bg-[#ff7d52]/10 p-3 text-[12px] text-[#ff7d52]">{error}</p>}
                    <div className="flex gap-2 border-t border-[var(--line)] pt-5"><button type="button" onClick={closeModal} className="flex-1 rounded-[10px] border border-[var(--line2)] bg-[var(--raised)] py-3 text-[13px]">Cancelar</button><button type="submit" disabled={kind !== 'rate' && quotePrice == null} className="flex-[1.3] rounded-[10px] bg-[var(--ink)] py-3 text-[13px] font-medium text-[var(--bg)] disabled:opacity-50">{editingId ? 'Guardar cambios' : 'Guardar inversión'}</button></div>
                </form>
            </div>
        </div>}
        {cryptoSearch && <CryptoSearchDialog onClose={() => setCryptoSearch(false)} onSelect={selectCrypto} />}
        {confirmDelete && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className={`${panel} w-full max-w-[390px] p-6 shadow-2xl`}><h2 id="delete-title" className="text-[20px] font-medium">Eliminar inversión</h2><p className="mt-2 text-[13px] text-[var(--muted)]">Esta acción no se puede deshacer. ¿Querés eliminar esta posición de tu cartera?</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-[var(--line2)] px-4 py-2.5 text-[13px]">Cancelar</button><button onClick={() => { setItems(prev => prev.filter(i => i.id !== confirmDelete)); setConfirmDelete(null) }} className="rounded-lg bg-[#ff7d52] px-4 py-2.5 text-[13px] font-medium text-white">Eliminar</button></div></div></div>}
        {importPreview && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="import-title" className={`${panel} w-full max-w-[430px] p-6 shadow-2xl`}><h2 id="import-title" className="text-[20px] font-medium">Importar inversiones</h2><p className="mt-2 text-[13px] text-[var(--muted)]">Se encontraron <strong className="font-medium text-[var(--ink)]">{importPreview.items.length}</strong> inversiones válidas{importPreview.skipped > 0 ? ` (${importPreview.skipped} inválidas se van a omitir)` : ''}. Tenés {items.length} cargadas ahora.</p><ul className="mt-4 space-y-1.5 text-[12px] text-[var(--muted)]"><li><strong className="font-medium text-[var(--ink)]">Combinar:</strong> suma las nuevas y omite las que ya existen.</li><li><strong className="font-medium text-[var(--ink)]">Reemplazar:</strong> borra tu cartera actual y deja solo el archivo.</li></ul><div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={() => setImportPreview(null)} className="rounded-lg border border-[var(--line2)] px-4 py-2.5 text-[13px]">Cancelar</button><button onClick={() => applyImport('replace')} className="rounded-lg border border-[#ff7d52]/40 px-4 py-2.5 text-[13px] text-[#ff7d52]">Reemplazar</button><button onClick={() => applyImport('merge')} className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-[var(--bg)]">Combinar</button></div></div></div>}
    </div>;
}
