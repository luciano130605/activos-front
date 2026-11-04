import type { AllocationCategory, AllocationTargets } from './portfolio';
export const allocationKeys: AllocationCategory[] = ['rate', 'cedear', 'index', 'stock', 'crypto', 'arg-stock', 'bond', 'fund'];
export function calculateAllocation(values: Record<AllocationCategory, number>, targets: AllocationTargets) {
    values = Object.assign({ 'arg-stock': 0, bond: 0, fund: 0 }, values);
    targets = Object.assign({ 'arg-stock': 0, bond: 0, fund: 0 }, targets);
    const total = allocationKeys.reduce((sum, key) => sum + values[key], 0);
    if (!Number.isFinite(total) || total < 0 || allocationKeys.some(key => !Number.isFinite(values[key]) || values[key] < 0 || !Number.isFinite(targets[key]) || targets[key] < 0 || targets[key] > 100) || Math.abs(allocationKeys.reduce((sum, key) => sum + targets[key], 0) - 100) > 0.000001) return null;
    const blocked = allocationKeys.filter(key => targets[key] === 0 && values[key] > 0);
    const finalTotal = blocked.length ? null : Math.max(total, ...allocationKeys.filter(key => targets[key] > 0).map(key => values[key] / (targets[key] / 100)));
    const contributions = finalTotal === null ? null : Object.fromEntries(allocationKeys.map(key => [key, Math.max(0, finalTotal * targets[key] / 100 - values[key])])) as Record<AllocationCategory, number>;
    return { total, blocked, contributions, totalContribution: contributions ? allocationKeys.reduce((sum, key) => sum + contributions[key], 0) : null };
}
