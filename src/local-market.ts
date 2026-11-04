import type { Investment } from './portfolio';
export type LocalKind = 'arg-stock' | 'bond' | 'fund';
type LocalItem = Investment & { kind: LocalKind; coin: string };
export function isLocal(item: Investment): item is LocalItem { return (item.kind === 'arg-stock' || item.kind === 'bond' || item.kind === 'fund') && !!item.coin; }
export async function localQuotes(items: { kind: LocalKind; coin: string }[], signal?: AbortSignal): Promise<Record<string, number>> {
    if (!items.length) return {};
    const groups = [...new Set(items.map(i => i.kind))];
    const results = await Promise.allSettled(groups.map(async kind => {
        const url = kind === 'fund' ? 'https://api.argentinadatos.com/v1/finanzas/fci/fondos' : `https://data912.com/live/${kind === 'bond' ? 'arg_bonds' : 'arg_stocks'}`;
        const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('No se pudieron consultar las cotizaciones locales.');
        const body = await response.json(); const rows = kind === 'fund' ? body?.fondos : body;
        if (!Array.isArray(rows)) throw new Error('Respuesta inválida del proveedor.');
        return Object.fromEntries(items.filter(i => i.kind === kind).flatMap(item => {
            if (kind === 'fund') {
                const [, fundId, classId] = item.coin.split('~');
                const row = rows.find(r => String(r?.fondoId) === fundId && String(r?.claseId) === classId);
                const price = Number(row?.rendimientos?.valorCuotaparte);
                return Number.isFinite(price) && price > 0 ? [[`fund:${item.coin}`, price]] : [];
            }
            const row = rows.find(r => String(r?.symbol ?? '').toUpperCase() === item.coin.toUpperCase());
            const price = Number(row?.c);
            return Number.isFinite(price) && price > 0 ? [[`${kind}:${item.coin}`, kind === 'bond' ? price / 100 : price]] : [];
        }));
    }));
    if (results.every(result => result.status === 'rejected')) throw new Error('No se pudieron consultar las cotizaciones locales.');
    return Object.assign({}, ...results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []));
}
