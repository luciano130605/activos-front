
import { useMemo, useState } from 'react';
import type { Investment } from './portfolio';

type Month = {
    key: string;
    name: string;
    shortName: string;
    count: number;
    ars: number;
    usd: number;
    year: number;
    month: number;
};

const monthKey = (year: number, month: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}`;

const monthName = (year: number, month: number) =>
    new Intl.DateTimeFormat('es-AR', {
        month: 'long',
        year: 'numeric',
    }).format(new Date(year, month, 1));

const money = (value: number, currency: 'ARS' | 'USD') =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
    }).format(value);

const getLevel = (count: number) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    return 4;
};

const greens = [
    'var(--raised)',
    '#0e4429',
    '#006d32',
    '#26a641',
    '#39d353',
];

export default function ContributionStreak({
    items,
    hidden,
}: {
    items: Investment[];
    hidden: boolean;
}) {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);

    const today = new Date();
    const current = today.getFullYear() * 12 + today.getMonth();

    const { months, streak, total, activeMonths } = useMemo(() => {
        const grouped = new Map<
            string,
            { count: number; ars: number; usd: number }
        >();

        const currentKey = monthKey(today.getFullYear(), today.getMonth());

        for (const item of items) {
            const key = item.date.slice(0, 7);
            if (key > currentKey) continue;

            const entry = grouped.get(key) ?? {
                count: 0,
                ars: 0,
                usd: 0,
            };

            entry.count++;

            if (item.currency === 'ARS') entry.ars += item.amount;
            if (item.currency === 'USD') entry.usd += item.amount;

            grouped.set(key, entry);
        }

        const months: Month[] = Array.from({ length: 24 }, (_, n) => {
            const index = current - 23 + n;
            const year = Math.floor(index / 12);
            const month = index % 12;
            const key = monthKey(year, month);
            const data = grouped.get(key);

            return {
                key,
                name: monthName(year, month),
                shortName: new Intl.DateTimeFormat('es-AR', {
                    month: 'short',
                }).format(new Date(year, month, 1)),
                count: data?.count ?? 0,
                ars: data?.ars ?? 0,
                usd: data?.usd ?? 0,
                year,
                month,
            };
        });

        const keyAt = (index: number) =>
            monthKey(Math.floor(index / 12), index % 12);

        let cursor = grouped.has(keyAt(current))
            ? current
            : current - 1;

        let streak = 0;

        while (grouped.has(keyAt(cursor))) {
            streak++;
            cursor--;
        }

        return {
            months,
            streak,
            total: months.reduce((sum, m) => sum + m.count, 0),
            activeMonths: months.filter(m => m.count > 0).length,
        };
    }, [items, current]);

    const selected =
        months.find(m => m.key === selectedKey) ??
        months[months.length - 1];

    const hovered = months.find(m => m.key === hoveredKey);

    const amounts = (month: Month) => {
        if (hidden) return '••••••';

        return [
            month.ars > 0 ? money(month.ars, 'ARS') : '',
            month.usd > 0 ? money(month.usd, 'USD') : '',
        ].filter(Boolean).join(' · ') || 'Sin inversiones';
    };

    const years = Array.from(new Set(months.map(m => m.year)));

    return (
        <section
            className="card mb-3.5 p-5 sm:p-6"
            aria-labelledby="streak-title"
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="lb">CONSTANCIA</p>

                    <h2
                        id="streak-title"
                        className="mt-2 text-[20px] font-light tracking-tight"
                    >
                        Actividad de inversiones
                    </h2>

                    <p className="mu mt-2 text-[12px]">
                        Tu historial de aportes de los últimos 24 meses.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
                    <span className="text-[18px]">🔥</span>

                    <div>
                        <p className="text-[15px] font-semibold tabular-nums leading-5">
                            {streak} {streak === 1 ? 'mes' : 'meses'}
                        </p>
                        <p className="mu text-[10px]">Racha de aportes</p>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-[var(--line)] pb-5">
                <div>
                    <p className="text-[22px] font-semibold tabular-nums">
                        {total}
                    </p>
                    <p className="mu mt-0.5 text-[11px]">
                        Inversiones registradas
                    </p>
                </div>

                <div>
                    <p className="text-[22px] font-semibold tabular-nums">
                        {activeMonths}
                        <span className="ml-1 text-[12px] font-normal text-[var(--muted)]">
                            / 24
                        </span>
                    </p>
                    <p className="mu mt-0.5 text-[11px]">
                        Meses con actividad
                    </p>
                </div>

                <div>
                    <p className="text-[22px] font-semibold tabular-nums">
                        {Math.round((activeMonths / 24) * 100)}%
                    </p>
                    <p className="mu mt-0.5 text-[11px]">
                        Constancia
                    </p>
                </div>
            </div>

            {/* GitHub contribution graph */}
            <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                    <p className="mu text-[11px]">
                        Historial de actividad
                    </p>

                    <span className="mu text-[10px]">
                        Últimos 24 meses
                    </span>
                </div>

                <div className="relative mt-4">
                    <div className="grid grid-cols-12 gap-[5px] sm:gap-2">
                        {months.map(m => {
                            const level = getLevel(m.count);
                            const isSelected = selected.key === m.key;

                            return (
                                <div key={m.key} className="relative group">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedKey(m.key)}
                                        onMouseEnter={() => setHoveredKey(m.key)}
                                        onMouseLeave={() => setHoveredKey(null)}
                                        onFocus={() => setHoveredKey(m.key)}
                                        onBlur={() => setHoveredKey(null)}
                                        aria-pressed={isSelected}
                                        aria-label={`${m.name}: ${m.count} inversiones`}
                                        className={`
                      block aspect-square w-full
                      rounded-[3px]
                      border border-black/5
                      transition-all duration-150
                      hover:scale-110 hover:z-10
                      focus-visible:outline-2
                      focus-visible:outline-offset-2
                      focus-visible:outline-[#39d353]
                      ${isSelected
                                                ? 'ring-2 ring-[#39d353] ring-offset-2 ring-offset-[var(--surface)]'
                                                : ''
                                            }
                    `}
                                        style={{
                                            backgroundColor: greens[level],
                                        }}
                                    />

                                    {/* Tooltip */}
                                    {hoveredKey === m.key && (
                                        <div
                                            className={`
                        pointer-events-none absolute
                        bottom-[calc(100%+10px)]
                        z-30 w-max max-w-[220px]
                        rounded-lg border border-[var(--line)]
                        bg-[var(--surface)]
                        px-3 py-2 shadow-xl
                        ${m.month < 2 ? 'left-0' :
                                                    m.month > 9 ? 'right-0' :
                                                        'left-1/2 -translate-x-1/2'}
                      `}
                                            role="tooltip"
                                        >
                                            <p className="text-[12px] font-semibold">
                                                {m.count} {m.count === 1
                                                    ? 'inversión'
                                                    : 'inversiones'}
                                            </p>

                                            <p className="mu mt-0.5 text-[11px] capitalize">
                                                {m.name}
                                            </p>

                                            {!hidden && m.count > 0 && (
                                                <p className="mt-1 text-[11px]">
                                                    {amounts(m)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Year labels */}
                    <div className="mt-3 grid grid-cols-12 gap-[5px] sm:gap-2">
                        {months.map((m, index) => {
                            const firstOfYear =
                                index === 0 || months[index - 1].year !== m.year;

                            return (
                                <div key={m.key} className="relative min-w-0">
                                    {firstOfYear && (
                                        <span className="mu absolute left-0 whitespace-nowrap text-[10px]">
                                            {m.year}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <p className="mu text-[10px]">
                        {years[0]} — {years[years.length - 1]}
                    </p>

                    <div className="flex items-center gap-2">
                        <span className="mu text-[10px]">Menos</span>

                        <div className="flex items-center gap-[3px]">
                            {greens.map((color, index) => (
                                <span
                                    key={index}
                                    className="h-[11px] w-[11px] rounded-[2px] border border-black/5"
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>

                        <span className="mu text-[10px]">Más</span>
                    </div>
                </div>
            </div>

            {/* Selected month */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--raised)] px-4 py-3">
                <div className="flex items-center gap-3">
                    <span
                        className="h-3 w-3 shrink-0 rounded-[3px]"
                        style={{
                            backgroundColor: greens[getLevel(selected.count)],
                        }}
                    />

                    <div>
                        <p className="text-[12px] font-medium capitalize">
                            {selected.name}
                        </p>

                        <p className="mu mt-0.5 text-[11px]">
                            {selected.count}{' '}
                            {selected.count === 1
                                ? 'inversión registrada'
                                : 'inversiones registradas'}
                        </p>
                    </div>
                </div>

                <p className="text-[13px] font-semibold tabular-nums">
                    {amounts(selected)}
                </p>
            </div>

            <p className="mu mt-4 text-[11px] leading-5">
                Cada cuadrado representa un mes. Cuanto más intenso es el
                verde, mayor es la cantidad de inversiones registradas.
                Los importes corresponden a las posiciones actuales y no
                necesariamente representan aportes netos.
            </p>
        </section>
    );
}
