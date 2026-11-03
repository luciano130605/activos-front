import type { Investment } from './portfolio';

const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;
const monthName = (year: number, month: number) => new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' }).format(new Date(year, month, 1));

export default function ContributionStreak({ items }: { items: Investment[] }) {
    const today = new Date();
    const current = today.getFullYear() * 12 + today.getMonth();
    const counts = new Map<string, number>();
    for (const item of items) {
        const month = item.date.slice(0, 7);
        if (month <= monthKey(today.getFullYear(), today.getMonth())) counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    const keyAt = (index: number) => monthKey(Math.floor(index / 12), index % 12);
    const months = Array.from({ length: 24 }, (_, n) => {
        const index = current - 23 + n;
        const year = Math.floor(index / 12), month = index % 12;
        return { key: keyAt(index), name: monthName(year, month), count: counts.get(keyAt(index)) ?? 0, year, month };
    });
    let cursor = counts.has(keyAt(current)) ? current : current - 1;
    let streak = 0;
    while (counts.has(keyAt(cursor))) { streak++; cursor--; }
    const currentMonth = counts.has(keyAt(current));
    return <section className="card mb-3.5 p-5 sm:p-6" aria-labelledby="streak-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="lb">CONSTANCIA</p><h2 id="streak-title" className="mt-2 text-[20px] font-light tracking-tight">Racha de aportes</h2><p className="mu mt-2 text-[12px]">Cada casilla representa un mes con al menos una inversión cargada.</p></div>
            <div className="text-left sm:text-right"><p className="text-[26px] font-light tabular-nums">{streak} <span className="text-[13px] text-[var(--muted)]">{streak === 1 ? 'mes' : 'meses'}</span></p><p className="mu text-[11px]">{currentMonth ? 'Racha actual' : streak ? 'Racha hasta el mes pasado' : 'Tu racha empieza con un aporte'}</p></div>
        </div>
        <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-12" aria-label="Aportes de los últimos 24 meses">{months.map(m => <div key={m.key} title={`${m.name}: ${m.count} ${m.count === 1 ? 'inversión' : 'inversiones'}`} aria-label={`${m.name}: ${m.count} ${m.count === 1 ? 'inversión' : 'inversiones'}`} className={`min-w-0 rounded-lg border px-1 py-2 text-center ${m.count ? 'border-[var(--sig)]/30 bg-[var(--sigbg)] text-[var(--sig)]' : 'border-[var(--line)] bg-[var(--raised)] text-[var(--muted)]'}`}><span className="block truncate text-[10px] capitalize">{new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(new Date(m.year, m.month, 1)).replace('.', '')}</span><span className="mt-1 block font-mono text-[10px]">{m.year}</span><span aria-hidden="true" className="mt-1 block text-[11px]">{m.count ? '●' : '–'}</span></div>)}</div>
        <p className="mu mt-4 text-[11px] leading-5">Se usan las fechas de las posiciones que tenés cargadas. Las inversiones eliminadas o vendidas por completo dejan de contarse; no es un historial completo de movimientos.</p>
    </section>;
}
