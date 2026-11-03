export type PricePoint = { date: string; value: number };

// Cambios cercanos a una relación entera pueden ser cambios de ratio del CEDEAR.
// Es una heurística: conserva los movimientos normales de cotización.
export function approximateSplitAdjustment(rows: PricePoint[]): { rows: PricePoint[]; dates: string[] } {
    const adjusted = rows.map(row => ({ ...row }));
    const dates: string[] = [];
    let factor = 1;
    for (let i = rows.length - 1; i >= 0; i--) {
        adjusted[i].value = rows[i].value * factor;
        if (i === 0 || Date.parse(rows[i].date) - Date.parse(rows[i - 1].date) > 7 * 86400000) continue;
        const ratio = rows[i - 1].value / rows[i].value;
        const integer = Math.round(ratio >= 1 ? ratio : 1 / ratio);
        if (integer >= 2 && integer <= 10 && Math.abs((ratio >= 1 ? ratio : 1 / ratio) / integer - 1) <= 0.02) {
            factor *= ratio >= 1 ? 1 / integer : integer;
            dates.push(rows[i].date);
        }
    }
    return { rows: adjusted, dates };
}
