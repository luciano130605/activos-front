import RefreshButton from './RefreshButton';
import { useEffect, useState } from 'react';
import PageLink from './PageLink';

type Observation = { fecha: string; valor: number; previous?: number };
type MacroData = { risk?: Observation; inflation?: Observation; rate?: Observation; merval?: Observation };

type Rates = Record<string, { venta: number }>;

type Stablecoins = {
    usdt?: number;
    usdc?: number;
};
const endpoints = { risk: 'https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo', inflation: 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion', rate: 'https://api.argentinadatos.com/v1/finanzas/tasas/depositos30Dias', merval: '/api/benchmarks/merval' } as const;
const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const price = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const day = (value: string, monthly = false) => {
    const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-AR', monthly ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : 'Fecha no disponible';
};

export default function MacroDashboard({ rates, refreshDollars, dollarLoading }: { rates: Rates; refreshDollars: () => void; dollarLoading: boolean }) {
    const [data, setData] = useState<MacroData | null>(null);
    const [retry, setRetry] = useState(0);
    const [stablecoins, setStablecoins] = useState<Stablecoins | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setData(null);
        setStablecoins(null);

        void fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=tether%2Cusd-coin&vs_currencies=ars',
            {
                signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(20000),
                ]),
            }
        )
            .then(async (response) => {
                if (!response.ok) throw new Error('Cotización no disponible');

                const json: {
                    tether?: { ars?: number };
                    'usd-coin'?: { ars?: number };
                } = await response.json();

                setStablecoins({
                    usdt: json.tether?.ars,
                    usdc: json['usd-coin']?.ars,
                });
            })
            .catch(() => {
                if (!controller.signal.aborted) setStablecoins({});
            });
        void Promise.allSettled(Object.entries(endpoints).map(async ([key, path]) => {
            const response = await fetch(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
            if (!response.ok) throw new Error('Dato no disponible');
            const raw: unknown = await response.json();
            const rows: unknown[] = Array.isArray(raw) ? raw : [raw];
            const valid = rows.filter((row): row is Observation => !!row && typeof row === 'object' && typeof (row as Observation).fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test((row as Observation).fecha) && typeof (row as Observation).valor === 'number' && Number.isFinite((row as Observation).valor));
            valid.sort((a, b) => b.fecha.localeCompare(a.fecha));
            if (!valid.length) throw new Error('Dato inválido');
            const previous = key === 'merval' ? valid.find(row => row.fecha.slice(0, 10) < valid[0].fecha.slice(0, 10) && row.valor > 0)?.valor : undefined;
            return [key, { ...valid[0], previous }] as const;
        })).then(results => { if (!controller.signal.aborted) setData(Object.fromEntries(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))); });
        return () => controller.abort();
    }, [retry]);
    const refresh = () => { refreshDollars(); setRetry(value => value + 1); };
    const loading = data === null;
    const unavailable = 'No disponible';
    const metric = (title: string, value: string, note: string, source: string, url: string) => <article key={title} className="macro-metric">
        <p className="macro-metric-label">{title}</p>
        <p className="macro-value">{value}</p>
        <p className="macro-note">{note}</p>
        <a className="macro-source" href={url} target="_blank" rel="noopener noreferrer">{source}</a>
    </article>;
    return <section className="card macro-dashboard mb-3.5 p-5 sm:p-6" aria-labelledby="macro-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="lb">CONTEXTO DE MERCADO</p><h2 id="macro-title" className="mt-2 text-[20px] font-light tracking-tight">Tablero macro</h2><p className="mu mt-2 text-[12px]">Referencias de Argentina para seguir el contexto de tu cartera.</p></div><RefreshButton onClick={refresh} loading={loading || dollarLoading} label="Actualizar tablero macro" /></div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {([['oficial', 'Dólar oficial'], ['bolsa', 'Dólar MEP'], ['contadoconliqui', 'Dólar CCL']] as const).map(([key, label]) => metric(label, rates[key]?.venta > 0 ? price.format(rates[key].venta) : unavailable, 'Venta · última consulta', 'DolarApi', 'https://dolarapi.com/'))}
            {metric(
                'USDT',
                stablecoins === null
                    ? '…'
                    : stablecoins.usdt && stablecoins.usdt > 0
                        ? price.format(stablecoins.usdt)
                        : unavailable,
                'Tether · ARS',
                'CoinGecko',
                'https://www.coingecko.com/en/coins/tether'
            )}

            {metric(
                'USDC',
                stablecoins === null
                    ? '…'
                    : stablecoins.usdc && stablecoins.usdc > 0
                        ? price.format(stablecoins.usdc)
                        : unavailable,
                'USD Coin · ARS',
                'CoinGecko',
                'https://www.coingecko.com/en/coins/usd-coin'
            )}
            {metric('Merval', loading ? '…' : data?.merval ? `${number.format(data.merval.valor)} pts` : unavailable, data?.merval ? `${day(data.merval.fecha)}${data.merval.previous ? ` · ${data.merval.valor >= data.merval.previous ? '+' : ''}${number.format((data.merval.valor / data.merval.previous - 1) * 100)}% vs. cierre anterior` : ''}` : 'Sin fecha disponible', 'Rosario Finanzas', 'https://rosariofinanzas.ar/')}
            {metric('Riesgo país', loading ? '…' : data?.risk ? `${number.format(data.risk.valor)} pb` : unavailable, data?.risk ? day(data.risk.fecha) : 'Sin fecha disponible', 'ArgentinaDatos · Ámbito', 'https://argentinadatos.com/docs/operations/get-finanzas-indices-riesgo-pais-ultimo')}
            {metric('Inflación mensual', loading ? '…' : data?.inflation ? `${number.format(data.inflation.valor)}%` : unavailable, data?.inflation ? day(data.inflation.fecha, true) : 'Sin fecha disponible', 'INDEC · ArgentinaDatos', 'https://www.indec.gob.ar/')}
            {metric('Depósitos 30 días', loading ? '…' : data?.rate ? `${number.format(data.rate.valor)}%` : unavailable, data?.rate ? `${day(data.rate.fecha)} · tasa anual` : 'Sin fecha disponible', 'BCRA · ArgentinaDatos', 'https://argentinadatos.com/docs/operations/get-finanzas-tasas-depositos-30-dias')}
        </div>
        <div className="mu mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px]"><span>Los indicadores tienen distintas fechas de publicación. La tasa es una referencia, no una oferta de un banco.</span><PageLink page="inflation" className="underline underline-offset-4">Ver inflación en detalle</PageLink></div>
        {data && (!data.risk || !data.inflation || !data.rate || !data.merval) && <p role="status" className="mt-3 text-[11px] text-[var(--neg)]">Algunos indicadores no pudieron consultarse. Podés volver a intentar con el botón de actualizar.</p>}
    </section>;
}
