import { useMemo, useRef, useState, type FormEvent } from 'react';

type Type = 'cedear' | 'crypto';
type Pt = { t: number; v: number };
type Result = { id: string; color: string; perf: Pt[]; ret: number; best: number; worst: number; drawdown: number };
type State =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; results: Result[]; days: number };

const COLORS = ['#7f96ff', '#f5c542'];
const RANGES = [{ days: 30, label: '1M' }, { days: 90, label: '3M' }, { days: 180, label: '6M' }, { days: 365, label: '1A' }];
const DEFAULTS: Record<Type, [string, string]> = { cedear: ['AAPL', 'MSFT'], crypto: ['bitcoin', 'ethereum'] };

const field = 'w-full min-w-0 rounded-[10px] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--muted)]';
const label = 'mb-1.5 block text-[12px] text-[var(--muted)]';
const panel = 'rounded-[20px] border border-[var(--line)] bg-[var(--surface)]';

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const shortDate = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
const norm = (type: Type, s: string) => (type === 'cedear' ? s.trim().toUpperCase() : s.trim().toLowerCase());

async function cryptoSeries(id: string, days: number, signal: AbortSignal): Promise<Pt[]> {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`, { signal });
    if (res.status === 429) throw new Error('CoinGecko limitó las consultas. Esperá un minuto y volvé a intentar.');
    if (!res.ok) throw new Error(`No se encontró "${id}" en CoinGecko. Revisá el ID.`);
    const data = await res.json();
    const pts: Pt[] = (Array.isArray(data?.prices) ? data.prices : [])
        .map((p: unknown) => (Array.isArray(p) ? { t: Number(p[0]), v: Number(p[1]) } : null))
        .filter((p: Pt | null): p is Pt => !!p && Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0);
    if (pts.length < 2) throw new Error(`No hay historial suficiente para "${id}".`);
    return pts;
}

async function cedearSeries(ticker: string, days: number, signal: AbortSignal): Promise<Pt[]> {
    const res = await fetch(`https://data912.com/historical/cedears/${encodeURIComponent(ticker)}`, { signal });
    if (!res.ok) throw new Error(`No se pudo consultar el historial de "${ticker}".`);
    const rows = await res.json();
    const cutoff = Date.now() - days * 86_400_000;
    const pts: Pt[] = (Array.isArray(rows) ? rows : [])
        .map((r: { date?: unknown; c?: unknown }) => {
            const d = String(r.date ?? '');
            const t = /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T12:00:00`) : Date.parse(d);
            return { t, v: Number(r.c) };
        })
        .filter((p: Pt) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0 && p.t >= cutoff)
        .sort((a: Pt, b: Pt) => a.t - b.t);
    if (pts.length < 2) throw new Error(`No hay datos para "${ticker}" en el período. Revisá el ticker.`);
    return pts;
}

function analyze(id: string, color: string, pts: Pt[]): Result {
    const base = pts[0].v;
    const perf = pts.map(p => ({ t: p.t, v: (p.v / base - 1) * 100 }));
    let peak = pts[0].v, drawdown = 0;
    for (const p of pts) {
        peak = Math.max(peak, p.v);
        drawdown = Math.min(drawdown, (p.v / peak - 1) * 100);
    }
    return { id, color, perf, ret: perf[perf.length - 1].v, best: Math.max(...perf.map(p => p.v)), worst: Math.min(...perf.map(p => p.v)), drawdown };
}

export default function Compare({ cryptos, cedears }: { cryptos: string[]; cedears: string[] }) {
    const [type, setType] = useState<Type>('cedear');
    const [a, setA] = useState(DEFAULTS.cedear[0]);
    const [b, setB] = useState(DEFAULTS.cedear[1]);
    const [days, setDays] = useState(180);
    const [state, setState] = useState<State>({ status: 'idle' });
    const [nextSlot, setNextSlot] = useState<0 | 1>(0);
    const ctrl = useRef<AbortController | null>(null);

    const held = type === 'cedear' ? cedears : cryptos;

    function pickType(t: Type) {
        if (t === type) return;
        ctrl.current?.abort();
        setType(t); setA(DEFAULTS[t][0]); setB(DEFAULTS[t][1]); setState({ status: 'idle' }); setNextSlot(0);
    }

    function pickHeld(id: string) {
        if (nextSlot === 0) setA(id); else setB(id);
        setNextSlot(nextSlot === 0 ? 1 : 0);
    }

    async function run(e?: FormEvent) {
        e?.preventDefault();
        const ids = [norm(type, a), norm(type, b)];
        if (!ids[0] || !ids[1]) return setState({ status: 'error', message: 'Ingresá los dos activos a comparar.' });
        if (ids[0] === ids[1]) return setState({ status: 'error', message: 'Elegí dos activos distintos.' });
        ctrl.current?.abort();
        const controller = new AbortController();
        ctrl.current = controller;
        setState({ status: 'loading' });
        try {
            const load = type === 'crypto' ? cryptoSeries : cedearSeries;
            const series: Pt[][] = [];
            for (const id of ids) series.push(await load(id, days, controller.signal)); // en serie, para no saturar CoinGecko
            if (controller.signal.aborted) return;
            setState({ status: 'ready', days, results: ids.map((id, i) => analyze(id, COLORS[i], series[i])) });
        } catch (err) {
            if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
            setState({ status: 'error', message: err instanceof Error ? err.message : 'No se pudo completar la comparación.' });
        }
    }

    const chart = useMemo(() => {
        if (state.status !== 'ready') return null;
        const all = state.results.flatMap(r => r.perf);
        const tMin = Math.min(...all.map(p => p.t)), tMax = Math.max(...all.map(p => p.t));
        const vals = all.map(p => p.v);
        const lo0 = Math.min(0, ...vals), hi0 = Math.max(0, ...vals);
        const span = hi0 - lo0 || 1;
        const lo = lo0 - span * 0.08, hi = hi0 + span * 0.08;
        const w = 850, h = 230, pad = 12;
        const px = (t: number) => pad + ((t - tMin) / (tMax - tMin || 1)) * (w - 2 * pad);
        const py = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);
        return {
            w, h, zeroY: py(0), first: shortDate(tMin), last: shortDate(tMax),
            paths: state.results.map(r => ({ id: r.id, color: r.color, d: r.perf.map((p, i) => `${i ? 'L' : 'M'} ${px(p.t).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ') })),
        };
    }, [state]);

    const rangeLabel = RANGES.find(r => r.days === (state.status === 'ready' ? state.days : days))?.label ?? '';
    const summary = state.status === 'ready' ? (() => {
        const [x, y] = state.results;
        const win = x.ret >= y.ret ? x : y, lose = win === x ? y : x;
        return `${win.id} rindió ${(win.ret - lose.ret).toFixed(2)} puntos porcentuales más que ${lose.id} en ${rangeLabel}.`;
    })() : '';

    return (
        <section className={`${panel} mb-3.5 p-5 sm:p-6`} aria-labelledby="cmp-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="cmp-title" className="text-[16px] font-medium tracking-tight">Comparar activos</h2>
                    <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">Rendimiento real de dos CEDEARs o dos criptomonedas</p>
                </div>
                <div className="inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-1" role="group" aria-label="Tipo de activo">
                    {([['cedear', 'CEDEARs'], ['crypto', 'Cripto']] as const).map(([id, text]) => (
                        <button key={id} type="button" aria-pressed={type === id} onClick={() => pickType(id)}
                            className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] ${type === id ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)]'}`}>{text}</button>
                    ))}
                </div>
            </div>

            <form onSubmit={run} className="mt-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    {([[a, setA, 'Activo A', 'cmp-a'], [b, setB, 'Activo B', 'cmp-b']] as const).map(([val, set, text, id], i) => (
                        <div key={id}>
                            <label htmlFor={id} className={label}><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{text} · {type === 'cedear' ? 'ticker' : 'ID de CoinGecko'}</label>
                            <input id={id} className={field} value={val} onChange={e => set(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                placeholder={type === 'cedear' ? 'AAPL' : 'bitcoin'} />
                        </div>
                    ))}
                    <div>
                        <span className={label}>Período</span>
                        <div className="inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-1" role="group" aria-label="Período">
                            {RANGES.map(r => (
                                <button key={r.days} type="button" aria-pressed={days === r.days} onClick={() => setDays(r.days)}
                                    className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] ${days === r.days ? 'bg-[var(--raised)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line2)]' : 'text-[var(--muted)]'}`}>{r.label}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {held.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-[var(--muted)]">De tu cartera:</span>
                        {held.map(id => (
                            <button key={id} type="button" onClick={() => pickHeld(id)} className="rounded-md border border-[var(--line)] bg-[var(--raised)] px-2 py-0.5 font-mono text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">{id}</button>
                        ))}
                    </div>
                )}

                <button type="submit" disabled={state.status === 'loading'} className="mt-4 rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-[13px] font-medium text-[var(--bg)] disabled:opacity-50">
                    {state.status === 'loading' ? 'Consultando…' : 'Comparar'}
                </button>
            </form>

            <div aria-live="polite">
                {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-[#ff7d52]/10 p-3 text-[12px] text-[#ff7d52]">{state.message}</p>}

                {state.status === 'ready' && chart && (
                    <div className="mt-6">
                        <div className="mb-2 flex flex-wrap items-center gap-4 font-mono text-[11px] text-[var(--muted)]">
                            {state.results.map(r => <span key={r.id} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: r.color }} />{r.id}</span>)}
                            <span className="text-[var(--faint)]">Variación % desde el inicio del período</span>
                        </div>
                        <svg viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" className="h-[200px] w-full overflow-visible" role="img"
                            aria-label={`Comparación de rendimiento: ${state.results.map(r => `${r.id} ${pct(r.ret)}`).join(', ')}`}>
                            <line x1="12" x2={chart.w - 12} y1={chart.zeroY} y2={chart.zeroY} stroke="var(--muted)" strokeOpacity=".5" strokeDasharray="4 5" />
                            {chart.paths.map(p => <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
                        </svg>
                        <div className="mt-2 flex justify-between font-mono text-[11px] text-[var(--muted)]"><span>{chart.first}</span><span>{chart.last}</span></div>

                        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--line)]">
                            <table className="w-full min-w-[440px] text-right font-mono text-[12px] tabular-nums">
                                <thead>
                                    <tr className="text-[11px] text-[var(--muted)]">
                                        <th className="px-4 py-2.5 text-left font-normal">Activo</th>
                                        <th className="px-4 py-2.5 font-normal">Retorno</th>
                                        <th className="px-4 py-2.5 font-normal">Máximo</th>
                                        <th className="px-4 py-2.5 font-normal">Mínimo</th>
                                        <th className="px-4 py-2.5 font-normal">Caída máx.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--line)]">
                                    {state.results.map(r => (
                                        <tr key={r.id}>
                                            <td className="px-4 py-2.5 text-left"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.id}</td>
                                            <td className={`px-4 py-2.5 ${r.ret >= 0 ? 'text-[#4ade80]' : 'text-[#ff7d52]'}`}>{pct(r.ret)}</td>
                                            <td className="px-4 py-2.5">{pct(r.best)}</td>
                                            <td className="px-4 py-2.5">{pct(r.worst)}</td>
                                            <td className="px-4 py-2.5 text-[#ff7d52]">{r.drawdown.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-[13px]">{summary}</p>
                    </div>
                )}
            </div>

            <p className="mt-4 font-mono text-[10px] leading-5 text-[var(--faint)]">
                {type === 'cedear' ? 'Los CEDEARs cotizan en pesos: el retorno incluye el efecto del tipo de cambio. Datos de Data912, no en tiempo real. ' : 'Precios en USD de CoinGecko. '}
                Los rendimientos pasados no garantizan resultados futuros.
            </p>
        </section>
    );
}