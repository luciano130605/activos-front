import { useSyncExternalStore } from 'react';

export const pages = {
    summary: { path: '/', label: 'Resumen', title: 'Mi cartera', description: 'El estado de tus inversiones, en un solo lugar.' },
    evolution: { path: '/evolucion', label: 'Evolución', title: 'Evolución', description: 'Seguí el valor de tu cartera y compará el rendimiento de tus activos.' },
    simulation: { path: '/simulacion', label: 'Simulación', title: 'Simulación', description: 'Explorá cómo puede crecer tu capital con distintos plazos, tasas y aportes.' },
    investments: { path: '/mis-inversiones', label: 'Mis inversiones', title: 'Mis inversiones', description: 'Administrá tus activos y las posiciones de tu cartera.' },
} as const;

export type PageId = keyof typeof pages;

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

