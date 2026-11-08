// CatÃ¡logo de activos que se pueden buscar: Ã­ndices (ETFs con CEDEAR) y CEDEARs (Data912).
export type SearchAsset = { symbol: string; name: string };

export const INDEXES: SearchAsset[] = [
    { symbol: 'SPY', name: 'S&P 500' },
    { symbol: 'QQQ', name: 'Nasdaq 100' },
    { symbol: 'DIA', name: 'Dow Jones' },
    { symbol: 'IWM', name: 'Russell 2000' },
    { symbol: 'EEM', name: 'Mercados emergentes' },
    { symbol: 'EWZ', name: 'Brasil' },
    { symbol: 'XLE', name: 'Sector energÃ­a' },
    { symbol: 'XLF', name: 'Sector financiero' },
    { symbol: 'XLK', name: 'Sector tecnologÃ­a' },
    { symbol: 'XLV', name: 'Sector salud' },
    { symbol: 'ARKK', name: 'ARK Innovation' },
    { symbol: 'VEA', name: 'Mercados desarrollados ex EE.UU.' },
];
const indexSymbols = new Set(INDEXES.map(i => i.symbol));
export const isIndexTicker = (ticker?: string) => indexSymbols.has((ticker ?? '').toUpperCase());
export const indexName = (ticker: string) => INDEXES.find(i => i.symbol === ticker)?.name ?? ticker;

// Nombres de los CEDEARs mÃ¡s buscados; el resto se muestra solo con el ticker.
const names: Record<string, string> = {
    AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet (Google)', AMZN: 'Amazon', META: 'Meta Platforms', TSLA: 'Tesla', NVDA: 'NVIDIA',
    MELI: 'MercadoLibre', KO: 'Coca-Cola', PEP: 'PepsiCo', DIS: 'Disney', NFLX: 'Netflix', AMD: 'AMD', INTC: 'Intel', ORCL: 'Oracle',
    JPM: 'JPMorgan', BAC: 'Bank of America', V: 'Visa', MA: 'Mastercard', PYPL: 'PayPal', WMT: 'Walmart', XOM: 'Exxon Mobil', CVX: 'Chevron',
    PFE: 'Pfizer', JNJ: 'Johnson & Johnson', MCD: 'McDonaldâ€™s', NKE: 'Nike', BABA: 'Alibaba', VIST: 'Vista Energy', YPF: 'YPF', GGAL: 'Grupo Galicia',
    BMA: 'Banco Macro', PAM: 'Pampa EnergÃ­a', TEO: 'Telecom Argentina', VALE: 'Vale', PBR: 'Petrobras', BRKB: 'Berkshire Hathaway', COST: 'Costco',
    AVGO: 'Broadcom', CRM: 'Salesforce', ADBE: 'Adobe', UBER: 'Uber', SHOP: 'Shopify', SPOT: 'Spotify', COIN: 'Coinbase', MSTR: 'MicroStrategy',
    TSM: 'TSMC', ASML: 'ASML', SAP: 'SAP', GOLD: 'Barrick Gold', NEM: 'Newmont', IBIT: 'iShares Bitcoin Trust', BA: 'Boeing', T: 'AT&T', VZ: 'Verizon',
};
export const cedearName = (ticker: string) => names[ticker] ?? '';

let cache: { list: SearchAsset[]; expires: number } | undefined;
export async function listCedears(signal?: AbortSignal): Promise<SearchAsset[]> {
    if (cache && cache.expires > Date.now()) return cache.list;
    let response: Response;
    try { response = await fetch('https://data912.com/live/arg_cedears', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }); }
    catch (error) { if (signal?.aborted) throw error; throw new Error('No se pudo conectar con Data912. RevisÃ¡ tu conexiÃ³n y volvÃ© a intentar.'); }
    if (!response.ok) throw new Error('Data912 no respondiÃ³. VolvÃ© a intentar en un momento.');
    const rows: unknown = await response.json().catch(() => null);
    if (!Array.isArray(rows)) throw new Error('Data912 no devolviÃ³ un listado vÃ¡lido.');
    const seen = new Set<string>();
    const list = rows.flatMap((row: { symbol?: unknown; c?: unknown }) => {
        const symbol = typeof row?.symbol === 'string' ? row.symbol.toUpperCase() : '';
        if (!/^[A-Z0-9]+$/.test(symbol) || seen.has(symbol) || isIndexTicker(symbol) || !(Number(row.c) > 0)) return [];
        seen.add(symbol);
        return [{ symbol, name: names[symbol] ?? '' }];
    }).sort((a, b) => Number(!!b.name) - Number(!!a.name) || a.symbol.localeCompare(b.symbol));
    if (!list.length) throw new Error('Data912 devolviÃ³ un listado vacÃ­o.');
    cache = { list, expires: Date.now() + 10 * 60_000 };
    return list;
}

const US_EXTRAS: SearchAsset[] = [{ symbol: 'YPF', name: 'YPF (ADR · NYSE)' }];
export async function listUsStocks(signal?: AbortSignal): Promise<SearchAsset[]> {
    const response = await fetch('https://data912.com/live/usa_stocks', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('No se pudo cargar el listado de acciones estadounidenses.');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('El listado de acciones no es vÃ¡lido.');
    const seen = new Set<string>();
    const list = rows.flatMap((row: { symbol?: unknown; c?: unknown }) => {
        const symbol = typeof row?.symbol === 'string' ? row.symbol.toUpperCase() : '';
        if (!/^[A-Z0-9]+$/.test(symbol) || seen.has(symbol) || !(Number(row.c) > 0)) return [];
        seen.add(symbol);
        return [{ symbol, name: cedearName(symbol) }];
    });
    // ADRs que Data912 no lista pero Yahoo Finance sí cotiza en USD.
    for (const extra of US_EXTRAS) if (!seen.has(extra.symbol)) list.push(extra);
    return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
