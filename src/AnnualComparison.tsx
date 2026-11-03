import type { Investment } from './portfolio';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

type Props = {
    items: Investment[];
    now: number;
    valueAt: (item: Investment, time: number) => number;
    convert: (value: number, item: Investment) => number;
};

export default function AnnualComparison({ items, now, valueAt, convert }: Props) {
    const currentYear = new Date(now).getFullYear();
    const years = Array.from({ length: 5 }, (_, index) => currentYear - index).map(year => {
        const start = new Date(year, 0, 1).getTime();
        const end = Math.min(now, new Date(year + 1, 0, 1).getTime());
        let initial = 0, final = 0, count = 0, partial = 0, missing = 0;
        for (const item of items) {
            const bought = new Date(`${item.date}T00:00:00`).getTime();
            if (bought >= end) continue;
            const from = Math.max(start, bought);
            const base = convert(valueAt(item, from), item);
            const value = convert(valueAt(item, end), item);
            if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(value)) { missing++; continue; }
            initial += base; final += value; count++;
            if (bought > start) partial++;
        }
        return { year, count, partial, missing, result: initial > 0 ? (final / initial - 1) * 100 : null };
    });
    const max = Math.max(1, ...years.map(row => Math.abs(row.result ?? 0)));
    return <section className="card mt-4 p-5 sm:p-6" aria-label="Comparación anual estimada">
        <p className="lb">COMPARACIÓN ANUAL ESTIMADA</p>
        <p className="mu mt-2 max-w-3xl text-[12px] leading-5">Compará las posiciones que todavía tenés. Cada año muestra el cambio desde el inicio del año o desde la compra si fue posterior; el año actual llega hasta hoy.</p>
        <div className="mt-5 divide-y divide-[var(--line)]">{years.map(row => <div key={row.year} className="grid grid-cols-[50px_1fr_auto] items-center gap-3 py-3"><span className="text-[13px] font-medium">{row.year}</span><div className="min-w-0"><div className="h-2 rounded-full bg-[var(--raised)]"><div className="h-full rounded-full" style={{ width: `${row.result == null ? 0 : Math.max(2, Math.abs(row.result) / max * 100)}%`, background: row.result != null && row.result < 0 ? 'var(--neg)' : 'var(--sig)' }} /></div><p className="mu mt-1 text-[10px]">{row.count ? `${row.count} ${row.count === 1 ? 'posición' : 'posiciones'}${row.partial ? ` · ${row.partial} con período parcial` : ''}${row.missing ? ` · ${row.missing} sin cotización` : ''}` : 'Sin posiciones con datos para este año'}</p></div><span className="font-mono text-[13px]" style={{ color: row.result == null ? 'var(--muted)' : row.result < 0 ? 'var(--neg)' : 'var(--sig)' }}>{row.result == null ? '—' : pct(row.result)}</span></div>)}</div>
        <p className="mu mt-4 border-t border-[var(--line)] pt-4 text-[11px] leading-5">Es una aproximación ponderada por el valor inicial de cada posición. Para cripto y CEDEARs se interpolan los valores entre la compra y la cotización actual; la conversión usa el dólar actual. No reconstruye ventas ni posiciones cerradas, y los años con compras posteriores no cubren doce meses completos.</p>
    </section>;
}
