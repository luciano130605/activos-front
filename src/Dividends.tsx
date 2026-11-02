import { useEffect, useMemo, useState } from 'react';
import { request } from './account';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalendarMinusIcon, ChevronLeftIcon, ChevronRightIcon, Estimate01Icon, Estimate02Icon } from '@hugeicons/core-free-icons';

type Event = { payDate: string; exDate: string; amountPerShare: number; eligible: boolean; estimatedGross: number };
type Position = { id: string; name: string; ticker: string; units: number; ratio?: number; status: 'ok' | 'missing_ratio' | 'unavailable'; events?: Event[] };
type Result = { configured: boolean; items: Position[] };
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const usd = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export default function Dividends({ dirty, hidden }: { dirty: boolean; hidden: boolean }) {
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        request<Result>('dividends').then(data => { if (active) setResult(data); }).catch(() => { if (active) setError('No se pudieron consultar los dividendos. Volvé a intentar más tarde.'); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);
    const events = useMemo(() => (result?.items ?? []).flatMap(position => (position.events ?? []).map(event => ({ ...event, position }))).sort((a, b) => a.payDate.localeCompare(b.payDate)), [result]);
    const monthKey = isoDate(month).slice(0, 7);
    const monthEvents = events.filter(event => event.payDate.startsWith(monthKey));
    const shownEvents = selected ? monthEvents.filter(event => event.payDate === selected) : monthEvents;
    const total = monthEvents.reduce((sum, event) => sum + (event.eligible ? event.estimatedGross : 0), 0);
    const offset = (month.getDay() + 6) % 7;
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((offset + dayCount) / 7) * 7 }, (_, i) => i - offset + 1);
    const changeMonth = (step: number) => { setMonth(value => new Date(value.getFullYear(), value.getMonth() + step, 1)); setSelected(null); };
    const unavailable = result?.items.filter(item => item.status !== 'ok') ?? [];

    return <div className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-center justify-between text-[var(--muted)]"><span className="text-[12px]">Estimado del mes</span><HugeiconsIcon icon={Estimate01Icon} size={17} /></div><p className="mt-4 text-[clamp(1.8rem,4vw,2.6rem)] font-light tracking-tight tabular-nums">{loading || !result?.configured ? '—' : hidden ? '****' : usd(total)}</p><p className="mt-2 font-mono text-[10px] text-[var(--muted)]">BRUTO · PAGOS ANUNCIADOS DEL SUBYACENTE</p></section>
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-center justify-between text-[var(--muted)]"><span className="text-[12px]">Pagos anunciados</span><HugeiconsIcon icon={Estimate02Icon} size={17} /></div><p className="mt-4 text-[clamp(1.8rem,4vw,2.6rem)] font-light tracking-tight tabular-nums">{loading || !result?.configured ? '—' : monthEvents.length}</p><p className="mt-2 text-[11px] text-[var(--muted)]">Eventos correspondientes al mes seleccionado</p></section>
        </div>
        {dirty && <p className="rounded-xl border border-[#ffb36b]/30 bg-[#ffb36b]/5 px-4 py-3 text-[12px] text-[#ffb36b]">Hay cambios sin guardar: el calendario usa la última cartera guardada en tu cuenta.</p>}
        {loading ? <p className="p-4 text-[13px] text-[var(--muted)]" role="status">Consultando dividendos…</p> : error ? <p className="p-4 text-[13px] text-[#ff7d52]" role="alert">{error}</p> : !result?.configured ? <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 text-[13px] text-[var(--muted)]">Para consultar dividendos, configurá MASSIVE_API_KEY en el backend.</p> : <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6" aria-label="Calendario de dividendos">
                <div className="mb-6 flex items-center justify-between gap-3"><div><h2 className="text-[16px] font-medium">Calendario de pagos</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Seleccioná un día para ver el detalle</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={ChevronLeftIcon} size={16} /></button><button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente" className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={ChevronRightIcon} size={16} /></button></div></div>
                <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-[17px] font-medium capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3>{selected && <button type="button" onClick={() => setSelected(null)} className="text-[11px] text-[var(--muted)] underline">Ver todo el mes</button>}</div>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Días de ${month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="pb-2 text-center font-mono text-[10px] text-[var(--faint)]">{day}</div>)}
                    {cells.map((day, index) => { if (day < 1 || day > dayCount) return <div key={`blank-${index}`} />; const key = `${monthKey}-${String(day).padStart(2, '0')}`; const daily = monthEvents.filter(event => event.payDate === key); return <button key={key} type="button" onClick={() => setSelected(selected === key ? null : key)} aria-pressed={selected === key} aria-label={`${date(key)}: ${daily.length} pagos`} className={`relative flex min-h-[53px] flex-col items-center rounded-lg border p-1 text-[12px] transition-colors sm:min-h-[76px] sm:items-start sm:p-2 ${selected === key ? 'border-[#b59bff]/70 bg-[#b59bff]/10' : 'border-[var(--line)] hover:bg-[var(--raised)]'} ${key === isoDate(new Date()) ? 'text-[#b59bff]' : 'text-[var(--muted)]'}`}><span>{day}</span>{daily.length > 0 && <><span className="mt-auto hidden max-w-full truncate rounded bg-[#b59bff]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#b59bff] sm:block">{daily[0].position.ticker}{daily.length > 1 ? ` +${daily.length - 1}` : ''}</span><span className="mt-auto mb-1 h-1.5 w-1.5 rounded-full bg-[#b59bff] sm:hidden" /></>}</button>; })}
                </div>
            </section>
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[16px] font-medium">{selected ? date(selected) : 'Pagos del mes'}</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Fechas del activo de origen</p></div><span className="rounded-full bg-[var(--raised)] px-2.5 py-1 font-mono text-[10px] text-[var(--muted)]">{shownEvents.length}</span></div>
                {!result.items.length ? <p className="py-10 text-center text-[12px] text-[var(--muted)]">No hay CEDEARs en tu cartera guardada.</p> : !shownEvents.length ? <div className="grid min-h-[180px] place-items-center text-center"><div><HugeiconsIcon icon={CalendarMinusIcon} size={24} className="mx-auto mb-3 text-[var(--faint)]" /><p className="text-[13px] text-[var(--muted)]">No hay pagos anunciados {selected ? 'para este día' : 'para este mes'}.</p></div></div> : <div className="mt-5 divide-y divide-[var(--line)]">{shownEvents.map((event, index) => <article key={`${event.position.id}-${event.exDate}-${index}`} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[13px] font-medium">{event.position.name}</p><p className="mt-1 font-mono text-[10px] text-[var(--muted)]">{event.position.ticker} · {date(event.payDate)}</p></div><span className="shrink-0 text-right font-mono text-[12px] text-[#b59bff]">{event.eligible ? hidden ? '****' : usd(event.estimatedGross) : 'Sin derecho estimado'}</span></div><p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">Fecha ex: {date(event.exDate)} · Ratio: {event.position.ratio}:1 · {hidden ? '****' : usd(event.amountPerShare)} por acción subyacente</p>{!event.eligible && <p className="mt-1 text-[11px] text-[#ffb36b]">La compra registrada es posterior a la fecha de corte.</p>}</article>)}</div>}
                {unavailable.length > 0 && <div className="mt-4 rounded-xl border border-[#ffb36b]/25 bg-[#ffb36b]/5 p-3 text-[11px] leading-5 text-[var(--muted)]">No se pudo calcular {unavailable.map(item => item.ticker).join(', ')}: falta el ratio o la cotización de dividendos.</div>}
            </section>
        </div>}
        <p className="px-1 text-[11px] leading-5 text-[var(--muted)]">La fecha corresponde al pago del activo de origen; la acreditación del CEDEAR puede ser posterior. El monto es estimado antes de impuestos y comisiones. La elegibilidad depende de la fecha de corte y las tenencias efectivas. Ratios orientativos de <a className="underline" href="https://ferminrp.github.io/google-sheets-argento/" target="_blank" rel="noreferrer">Google Sheets Argento</a>; dividendos de <a className="underline" href="https://massive.com/docs/rest/stocks/corporate-actions/dividends" target="_blank" rel="noreferrer">Massive</a>. Verificá el pago en tu bróker.</p>
    </div>;
}
