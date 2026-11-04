import { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@hugeicons/core-free-icons';
import { request } from './account';
import type { Investment } from './portfolio';

type CalendarEvent = { date: string; title: string; detail: string; category: 'mercados' | 'tesoro'; source: string };
type Earnings = { date: string; items: { ticker: string; name: string; time: string }[] };
const byma = 'https://www.byma.com.ar/mercado/calendario-bursatil';
const nyse = 'https://www.nyse.com/trade/hours-calendars';
const treasury = 'https://www.argentina.gob.ar/economia/finanzas/licitaciones-de-letras-y-bonos-del-tesoro/cronograma-2026';
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const bymaDays: [string, string, string][] = [
    ['02-16', 'Carnaval', 'Sin negociación'], ['02-17', 'Carnaval', 'Sin negociación'], ['03-23', 'Día con fines turísticos', 'Negociación sin liquidación'], ['03-24', 'Día de la Memoria', 'Sin negociación'], ['04-02', 'Día de Malvinas', 'Sin negociación'], ['04-03', 'Viernes Santo', 'Sin negociación'], ['05-01', 'Día del Trabajador', 'Sin negociación'], ['05-25', 'Revolución de Mayo', 'Sin negociación'], ['06-15', 'Paso a la inmortalidad de Güemes', 'Sin negociación'], ['07-09', 'Día de la Independencia', 'Sin negociación'], ['07-10', 'Día con fines turísticos', 'Negociación sin liquidación'], ['08-17', 'Paso a la inmortalidad de San Martín', 'Sin negociación'], ['10-12', 'Respeto a la Diversidad Cultural', 'Sin negociación'], ['11-06', 'Día del Bancario', 'Negociación sin liquidación'], ['11-09', 'Visita papal', 'Jornada especial; consultá el comunicado de BYMA'], ['11-10', 'Visita papal', 'Jornada especial; consultá el comunicado de BYMA'], ['11-23', 'Día de la Soberanía Nacional', 'Sin negociación'], ['12-07', 'Día con fines turísticos', 'Negociación sin liquidación'], ['12-08', 'Inmaculada Concepción', 'Sin negociación'], ['12-24', 'Nochebuena', 'Negociación sin liquidación'], ['12-25', 'Navidad', 'Sin negociación'], ['12-31', 'Fin de año', 'Sin negociación ni liquidación'],
];
const usDays: [string, string, string][] = [['01-01','Año Nuevo','Cerrado'],['01-19','Día de Martin Luther King','Cerrado'],['02-16','Día de los Presidentes','Cerrado'],['04-03','Viernes Santo','Cerrado'],['05-25','Memorial Day','Cerrado'],['06-19','Juneteenth','Cerrado'],['07-03','Día de la Independencia (observado)','Cerrado'],['09-07','Día del Trabajo','Cerrado'],['11-26','Acción de Gracias','Cerrado'],['11-27','Día posterior a Acción de Gracias','Cierre a las 13:00 de Nueva York'],['12-24','Nochebuena','Cierre a las 13:00 de Nueva York'],['12-25','Navidad','Cerrado']];
const auctions: [string, number[]][] = [['01',[14,28]],['02',[11,25]],['03',[12,27]],['04',[15,28]],['07',[15,29]],['08',[12,27]],['09',[11,28]],['10',[14,28]],['11',[11,26]],['12',[11]]];
const events: CalendarEvent[] = [
    ...bymaDays.map(([day, title, detail]) => ({ date: `2026-${day}`, title: `BYMA · ${title}`, detail, category: 'mercados' as const, source: byma })),
    ...usDays.map(([day, title, detail]) => ({ date: `2026-${day}`, title: `NYSE y Nasdaq · ${title}`, detail, category: 'mercados' as const, source: nyse })),
    ...auctions.flatMap(([month, days]) => days.map(day => ({ date: `2026-${month}-${pad(day)}`, title: 'Licitación del Tesoro argentino', detail: 'Fecha prevista en el cronograma oficial; sujeta a cambios.', category: 'tesoro' as const, source: treasury }))),
    { date: '2026-11-30', title: 'Vencimiento de letra del Tesoro vinculada al dólar', detail: 'Vencimiento previsto de la letra emitida por la Resolución Conjunta 55/2026.', category: 'tesoro', source: 'https://www.argentina.gob.ar/normativa/nacional/norma-430114/texto' },
    { date: '2026-11-30', title: 'Vencimiento S30N6', detail: 'Letra del Tesoro en pesos; fecha prevista, sujeta a canjes u otras modificaciones.', category: 'tesoro', source: 'https://www.argentina.gob.ar/node/492012' },
    { date: '2026-12-15', title: 'Vencimientos TZXD6 y TTD26', detail: 'Bonos del Tesoro en pesos; fechas previstas, sujetas a canjes u otras modificaciones.', category: 'tesoro', source: 'https://www.argentina.gob.ar/node/499613' },
];
const aliases: Record<string, string> = { BRKB: 'BRK.B', GOOGLE: 'GOOGL' };

export default function MarketCalendar({ investments }: { investments: Investment[] }) {
    const [month, setMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1); });
    const [selected, setSelected] = useState(() => iso(new Date()));
    const [filter, setFilter] = useState<'todos' | 'mercados' | 'balances' | 'tesoro'>('todos');
    const [onlyMine, setOnlyMine] = useState(false);
    const [earnings, setEarnings] = useState<Earnings | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const monthKey = iso(month).slice(0, 7);
    const mine = useMemo(() => new Set(investments.filter(item => item.kind === 'cedear' && item.coin).map(item => aliases[item.coin!.toUpperCase()] ?? item.coin!.toUpperCase())), [investments]);
    const monthEvents = events.filter(event => event.date.startsWith(monthKey) && (filter === 'todos' || filter === event.category));
    const selectedEvents = monthEvents.filter(event => event.date === selected);
    const showEarnings = filter === 'todos' || filter === 'balances';
    useEffect(() => {
        if (!showEarnings) return;
        let active = true;
        setError(''); setEarnings(null); setLoading(true);
        const key = `activos:balances:${selected}`;
        try {
            const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
            if (cached && Date.now() >= cached.time && Date.now() - cached.time < 86400000 && cached.data?.date === selected && Array.isArray(cached.data.items)) {
                setEarnings(cached.data); setLoading(false); return;
            }
        } catch { /* La consulta sigue funcionando sin almacenamiento local. */ }
        request<Earnings>(`market-calendar/earnings?date=${selected}`).then(data => {
            if (!active) return;
            setEarnings(data);
            try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch { /* Sin caché. */ }
        }).catch(() => { if (active) setError('No se pudieron consultar los balances de este día.'); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [selected, showEarnings]);
    const selectedEarnings = (earnings?.date === selected ? earnings.items : []).filter(item => !onlyMine || mine.has(item.ticker.toUpperCase())).slice().sort((a, b) => Number(mine.has(b.ticker.toUpperCase())) - Number(mine.has(a.ticker.toUpperCase())) || a.ticker.localeCompare(b.ticker));
    const totalPages = Math.max(1, Math.ceil(selectedEarnings.length / 10));
    const currentPage = Math.min(page, totalPages);
    const offset = (month.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i - offset + 1);
    const changeMonth = (step: number) => { const next = new Date(month.getFullYear(), month.getMonth() + step, 1); setMonth(next); setSelected(iso(next)); setPage(1); };
    return <div className="space-y-3.5">
        <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="lb">AGENDA DEL MERCADO</p><h2 className="mt-2 text-[20px] font-light tracking-tight">Eventos y fechas importantes</h2><p className="mu mt-2 text-[12px]">Feriados bursátiles, balances y deuda argentina en un solo lugar.</p></div><div className="seg flex-wrap" role="group" aria-label="Filtrar eventos">{([['todos','Todos'],['mercados','Mercados'],['balances','Balances'],['tesoro','Tesoro']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setPage(1); }}>{label}</button>)}</div></div>
            <div className="mt-5 flex items-center justify-between"><h3 className="text-[16px] font-medium capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3><div className="flex gap-1"><button type="button" className="ibtn !h-9 !w-9" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><HugeiconsIcon icon={ChevronLeftIcon} size={16}/></button><button type="button" className="ibtn !h-9 !w-9" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><HugeiconsIcon icon={ChevronRightIcon} size={16}/></button></div></div>
            <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label="Días del mes">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(day => <div key={day} className="mu pb-2 text-center text-[10px]">{day}</div>)}{cells.map((day, i) => { if (day < 1 || day > count) return <div key={`blank-${i}`} />; const key = `${monthKey}-${pad(day)}`; const daily = monthEvents.filter(event => event.date === key); return <button key={key} type="button" onClick={() => { setSelected(key); setPage(1); }} aria-pressed={selected === key} aria-label={`${dateLabel(key)}: ${daily.length} eventos de mercado y Tesoro`} className={`flex min-h-[52px] flex-col items-center rounded-lg border p-1 text-[12px] sm:min-h-[76px] sm:items-start sm:p-2 ${selected === key ? 'border-[var(--sig)] bg-[var(--sigbg)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--raised)]'}`}><span>{day}</span>{daily.length > 0 && <span className="mt-auto rounded bg-[var(--sigbg)] px-1 text-[10px] text-[var(--sig)]">{daily.length}</span>}</button>; })}</div>
            <p className="mu mt-3 text-[11px]">Los indicadores del calendario muestran eventos de mercados y Tesoro. Seleccioná un día para consultar sus balances.</p>
        </section>
        <section className="card p-5 sm:p-6"><h3 className="text-[18px] font-medium capitalize">{dateLabel(selected)}</h3>
            {selectedEvents.map(event => <article key={`${event.date}-${event.title}`} className="mt-4 border-t border-[var(--line)] pt-4"><p className="text-[13px] font-medium">{event.title}</p><p className="mu mt-1 text-[12px]">{event.detail} · <a className="underline" href={event.source} target="_blank" rel="noreferrer">Fuente oficial</a></p></article>)}
            {showEarnings && <div className="mt-5 border-t border-[var(--line)] pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[14px] font-medium">Balances de empresas</p><p className="mu mt-1 text-[11px]">Primero los activos que coinciden con tu cartera.</p></div><label className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><input type="checkbox" checked={onlyMine} onChange={event => { setOnlyMine(event.target.checked); setPage(1); }} />Solo mi cartera</label></div>
                {loading ? <p role="status" className="mu mt-4 text-[12px]">Consultando balances…</p> : error ? <p role="alert" className="mt-4 text-[12px] text-[var(--neg)]">{error}</p> : selectedEarnings.length ? <><div className="mt-3">{selectedEarnings.slice((currentPage - 1) * 10, currentPage * 10).map((item, i) => <article key={`${item.ticker}-${i}`} className="flex items-center justify-between gap-3 border-t border-[var(--line)] py-3"><div><p className="text-[13px] font-medium">{item.name} <span className="mu">{item.ticker}</span>{mine.has(item.ticker.toUpperCase()) && <span className="ml-2 text-[10px] text-[var(--sig)]">EN MI CARTERA</span>}</p><p className="mu mt-1 text-[11px]">{item.time}</p></div></article>)}</div>{totalPages > 1 && <nav aria-label="Páginas de balances" className="mt-3 flex items-center justify-between"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="btn-ghost text-[12px] disabled:opacity-30">Anterior</button><span className="mu text-[12px]">Página {currentPage} de {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="btn-ghost text-[12px] disabled:opacity-30">Siguiente</button></nav>}</> : <p className="mu mt-4 text-[12px]">{onlyMine ? 'No se encontraron balances de tu cartera para este día.' : 'No se encontraron balances para este día.'}</p>}
                <p className="mu mt-4 text-[11px]">Fechas de <a href="https://www.nasdaq.com/market-activity/earnings" target="_blank" rel="noreferrer" className="underline">Nasdaq</a>; pueden ser estimadas y cambiar. La coincidencia con tu cartera se basa en el ticker y puede no reconocer todos los CEDEARs.</p>
            </div>}
            {!selectedEvents.length && !showEarnings && <p className="mu mt-4 text-[12px]">No hay eventos cargados para este día.</p>}
        </section>
        <p className="mu px-1 text-[11px] leading-5">Feriados y licitaciones: fechas publicadas para 2026, consultadas el 3 de noviembre de 2026; pueden cambiar y la cobertura de vencimientos de deuda es parcial. Horario regular de NYSE y Nasdaq: 9:30 a 16:00, hora de Nueva York. Consultá los <a href="https://www.byma.com.ar/mercado/horarios" target="_blank" rel="noreferrer" className="underline">horarios de BYMA</a>, que varían según el instrumento. Para otras fechas y vencimientos, verificá las fuentes oficiales.</p>
    </div>;
}
