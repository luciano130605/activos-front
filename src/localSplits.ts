export type SplitPoint = { time: number; price: number };

// YPF: split 10:1 efectivo el 4 de agosto de 2026 en BYMA.
const YPFD_SPLIT = Date.parse('2026-08-04T00:00:00Z');
const DAY = 86400000;

export function adjustLocalSplits(id: string, points: SplitPoint[]): SplitPoint[] {
    if (id.toUpperCase() !== 'YPFD') return points;
    const firstAfter = points.findIndex(point => point.time >= YPFD_SPLIT);
    if (firstAfter <= 0) return points;
    const before = points[firstAfter - 1];
    const after = points[firstAfter];
    // Solo corregir cuando hay observaciones cercanas al evento y el salto
    // indica que el proveedor todavía entrega precios sin ajustar.
    const ratio = before.price / after.price;
    if (YPFD_SPLIT - before.time > 7 * DAY || after.time - YPFD_SPLIT > 7 * DAY || ratio < 5 || ratio > 20) return points;
    return points.map(point => point.time < YPFD_SPLIT ? { ...point, price: point.price / 10 } : point);
}
