import { useEffect, useState } from 'react';
import { coinPricesNow } from './coingecko';
import { cedearPricesNow, stockPricesNow } from './cedears';
import { history, adjustPossibleRatios, type HistoryPoint } from './AssetPerformance';
import { request } from './account';
import { localQuotes, type LocalKind } from './local-market';
import type { PriceAlert } from './portfolio';

const DAY = 86_400_000;
type DividendResult = { configured: boolean; items: { ticker: string; kind: string; status: string; events?: { payDate: string; estimated?: boolean }[] }[] };
export type AlertStatus = { state: 'triggered' | 'waiting' | 'unavailable'; message: string };
export function usePriceAlerts(alerts: PriceAlert[], values: { kind: string; id: string; value: number }[]) {
    const [quotes, setQuotes] = useState<Record<string, number>>({});
    const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>({});
    const [dividends, setDividends] = useState<DividendResult | null>(null);
    const [tick, setTick] = useState(0);
    const signature = JSON.stringify(alerts);
    useEffect(() => { if (!alerts.length) return; const timer = window.setInterval(() => setTick(value => value + 1), 5 * 60_000); return () => window.clearInterval(timer); }, [alerts.length]);
    useEffect(() => {
        const configs = JSON.parse(signature) as PriceAlert[];
        const controller = new AbortController();
        if (!configs.length) { setQuotes({}); setHistories({}); setDividends(null); return () => controller.abort(); }
        const relevant = configs.filter(a => a.kind === 'price' || a.kind === 'variation');
        const ids = (kind: PriceAlert['assetKind']) => [...new Set(relevant.filter(a => a.assetKind === kind).map(a => a.assetId))];
        setQuotes({}); setHistories({}); setDividends(null);
        const local = (['arg-stock', 'bond', 'fund'] as LocalKind[]).flatMap(kind => ids(kind).map(coin => ({ kind, coin })));
        void Promise.allSettled([cedearPricesNow(ids('cedear'), controller.signal), stockPricesNow(ids('stock'), controller.signal), coinPricesNow(ids('crypto'), controller.signal), localQuotes(local, controller.signal)]).then(results => { if (!controller.signal.aborted) setQuotes(Object.assign({}, ...results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))); });
        const varying = [...new Map(configs.filter(a => a.kind === 'variation').map(a => [`${a.assetKind}:${a.assetId}`, a])).entries()];
        void Promise.all(varying.map(async ([key, alert]) => { try { return [key, await history(alert.assetKind, alert.assetId, controller.signal)] as const; } catch { return [key, []] as const; } })).then(rows => { if (!controller.signal.aborted) setHistories(Object.fromEntries(rows)); });
        if (configs.some(a => a.kind === 'dividend')) void request<DividendResult>('dividends').then(data => { if (!controller.signal.aborted) setDividends(data); }).catch(() => {});
        return () => controller.abort();
    }, [signature, tick]);
    const statuses: Record<string, AlertStatus> = {};
    const now = Date.now();
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const total = values.reduce((sum, item) => sum + item.value, 0);
    for (const alert of alerts) {
        const key = `${alert.assetKind}:${alert.assetId}`;
        let status: AlertStatus = { state: 'unavailable', message: 'Datos no disponibles' };
        if (alert.kind === 'price') {
            const price = quotes[key];
            if (price > 0) { const matched = alert.direction === 'above' ? price >= alert.threshold : price <= alert.threshold; status = { state: matched ? 'triggered' : 'waiting', message: `Precio: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: ['cedear', 'arg-stock', 'bond', 'fund'].includes(alert.assetKind) ? 'ARS' : 'USD', maximumFractionDigits: 4 }).format(price)}` }; }
        } else if (alert.kind === 'variation') {
            const raw = histories[key];
            const points = raw && alert.assetKind === 'cedear' ? adjustPossibleRatios(raw).points : raw;
            const last = points?.at(-1), price = quotes[key];
            const previous = points?.filter(point => point.time <= now - DAY).at(-1);
            if (last && previous && price && now - last.time <= 7 * DAY && now - previous.time <= 4 * DAY) { const change = (price / previous.price - 1) * 100; const matched = alert.direction === 'above' ? change >= alert.threshold : change <= -alert.threshold; status = { state: matched ? 'triggered' : 'waiting', message: `Variación aproximada en 24 h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%` }; }
        } else if (alert.kind === 'concentration') {
            const matching = values.filter(value => value.kind === alert.assetKind && value.id === alert.assetId);
            if (matching.length && Number.isFinite(total) && total > 0) { const share = matching.reduce((sum, value) => sum + value.value, 0) / total * 100; status = { state: share >= alert.threshold ? 'triggered' : 'waiting', message: `Participación actual: ${share.toFixed(1)}%` }; }
        } else if (alert.kind === 'maturity') {
            const days = Math.round((new Date(`${alert.date}T12:00:00`).getTime() - today.getTime()) / DAY);
            status = { state: days >= 0 && days <= alert.threshold ? 'triggered' : 'waiting', message: days < 0 ? 'Fecha de vencimiento pasada' : days === 0 ? 'Vence hoy' : `Vence en ${days} días` };
        } else if (dividends?.configured) {
            const matching = dividends.items.filter(item => item.ticker === alert.assetId && item.kind === alert.assetKind);
            if (matching.some(item => item.status === 'ok')) {
                const end = today.getTime() + alert.threshold * DAY;
                const event = matching.flatMap(item => item.events ?? []).filter(event => { const time = new Date(`${event.payDate}T12:00:00`).getTime(); return time >= today.getTime() && time <= end; }).sort((a, b) => a.payDate.localeCompare(b.payDate))[0];
                status = { state: event ? 'triggered' : 'waiting', message: event ? `${event.estimated ? 'Pago estimado' : 'Pago anunciado'}: ${event.payDate}` : 'Sin pagos próximos en el plazo elegido' };
            }
        }
        statuses[alert.id] = status;
    }
    return statuses;
}
