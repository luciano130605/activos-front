import type { Portfolio } from './portfolio';

export type Snapshot = { portfolio: Portfolio; version: number; mutationId: string | null };
export type Account = Snapshot & { user: { id: string; email: string } };
export type Mutation = { portfolio: Portfolio; version: number; mutationId: string };

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

const apiBase = (import.meta.env.VITE_API_URL || 'activos-back-production.up.railway.app/').replace(/\/+$/, '');

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${apiBase}/api/${path}`, {
            method, credentials: 'include', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'X-Activos-Request': '1' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(20_000),
        });
    } catch { throw new ApiError(0, 'No hay conexión. Tus cambios siguen abiertos; reintentá antes de salir.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data?.error || 'No se pudo completar la operación.');
    if (!data) throw new ApiError(503, 'El acceso a tu cuenta no está disponible.');
    return data as T;
}
