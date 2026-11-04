import { allocationKeys } from './allocation.ts';
import type { AllocationTargets } from './portfolio';

export function parseAllocationResponse(text: string): { message: string; allocation: AllocationTargets | null } {
    const parsed: unknown = JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
    if (!parsed || typeof parsed !== 'object') throw new Error('La respuesta de la IA no tiene un formato válido.');
    const { message, allocation } = parsed as { message?: unknown; allocation?: unknown };
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new Error('La respuesta de la IA no tiene un mensaje válido.');
    if (allocation === null) return { message, allocation: null };
    if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) throw new Error('La propuesta de la IA está incompleta. Volvé a intentar.');
    const values = allocation as Record<string, unknown>;
    if (Object.keys(values).length !== allocationKeys.length || !allocationKeys.every(key => typeof values[key] === 'number' && Number.isFinite(values[key]) && (values[key] as number) >= 0 && (values[key] as number) <= 100) || Math.abs(allocationKeys.reduce((sum, key) => sum + (values[key] as number), 0) - 100) > 0.000001) throw new Error('La propuesta de la IA debe incluir todas las categorías y sumar 100 %. Volvé a intentar.');
    return { message, allocation: Object.fromEntries(allocationKeys.map(key => [key, values[key]])) as AllocationTargets };
}

