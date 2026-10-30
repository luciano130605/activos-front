type LivePrice = { symbol: string; c: number };
type HistoricalPrice = { date: string; c: number };
export type CedearQuote = { price: number; sourceDate?: string };

async function request<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const timeout = AbortSignal.timeout(15_000);
    try {
        const response = await fetch(`https://data912.com${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
        if (response.status === 404) throw new Error('No se encontró ese CEDEAR. Revisá el ticker, por ejemplo AAPL o SPY.');
        if (response.status === 429) throw new Error('El proveedor de CEDEARs alcanzó el límite de consultas. Esperá un minuto y volvé a intentar.');
        if (!response.ok) throw new Error('No se pudo consultar el precio del CEDEAR. Volvé a intentar.');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('El proveedor no devolvió cotizaciones válidas. Volvé a intentar.');
        return data;
    } catch (error) {
        if (signal?.aborted) throw error;
        if (timeout.aborted) throw new Error('La consulta del CEDEAR tardó demasiado. Volvé a intentar.');
        if (error instanceof TypeError) throw new Error('No se pudo conectar con el proveedor de CEDEARs. Revisá tu conexión.');
        throw error;
    }
}

export async function cedearPricesNow(ids: string[], signal?: AbortSignal): Promise<Record<string, number>> {
    if (!ids.length) return {};
    const rows = await request<LivePrice>('/live/arg_cedears', signal);
    return Object.fromEntries(rows.filter(row => ids.includes(row.symbol) && Number.isFinite(row.c) && row.c > 0).map(row => [`cedear:${row.symbol}`, row.c]));
}

export async function cedearPriceOn(ticker: string, iso: string, today: string, signal?: AbortSignal): Promise<CedearQuote> {
    if (!/^[A-Z0-9]+$/.test(ticker)) throw new Error('Ingresá un ticker válido, por ejemplo AAPL, SPY o MELI.');
    if (iso === today) {
        const prices = await cedearPricesNow([ticker], signal);
        const price = prices[`cedear:${ticker}`];
        if (price == null) throw new Error('No se encontró una cotización para ese CEDEAR. Revisá el ticker.');
        return { price };
    }
    const rows = await request<HistoricalPrice>(`/historical/cedears/${encodeURIComponent(ticker)}`, signal);
    const row = rows.filter(row => typeof row.date === 'string' && row.date.slice(0, 10) <= iso && Number.isFinite(row.c) && row.c > 0).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!row) throw new Error('No hay cotización de ese CEDEAR para la fecha elegida ni para días anteriores. Probá otra fecha.');
    return { price: row.c, sourceDate: row.date.slice(0, 10) };
}
