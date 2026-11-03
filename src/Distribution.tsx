import { useRef, useState } from 'react';

export type Slice = { label: string; color: string; value: number; count: number };

export default function Distribution({ byKind, byCurrency, byAsset, bySector, byCountry, format }: {
    byKind: Slice[];
    byCurrency: Slice[];
    byAsset: Slice[];
    bySector: Slice[];
    byCountry: Slice[];
    format: (n: number) => string; // ya respeta el modo "ocultar montos"
}) {
    const [view, setView] = useState<'kind' | 'currency' | 'asset' | 'sector' | 'country'>('kind');
    const [active, setActive] = useState<string | null>(null);
    const [at, setAt] = useState({ x: 0, y: 0 });
    const box = useRef<HTMLDivElement>(null);
    const slices = ({ kind: byKind, currency: byCurrency, asset: byAsset, sector: bySector, country: byCountry }[view]).filter(s => Number.isFinite(s.value) && s.value > 0);
    const total = slices.reduce((s, x) => s + x.value, 0);
    const sorted = [...slices].sort((a, b) => b.value - a.value);
    const hovered = sorted.find(s => s.label === active) ?? null;
    const pct = (s: Slice) => (s.value / total * 100).toFixed(1).replace('.', ',');
    const move = (event: React.PointerEvent, label: string) => {
        const r = box.current?.getBoundingClientRect();
        if (!r) return;
        setAt({ x: Math.min(event.clientX - r.left + 14, r.width - 210), y: Math.max(0, event.clientY - r.top - 96) });
        setActive(label);
    };
    const R = 42, C = 2 * Math.PI * R, gap = slices.length > 1 ? 2 : 0;
    let acc = 0;
    const total$ = slices.reduce((n, s) => n + s.count, 0);

    return (
        <section className="mb-3.5" aria-labelledby="dist-title">
            <div className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="lb">06 — DISTRIBUCIÓN</p>
                        <h2 id="dist-title" className="mt-2 text-[20px] font-light tracking-tight">Distribución de la cartera</h2>
                    </div>
                    <div className="seg flex-wrap" role="group" aria-label="Agrupar por">
                        {([['kind', 'Tipo'], ['currency', 'Moneda'], ['asset', 'Activo'], ['sector', 'Sector'], ['country', 'País']] as const).map(([id, text]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => { setView(id); setActive(null); }}>{text}</button>)}
                    </div>
                </div>

                {(view === 'sector' || view === 'country') && <p className="mu mt-3 text-[11px]">Clasificación orientativa de CEDEARs conocidos; fondos y activos sin datos figuran como Sin clasificar.</p>}
                {slices.length ? (
                    <div ref={box} className="relative mt-6" onPointerLeave={() => setActive(null)}>
                        <div className="dm" role="img" aria-label={`Distribución: ${sorted.map(s => `${s.label} ${pct(s)}%`).join(', ')}`}>
                            {sorted.map(s => <i key={s.label} className={active === s.label ? 'on' : ''} style={{ ['--c' as string]: s.color, flex: s.value }} onPointerMove={e => move(e, s.label)} />)}
                        </div>
                        <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row">
                            <div className="relative h-[180px] w-[180px] shrink-0">
                                <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
                                    <circle cx="60" cy="60" r={R} fill="none" stroke="var(--raised)" strokeWidth="14" />
                                    {sorted.map(s => {
                                        const frac = s.value / total;
                                        const len = Math.max(0, frac * C - gap);
                                        const el = <circle key={s.label} cx="60" cy="60" r={R} fill="none" strokeWidth={active === s.label ? 18 : 14} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc * C} transform="rotate(-90 60 60)" opacity={active && active !== s.label ? .3 : 1} style={{ stroke: s.color, transition: 'stroke-width .15s, opacity .15s', cursor: 'default' }} onPointerMove={e => move(e, s.label)} />;
                                        acc += frac;
                                        return el;
                                    })}
                                </svg>
                                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                                    <div className="max-w-[100px] text-center">
                                        <p className="mu text-[10px]">{hovered ? hovered.label : 'Total'}</p>
                                        <p className="break-all text-[14px] font-light tabular-nums">{hovered ? `${pct(hovered)}%` : format(total)}</p>
                                    </div>
                                </div>
                            </div>
                            <ul className="w-full min-w-0 flex-1">
                                {sorted.map(s => (
                                    <li key={s.label} tabIndex={0} onPointerEnter={() => setActive(s.label)} onFocus={() => setActive(s.label)} onBlur={() => setActive(null)} className={`flex items-center gap-3 rounded-lg border-t border-[var(--line)] px-2 py-3 first:border-0 ${active === s.label ? 'bg-[var(--raised)]' : ''}`}>
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                                        <span className="min-w-0 flex-1 truncate text-[13px]">{s.label}<span className="mu ml-2 text-[10.5px]">{s.count} {s.count === 1 ? 'inversión' : 'inversiones'}</span></span>
                                        <span className="mu tabular-nums">{pct(s)}%</span>
                                        <span className="min-w-[96px] text-right font-mono text-[12px] tabular-nums">{format(s.value)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {hovered && <div className="tip" style={{ left: at.x, top: at.y }} role="presentation">
                            <p className="flex items-center gap-2 text-[13px] font-medium"><span className="h-2 w-2 rounded-full" style={{ background: hovered.color }} />{hovered.label}</p>
                            <dl><dt>Valor</dt><dd>{format(hovered.value)}</dd><dt>% de la cartera</dt><dd>{pct(hovered)}%</dd><dt>Inversiones</dt><dd>{hovered.count} de {total$}</dd></dl>
                        </div>}
                    </div>
                ) : (
                    <div className="grid h-[160px] place-items-center text-center text-[13px] text-[var(--muted)]">
                        No hay datos para mostrar. Puede faltar la cotización de USDC o el precio de algún activo.
                    </div>
                )}
            </div>
        </section>
    );
}
