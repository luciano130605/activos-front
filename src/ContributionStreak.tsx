import { useState } from 'react';
import type { Investment } from './portfolio';

const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;
const monthName = (year: number, month: number) => new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
const money = (value: number, currency: 'ARS' | 'USD') => new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);

type Month = { key: string; name: string; count: number; ars: number; usd: number; year: number; month: number };

export default function ContributionStreak({ items, hidden }: { items: Investment[]; hidden: boolean }) {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const today = new Date();
    const current = today.getFullYear() * 12 + today.getMonth();
    const counts = new Map<string, number>();
    for (const item of items) {
        const month = item.date.slice(0, 7);
        if (month <= monthKey(today.getFullYear(), today.getMonth())) counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    const keyAt = (index: number) => monthKey(Math.floor(index / 12), index % 12);
    const months: Month[] = Array.from({ length: 24 }, (_, n) => {
        const index = current - 23 + n;
        const year = Math.floor(index / 12), month = index % 12, key = keyAt(index);
        const matching = items.filter(i => i.date.slice(0, 7) === key);
        return { key, name: monthName(year, month), count: matching.length, ars: matching.filter(i => i.currency === 'ARS').reduce((sum, i) => sum + i.amount, 0), usd: matching.filter(i => i.currency === 'USD').reduce((sum, i) => sum + i.amount, 0), year, month };
    });
    let cursor = counts.has(keyAt(current)) ? current : current - 1;
    let streak = 0;
    while (counts.has(keyAt(cursor))) { streak++; cursor--; }
    const currentMonth = counts.has(keyAt(current));
    const selected = months.find(m => m.key === selectedKey) ?? months[months.length - 1];
    const amounts = (month: Month) => hidden ? '****' : [month.ars > 0 ? money(month.ars, 'ARS') : '', month.usd > 0 ? money(month.usd, 'USD') : ''].filter(Boolean).join(' · ') || 'Sin inversiones';
    return <section className="card mb-3.5 p-5 sm:p-6" aria-labelledby="streak-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="lb">CONSTANCIA</p><h2 id="streak-title" className="mt-2 text-[20px] font-light tracking-tight">Racha de aportes</h2><p className="mu mt-2 text-[12px]">Seleccioná un mes para ver sus montos registrados.</p></div>
            <div className="text-left sm:text-right"><p className="text-[26px] font-light tabular-nums">{streak} <span className="text-[13px] text-[var(--muted)]">{streak === 1 ? 'mes' : 'meses'}</span></p><p className="mu text-[11px]">{currentMonth ? 'Racha actual' : streak ? 'Racha hasta el mes pasado' : 'Tu racha empieza con una inversión'}</p></div>
        </div>
        <div className="mt-5 max-w-[520px]" role="group" aria-label="Seleccionar mes de los últimos 24 meses">
            <div className="grid grid-cols-12 gap-1.5 sm:gap-2">{months.map(m => <button key={m.key} type="button" onClick={() => setSelectedKey(m.key)} onFocus={() => setSelectedKey(m.key)} aria-pressed={selected.key === m.key} aria-label={`${m.name}: ${m.count} ${m.count === 1 ? 'inversión' : 'inversiones'}, ${amounts(m)}`} title={`${m.name}: ${amounts(m)}`} className={`aspect-square min-h-5 rounded-[4px] border transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${selected.key === m.key ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]' : ''}`} style={{ background: m.count ? 'var(--sig)' : 'var(--raised)', borderColor: 'var(--line2)', opacity: m.count ? Math.min(1, 0.4 + m.count * 0.2) : 1 }} />)}</div>
            <div className="mu mt-3 flex justify-between text-[10px]"><span>{months[0].name}</span><span>Últimos 24 meses</span><span>{months[23].name}</span></div>
        </div>
        <div aria-live="polite" className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--raised)] px-4 py-3"><p className="mu text-[11px] capitalize">{selected.name} · {selected.count} {selected.count === 1 ? 'inversión' : 'inversiones'}</p><p className="mt-1 text-[15px] font-medium tabular-nums">{amounts(selected)}</p></div>
        <p className="mu mt-4 text-[11px] leading-5">El color indica cuántas posiciones se cargaron ese mes. Los montos son los registrados en las posiciones actuales, separados por moneda; pueden incluir valores actuales y no representan necesariamente aportes netos. Las posiciones eliminadas o vendidas por completo dejan de contarse.</p>
    </section>;
}
