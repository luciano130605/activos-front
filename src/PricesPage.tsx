import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Select from './Select';
import AssetSearchDialog, { type PickedAsset } from './AssetSearchDialog';
import { history, type HistoryPoint } from './AssetPerformance';
import type { Investment, PriceAlert } from './portfolio';
import type { AlertStatus } from './usePriceAlerts';

const DAY = 86400000;
const field = 'rounded-[10px] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--muted)]';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const date = (time: number) => new Date(time).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const money = (value: number, currency: string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
const typeLabels: Record<PriceAlert['kind'], string> = { price: 'Precio objetivo', variation: 'Variación fuerte', concentration: 'Concentración', dividend: 'Próximo dividendo', maturity: 'Vencimiento' };

type Props = { items: Investment[]; alerts: PriceAlert[]; statuses: Record<string, AlertStatus>; onAdd: (alert: PriceAlert) => void; onDelete: (id: string) => void };
export default function PricesPage({ items, alerts, statuses, onAdd, onDelete }: Props) {
    const held = useMemo(() => [...new Map(items.filter(item => item.kind !== 'rate' && item.coin).map(item => [`${item.kind}:${item.coin}`, item])).values()], [items]);
    const [asset, setAsset] = useState<PickedAsset | null>(() => { const item = held[0]; return item?.coin && item.kind !== 'rate' ? { kind: item.kind, id: item.coin, name: item.name } : null; });
    const [alertAsset, setAlertAsset] = useState<PickedAsset | null>(() => { const item = held[0]; return item?.coin && item.kind !== 'rate' ? { kind: item.kind, id: item.coin, name: item.name } : null; });
    const [search, setSearch] = useState<'chart' | 'alert' | null>(null);
    const [data, setData] = useState<HistoryPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [index, setIndex] = useState<number | null>(null);
    const [range, setRange] = useState('12');
    const periodOptions = [
        { value: '1', label: '1 mes' }, { value: '6', label: '6 meses' },
        { value: '12', label: '1 año' }, { value: '24', label: '2 años' },
        { value: '36', label: '3 años' }, { value: '72', label: '6 años' },
    ];
    const periodStart = (months: number) => {
        const from = new Date();
        const day = from.getDate();
        from.setDate(1); from.setMonth(from.getMonth() - months);
        from.setDate(Math.min(day, new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()));
        from.setHours(0, 0, 0, 0);
        return from.getTime();
    };
    const availablePeriods = periodOptions.filter(option => data.length > 1 && data[0].time <= periodStart(Number(option.value)) + 7 * DAY);
    const effectiveRange = availablePeriods.some(option => option.value === range) ? range : availablePeriods.at(-1)?.value ?? 'all';
    const [kind, setKind] = useState<PriceAlert['kind']>('price');
    const [direction, setDirection] = useState<'above' | 'below'>('above');
    const [threshold, setThreshold] = useState('');
    const [maturity, setMaturity] = useState('');
    const [formError, setFormError] = useState('');
    const selectedKind = asset?.kind === 'index' ? 'stock' : asset?.kind;
    const alertKind = alertAsset?.kind === 'index' ? 'stock' : alertAsset?.kind;
    const alertCurrency = alertKind === 'cedear' ? 'ARS' : 'USD';
    useEffect(() => {
        if (!asset || !selectedKind) { setData([]); return; }
        const controller = new AbortController(); setLoading(true); setError(''); setData([]); setIndex(null);
        history(selectedKind, asset.id, controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo obtener el historial.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [asset?.id, selectedKind, retry]);
    const points = useMemo(() => effectiveRange === 'all' ? data : data.filter(point => point.time >= periodStart(Number(effectiveRange))), [data, effectiveRange]);
    const chart = useMemo(() => {
        if (points.length < 2) return null;
        const min = Math.min(...points.map(point => point.price)), max = Math.max(...points.map(point => point.price));
        const span = max - min || max * .02 || 1, low = min - span * .1, high = max + span * .1;
        const x = (time: number) => 12 + (time - points[0].time) / (points[points.length-1].time - points[0].time || 1) * 826;
        const y = (value: number) => 218 - (value - low) / (high-low) * 206;
        const coords = points.map(point => ({ ...point, x: x(point.time), y: y(point.price) }));
        return { coords, path: coords.map((point, i) => `${i ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ') };
    }, [points]);
    const currency = selectedKind === 'cedear' ? 'ARS' : 'USD';
    const focused = chart?.coords[index ?? chart.coords.length - 1];
    function add(event: FormEvent) {
        event.preventDefault(); setFormError('');
        if (!alertAsset || !alertKind) return setFormError('Elegí un activo.');
        const value = Number(threshold);
        if (!Number.isFinite(value) || value <= 0 || value > 1e15 || (['concentration','dividend','maturity'].includes(kind) && value > 100)) return setFormError('Ingresá un valor válido mayor a cero. Para porcentaje o días, el máximo es 100.');
        if (kind === 'maturity' && (!maturity || maturity < iso(new Date()))) return setFormError('Elegí una fecha de vencimiento actual o futura.');
        if (alerts.length >= 200) return setFormError('Alcanzaste el límite de 200 alertas.');
        onAdd({ id: crypto.randomUUID(), kind, assetKind: alertKind, assetId: alertAsset.id, assetName: alertAsset.name, threshold: value, direction, date: kind === 'maturity' ? maturity : '' }); setThreshold(''); setMaturity('');
    }
    return <div className="space-y-3.5">
        <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="lb">EXPLORAR PRECIOS</p><h2 className="mt-2 text-[22px] font-light tracking-tight">{asset ? asset.name : 'Elegí un activo'}</h2><p className="mu mt-1 text-[12px]">{asset ? `${asset.id} · ${selectedKind === 'cedear' ? 'CEDEAR · ARS' : selectedKind === 'crypto' ? 'Cripto · USD' : 'Acción / ETF · USD'}` : 'Buscá un activo o elegí uno de tu cartera.'}</p></div><button type="button" onClick={() => setSearch('chart')} className="btn-ghost text-[12px]">Buscar activo</button></div>
            {held.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-2"><span className="mu text-[11px]">Tu cartera:</span>{held.map(item => <button type="button" key={`${item.kind}:${item.coin}`} onClick={() => { if (item.kind !== 'rate' && item.coin) setAsset({kind: item.kind, id: item.coin, name: item.name}); }} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${asset?.id === item.coin && selectedKind === item.kind ? 'border-[var(--sig)] text-[var(--sig)]' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item.coin}</button>)}</div>}
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><div><p className="lb">EVOLUCIÓN DEL PRECIO</p><p className="mu mt-3 text-[11px]">{index === null ? 'Último dato del período' : 'Precio seleccionado'}</p><p className="mt-1 text-[28px] font-light tabular-nums">{focused ? money(focused.price, currency) : '—'}</p><p className="mu mt-1 text-[11px]">{focused ? date(focused.time) : 'Sin datos en este período'}</p></div><div className="w-[170px]"><label htmlFor="price-period" className="mb-2 block text-[11px] text-[var(--muted)]">Período</label><Select id="price-period" label="Período de precios" value={effectiveRange} onChange={value => { setRange(value); setIndex(null); }} options={[...periodOptions.map(option => ({ ...option, disabled: !availablePeriods.some(available => available.value === option.value) })), ...(effectiveRange === 'all' ? [{ value: 'all', label: 'Historial disponible' }] : [])]} /></div></div>
            {data.length > 1 && availablePeriods.length < periodOptions.length && <p className="mu mt-3 text-[11px]">Los períodos sin historial suficiente están deshabilitados.</p>}
            {loading ? <div className="grid h-[240px] place-items-center text-[12px] text-[var(--muted)]" role="status">Consultando historial…</div> : error ? <div className="grid h-[240px] place-items-center text-center text-[12px] text-[var(--muted)]"><div><p role="alert">{error}</p><button onClick={() => setRetry(n => n + 1)} className="mt-3 underline">Reintentar</button></div></div> : chart ? <><div className="relative mt-6 touch-pan-y" role="slider" tabIndex={0} aria-label="Explorar precios históricos con las flechas" aria-valuemin={0} aria-valuemax={chart.coords.length - 1} aria-valuenow={index ?? chart.coords.length - 1} aria-valuetext={focused ? `${date(focused.time)}: ${money(focused.price, currency)}` : ''} onBlur={() => setIndex(null)} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setIndex(i => Math.max(0, Math.min(chart.coords.length - 1, (i ?? chart.coords.length - 1) + (e.key === 'ArrowRight' ? 1 : -1)))); } }} onPointerDown={e => {const rect = e.currentTarget.getBoundingClientRect(), target = (e.clientX - rect.left) / rect.width * 850; let best = 0; chart.coords.forEach((point, i) => {if (Math.abs(point.x - target) < Math.abs(chart.coords[best].x - target)) best = i;}); setIndex(best);}} onPointerMove={e => {const rect = e.currentTarget.getBoundingClientRect(), target = (e.clientX - rect.left) / rect.width * 850; let best = 0; chart.coords.forEach((point, i) => {if (Math.abs(point.x - target) < Math.abs(chart.coords[best].x - target)) best = i;}); setIndex(best);}} onPointerLeave={e => {if (e.pointerType === 'mouse') setIndex(null);}}><svg viewBox="0 0 850 230" preserveAspectRatio="none" className="h-[230px] w-full overflow-visible" aria-hidden="true"><defs><linearGradient id="prices-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--sig)" stopOpacity=".25"/><stop offset="100%" stopColor="var(--sig)" stopOpacity="0"/></linearGradient></defs>{[.25,.5,.75,1].map(n => <line key={n} x1="12" x2="838" y1={230*n-5} y2={230*n-5} stroke="var(--line2)" strokeDasharray="4 6"/>)}<path d={`${chart.path} L 838 218 L 12 218 Z`} fill="url(#prices-fill)"/><path d={chart.path} fill="none" stroke="var(--sig)" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>{focused && <><line x1={focused.x} x2={focused.x} y1="4" y2="218" stroke="var(--muted)" strokeDasharray="4 5"/><circle cx={focused.x} cy={focused.y} r="5" fill="var(--sig)" stroke="var(--surface)" strokeWidth="3"/></>}</svg>{index !== null && focused && <div className="pointer-events-none absolute top-2 z-10 rounded-lg border border-[var(--line2)] bg-[var(--raised)] px-3 py-2 shadow-lg" style={{left:`${Math.max(2, Math.min(98, focused.x / 850 * 100))}%`,transform: focused.x > 425 ? 'translateX(-100%)' : undefined}}><p className="mu whitespace-nowrap text-[10px]">{date(focused.time)}</p><p className="mt-1 whitespace-nowrap font-mono text-[12px]">{money(focused.price,currency)}</p></div>}</div><div className="mu mt-2 flex justify-between text-[11px]"><span>{date(points[0].time)}</span><span>{date(points[points.length-1].time)}</span></div></> : <div className="grid h-[240px] place-items-center text-center text-[12px] text-[var(--muted)]">{asset ? 'No hay suficientes datos en el período seleccionado.' : 'Elegí un activo para ver su evolución.'}</div>}
            <p className="mu mt-5 border-t border-[var(--line)] pt-4 text-[10.5px] leading-5">Precios históricos provistos por {selectedKind === 'crypto' ? 'CoinGecko' : selectedKind === 'cedear' ? 'Data912' : 'proveedores de acciones'}. El historial disponible depende del proveedor; cripto puede estar limitado a 365 días. Las cotizaciones no necesariamente son en tiempo real.</p>
        </section>
        <div className="grid items-start gap-3.5 xl:grid-cols-2"><section className="card p-5 sm:p-6"><p className="lb">CREAR ALERTA</p><h2 className="mt-2 text-[20px] font-light tracking-tight">Seguí lo que te importa</h2><form onSubmit={add} className="mt-5 space-y-4"><div><span className="block text-[11px] text-[var(--muted)]">Activo de la alerta</span><button type="button" onClick={() => setSearch('alert')} className={`${field} mt-1.5 flex w-full items-center justify-between gap-3 text-left hover:border-[var(--line2)]`}><span>{alertAsset ? `${alertAsset.name} · ${alertAsset.id}` : 'Elegí un activo'}</span><span className="shrink-0 text-[var(--muted)]">Buscar ›</span></button></div><div><span className="block text-[11px] text-[var(--muted)]">Tipo de alerta</span><Select<PriceAlert['kind']> label="Tipo de alerta" className="mt-1.5 w-full" value={kind} onChange={value => {setKind(value); setThreshold(''); setFormError('');}} options={(Object.entries(typeLabels) as [PriceAlert['kind'], string][]).map(([value, label]) => ({ value, label }))} /></div>{(kind === 'price' || kind === 'variation') && <div><span className="block text-[11px] text-[var(--muted)]">Condición</span><Select<'above' | 'below'> label="Condición" className="mt-1.5 w-full" value={direction} onChange={setDirection} options={[{value: 'above', label: kind === 'price' ? 'Precio igual o superior' : 'Sube al menos'}, {value: 'below', label: kind === 'price' ? 'Precio igual o inferior' : 'Baja al menos'}]} /></div>}{kind === 'maturity' && <label className="block text-[11px] text-[var(--muted)]">Fecha de vencimiento<input type="date" min={iso(new Date())} value={maturity} onChange={e => setMaturity(e.target.value)} className={`${field} mt-1.5 w-full`}/></label>}<label className="block text-[11px] text-[var(--muted)]">{kind === 'price' ? `Precio objetivo (${alertCurrency})` : kind === 'variation' ? 'Variación en 24 horas (%)' : kind === 'concentration' ? 'Participación de la cartera (%)' : 'Avisar con hasta (días)'}<input type="number" inputMode="decimal" min="0.000001" step="any" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder={kind === 'price' ? 'Ej. 150' : kind === 'variation' ? 'Ej. 5' : kind === 'concentration' ? 'Ej. 25' : 'Ej. 7'} className={`${field} mt-1.5 w-full`}/></label>{kind === 'concentration' && <p className="mu text-[11px]">Suma las posiciones de este activo; requiere que esté en tu cartera.</p>}{kind === 'dividend' && <p className="mu text-[11px]">Requiere acciones o CEDEARs en la cartera guardada y la fuente de dividendos configurada. Puede incluir pagos estimados.</p>}{kind === 'maturity' && <p className="mu text-[11px]">La fecha se carga manualmente y se revisa mientras usás la app.</p>}{formError && <p role="alert" className="text-[12px] text-[var(--neg)]">{formError}</p>}<button className="btn-primary" disabled={!alertAsset}>Crear alerta</button></form></section>
        <section className="card p-5 sm:p-6"><p className="lb">MIS ALERTAS · {alerts.length}</p><h2 className="mt-2 text-[20px] font-light tracking-tight">Tu seguimiento</h2><p className="mu mt-2 text-[11px] leading-5">Se revisan mientras la app está abierta. Notificaciones del dispositivo y correo: próximamente.</p><div className="mt-4 divide-y divide-[var(--line)]">{alerts.length ? alerts.map(alert => { const state = statuses[alert.id]; return <article key={alert.id} className="flex items-start gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{alert.assetName} <span className="mu text-[11px]">{alert.assetId}</span></p><p className="mu mt-1 text-[11px]">{typeLabels[alert.kind]} · {alert.kind === 'price' ? `${alert.direction === 'above' ? '≥' : '≤'} ${money(alert.threshold, alert.assetKind === 'cedear' ? 'ARS' : 'USD')}` : alert.kind === 'variation' ? `${alert.direction === 'above' ? 'sube' : 'baja'} ${alert.threshold}%` : alert.kind === 'concentration' ? `≥ ${alert.threshold}%` : `${alert.threshold} días${alert.date ? ` · ${alert.date}` : ''}`}</p><p className={`mt-1 text-[11px] ${state?.state === 'triggered' ? 'text-[var(--sig)]' : 'text-[var(--muted)]'}`}>{state?.state === 'triggered' ? '● Activada · ' : state?.state === 'unavailable' ? '○ Sin datos · ' : '○ En seguimiento · '}{state?.message ?? 'Consultando…'}</p></div><button type="button" onClick={() => onDelete(alert.id)} className="text-[11px] text-[var(--muted)] underline hover:text-[var(--neg)]" aria-label={`Eliminar alerta de ${alert.assetName}`}>Eliminar</button></article>; }) : <p className="py-8 text-[12px] text-[var(--muted)]">Todavía no creaste alertas.</p>}</div></section></div>
        {search && <AssetSearchDialog initial={(search === 'alert' ? alertAsset?.kind : asset?.kind) ?? 'crypto'} onClose={() => setSearch(null)} onSelect={value => { if (search === 'alert') { setAlertAsset(value); setThreshold(''); setFormError(''); } else setAsset(value); setSearch(null); }} footer={search === 'alert' ? 'Elegí el activo que querés seguir con esta alerta.' : 'Elegí un activo para ver sus precios.'} />}
    </div>;
}
