export type DividendAlertEvent = { payDate: string; eligible: boolean; estimated?: boolean };
export function dividendAlertStatus(events: DividendAlertEvent[], threshold: number, now = Date.now()) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const upcoming = events.filter(event => /^\d{4}-\d{2}-\d{2}$/.test(event.payDate) && Date.parse(`${event.payDate}T00:00:00Z`) >= todayMs).sort((a, b) => a.payDate.localeCompare(b.payDate));
    const event = upcoming.find(item => item.eligible);
    if (!event) {
        if (upcoming.length) {
            const date = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${upcoming[0].payDate}T12:00:00Z`));
            return { state: 'waiting' as const, message: `${upcoming[0].estimated ? 'Pago estimado' : 'Pago anunciado'}: ${date} · La posición no tiene derecho a cobrarlo.` };
        }
        return { state: 'waiting' as const, message: 'No hay pagos futuros disponibles para este activo.' };
    }
    const days = Math.round((Date.parse(`${event.payDate}T00:00:00Z`) - todayMs) / 86_400_000);
    const date = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${event.payDate}T12:00:00Z`));
    const label = event.estimated ? 'Pago estimado' : 'Pago anunciado';
    const when = threshold === 0 ? 'el día del pago' : threshold === 1 ? '1 día antes' : `${threshold.toLocaleString('es-AR')} días antes`;
    return { state: days <= threshold ? 'triggered' as const : 'waiting' as const, message: `${label}: ${date}${days > threshold ? ` · Aviso ${when}` : ''}` };
}


type DividendResult = { configured: boolean; items: { ticker: string; kind: string; status: string; events?: DividendAlertEvent[] }[] };
export function portfolioDividendAlertStatus(result: DividendResult | null, alert: { assetId: string; assetKind: string; threshold: number }, failed = false, now = Date.now()) {
    if (failed) return { state: 'unavailable' as const, message: 'No se pudieron consultar los dividendos. Reintentá más tarde.' };
    if (!result) return { state: 'unavailable' as const, message: 'Consultando dividendos…' };
    if (!result.configured) return { state: 'unavailable' as const, message: 'Falta configurar el proveedor de dividendos en el servidor.' };
    const matching = result.items.filter(item => item.ticker.toUpperCase() === alert.assetId.toUpperCase() && item.kind === alert.assetKind);
    if (!matching.length) return { state: 'unavailable' as const, message: 'No hay una posición con unidades registradas para este activo. Revisá tu cartera y su sincronización.' };
    if (matching.some(item => item.status === 'missing_ratio')) return { state: 'unavailable' as const, message: 'No se pudo obtener el ratio del CEDEAR para calcular los dividendos.' };
    if (matching.some(item => item.status !== 'ok')) return { state: 'unavailable' as const, message: 'El proveedor de dividendos no respondió para este activo. Reintentá más tarde.' };
    return dividendAlertStatus(matching.flatMap(item => item.events ?? []), alert.threshold, now);
}
