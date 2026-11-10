import type { Portfolio } from './portfolio';

export type Snapshot = { portfolio: Portfolio; version: number; mutationId: string | null };
export type Account = Snapshot & { user: { id: string; email: string } };
export type Mutation = { portfolio: Portfolio; version: number; mutationId: string };

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

// Web conserva el proxy del mismo origen; el bundle de escritorio usa el dominio de la app.
export const isTauriApp = typeof window !== 'undefined' && !!window.__TAURI__?.core;
const apiBase = isTauriApp && !import.meta.env.DEV ? 'https://activos-nu.vercel.app' : '';
export const apiUrl = (path: string) => /^https?:\/\//i.test(path) ? path : `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
        response = await fetch(apiUrl(`/api/${path}`), {
            method, credentials: 'include', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'X-Activos-Request': '1' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout((path === 'imports/extract' || (path === 'imports/resend' || path === 'imports/gmail/sync') && method === 'POST') ? 100_000 : 20_000),
        });
    } catch { throw new ApiError(0, 'No hay conexión. Tus cambios siguen abiertos; reintentá antes de salir.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data?.error || 'No se pudo completar la operación.');
    if (!data) throw new ApiError(503, 'El acceso a tu cuenta no está disponible.');
    return data as T;
}
