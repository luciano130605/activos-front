import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartIncreaseFreeIcons, ChartDecreaseFreeIcons, PieChart02Icon } from '@hugeicons/core-free-icons';
import Select from './Select';

type Currency = 'USD' | 'ARS';
type Period = 'year' | 'month';
type Mode = 'compound' | 'simple';
type Unit = 'years' | 'months';

const field = 'w-full min-w-0 rounded-[10px] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--muted)]';
const label = 'mb-1.5 block text-[12px] text-[var(--muted)]';
const panel = 'rounded-[20px] border border-[var(--line)] bg-[var(--surface)]';
const MAX_MONTHS = 600; // 50 años

const money = (n: number, c: Currency) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

type Point = { m: number; value: number; invested: number };

function simulate(amount: number, rate: number, period: Period, months: number, contrib: number, mode: Mode): Point[] {
    const r = rate / 100;
    const out: Point[] = [{ m: 0, value: amount, invested: amount }];
    if (mode === 'compound') {
        // Tasa mensual equivalente (si es anual, se convierte con raíz 12)
        const rm = period === 'month' ? r : Math.pow(1 + r, 1 / 12) - 1;
        let balance = amount;
        for (let m = 1; m <= months; m++) {
            balance = balance * (1 + rm) + contrib; // el aporte entra a fin de mes
            out.push({ m, value: balance, invested: amount + contrib * m });
        }
    } else {
        // Interés simple: solo se calcula sobre el capital aportado, sin reinvertir lo ganado
        const rs = period === 'month' ? r : r / 12;
        let principal = amount;
        let interest = 0;
        for (let m = 1; m <= months; m++) {
            interest += principal * rs;
            principal += contrib;
            out.push({ m, value: principal + interest, invested: principal });
        }
    }
    return out;
}

