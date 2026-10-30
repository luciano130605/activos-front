import type { Portfolio } from './portfolio.ts';
import type { Mutation, Snapshot } from './account.ts';

type View = { portfolio: Portfolio; dirty: boolean; status: 'saved' | 'pending' | 'saving' | 'error' | 'conflict' | 'expired'; error: string };
type Send = (mutation: Mutation) => Promise<{ version: number; mutationId: string }>;
const equal = (a: Portfolio, b: Portfolio) => JSON.stringify(a) === JSON.stringify(b);

export class PortfolioSync {
    private saved: Portfolio;
    private version: number;
    private pending: Mutation | null = null;
    private running: Promise<boolean> | null = null;
    private send: Send;
    private listeners = new Set<() => void>();
    private view: View;

    constructor(initial: Snapshot, send: Send) {
        this.saved = initial.portfolio;
        this.version = initial.version;
        this.send = send;
        this.view = { portfolio: initial.portfolio, dirty: false, status: 'saved', error: '' };
    }

    getSnapshot = () => this.view;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private publish(patch: Partial<View>) {
        this.view = { ...this.view, ...patch };
        this.listeners.forEach(listener => listener());
    }

    update = (change: (current: Portfolio) => Portfolio) => {
        const portfolio = change(this.view.portfolio);
        const dirty = this.pending !== null || !equal(portfolio, this.saved);
        this.publish({ portfolio, dirty, status: ['conflict', 'expired'].includes(this.view.status) ? this.view.status : dirty ? 'pending' : 'saved' });
    };

    flush = (): Promise<boolean> => {
        if (this.running) return this.running;
        this.running = this.write().finally(() => { this.running = null; });
        return this.running;
    };

    private async write(): Promise<boolean> {
        while (this.pending || !equal(this.view.portfolio, this.saved)) {
            this.pending ??= { portfolio: this.view.portfolio, version: this.version, mutationId: crypto.randomUUID() };
            this.publish({ status: 'saving', error: '' });
            try {
                const result = await this.send(this.pending);
                if (result.version !== this.pending.version + 1 || result.mutationId !== this.pending.mutationId) throw new Error('La confirmación de guardado no es válida. Reintentá.');
                this.saved = this.pending.portfolio;
                this.version = result.version;
                this.pending = null;
            } catch (error) {
                const status = (error as { status?: number })?.status;
                this.publish({ dirty: true, status: status === 409 ? 'conflict' : status === 401 ? 'expired' : 'error', error: error instanceof Error ? error.message : 'No se pudieron guardar los cambios.' });
                return false;
            }
        }
        this.publish({ dirty: false, status: 'saved', error: '' });
        return true;
    }

    reset = (snapshot: Snapshot) => {
        if (this.running) throw new Error('Esperá a que termine el guardado.');
        this.pending = null;
        this.version = snapshot.version;
        this.saved = snapshot.portfolio;
        this.publish({ portfolio: snapshot.portfolio, dirty: false, status: 'saved', error: '' });
    };
}
