const API_URL = 'https://api.coingecko.com/api/v3';

function validPrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
    const timeout = AbortSignal.timeout(15_000);
    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
    } catch (error) {
        if (signal?.aborted) throw error;
        if (timeout.aborted) throw new Error('CoinGecko tardó demasiado en responder. Volvé a intentar.');
        throw new Error('No se pudo conectar con CoinGecko. Revisá tu conexión y volvé a intentar.');
    }
    if (response.status === 429) throw new Error('CoinGecko alcanzó el límite de consultas. Esperá un minuto y volvé a intentar.');
    if (response.status === 404) throw new Error('No se encontró ese ID en CoinGecko. Usá un ID como bitcoin o ethereum.');
    let data;
    try {
        data = await response.json();
    } catch {
        if (signal?.aborted) throw signal.reason;
        throw new Error('CoinGecko no devolvió una respuesta válida. Volvé a intentar.');
    }
    if (!response.ok) {
        if (data?.error?.status?.error_code === 10012 || data?.status?.error_code === 10012) {
            throw new Error('CoinGecko limita el historial gratuito a los últimos 365 días. Elegí una fecha más reciente.');
        }
        if (response.status === 401 || response.status === 403) throw new Error('CoinGecko no autorizó esta consulta. Probá más tarde o con otra fecha.');
        throw new Error('No se pudo consultar CoinGecko. Probá de nuevo más tarde.');
    }
    if (data == null || typeof data !== 'object') throw new Error('CoinGecko no devolvió una respuesta válida. Volvé a intentar.');
    return data as T;
}

export async function coinPricesNow(ids: string[], signal?: AbortSignal): Promise<Record<string, number>> {
    if (!ids.length) return {};
    const query = new URLSearchParams({ ids: ids.join(','), vs_currencies: 'usd', precision: 'full' });
    const data = await request<Record<string, { usd?: unknown }>>(`/simple/price?${query}`, signal);
    return Object.fromEntries(ids.flatMap(id => validPrice(data[id]?.usd) ? [[`crypto:${id}`, data[id].usd]] : []));
}

export async function coinPriceOn(id: string, iso: string, today: string, signal?: AbortSignal): Promise<number> {
    if (/[\s,]/.test(id)) throw new Error('Ingresá un solo ID de CoinGecko, como bitcoin o ethereum.');
    if (iso === today) {
        const prices = await coinPricesNow([id], signal);
        const price = prices[`crypto:${id}`];
        if (!validPrice(price)) throw new Error('No se encontró una cotización para ese ID. Usá el ID de CoinGecko, por ejemplo bitcoin en lugar de BTC.');
        return price;
    }
    const [year, month, day] = iso.split('-');
    const query = new URLSearchParams({ date: `${day}-${month}-${year}`, localization: 'false' });
    const data = await request<{ market_data?: { current_price?: { usd?: unknown } } }>(`/coins/${encodeURIComponent(id)}/history?${query}`, signal);
    const price = data.market_data?.current_price?.usd;
    if (!validPrice(price)) throw new Error('CoinGecko no tiene un precio para ese activo en la fecha elegida. Probá con otra fecha.');
    return price;
}

export type CryptoAsset = { id: string; name: string; symbol: string };
let coinCatalog: { coins: CryptoAsset[]; expires: number } | undefined;

export async function listCryptoAssets(signal?: AbortSignal): Promise<CryptoAsset[]> {
    if (coinCatalog && coinCatalog.expires > Date.now()) return coinCatalog.coins;
    const data = await request<CryptoAsset[]>('/coins/list?include_platform=false', signal);
    if (!Array.isArray(data)) throw new Error('No se pudo obtener el listado de criptomonedas. Volvé a intentar.');
    const coins = data.filter(coin => coin && typeof coin.id === 'string' && typeof coin.name === 'string' && typeof coin.symbol === 'string');
    if (!coins.length) throw new Error('CoinGecko devolvió un listado vacío. Volvé a intentar.');
    coinCatalog = { coins, expires: Date.now() + 10 * 60_000 };
    return coins;
}
