export type SplitPoint = { time: number; price: number };

// El split 10:1 fue efectivo el 4 de agosto; Data912 registra el salto el 3.
const YPFD_SPLIT = Date.parse('2026-08-04T00:00:00Z');
const DAY = 86400000;

export function adjustLocalSplits(id: string, points: SplitPoint[]): SplitPoint[] {
    if (id.toUpperCase() !== 'YPFD') return points;
    // Buscamos el salto cercano a la fecha oficial: distintos proveedores pueden
    // registrar el primer precio ajustado en ruedas o fechas diferentes.
    const boundary = points.findIndex((point, i) => {
        if (i === 0 || Math.abs(point.time - YPFD_SPLIT) > 7 * DAY) return false;
        const before = points[i - 1];
        const ratio = before.price / point.price;
        return point.time - before.time <= 7 * DAY && ratio >= 5 && ratio <= 20;
    });
    if (boundary <= 0) return points;
    return points.map((point, i) => i < boundary ? { ...point, price: point.price / 10 } : point);
}
