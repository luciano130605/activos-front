import { HugeiconsIcon } from '@hugeicons/react';
import Select from './Select';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { PointerEvent, ReactNode } from 'react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

type Row = {

    fecha: string;

    valor?: number;

    venta?: number;

};

type Series = {

    dollar: Row[];

    official: Row[];

    merval: Row[];

    uva: Row[];

    inflation: Row[];

    deposit: Row[];

};

type Key = keyof Series | 'cartera';

type Point = { t: number; value: number; original?: number; observedAt?: number };

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

    official: 'cotizaciones/dolares/oficial',

    merval: '/api/benchmarks/merval',

    uva: 'finanzas/indices/uva',

    inflation: 'finanzas/indices/inflacion',

    deposit: 'finanzas/tasas/depositos30Dias',

} as const;

const labels = {

    cartera: 'Mi cartera',

    dollar: 'Dólar MEP',

    official: 'Dólar oficial',

    merval: 'Merval',

    uva: 'UVA',

    inflation: 'Inflación',

    deposit: 'Plazo fijo',

} as const;

const colors = {

    cartera: '#39d353',

    dollar: '#e3b76a',

    official: '#f28e5b',

    merval: '#50c5cb',

    uva: '#79aef2',

    inflation: '#e38da4',

    deposit: '#ae9ce6',

};

const keys: (keyof Series)[] = [

    'dollar',

    'official',

    'merval',

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

function Explanation({ label, children, content, inside = false }: { label: string; children: ReactNode; content: ReactNode; inside?: boolean }) {
    const [open, setOpen] = useState(false);
    return <span className="group relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); (event.currentTarget.querySelector('button') as HTMLButtonElement | null)?.blur(); } }}>
        <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} className={`inline-flex items-center gap-2 rounded-md text-[11px] font-medium hover:bg-[var(--raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--muted)] ${inside ? 'px-1.5 py-2 text-[var(--muted)]' : 'border border-[var(--line2)] px-3 py-2'}`}>{children}</button>
        {open && <span role="tooltip" className={`absolute top-full z-40 mt-2 block w-[min(260px,75vw)] rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-3 text-left text-[11px] font-normal leading-5 text-[var(--muted)] shadow-xl ${inside ? 'right-0' : 'left-0'}`}>{content}</span>}
    </span>;
}

