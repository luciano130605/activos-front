import Select from './Select';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

type Row = {
    fecha: string;
    valor?: number;
    venta?: number;
};

type Series = {
    dollar: Row[];
    uva: Row[];
    inflation: Row[];
    deposit: Row[];
};

type Key = keyof Series | 'cartera';
type Point = { t: number; value: number };

type Line = {
    key: Key;
    label: string;
    points: Point[];
    lastDate: number;
};

const DAY = 86400000;

const W = 860;
const H = 300;
const LEFT = 55;
const RIGHT = 20;
const TOP = 24;
const BOTTOM = 35;
const PW = W - LEFT - RIGHT;
const PH = H - TOP - BOTTOM;

const endpoints = {
    dollar: 'cotizaciones/dolares/bolsa',
    uva: 'finanzas/indices/uva',
    inflation: 'finanzas/indices/inflacion',
    deposit: 'finanzas/tasas/depositos30Dias',
} as const;

const labels = {
    cartera: 'Mi cartera',
    dollar: 'Dólar MEP',
    uva: 'UVA',
    inflation: 'Inflación',
    deposit: 'Plazo fijo',
} as const;

const colors = {
    cartera: '#39d353',
    dollar: '#e3b76a',
    uva: '#79aef2',
    inflation: '#e38da4',
    deposit: '#ae9ce6',
};

const keys: (keyof Series)[] = [
    'dollar',
    'uva',
    'inflation',
    'deposit',
];

const time = (date: string) =>
    Date.parse(`${date.slice(0, 10)}T12:00:00Z`);

const dateLabel = (t: number) =>
    new Date(t).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });

const monthLabel = (t: number) =>
    new Date(t).toLocaleDateString('es-AR', {
        month: 'short',
        timeZone: 'UTC',
    });

const percent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const at = (rows: Point[], t: number) => {
    let result: Point | undefined;
    for (const p of rows) {
        if (p.t > t) break;
        result = p;
    }
    return result;
};

const getValue = (points: Point[], t: number) => {
    if (!points.length || t < points[0].t) return null;
    return at(points, t)?.value ?? null;
};

