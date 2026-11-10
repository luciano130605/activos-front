import { useSyncExternalStore } from 'react';

export const pages = {
    summary: { path: '/', label: 'Resumen', title: 'Mi cartera', description: 'El estado de tus inversiones, en un solo lugar.' },
    evolution: { path: '/evolucion', label: 'Evolución', title: 'Evolución', description: 'Seguí el valor de tu cartera y compará el rendimiento de tus activos.' },
    inflation: { path: '/inflacion', label: 'Inflación', title: 'Inflación', description: 'Consultá la inflación de Argentina y Estados Unidos de los últimos meses y años.' },
    investments: { path: '/mis-inversiones', label: 'Mis inversiones', title: 'Mis inversiones', description: 'Administrá tus activos y las posiciones de tu cartera.' },
    goals: { path: '/objetivos', label: 'Objetivos', title: 'Objetivos y rebalanceo', description: 'Definí cómo querés distribuir tu cartera y seguí tu progreso.' },
    prices: { path: '/precios', label: 'Precios y alertas', title: 'Precios y alertas', description: 'Explorá precios históricos y seguí tus activos.' },
    imports: { path: '/importaciones', label: 'Importar', title: 'Importar operaciones', description: 'Subí comprobantes y revisá cada operación antes de incorporarla.' },
    marketCalendar: { path: '/calendario-mercado', label: 'Calendario de mercado', title: 'Calendario de mercado', description: 'Feriados bursátiles, balances y eventos de deuda argentina.' },
    dividends: { path: '/dividendos', label: 'Dividendos', title: 'Dividendos', description: 'Próximos pagos anunciados para tus inversiones.' },
} as const;

export type PageId = keyof typeof pages;

export function isAppPath(path: string): boolean {
    const normalized = path.replace(/\/+$/, '') || '/';
    return normalized === '/espacio' || Object.values(pages).some(page => page.path === normalized);
}

function currentPage(): PageId {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return (Object.keys(pages) as PageId[]).find(id => pages[id].path === path) ?? 'summary';
}

function subscribe(listener: () => void) {
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
}

export function usePage() {
    return useSyncExternalStore(subscribe, currentPage, () => 'summary' as const);
}
