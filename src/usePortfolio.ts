import { useEffect, useState, useSyncExternalStore, type SetStateAction } from 'react';
import { request, type Snapshot } from './account';
import { PortfolioSync } from './portfolio-sync';
import type { Investment, Preferences } from './portfolio';

export function usePortfolio(initial: Snapshot) {
    const [sync] = useState(() => new PortfolioSync(initial, mutation => request('portfolio', 'PUT', mutation)));
    const view = useSyncExternalStore(sync.subscribe, sync.getSnapshot);
    useEffect(() => {
        if (!view.dirty || view.status === 'conflict' || view.status === 'expired' || view.status === 'error') return;
        const timeout = window.setTimeout(() => { void sync.flush(); }, 450);
        return () => window.clearTimeout(timeout);
    }, [sync, view.portfolio, view.dirty, view.status]);
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (sync.getSnapshot().dirty) { event.preventDefault(); event.returnValue = ''; }
        };
        const reconnect = () => {
            if (!['conflict', 'expired'].includes(sync.getSnapshot().status)) void sync.flush();
        };
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('online', reconnect);
        return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('online', reconnect); };
    }, [sync]);
    function preference<K extends keyof Preferences>(key: K): [Preferences[K], (next: SetStateAction<Preferences[K]>) => void] {
        return [view.portfolio.preferences[key], next => sync.update(current => ({
            ...current, preferences: { ...current.preferences, [key]: typeof next === 'function' ? next(current.preferences[key]) : next },
        }))];
    }
    const setItems = (next: SetStateAction<Investment[]>) => sync.update(current => ({
        ...current, investments: typeof next === 'function' ? next(current.investments) : next,
    }));
    return { sync, view, preference, items: view.portfolio.investments, setItems };
}
