// Vaults de Morpho (https://api.morpho.org/graphql). El identificador de la inversión es `chainId~direccion` en minúsculas.
const URL = 'https://api.morpho.org/graphql';
export type MorphoVault = { id: string; name: string; symbol: string; asset: string; network: string; apy: number; tvl: number };

const ID = /^\d{1,9}~0x[0-9a-f]{40}$/;
export const isMorphoId = (id: string) => ID.test(id);
export const morphoKey = (chainId: number, address: string) => `${chainId}~${address.toLowerCase()}`;
const parse = (id: string) => { const [chain, address] = id.split('~'); return { chainId: Number(chain), address }; };

async function gql<T>(query: string, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try { response = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) }); }
    catch (error) { if (signal?.aborted) throw error; throw new Error('No se pudo conectar con Morpho. Revisá tu conexión y volvé a intentar.'); }
    if (!response.ok) throw new Error('Morpho no respondió. Volvé a intentar en un momento.');
    const body = await response.json().catch(() => null) as { data?: T; errors?: unknown[] } | null;
    if (!body?.data) throw new Error('Morpho devolvió una respuesta inválida.');
    return body.data;
}

let cache: { list: MorphoVault[]; expires: number } | undefined;
export async function listMorphoVaults(signal?: AbortSignal): Promise<MorphoVault[]> {
    if (cache && cache.expires > Date.now()) return cache.list;
    const data = await gql<{ vaults?: { items?: { address?: string; name?: string; symbol?: string; chain?: { id?: number; network?: string }; asset?: { symbol?: string }; state?: { sharePriceUsd?: number; netApy?: number; totalAssetsUsd?: number } }[] } }>(
        '{ vaults(first: 500, orderBy: TotalAssetsUsd, orderDirection: Desc, where: { listed: true, totalAssetsUsd_gte: 100000 }) { items { address name symbol chain { id network } asset { symbol } state { sharePriceUsd netApy totalAssetsUsd } } } }', signal);
    const items = data.vaults?.items;
    if (!Array.isArray(items)) throw new Error('Morpho no devolvió un listado válido.');
    const list = items.flatMap(v => {
        const address = v.address ?? '', chainId = Number(v.chain?.id);
        if (!/^0x[0-9a-fA-F]{40}$/.test(address) || !Number.isInteger(chainId) || !(Number(v.state?.sharePriceUsd) > 0)) return [];
        return [{ id: morphoKey(chainId, address), name: v.name || v.symbol || address, symbol: v.symbol ?? '', asset: v.asset?.symbol ?? '', network: v.chain?.network ?? `Chain ${chainId}`, apy: Number(v.state?.netApy) || 0, tvl: Number(v.state?.totalAssetsUsd) || 0 }];
    });
    if (!list.length) throw new Error('Morpho devolvió un listado vacío.');
    cache = { list, expires: Date.now() + 10 * 60_000 };
    return list;
}

// Precio de la participación (share) del vault en USD, indexado como `morpho:<id>`.
export async function morphoQuotes(ids: string[], signal?: AbortSignal): Promise<Record<string, number>> {
    const valid = [...new Set(ids.filter(isMorphoId))];
    if (!valid.length) return {};
    const parsed = valid.map(parse);
    const data = await gql<{ vaults?: { items?: { address?: string; chain?: { id?: number }; state?: { sharePriceUsd?: number } }[] } }>(
        `{ vaults(first: 1000, where: { address_in: ${JSON.stringify(parsed.map(p => p.address))}, chainId_in: ${JSON.stringify([...new Set(parsed.map(p => p.chainId))])} }) { items { address chain { id } state { sharePriceUsd } } } }`, signal);
    const result: Record<string, number> = {};
    for (const v of data.vaults?.items ?? []) {
        const price = Number(v.state?.sharePriceUsd), id = morphoKey(Number(v.chain?.id), v.address ?? '');
        if (valid.includes(id) && Number.isFinite(price) && price > 0) result[`morpho:${id}`] = price;
    }
    return result;
}

export async function morphoPriceNow(id: string, signal?: AbortSignal): Promise<number> {
    const price = (await morphoQuotes([id], signal))[`morpho:${id}`];
    if (!price) throw new Error('Morpho no tiene precio para este vault.');
    return price;
}

export async function morphoHistory(id: string, signal?: AbortSignal): Promise<{ time: number; price: number }[]> {
    if (!isMorphoId(id)) throw new Error('Vault de Morpho inválido.');
    const { chainId, address } = parse(id);
    const end = Math.floor(Date.now() / 1000), start = end - 365 * 86400;
    const data = await gql<{ vaultByAddress?: { historicalState?: { sharePriceUsd?: { x?: number; y?: number }[] } } }>(
        `{ vaultByAddress(address: "${address}", chainId: ${chainId}) { historicalState { sharePriceUsd(options: { startTimestamp: ${start}, endTimestamp: ${end}, interval: DAY }) { x y } } } }`, signal);
    const rows = data.vaultByAddress?.historicalState?.sharePriceUsd;
    if (!Array.isArray(rows)) throw new Error('Respuesta histórica inválida.');
    return rows.flatMap(row => { const time = Number(row?.x) * 1000, price = Number(row?.y); return Number.isFinite(time) && Number.isFinite(price) && price > 0 && time <= Date.now() ? [{ time, price }] : []; }).sort((a, b) => a.time - b.time);
}