export default function Benchmarks({
    start,
    end,
    valueAt,
    available,
    historyLoading,
    historyError,
    actualReturnArs,
    selection,
    onSelectionChange,
    options,
    selectionLabel,
    annualSimulated,
    averageMonthlyReturn,
}: {
    start: number;
    end: number;
    valueAt: (t: number) => number;
    available: boolean;
    historyLoading: boolean;
    historyError: string;
    actualReturnArs: number | null;
    selection: string;
    onSelectionChange: (value: string) => void;
    options: { value: string; label: string }[];
    selectionLabel: string;
    annualSimulated: boolean;
    averageMonthlyReturn: number | null;
}) {
    const [data, setData] = useState<Partial<Series> | null>(null);
    const [retry, setRetry] = useState(0);
    const [hoverT, setHoverT] = useState<number | null>(null);

    const [visible, setVisible] = useState<Record<keyof Series, boolean>>({
        dollar: true,
        uva: true,
        inflation: true,
        deposit: true,
    });

    const svgRef = useRef<SVGSVGElement>(null);

    const from = start;
    const to = end;

    useEffect(() => {
        const controller = new AbortController();
        setData(null);

        void Promise.allSettled(
            Object.entries(endpoints).map(async ([key, path]) => {
                const response = await fetch(
                    `https://api.argentinadatos.com/v1/${path}`,
                    { signal: controller.signal }
                );

                if (!response.ok) throw new Error('No disponible');

                const raw: unknown = await response.json();

                if (!Array.isArray(raw)) {
                    throw new Error('Respuesta inválida');
                }

                const rows: Row[] = raw
                    .filter((x): x is Row =>
                        x &&
                        typeof x.fecha === 'string' &&
                        /^\d{4}-\d{2}-\d{2}/.test(x.fecha) &&
                        Number.isFinite(
                            key === 'dollar' ? x.venta : x.valor
                        )
                    )
                    .sort((a, b) => a.fecha.localeCompare(b.fecha));

                if (!rows.length) throw new Error('Sin datos');

                return [key, rows] as const;
            })
        ).then(results => {
            if (controller.signal.aborted) return;

            setData(
                Object.fromEntries(
                    results.flatMap(r =>
                        r.status === 'fulfilled' ? [r.value] : []
                    )
                )
            );
        });

        return () => controller.abort();
    }, [retry]);

    const result = useMemo(() => {
        if (!data || !available || from >= to) return null;

        const convert = (
            rows: Row[] | undefined,
            key: 'valor' | 'venta'
        ): Point[] =>
            (rows ?? [])
                .map(row => ({
                    t: time(row.fecha),
                    value: Number(row[key]),
                }))
                .filter(p =>
                    Number.isFinite(p.t) &&
                    Number.isFinite(p.value)
                )
                .sort((a, b) => a.t - b.t);

        const dollar = convert(data.dollar, 'venta')
            .filter(p => p.value > 0);

        const uva = convert(data.uva, 'valor')
            .filter(p => p.value > 0);

        const rates = convert(data.deposit, 'valor')
            .filter(p => p.value >= 0);

        const monthly = (data.inflation ?? [])
            .map(r => {
                const [year, month] = r.fecha
                    .slice(0, 7)
                    .split('-')
                    .map(Number);

                return {
                    t: Date.UTC(year, month, 0, 12),
                    value: Number(r.valor),
                };
            })
            .filter(p =>
                Number.isFinite(p.t) &&
                Number.isFinite(p.value) &&
                p.value > -100
            )
            .sort((a, b) => a.t - b.t);

        const initial = valueAt(from);
        if (!(initial > 0)) return null;

        const times = Array.from(
            { length: 241 },
            (_, i) => from + (to - from) * i / 240
        );

        const lines: Line[] = [];

        const portfolio = times
            .map(t => ({
                t,
                value: valueAt(t) / initial * 100,
            }))
            .filter(p => Number.isFinite(p.value));

        if (portfolio.length !== times.length) return null;

        if (portfolio.length > 1) {
            lines.push({
                key: 'cartera',
                label: selectionLabel,
                points: portfolio,
                lastDate: to,
            });
        }

        const addRatio = (
            key: 'dollar' | 'uva',
            rows: Point[]
        ) => {
            const base = at(rows, from);
            if (!base || !rows.length) return;

            const last = rows[rows.length - 1].t;

            const points = times
                .filter(t => t <= last + DAY)
                .flatMap(t => {
                    const p = at(rows, t);
                    return p
                        ? [{ t, value: 100 * p.value / base.value }]
                        : [];
                });

            if (points.length > 1) {
                lines.push({
                    key,
                    label: labels[key],
                    points,
                    lastDate: Math.min(last, to),
                });
            }
        };

        if (visible.dollar) addRatio('dollar', dollar);
        if (visible.uva) addRatio('uva', uva);

        if (
            visible.inflation &&
            monthly.length &&
            at(monthly, from)
        ) {
            const last = monthly[monthly.length - 1].t;

            const points = times
                .filter(t => t <= last + DAY)
                .map(t => {
                    let value = 100;

                    for (const p of monthly) {
                        if (p.t > t) break;
                        if (p.t > from) {
                            value *= 1 + p.value / 100;
                        }
                    }

                    return { t, value };
                });

            if (points.length > 1) {
                lines.push({
                    key: 'inflation',
                    label: labels.inflation,
                    points,
                    lastDate: Math.min(last, to),
                });
            }
        }

        if (visible.deposit && at(rates, from)) {
            const last = rates[rates.length - 1].t;

            const points = times
                .filter(t => t <= last + DAY)
                .map(t => {
                    let cursor = from;
                    let value = 100;

                    while (cursor < t) {
                        const rate = at(rates, cursor);
                        if (!rate) break;

                        const days = Math.min(
                            30,
                            (t - cursor) / DAY
                        );

                        if (days <= 0) break;

                        value *= 1 +
                            (rate.value / 100) * (days / 365);

                        cursor += days * DAY;
                    }

                    return { t, value };
                });

            if (points.length > 1) {
                lines.push({
                    key: 'deposit',
                    label: labels.deposit,
                    points,
                    lastDate: Math.min(last, to),
                });
            }
        }

        const values = lines.flatMap(l =>
            l.points.map(p => p.value)
        );

        const rawMin = Math.min(100, ...values);
        const rawMax = Math.max(100, ...values);
        const padding = Math.max(3, (rawMax - rawMin) * 0.12);

        const min = rawMin - padding;
        const max = rawMax + padding;

        const x = (t: number) =>
            LEFT + ((t - from) / (to - from)) * PW;

        const y = (v: number) =>
            TOP + PH - ((v - min) / (max - min)) * PH;

        const ticks = Array.from(
            { length: 5 },
            (_, i) => min + ((max - min) * i) / 4
        );

        // Etiquetas mensuales, evitando fechas fuera del rango.
        const firstDate = new Date(from);
        const startYear = firstDate.getUTCFullYear();
        const startMonth = firstDate.getUTCMonth();

        const monthTicks = Array.from(
            { length: 14 },
            (_, i) =>
                Date.UTC(startYear, startMonth + i, 1, 12)
        ).filter(t => t >= from && t <= to);

        return {
            lines,
            x,
            y,
            ticks,
            monthTicks,
            min,
            max,
        };
    }, [data, available, from, to, valueAt, visible, selectionLabel]);

    const handlePointerMove = (
        e: PointerEvent<SVGSVGElement>
    ) => {
        if (!result || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * W;

        const ratio = Math.max(
            0,
            Math.min(1, (svgX - LEFT) / PW)
        );

        setHoverT(from + ratio * (to - from));
    };

    const hover = useMemo(() => {
        if (!result || hoverT === null) return null;

        const points = result.lines.flatMap(line => {
            const value = getValue(line.points, hoverT);

            if (value === null) return [];

            return [{
                key: line.key,
                label: line.label,
                color: colors[line.key],
                value,
                change: value - 100,
            }];
        });

        return {
            t: hoverT,
            points,
            x: result.x(hoverT),
        };
    }, [result, hoverT]);

    const portfolio = result?.lines.find(
        l => l.key === 'cartera'
    );

    const portfolioReturn = portfolio
        ? portfolio.points[portfolio.points.length - 1].value - 100
        : null;

    return (
        <section
            className="card mb-3.5 p-5 sm:p-6"
            aria-labelledby="benchmark-title"
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="lb">RENDIMIENTO ANUAL</p>

                    <h2
                        id="benchmark-title"
                        className="mt-2 text-[20px] font-light tracking-tight"
                    >
                        Cartera y activos vs. mercado
                    </h2>

                    <p className="mu mt-2 text-[12px]">
                        Comparación de rendimiento en pesos argentinos.
                    </p>
                </div>

                <div className="rounded-lg border border-[var(--line)] bg-[var(--raised)] px-3 py-2">
                    <p className="mu text-[10px]">
                        Últimos 12 meses
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium tabular-nums">
                        {dateLabel(from)} — {dateLabel(to)}
                    </p>
                </div>
            </div>

            <div className="mt-5 max-w-sm">
                <label htmlFor="benchmark-selection" className="mb-2 block text-[11px] text-[var(--muted)]">Comparar</label>
                <Select id="benchmark-selection" label="Seleccionar cartera o activo" value={selection} onChange={onSelectionChange} options={[{ value: 'all', label: 'Mi cartera completa' }, ...options]} />
            </div>
            {selection === 'all' && <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
                <p className="mu text-[11px]">Resultado en pesos · {selection === 'all' ? 'posiciones abiertas' : selectionLabel}</p>
                <p className="mt-2 text-[24px] font-medium tabular-nums" style={{ color: actualReturnArs == null ? 'var(--muted)' : actualReturnArs >= 0 ? '#39a967' : 'var(--neg)' }}>{actualReturnArs == null ? 'No disponible' : percent(actualReturnArs)}</p>
                <p className="mu mt-2 text-[11px] leading-5">Compara el monto registrado de cada posición con su valor actual. Para montos en dólares usa el MEP de la fecha registrada y la cotización actual de conversión. Las fechas pueden ser distintas; no es necesariamente un rendimiento de 12 meses. Excluye ventas cerradas y dividendos.</p>
                {actualReturnArs == null && <p className="mu mt-1 text-[11px]">Se necesitan precios actuales y cotizaciones históricas para las fechas de registro.</p>}
            </div>}

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
                <p className="mu text-[11px]">Promedio mensual de los últimos 12 meses · {selectionLabel}</p>
                <p className="mt-2 text-[24px] font-medium tabular-nums">{averageMonthlyReturn == null ? 'No disponible' : percent(averageMonthlyReturn)}</p>
                <p className="mu mt-2 text-[11px] leading-5">Suma de las 12 variaciones mensuales dividida por 12, calculada con cotizaciones históricas disponibles. Es un promedio por mes, no la variación acumulada del año.</p>
                {averageMonthlyReturn == null && <p className="mu mt-1 text-[11px]">Se necesitan cotizaciones históricas suficientes para los 12 meses; las inversiones con tasa no tienen una serie de precios de mercado.</p>}
            </div>

            {/* Portfolio return */}
            {portfolioReturn !== null && (
                <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
                    <div>
                        <p className="mu text-[11px]">
                            {annualSimulated ? 'Proyección anual a partir de la tendencia reciente' : 'Variación acumulada en 12 meses'} · {selectionLabel}
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                            <p
                                className="text-[32px] font-semibold tracking-tight tabular-nums"
                                style={{
                                    color: portfolioReturn >= 0
                                        ? '#39a967'
                                        : 'var(--neg)',
                                }}
                            >
                                {percent(portfolioReturn)}
                            </p>

                            <span className="rounded-md bg-[var(--raised)] px-2 py-1 text-[10px] text-[var(--muted)]">
                                Base 100
                            </span>
                        </div>
                    </div>

                    <div className="text-left sm:text-right">
                        <p className="mu text-[11px]">
                            Valor del índice
                        </p>

                        <p className="mt-1 text-[20px] font-medium tabular-nums">
                            {(100 + portfolioReturn).toFixed(2)}
                        </p>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 inline-flex items-center gap-2 rounded-md border border-[var(--line2)] px-3 py-2 text-[11px] font-medium">
                    <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: colors.cartera }}
                    />
                    {selectionLabel}
                </span>

                {keys.map(key => (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={visible[key]}
                        onClick={() =>
                            setVisible(v => ({
                                ...v,
                                [key]: !v[key],
                            }))
                        }
                        className={`
              inline-flex items-center gap-2
              rounded-md border px-3 py-2
              text-[11px] transition-all duration-150
              hover:border-[var(--line2)]
              ${visible[key]
                                ? 'border-[var(--line2)] bg-[var(--raised)] text-[var(--ink)]'
                                : 'border-[var(--line)] text-[var(--muted)] opacity-50'
                            }
            `}
                    >
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: colors[key] }}
                        />
                        {labels[key]}
                    </button>
                ))}
            </div>

            {/* Chart */}
            {!data || historyLoading ? (
                <div
                    className="mu flex h-[340px] items-center justify-center text-[12px]"
                    role="status"
                >
                    Consultando referencias…
                </div>
            ) : !result ? (
                <div className="mu flex h-[340px] items-center justify-center text-center text-[12px]">
                    {historyError || 'No hay suficientes cotizaciones recientes para calcular o estimar una variación anual.'}
                </div>
            ) : (
                <>
                    <div className="relative mt-6 select-none">
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${W} ${H}`}
                            className="block w-full overflow-visible"
                            role="img"
                            aria-label="Gráfico anual de rendimiento comparado, base 100"
                            onPointerMove={handlePointerMove}
                            onPointerLeave={() => setHoverT(null)}
                        >
                            {/* Horizontal grid */}
                            {result.ticks.map((v, i) => (
                                <g key={i}>
                                    <line
                                        x1={LEFT}
                                        x2={W - RIGHT}
                                        y1={result.y(v)}
                                        y2={result.y(v)}
                                        stroke="var(--line)"
                                        strokeWidth="1"
                                        strokeDasharray={i === 0 ? '0' : '3 5'}
                                    />

                                    <text
                                        x={LEFT - 12}
                                        y={result.y(v) + 4}
                                        textAnchor="end"
                                        fill="var(--muted)"
                                        fontSize="11"
                                    >
                                        {v.toFixed(0)}
                                    </text>
                                </g>
                            ))}

                            {/* Monthly axis */}
                            {result.monthTicks.map((t, i) => (
                                <text
                                    key={t}
                                    x={result.x(t)}
                                    y={H - 8}
                                    textAnchor="middle"
                                    fill="var(--muted)"
                                    fontSize="11"
                                >
                                    {i % 2 === 0 ? monthLabel(t) : ''}
                                </text>
                            ))}

                            {/* Base 100 */}
                            <line
                                x1={LEFT}
                                x2={W - RIGHT}
                                y1={result.y(100)}
                                y2={result.y(100)}
                                stroke="var(--muted)"
                                strokeWidth="1"
                                strokeDasharray="5 5"
                                opacity=".5"
                            />

                            {/* Area under portfolio */}
                            {portfolio && (
                                <path
                                    d={[
                                        `M ${result.x(portfolio.points[0].t)} ${result.y(100)}`,
                                        ...portfolio.points.map(
                                            p => `L ${result.x(p.t)} ${result.y(p.value)}`
                                        ),
                                        `L ${result.x(portfolio.points[portfolio.points.length - 1].t)} ${result.y(100)}`,
                                        'Z',
                                    ].join(' ')}
                                    fill={colors.cartera}
                                    opacity=".055"
                                    pointerEvents="none"
                                />
                            )}

                            {/* Curves */}
                            {result.lines.map(line => (
                                <path
                                    key={line.key}
                                    d={line.points.map((p, i) =>
                                        `${i === 0 ? 'M' : 'L'} ${result.x(p.t).toFixed(2)} ${result.y(p.value).toFixed(2)}`
                                    ).join(' ')}
                                    fill="none"
                                    stroke={colors[line.key]}
                                    strokeWidth={line.key === 'cartera' ? 3 : 2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                    opacity={hover ? .8 : 1}
                                    pointerEvents="none"
                                />
                            ))}

                            {/* Crosshair */}
                            {hover && (
                                <g pointerEvents="none">
                                    <line
                                        x1={hover.x}
                                        x2={hover.x}
                                        y1={TOP}
                                        y2={TOP + PH}
                                        stroke="var(--muted)"
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                        opacity=".8"
                                    />

                                    {hover.points.map(point => (
                                        <g key={point.key}>
                                            <circle
                                                cx={hover.x}
                                                cy={result.y(point.value)}
                                                r="7"
                                                fill={point.color}
                                                opacity=".18"
                                            />
                                            <circle
                                                cx={hover.x}
                                                cy={result.y(point.value)}
                                                r="4"
                                                fill={point.color}
                                                stroke="var(--surface)"
                                                strokeWidth="2"
                                            />
                                        </g>
                                    ))}
                                </g>
                            )}
                        </svg>

                        {/* Hover tooltip */}
                        {hover && hover.points.length > 0 && (
                            <div
                                className="pointer-events-none absolute top-0 z-20 w-[210px] rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-3 shadow-xl sm:w-[230px]"
                                style={{
                                    left: `${Math.max(
                                        16,
                                        Math.min(84, (hover.x / W) * 100)
                                    )}%`,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <p className="border-b border-[var(--line)] pb-2 text-[12px] font-semibold capitalize">
                                    {dateLabel(hover.t)}
                                </p>

                                <div className="mt-3 space-y-2.5">
                                    {hover.points.map(point => (
                                        <div
                                            key={point.key}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className="h-2 w-2 shrink-0 rounded-full"
                                                    style={{ background: point.color }}
                                                />
                                                <span className="truncate text-[11px] text-[var(--muted)]">
                                                    {point.label}
                                                </span>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <p className="text-[12px] font-semibold tabular-nums">
                                                    {percent(point.change)}
                                                </p>
                                                <p className="mu text-[10px] tabular-nums">
                                                    {point.value.toFixed(2)} pts
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Annual results */}
                    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {result.lines.map(line => {
                            const last = line.points[line.points.length - 1];
                            const variation = last.value - 100;

                            return (
                                <div
                                    key={line.key}
                                    className="min-w-0 rounded-lg border border-[var(--line)] p-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{ background: colors[line.key] }}
                                        />
                                        <span className="mu truncate text-[10px]">
                                            {line.label}
                                        </span>
                                    </div>

                                    <p
                                        className="mt-3 text-[19px] font-semibold tracking-tight tabular-nums"
                                        style={{
                                            color: variation >= 0
                                                ? 'var(--ink)'
                                                : 'var(--neg)',
                                        }}
                                    >
                                        {percent(variation)}
                                    </p>

                                    <p className="mu mt-1 text-[10px]">
                                        {dateLabel(from)} — {dateLabel(line.lastDate)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Missing references */}
            {data && result && keys
                .filter(key =>
                    visible[key] &&
                    data[key] &&
                    !result.lines.some(line => line.key === key)
                )
                .map(key => (
                    <p key={key} className="mu mt-2 text-[11px]">
                        {labels[key]}: sin datos suficientes para el período.
                    </p>
                ))}

            {data && keys.some(key => !data[key]) && (
                <p className="mt-4 text-[12px] text-[var(--neg)]">
                    Algunas referencias no están disponibles.{' '}
                    <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => setRetry(n => n + 1)}
                    >
                        Reintentar
                    </button>
                </p>
            )}

            {/* Footer */}
            <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="mu text-[11px] leading-5">
                    Rendimiento comparativo con base 100 al inicio del período.
                    Se simula la tenencia de {selection === 'all' ? 'las posiciones actuales' : 'este activo'} durante todo el año.
                    Cuando no hay un año de precios históricos, se proyecta durante 12 meses la variación diaria
                    del último mes disponible. Esa proyección no es el rendimiento anual histórico y puede diferir mucho del resultado real.
                    Las posiciones en dólares se expresan en pesos usando la evolución histórica del dólar MEP,
                    ajustada a la cotización actual de conversión de la app. Las inversiones con tasa usan
                    la tasa cargada. Es una simulación, no un historial real de aportes o ventas. El dólar MEP y
                    la UVA utilizan la última cotización disponible; la
                    inflación se acumula mensualmente y el plazo fijo se
                    simula mediante reinversiones. Las referencias pueden
                    tener distintas fechas de actualización.
                </p>

                <a
                    href="https://argentinadatos.com/docs/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mu mt-2 inline-flex text-[11px] underline underline-offset-2 hover:text-[var(--ink)]"
                >
                    Fuente: ArgentinaDatos
                </a>
            </div>
        </section>
    );
}
