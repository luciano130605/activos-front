import { useEffect, useMemo, useState } from 'react';
import { request } from './account';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Calendar03Icon, CalendarMinusIcon, ChevronLeftIcon, ChevronRightIcon, ListViewIcon, RightToLeftListBulletIcon } from '@hugeicons/core-free-icons';

type Event = { payDate: string; exDate: string; amountPerShare: number; eligible: boolean; estimatedGross: number };
type Position = { id: string; name: string; ticker: string; units: number; ratio?: number; status: 'ok' | 'missing_ratio' | 'unavailable'; events?: Event[] };
type Result = { configured: boolean; items: Position[] };
type Row = Event & { position: Position };
const at = (value: string) => new Date(`${value}T12:00:00`);
const date = (value: string) => at(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const usd = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const daysUntil = (iso: string) => Math.round((at(iso).getTime() - at(isoDate(new Date())).getTime()) / 86_400_000);

export default function Dividends({ dirty, hidden }: { dirty: boolean; hidden: boolean }) {
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'agenda' | 'calendar'>('agenda');
    const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        request<Result>('dividends').then(data => { if (active) setResult(data); }).catch(() => { if (active) setError('No se pudieron consultar los dividendos. Volvé a intentar más tarde.'); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);
    const money = (n: number) => hidden ? '****' : usd(n);
    const events = useMemo<Row[]>(() => (result?.items ?? []).flatMap(position => (position.events ?? []).map(event => ({ ...event, position }))).sort((a, b) => a.payDate.localeCompare(b.payDate)), [result]);
    const todayIso = isoDate(new Date());
    const upcoming = events.filter(e => e.payDate >= todayIso);
    const next = upcoming.find(e => e.eligible) ?? upcoming[0];
    const upcomingTotal = upcoming.reduce((s, e) => s + (e.eligible ? e.estimatedGross : 0), 0);
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
            <p className="mu mt-1 text-[11px]">{when(e.payDate)} · fecha ex {date(e.exDate)} · ratio {e.position.ratio}:1</p>
            <p className="mu mt-1 text-[11px]">{money(e.amountPerShare)} por acción subyacente · {e.position.units.toLocaleString('es-AR', { maximumFractionDigits: 6 })} CEDEARs</p>
            {!e.eligible && <p className="mt-1 text-[11px] text-[var(--neg)]">Tu compra es posterior a la fecha de corte: sin derecho.</p>}</div>
        <span className={`pill ${e.eligible ? '' : 'neg'}`}>{e.eligible ? money(e.estimatedGross) : 'Sin derecho'}</span>
    </article>;

    return <div className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {kpi('01 — PRÓXIMO PAGO', ready && next ? date(next.payDate) : '—', next ? `${next.position.ticker} · ${when(next.payDate)}` : 'Sin pagos anunciados')}
            {kpi('02 — A COBRAR (ANUNCIADO)', ready ? money(upcomingTotal) : '—', 'Bruto · pagos futuros con derecho', true)}
            {kpi('03 — ESTIMADO DEL MES', ready ? money(monthTotal) : '—', month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))}
            {kpi('04 — PAGOS ANUNCIADOS', ready ? String(upcoming.length) : '—', `${byTicker.length} ${byTicker.length === 1 ? 'activo' : 'activos'} con derecho`)}
        </div>
        {dirty && <p className="rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-4 py-3 text-[12px]">Hay cambios sin guardar: los dividendos usan la última cartera guardada en tu cuenta.</p>}
        {loading ? <p className="p-4 text-[13px] text-[var(--muted)]" role="status">Consultando dividendos…</p> : error ? <p className="p-4 text-[13px] text-[var(--neg)]" role="alert">{error}</p> : !result?.configured ? <p className="card p-5 text-[13px] text-[var(--muted)]">Para consultar dividendos, configurá MASSIVE_API_KEY en el backend.</p> : <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
            <section className="card p-5 sm:p-6" aria-label="Pagos de dividendos">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[20px] font-light tracking-tight">{view === 'agenda' ? 'Próximos pagos' : 'Calendario de pagos'}</h2>
                    <div className="seg" role="group" aria-label="Vista"><button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}><HugeiconsIcon icon={RightToLeftListBulletIcon} size={14} className="mr-1.5 inline" />Lista</button><button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><HugeiconsIcon icon={Calendar01Icon} size={14} className="mr-1.5 inline" />Calendario</button></div>
                </div>
                {view === 'agenda' ? (byMonth.length ? byMonth.map(([key, rows]) => <div key={key} className="mb-5 last:mb-0"><div className="mb-1 flex items-center justify-between"><h3 className="lb capitalize">{at(`${key}-01`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3><span className="mu text-[11px]">{money(rows.reduce((s, e) => s + (e.eligible ? e.estimatedGross : 0), 0))}</span></div>{rows.map((e, i) => payRow(e, `${e.position.id}-${e.exDate}-${i}`))}</div>) : <div className="grid min-h-[200px] place-items-center text-center"><div><HugeiconsIcon icon={CalendarMinusIcon} size={24} className="mx-auto mb-3 text-[var(--faint)]" /><p className="text-[13px] text-[var(--muted)]">{result.items.length ? 'No hay pagos futuros anunciados.' : 'No hay CEDEARs en tu cartera guardada.'}</p></div></div>) : <>
                    <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-[16px] font-medium capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3><div className="flex items-center gap-1">{selected && <button type="button" onClick={() => setSelected(null)} className="mu mr-2 underline">Ver todo el mes</button>}<button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="ibtn !h-9 !w-9"><HugeiconsIcon icon={ChevronLeftIcon} size={16} /></button><button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente" className="ibtn !h-9 !w-9"><HugeiconsIcon icon={ChevronRightIcon} size={16} /></button></div></div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Días de ${month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}>
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} className="mu pb-2 text-center text-[10px]">{d}</div>)}
                        {cells.map((day, index) => { if (day < 1 || day > dayCount) return <div key={`b-${index}`} />; const key = `${monthKey}-${String(day).padStart(2, '0')}`; const daily = monthEvents.filter(e => e.payDate === key); return <button key={key} type="button" onClick={() => setSelected(selected === key ? null : key)} aria-pressed={selected === key} aria-label={`${date(key)}: ${daily.length} pagos`} className={`relative flex min-h-[53px] flex-col items-center rounded-lg border p-1 text-[12px] transition-colors sm:min-h-[76px] sm:items-start sm:p-2 ${selected === key ? 'border-[var(--sig)] bg-[var(--sigbg)]' : 'border-[var(--line)] hover:bg-[var(--raised)]'} ${key === todayIso ? 'font-semibold text-[var(--sig)]' : 'text-[var(--muted)]'}`}><span>{day}</span>{daily.length > 0 && <><span className="mt-auto hidden max-w-full truncate rounded bg-[var(--sigbg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--sig)] sm:block">{daily[0].position.ticker}{daily.length > 1 ? ` +${daily.length - 1}` : ''}</span><span className="mb-1 mt-auto h-1.5 w-1.5 rounded-full bg-[var(--sig)] sm:hidden" /></>}</button>; })}
                    </div>
                    {shownEvents.length > 0 && <div className="mt-5">{shownEvents.map((e, i) => payRow(e, `c-${e.position.id}-${e.exDate}-${i}`))}</div>}
                </>}
            </section>
            <section className="card p-5 sm:p-6"><p className="lb">POR ACTIVO</p><h2 className="mt-2 text-[20px] font-light tracking-tight">Quién paga más</h2>
                {byTicker.length ? <ul className="mt-5 space-y-4">{byTicker.map(([ticker, amount]) => <li key={ticker}><div className="mb-1.5 flex items-baseline justify-between"><span className="font-mono text-[12px]">{ticker}</span><span className="font-mono text-[12px] tabular-nums">{money(amount)}</span></div><div className="trk !h-2"><b style={{ left: 0, width: `${amount / byTicker[0][1] * 100}%`, right: 'auto' }} /></div></li>)}</ul> : <p className="mu mt-6 text-[12px]">Todavía no hay pagos con derecho para mostrar.</p>}
                {unavailable.length > 0 && <div className="mt-6 rounded-xl border border-[var(--line2)] bg-[var(--raised)] p-3 text-[11px] leading-5 text-[var(--muted)]">No se pudo calcular {unavailable.map(i => i.ticker).join(', ')}: falta el ratio o la cotización de dividendos.</div>}
            </section>
        </div>}
        <p className="px-1 text-[11px] leading-5 text-[var(--muted)]">La fecha corresponde al pago del activo de origen; la acreditación del CEDEAR puede ser posterior. El monto es estimado, bruto, antes de impuestos y comisiones. La elegibilidad depende de la fecha de corte y las tenencias efectivas. Ratios orientativos de <a className="underline" href="https://ferminrp.github.io/google-sheets-argento/" target="_blank" rel="noreferrer">Google Sheets Argento</a>; dividendos de <a className="underline" href="https://massive.com/docs/rest/stocks/corporate-actions/dividends" target="_blank" rel="noreferrer">Massive</a>. Verificá el pago en tu bróker.</p>
    </div>;
}
