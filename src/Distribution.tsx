import { useState } from 'react';

export type Slice = { label: string; color: string; value: number };

const panel = 'rounded-[20px] border border-[var(--line)] bg-[var(--surface)]';

export default function Distribution({ byKind, byCurrency, format }: {
    byKind: Slice[];
    byCurrency: Slice[];
    format: (n: number) => string; // ya respeta el modo "ocultar montos"
}) {
    const [view, setView] = useState<'kind' | 'currency'>('kind');
    const slices = (view === 'kind' ? byKind : byCurrency).filter(s => Number.isFinite(s.value) && s.value > 0);
    const total = slices.reduce((s, x) => s + x.value, 0);

    const R = 42;
    const C = 2 * Math.PI * R;
    const gap = slices.length > 1 ? 2 : 0;
    let acc = 0;

    return (
        <section className="mb-3.5" aria-labelledby="dist-title">
            <div className={`${panel} p-5 sm:p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 id="dist-title" className="text-[16px] font-medium tracking-tight">Distribución de la cartera</h2>
                        <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">Cómo se reparte tu dinero hoy</p>
                    </div>
                    <div className="inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-1" role="group" aria-label="Agrupar por">
                        {([['kind', 'Por tipo'], ['currency', 'Por moneda']] as const).map(([id, text]) => (
                            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}
                                className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] ${view === id ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)]'}`}>{text}</button>
                        ))}
                    </div>
                </div>

                {slices.length ? (
                    <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-center">
                        <div className="relative h-[190px] w-[190px] shrink-0">
                            <svg viewBox="0 0 120 120" className="h-full w-full" role="img"
                                aria-label={`Distribución ${view === 'kind' ? 'por tipo de activo' : 'por moneda'}: ${slices.map(s => `${s.label} ${(s.value / total * 100).toFixed(1)}%`).join(', ')}`}>
                                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--raised)" strokeWidth="16" />
                                {slices.map(s => {
                                    const frac = s.value / total;
                                    const len = Math.max(0, frac * C - gap);
                                    const el = (
                                        <circle key={s.label} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="16"
                                            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc * C}
                                            transform="rotate(-90 60 60)" />
                                    );
                                    acc += frac;
                                    return el;
                                })}
                            </svg>
                            <div className="pointer-events-none absolute inset-0 grid place-items-center">
                                <div className="max-w-[110px] text-center">
                                    <p className="font-mono text-[10px] text-[var(--muted)]">Total</p>
                                    <p className="break-all text-[13px] font-light tabular-nums">{format(total)}</p>
                                </div>
                            </div>
                        </div>

                        <ul className="w-full min-w-0 flex-1 divide-y divide-[var(--line)]">
                            {[...slices].sort((a, b) => b.value - a.value).map(s => (
                                <li key={s.label} className="flex items-center gap-3 py-3">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                                    <span className="min-w-0 flex-1 truncate text-[13px]">{s.label}</span>
                                    <span className="font-mono text-[12px] tabular-nums text-[var(--muted)]">{(s.value / total * 100).toFixed(1)}%</span>
                                    <span className="min-w-[90px] text-right font-mono text-[12px] tabular-nums">{format(s.value)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="grid h-[160px] place-items-center text-center text-[13px] text-[var(--muted)]">
                        No hay datos para mostrar. Puede faltar la cotización del dólar o el precio de algún activo.
                    </div>
                )}
            </div>
        </section>
    );
}