export default function Simulator({ currency, portfolio }: { currency: Currency; portfolio?: number }) {
    const [amount, setAmount] = useState('1000');
    const [rate, setRate] = useState('10');
    const [period, setPeriod] = useState<Period>('year');
    const [time, setTime] = useState('5');
    const [unit, setUnit] = useState<Unit>('years');
    const [contrib, setContrib] = useState('0');
    const [mode, setMode] = useState<Mode>('compound');
    const [inflation, setInflation] = useState('');

    const parsed = useMemo(() => {
        const a = Number(amount), r = Number(rate), t = Number(time), c = Number(contrib || 0), inf = Number(inflation || 0);
        const months = Math.round(unit === 'years' ? t * 12 : t);
        let error = '';
        if (!Number.isFinite(a) || a < 0) error = 'El monto inicial debe ser 0 o mayor.';
        else if (!Number.isFinite(r) || r <= -100) error = 'La tasa debe ser mayor a -100%.';
        else if (!Number.isFinite(t) || months < 1) error = 'El plazo debe ser de al menos 1 mes.';
        else if (months > MAX_MONTHS) error = 'El plazo máximo es de 50 años.';
        else if (!Number.isFinite(c) || c < 0) error = 'El aporte mensual debe ser 0 o mayor.';
        else if (!Number.isFinite(inf) || inf <= -100) error = 'La inflación debe ser mayor a -100%.';
        else if (a === 0 && c === 0) error = 'Ingresá un monto inicial o un aporte mensual.';
        return { a, r, c, inf, months, error };
    }, [amount, rate, time, unit, contrib, inflation]);

    const points = useMemo(
        () => (parsed.error ? [] : simulate(parsed.a, parsed.r, period, parsed.months, parsed.c, mode)),
        [parsed, period, mode],
    );

    const last = points[points.length - 1];
    const gain = last ? last.value - last.invested : 0;
    const roi = last && last.invested > 0 ? (gain / last.invested) * 100 : 0;
    const years = parsed.months / 12;
    const realValue = last && inflation.trim() ? last.value / Math.pow(1 + parsed.inf / 100, years) : undefined;
    const realGain = realValue != null && last ? realValue - last.invested : undefined;
    const annualized = last && parsed.a > 0 && parsed.c === 0 && last.value > 0 ? (Math.pow(last.value / parsed.a, 1 / years) - 1) * 100 : undefined;

    // Cuánto tarda en duplicarse (solo sin aportes e interés compuesto)
    const doubling = useMemo(() => {
        if (mode !== 'compound' || parsed.error || parsed.r <= 0 || parsed.c > 0) return undefined;
        const rm = period === 'month' ? parsed.r / 100 : Math.pow(1 + parsed.r / 100, 1 / 12) - 1;
        const m = Math.log(2) / Math.log(1 + rm);
        return Number.isFinite(m) ? m : undefined;
    }, [mode, parsed, period]);

    const chart = useMemo(() => {
        if (points.length < 2) return null;
        const w = 850, h = 230, pad = 12;
        const n = points[points.length - 1].m;
        const max = Math.max(1, ...points.map(p => Math.max(p.value, p.invested))) * 1.1;
        const px = (m: number) => pad + (m / n) * (w - 2 * pad);
        const py = (v: number) => h - pad - (Math.max(0, v) / max) * (h - 2 * pad);
        const path = (key: 'value' | 'invested') => points.map((p, i) => `${i ? 'L' : 'M'} ${px(p.m).toFixed(1)} ${py(p[key]).toFixed(1)}`).join(' ');
        const line = path('value');
        const area = `${line} L ${px(n)} ${h - pad} L ${px(0)} ${h - pad} Z`;
        return { w, h, line, area, invested: path('invested') };
    }, [points]);

    const rows = useMemo(() => {
        if (!points.length) return [];
        const n = points[points.length - 1].m;
        const step = n <= 12 ? 1 : n <= 36 ? 3 : 12;
        return points.filter(p => p.m > 0 && (p.m % step === 0 || p.m === n));
    }, [points]);

    const periodLabel = (m: number) => (m % 12 === 0 ? `${m / 12} ${m / 12 === 1 ? 'año' : 'años'}` : m > 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m} ${m === 1 ? 'mes' : 'meses'}`);
    const positive = gain >= 0;

    return (
        <section className={`${panel} mb-3.5 p-5 sm:p-6`} aria-labelledby="sim-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="sim-title" className="text-[16px] font-medium tracking-tight">Simulador de rentabilidad</h2>
                    <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">Probá escenarios sin cargar una inversión real</p>
                </div>
                <div className="inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-1" role="group" aria-label="Tipo de interés">
                    {([['compound', 'Compuesto'], ['simple', 'Simple']] as const).map(([id, text]) => (
                        <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}
                            className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] ${mode === id ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)]'}`}>{text}</button>
                    ))}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <label htmlFor="sim-amount" className={label}>Monto inicial ({currency})</label>
                    <input id="sim-amount" type="number" min="0" step="any" inputMode="decimal" className={field} value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" />
                    {portfolio != null && Number.isFinite(portfolio) && portfolio > 0 && (
                        <button type="button" onClick={() => setAmount(String(Math.round(portfolio * 100) / 100))} className="mt-1.5 text-[11px] text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]">
                            Usar el valor de mi cartera
                        </button>
                    )}
                </div>
                <div>
                    <label htmlFor="sim-rate" className={label}>Rentabilidad (%)</label>
                    <div className="flex gap-2">
                        <input id="sim-rate" type="number" step="any" inputMode="decimal" className={field} value={rate} onChange={e => setRate(e.target.value)} placeholder="10" />
                        <Select<Period> label="Período de la tasa" className="w-[112px] shrink-0" value={period} onChange={setPeriod}
                            options={[{ value: 'year', label: 'anual' }, { value: 'month', label: 'mensual' }]} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {[5, 10, 15, 25, 50].map(n => (
                            <button key={n} type="button" onClick={() => setRate(String(n))} className={`rounded-md px-2 py-0.5 font-mono text-[10px] ${Number(rate) === n ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{n}%</button>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="sim-time" className={label}>Plazo</label>
                    <div className="flex gap-2">
                        <input id="sim-time" type="number" min="1" step="any" inputMode="decimal" className={field} value={time} onChange={e => setTime(e.target.value)} placeholder="5" />
                        <Select<Unit> label="Unidad de tiempo" className="w-[112px] shrink-0" value={unit} onChange={setUnit}
                            options={[{ value: 'years', label: 'años' }, { value: 'months', label: 'meses' }]} />
                    </div>
                </div>
                <div>
                    <label htmlFor="sim-contrib" className={label}>Aporte mensual ({currency})</label>
                    <input id="sim-contrib" type="number" min="0" step="any" inputMode="decimal" className={field} value={contrib} onChange={e => setContrib(e.target.value)} placeholder="0" />
                </div>
            </div>
            <div className="mt-3 max-w-xs">
                <label htmlFor="sim-inf" className={label}>Inflación anual estimada (%, opcional)</label>
                <input id="sim-inf" type="number" step="any" inputMode="decimal" className={field} value={inflation} onChange={e => setInflation(e.target.value)} placeholder="Para ver el rendimiento real" />
            </div>

            {parsed.error ? (
                <p role="alert" className="mt-5 rounded-lg bg-[#ff7d52]/10 p-3 text-[12px] text-[#ff7d52]">{parsed.error}</p>
            ) : last && (
                <>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
                            <p className="font-mono text-[11px] text-[var(--muted)]">Valor final</p>
                            <p className="mt-1 break-all text-[clamp(1.3rem,2.6vw,1.9rem)] font-light tracking-tight tabular-nums">{money(last.value, currency)}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
                            <p className="font-mono text-[11px] text-[var(--muted)]">Ganancia</p>
                            <p className={`mt-1 break-all text-[clamp(1.3rem,2.6vw,1.9rem)] font-light tracking-tight tabular-nums ${positive ? 'text-[#4ade80]' : 'text-[#ff7d52]'}`}>{money(gain, currency)}</p>
                            <span className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] ${positive ? 'bg-[#4ade80]/10 text-[#4ade80]' : 'bg-[#ff7d52]/10 text-[#ff7d52]'}`}>
                                <HugeiconsIcon icon={positive ? ChartIncreaseFreeIcons : ChartDecreaseFreeIcons} size={13} />{pct(roi)}
                            </span>
                        </div>
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
                            <p className="font-mono text-[11px] text-[var(--muted)]">Capital aportado</p>
                            <p className="mt-1 break-all text-[clamp(1.3rem,2.6vw,1.9rem)] font-light tracking-tight tabular-nums">{money(last.invested, currency)}</p>
                            <p className="mt-2 font-mono text-[10px] text-[var(--faint)]">{periodLabel(parsed.months)}</p>
                        </div>
                    </div>

                    <div className="mt-3 grid gap-x-6 gap-y-2 font-mono text-[12px] sm:grid-cols-2">
                        {annualized != null && (
                            <div className="flex items-center justify-between border-b border-[var(--line)] py-2"><span className="text-[var(--muted)]">Rendimiento anualizado</span><span>{pct(annualized)}</span></div>
                        )}
                        {doubling != null && (
                            <div className="flex items-center justify-between border-b border-[var(--line)] py-2"><span className="text-[var(--muted)]">Se duplica en</span><span>{periodLabel(Math.ceil(doubling))}</span></div>
                        )}
                        {realValue != null && realGain != null && (
                            <>
                                <div className="flex items-center justify-between border-b border-[var(--line)] py-2"><span className="text-[var(--muted)]">Valor final real (sin inflación)</span><span>{money(realValue, currency)}</span></div>
                                <div className="flex items-center justify-between border-b border-[var(--line)] py-2"><span className="text-[var(--muted)]">Ganancia real</span><span className={realGain >= 0 ? 'text-[#4ade80]' : 'text-[#ff7d52]'}>{money(realGain, currency)}</span></div>
                            </>
                        )}
                    </div>

                    {chart && (
                        <div className="mt-6">
                            <div className="mb-2 flex items-center gap-4 font-mono text-[10px] text-[var(--muted)]">
                                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#7f96ff]" />Valor</span>
                                <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-[var(--muted)]" />Capital aportado</span>
                            </div>
                            <svg viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" className="h-[200px] w-full overflow-visible" role="img" aria-label="Gráfico de la simulación: valor y capital aportado a lo largo del tiempo">
                                <defs>
                                    <linearGradient id="sim-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#7f96ff" stopOpacity=".23" />
                                        <stop offset="100%" stopColor="#7f96ff" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {[.25, .5, .75, 1].map(n => <line key={n} x1="12" x2={chart.w - 12} y1={chart.h * n - 5} y2={chart.h * n - 5} stroke="var(--line)" strokeDasharray="4 5" />)}
                                <path d={chart.area} fill="url(#sim-fill)" />
                                <path d={chart.invested} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                                <path d={chart.line} fill="none" stroke="#7f96ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="mt-2 flex justify-between font-mono text-[11px] text-[var(--muted)]"><span>Hoy</span><span>{periodLabel(parsed.months)}</span></div>
                        </div>
                    )}

                    <details className="group mt-5 rounded-xl border border-[var(--line)]">
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]">
                            <HugeiconsIcon icon={PieChart02Icon} size={15} />Ver evolución período por período
                        </summary>
                        <div className="overflow-x-auto border-t border-[var(--line)]">
                            <table className="w-full min-w-[420px] text-right font-mono text-[12px] tabular-nums">
                                <thead>
                                    <tr className="text-[11px] text-[var(--muted)]">
                                        <th className="px-4 py-2.5 text-left font-normal">Tiempo</th>
                                        <th className="px-4 py-2.5 font-normal">Aportado</th>
                                        <th className="px-4 py-2.5 font-normal">Ganancia</th>
                                        <th className="px-4 py-2.5 font-normal">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--line)]">
                                    {rows.map(p => (
                                        <tr key={p.m}>
                                            <td className="px-4 py-2.5 text-left text-[var(--muted)]">{periodLabel(p.m)}</td>
                                            <td className="px-4 py-2.5">{money(p.invested, currency)}</td>
                                            <td className={`px-4 py-2.5 ${p.value - p.invested >= 0 ? 'text-[#4ade80]' : 'text-[#ff7d52]'}`}>{money(p.value - p.invested, currency)}</td>
                                            <td className="px-4 py-2.5">{money(p.value, currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </>
            )}
            <p className="mt-4 font-mono text-[10px] leading-5 text-[var(--faint)]">Simulación teórica con rendimiento constante. Los aportes se suman a fin de cada mes. No incluye impuestos ni comisiones, y los rendimientos pasados no garantizan resultados futuros.</p>
        </section>
    );
}