export default function Benchmarks({

    start,

    end,

    months,

    onMonthsChange,

    availablePeriods,

    valueAt,

    available,

    historyLoading,

    historyError,

    actualReturnArs,

    selection,

    onSelectionChange,

    onSearch,

    searchStatus,

    options,

    selectionLabel,

    averageMonthlyReturn,

    composition,

    compositionIncomplete,

}: {

    start: number;

    end: number;

    months: number;

    onMonthsChange: (months: number) => void;

    availablePeriods: number[];

    valueAt: (t: number) => number;

    available: boolean;

    historyLoading: boolean;

    historyError: string;

    actualReturnArs: number | null;

    selection: string;

    onSelectionChange: (value: string) => void;

    onSearch: () => void;

    searchStatus: string;

    options: { value: string; label: string }[];

    selectionLabel: string;

    averageMonthlyReturn: number | null;

    composition: { label: string; value: number; color: string; count: number }[];

    compositionIncomplete: boolean;

}) {

    const compositionTotal = composition.reduce((sum, item) => sum + item.value, 0);
    const compositionAvailable = Number.isFinite(compositionTotal) && compositionTotal > 0 && composition.every(item => Number.isFinite(item.value));
    const compositionRows = composition.filter(item => item.count > 0 && Number.isFinite(item.value) && item.value > 0).sort((a, b) => b.value - a.value);
    const compositionContent = <><span className="block font-medium text-[var(--ink)]">Composición actual</span>{compositionAvailable ? <><span className="mt-1 block">Participación por tipo sobre el valor actual de tu cartera.</span><span className="mt-2 block space-y-1">{compositionRows.map(item => <span key={item.label} className="flex items-center justify-between gap-4"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span><span className="font-mono tabular-nums text-[var(--ink)]">{(item.value / compositionTotal * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span></span>)}</span>{compositionIncomplete && <span className="mt-2 block">Algunas cotizaciones faltan; se usa el monto registrado.</span>}</> : <span className="mt-1 block">No se puede calcular la distribución con los valores disponibles.</span>}</>;

    const [data, setData] = useState<Partial<Series> | null>(null);

    const [retry, setRetry] = useState(0);
    const [exportPreview, setExportPreview] = useState<string | null>(null);
    const [exportError, setExportError] = useState('');
    const [copyMessage, setCopyMessage] = useState('');
    const [copying, setCopying] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [hoverT, setHoverT] = useState<number | null>(null);

    const [visible, setVisible] = useState<Record<keyof Series, boolean>>({

        dollar: true,

        official: true,

        merval: true,

        uva: true,

        inflation: true,

        deposit: true,

    });

    const svgRef = useRef<SVGSVGElement>(null);

    const from = start;

    const to = end;

    const monthlyDisplay = averageMonthlyReturn != null && Number.isFinite(averageMonthlyReturn)
        ? averageMonthlyReturn : null;

    useEffect(() => {

        const controller = new AbortController();

        setData(null);

        void Promise.allSettled(

            Object.entries(endpoints).map(async ([key, path]) => {

                const response = await fetch(

                    path.startsWith('/api/') ? path : `https://api.argentinadatos.com/v1/${path}`,

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

                            key === 'dollar' || key === 'official' ? x.venta : x.valor

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

        if (!data || from >= to) return null;

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

        const times = Array.from(
            { length: 241 },
            (_, i) => from + (to - from) * i / 240
        );

        const lines: Line[] = [];

        if (available) {
            const initial = valueAt(from);
            if (Number.isFinite(initial) && initial > 0) {
                const points = times.map(t => { const original = valueAt(t); return { t, value: original / initial * 100, original }; });
                if (points.every(p => Number.isFinite(p.value) && p.value > 0)) {
                    lines.push({ key: 'cartera', label: selectionLabel, points, lastDate: to });
                }
            }
        }

        const addRatio = (

            key: 'dollar' | 'official' | 'merval' | 'uva',

            rows: Point[]

        ) => {

            const base = at(rows, from) ?? (rows[0] && rows[0].t - from <= 3 * DAY ? rows[0] : undefined);

            if (!base || !rows.length || (base.t <= from && from - base.t > 7 * DAY) || to - rows[rows.length - 1].t > 7 * DAY) return;

            const last = rows[rows.length - 1].t;

            const points = times

                .filter(t => t <= last + DAY)

                .flatMap(t => {

                    const p = at(rows, t) ?? (base.t > t && base.t - t <= 3 * DAY ? base : undefined);

                    return p

                        ? [{ t, value: 100 * p.value / base.value, original: p.value, observedAt: p.t }]

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

        if (visible.official) addRatio('official', convert(data.official, 'venta'));

        if (visible.merval) addRatio('merval', convert(data.merval, 'valor'));

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

                    const observed = at(monthly, t);
                    return { t, value, original: observed?.value, observedAt: observed?.t };

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

                    const observed = at(rates, t);
                    return { t, value, original: observed?.value, observedAt: observed?.t };

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

        const step = months <= 6 ? 1 : months <= 12 ? 2 : months <= 36 ? 6 : 12;
        const monthTicks = Array.from(
            { length: Math.ceil(months / step) + 2 },
            (_, i) => Date.UTC(startYear, startMonth + i * step, 1, 12)
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

    }, [data, available, from, to, valueAt, visible, selectionLabel, months]);

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

            const point = at(line.points, hoverT);
            const value = getValue(line.points, hoverT);

            if (!point || value === null) return [];

            return [{

                key: line.key,

                label: line.label,

                color: colors[line.key],

                value,

                change: value - 100,
                original: point.original,
                observedAt: point.observedAt,

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

    const prepareExport = async () => {
        if (!result?.lines.length || exporting) return;
        setExporting(true);
        setExportError(''); setCopyMessage('');
        try {
            await document.fonts.ready;
            const width = 1000;
            const rows = Math.ceil(result.lines.length / 2);
            const height = 710 + rows * 105;
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No se pudo crear la imagen');
            ctx.scale(2, 2);
            const rounded = (x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string) => {
                ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
                if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
            };
            ctx.fillStyle = '#0b0d0b'; ctx.fillRect(0, 0, width, height);
            rounded(24, 24, width - 48, height - 48, 24, '#141714', '#303730');
            ctx.textAlign = 'left';
            ctx.fillStyle = '#c6f26b'; ctx.font = '600 13px Geist, sans-serif';
            ctx.fillText('ALZA  /  RENDIMIENTO COMPARADO', 60, 70);
            ctx.fillStyle = '#f3f4ee'; ctx.font = '600 31px Geist, sans-serif';
            ctx.fillText('Cartera y activos vs. mercado', 60, 113);
            ctx.fillStyle = '#a9b1a8'; ctx.font = '16px Geist, sans-serif';
            ctx.fillText('Variación en pesos argentinos · Base 100', 60, 145);
            ctx.fillStyle = '#e0e5da'; ctx.font = '500 15px Geist, sans-serif';
            ctx.fillText(`${dateLabel(from)} — ${dateLabel(to)}`, 60, 173);
            if (portfolioReturn !== null) {
                rounded(708, 53, 230, 117, 16, '#1c231c', '#354035');
                ctx.fillStyle = '#a9b1a8'; ctx.font = '13px Geist, sans-serif';
                ctx.fillText('VARIACIÓN EN EL PERÍODO', 726, 79);
                ctx.fillStyle = portfolioReturn >= 0 ? '#c6f26b' : '#ff8a8a';
                ctx.font = '600 32px Geist, sans-serif';
                ctx.fillText(percent(portfolioReturn), 726, 119);
                ctx.fillStyle = '#b5bdb4'; ctx.font = '14px Geist, sans-serif';
                ctx.fillText(selectionLabel, 726, 145, 194);
            }
            rounded(48, 200, 904, 355, 18, '#101310', '#2b332c');
            ctx.save();
            ctx.translate(69, 220);
            const sx = 860 / W;
            const sy = 300 / H;
            ctx.scale(sx, sy);
            ctx.font = '12px Geist, sans-serif';
            result.ticks.forEach(v => {
                const y = result.y(v);
                ctx.strokeStyle = '#303a31'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
                ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(W - RIGHT, y); ctx.stroke();
                ctx.setLineDash([]); ctx.textAlign = 'right'; ctx.fillStyle = '#99a499';
                ctx.fillText(v.toFixed(0), LEFT - 12, y + 4);
            });
            ctx.textAlign = 'center'; ctx.fillStyle = '#99a499';
            result.monthTicks.forEach(t => ctx.fillText(months > 12 ? new Date(t).toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : monthLabel(t), result.x(t), H - 8));
            ctx.strokeStyle = '#758174'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(LEFT, result.y(100)); ctx.lineTo(W - RIGHT, result.y(100)); ctx.stroke(); ctx.setLineDash([]);
            result.lines.forEach(line => {
                ctx.strokeStyle = colors[line.key]; ctx.lineWidth = line.key === 'cartera' ? 3.4 : 2.2;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
                line.points.forEach((point, index) => { if (index === 0) ctx.moveTo(result.x(point.t), result.y(point.value)); else ctx.lineTo(result.x(point.t), result.y(point.value)); });
                ctx.stroke();
            });
            ctx.restore();
            ctx.textAlign = 'left'; ctx.fillStyle = '#d6ddd3'; ctx.font = '600 15px Geist, sans-serif';
            ctx.fillText('RESULTADOS POR ACTIVO', 60, 596);
            result.lines.forEach((line, index) => {
                const x = 60 + (index % 2) * 445;
                const y = 615 + Math.floor(index / 2) * 105;
                const variation = line.points[line.points.length - 1].value - 100;
                rounded(x, y, 430, 89, 12, '#1b211b', '#303a30');
                rounded(x + 15, y + 19, 8, 8, 4, colors[line.key]);
                ctx.textAlign = 'left'; ctx.fillStyle = '#edf0e8'; ctx.font = '600 16px Geist, sans-serif';
                ctx.fillText(line.label, x + 32, y + 27, 270);
                ctx.textAlign = 'right'; ctx.fillStyle = variation >= 0 ? '#d6f6ae' : '#ff9999'; ctx.font = '600 19px Geist, sans-serif';
                ctx.fillText(percent(variation), x + 414, y + 28);
                ctx.textAlign = 'left'; ctx.fillStyle = '#b7c0b5'; ctx.font = '14px Geist, sans-serif';
                ctx.fillText(`${dateLabel(from)} — ${dateLabel(line.lastDate)}`, x + 15, y + 62, 400);
            });
            ctx.fillStyle = '#899588'; ctx.font = '12px Geist, sans-serif';
            ctx.fillText('ALZA  ·  Comparación de rendimiento en ARS', 60, height - 55);
            setExportPreview(canvas.toDataURL('image/png'));
        } catch {
            setExportError('No se pudo generar la imagen. Intentá nuevamente.');
        } finally {
            setExporting(false);
        }
    };

    async function copyExport() {
        if (!exportPreview || copying) return;
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') { setCopyMessage('Tu navegador no permite copiar imágenes. Podés descargar el PNG.'); return; }
        setCopying(true); setCopyMessage('');
        try {
            const image = fetch(exportPreview).then(response => { if (!response.ok) throw new Error('No se pudo leer la imagen.'); return response.blob(); });
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
            setCopyMessage('Imagen copiada al portapapeles.');
        } catch {
            setCopyMessage('No se pudo copiar la imagen. Revisá los permisos o descargá el PNG.');
        } finally { setCopying(false); }
    }

    return (

        <section

            className="card mb-3.5 p-5 sm:p-6"

            aria-labelledby="benchmark-title"

        >

            {/* Header */}

            <div className="flex flex-wrap items-start justify-between gap-4">

                <div>

                    <p className="lb">RENDIMIENTO COMPARADO</p>

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

                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" data-export-exclude onClick={() => void prepareExport()} disabled={!result?.lines.length || historyLoading || exporting} className="btn-ghost text-[12px] disabled:opacity-50">{exporting ? 'Preparando…' : 'Exportar PNG'}</button>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--raised)] px-3 py-2">

                        <p className="mu text-[10px]">

                            Período seleccionado

                        </p>

                        <p className="mt-0.5 text-[12px] font-medium tabular-nums">

                            {dateLabel(from)} — {dateLabel(to)}

                        </p>

                    </div>

                </div>
            </div>
            {exportError && <p data-export-exclude role="alert" className="mt-3 text-[12px] text-[var(--neg)]">{exportError}</p>}
            {exportPreview && <div data-export-exclude className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setExportPreview(null); }} onKeyDown={event => { if (event.key === 'Escape') setExportPreview(null); }}>
                <div role="dialog" aria-modal="true" aria-labelledby="benchmark-export-title" className="card max-h-[90dvh] w-full max-w-[900px] overflow-y-auto p-5 shadow-2xl">
                    <div className="flex items-start justify-between gap-3"><div><h3 id="benchmark-export-title" className="text-[20px] font-medium">Vista previa</h3><p className="mu mt-1 text-[12px]">Así se verá tu comparación en PNG.</p></div><button type="button" autoFocus onClick={() => setExportPreview(null)} aria-label="Cerrar vista previa" className="btn-ghost text-[18px]"><HugeiconsIcon icon={Cancel01Icon} size={19} /></button></div>
                    <img src={exportPreview} alt="Vista previa de la comparación de rendimiento" className="mt-4 w-full rounded-lg border border-[var(--line)]" />
                    {copyMessage && <p role="status" className="mu mt-3 text-[12px]">{copyMessage}</p>}
                    <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setExportPreview(null)} className="btn-ghost text-[12px]">Cancelar</button><button type="button" onClick={() => void copyExport()} disabled={copying} className="btn-ghost text-[12px] disabled:opacity-50">{copying ? 'Copiando…' : 'Copiar imagen'}</button><a href={exportPreview} download="cartera-vs-mercado.png" className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[12px] font-medium text-[var(--bg)]">Descargar PNG</a></div>
                </div>
            </div>}

            <div className="mt-5 max-w-sm">
                <label htmlFor="benchmark-period" className="mb-2 block text-[11px] text-[var(--muted)]">Período</label>
                <Select id="benchmark-period" label="Período de comparación" value={String(months)} onChange={value => onMonthsChange(Number(value))} options={[
                    { value: '1', label: '1 mes' }, { value: '6', label: '6 meses' },
                    { value: '12', label: '1 año' }, { value: '24', label: '2 años' },
                    { value: '36', label: '3 años' }, { value: '72', label: '6 años' },
                ].map(option => ({ ...option, disabled: !availablePeriods.includes(Number(option.value)) }))} />
                {availablePeriods.length < 6 && <p className="mu mt-2 text-[11px]">Los períodos sin historial suficiente para la selección están deshabilitados.</p>}
            </div>

            <div className="mt-5 max-w-sm">

                <label htmlFor="benchmark-selection" className="mb-2 block text-[11px] text-[var(--muted)]">Comparar</label>

                <Select id="benchmark-selection" label="Seleccionar cartera o activo" value={selection} onChange={onSelectionChange} options={[{ value: 'all', label: 'Mi cartera completa' }, ...options]} />
                <button type="button" onClick={onSearch} className="mt-3 rounded-lg border border-[var(--line2)] px-3 py-2 text-[12px] hover:bg-[var(--raised)]">Buscar otro activo</button>
                <p className="mu mt-2 text-[11px]">El activo buscado se usa solo para comparar y no se guarda en tu cartera.</p>
                {searchStatus && <p role="status" className="mu mt-2 text-[12px]">{searchStatus}</p>}

            </div>

            {selection === 'all' && <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">

                <p className="mu text-[11px]">Resultado en pesos · {selection === 'all' ? 'posiciones abiertas' : selectionLabel}</p>

                <p className="mt-2 text-[24px] font-medium tabular-nums" style={{ color: actualReturnArs == null ? 'var(--muted)' : actualReturnArs >= 0 ? '#39a967' : 'var(--neg)' }}>{actualReturnArs == null ? 'No disponible' : percent(actualReturnArs)}</p>

                <p className="mu mt-2 text-[11px] leading-5">Compara el monto registrado de cada posición con su valor actual. Para montos en dólares usa el MEP de la fecha registrada y la cotización actual de conversión. Las fechas pueden ser distintas; no es necesariamente un rendimiento de 12 meses. Excluye ventas cerradas y dividendos.</p>

                {actualReturnArs == null && <p className="mu mt-1 text-[11px]">Se necesitan precios actuales y cotizaciones históricas para las fechas de registro.</p>}

            </div>}

            {monthlyDisplay != null && <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
                <p className="mu text-[11px]">Promedio mensual de los últimos 12 meses · {selectionLabel}</p>
                <p className="mt-2 text-[24px] font-medium tabular-nums">{percent(monthlyDisplay)}</p>
                <p className="mu mt-2 text-[11px] leading-5">Promedio aritmético de las variaciones mensuales históricas disponibles. No es la variación acumulada anual.</p>
            </div>}

            {selection !== 'all' && !historyLoading && !result?.lines.some(line => line.key === 'cartera') && <p role="status" className="mu mt-4 text-[12px]">No hay historial suficiente para comparar este activo durante el período seleccionado.</p>}
            {selection === 'all' && !historyLoading && !result?.lines.some(line => line.key === 'cartera') && <p role="status" className="mu mt-4 text-[12px]">No hay historial suficiente para comparar toda la cartera durante el período seleccionado.</p>}

            {/* Portfolio return */}

            {portfolioReturn !== null && (

                <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">

                    <div>

                        <p className="mu text-[11px]">

                            Variación acumulada en el período · {selectionLabel}

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

                {result?.lines.some(line => line.key === 'cartera') && (selection === 'all' ? <Explanation label="Ver composición actual de mi cartera" content={compositionContent}><span className="h-2 w-2 rounded-full" style={{ background: colors.cartera }} />{selectionLabel}<span aria-hidden="true" className="text-[var(--muted)]">ⓘ</span></Explanation> : <span className="mr-1 inline-flex items-center gap-2 rounded-md border border-[var(--line2)] px-3 py-2 text-[11px] font-medium"><span className="h-2 w-2 rounded-full" style={{ background: colors.cartera }} />{selectionLabel}</span>)}


                {keys.map(key => (

                    <span key={key} className={`inline-flex items-center rounded-md ${key === 'merval' || key === 'uva' ? `border pr-1 ${visible[key] ? 'border-[var(--line2)] bg-[var(--raised)]' : 'border-[var(--line)]'}` : ''}`}>
                    <button

                        type="button"

                        aria-pressed={visible[key]}

                        onClick={() =>

                            setVisible(v => ({

                                ...v,

                                [key]: !v[key],

                            }))

                        }

                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-[11px] transition-all duration-150 ${key === 'merval' || key === 'uva' ? (visible[key] ? 'text-[var(--ink)]' : 'text-[var(--muted)] opacity-50') : `border hover:border-[var(--line2)] ${visible[key] ? 'border-[var(--line2)] bg-[var(--raised)] text-[var(--ink)]' : 'border-[var(--line)] text-[var(--muted)] opacity-50'}`}`}

                    >

                        <span

                            className="h-2 w-2 rounded-full"

                            style={{ background: colors[key] }}

                        />

                        {labels[key]}

                    </button>
                    {(key === 'merval' || key === 'uva') && <Explanation inside label={`Qué es ${labels[key]}`} content={key === 'merval' ? 'El Merval es un índice que sigue la evolución de un grupo de acciones argentinas que cotizan en bolsa. Sirve como referencia general del mercado local.' : 'La UVA es una unidad de valor que se actualiza según la inflación. Se usa, por ejemplo, en algunos préstamos y plazos fijos.'}><span aria-hidden="true" className="font-mono text-[12px]">ⓘ</span></Explanation>}
                    </span>

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

                    {historyError || 'No hay suficientes cotizaciones para calcular la variación del período.'}

                </div>

            ) : (

                <>

                    <div className="relative mt-6 select-none touch-pan-y">

                        <svg

                            ref={svgRef}

                            viewBox={`0 0 ${W} ${H}`}

                            className="block w-full overflow-visible"

                            role="img"

                            aria-label="Gráfico de rendimiento comparado, base 100"

                            onPointerDown={handlePointerMove}
                            onPointerMove={handlePointerMove}

                            onPointerLeave={event => { if (event.pointerType === 'mouse') setHoverT(null); }}

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

                            {result.monthTicks.map(t => (

                                <text

                                    key={t}

                                    x={result.x(t)}

                                    y={H - 8}

                                    textAnchor="middle"

                                    fill="var(--muted)"

                                    fontSize="11"

                                >

                                    {months > 12 ? new Date(t).toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : monthLabel(t)}

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

                                className="pointer-events-none absolute top-0 z-20 w-[260px] max-w-[90%] rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-3 shadow-xl sm:w-[290px]"

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
                                                {point.original != null && Number.isFinite(point.original) && <p className="mu mt-1 text-[10px] tabular-nums">
                                                    {point.key === 'inflation' ? `Inflación mensual: ${point.original.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%` : point.key === 'deposit' ? `TNA: ${point.original.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%` : point.key === 'merval' ? `Índice: ${point.original.toLocaleString('es-AR', { maximumFractionDigits: 2 })} pts` : `${point.key === 'cartera' ? (selection === 'all' ? 'Valor estimado' : 'Valor de la selección') : 'Cotización'}: ${point.original.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })}`}
                                                </p>}
                                                {point.observedAt != null && <p className="mu text-[10px]">Dato del {dateLabel(point.observedAt)}</p>}

                                            </div>

                                        </div>

                                    ))}

                                </div>

                            </div>

                        )}

                    </div>

                    {/* Annual results */}

                    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">

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

                                        <span className="mu min-w-0 break-words text-[13px] font-medium">

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

                                    <p className="mu mt-1 text-[12px] leading-5">

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

                    Se simula la tenencia de {selection === 'all' ? 'las posiciones actuales' : 'este activo'} durante el período seleccionado.

                    Las posiciones en dólares se expresan en pesos usando la evolución histórica del dólar MEP,

                    ajustada a la cotización actual de conversión de la app. Las inversiones con tasa usan

                    la tasa cargada. Es una simulación, no un historial real de aportes o ventas. El dólar MEP y

                    la UVA utilizan la última cotización disponible; la

                    inflación se acumula mensualmente y el plazo fijo se

                    simula mediante reinversiones. Las referencias pueden

                    tener distintas fechas de actualización. El Merval utiliza la serie de Rosario Finanzas, que enlaza el MSCI Merval con el S&P Merval reescalado.

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
