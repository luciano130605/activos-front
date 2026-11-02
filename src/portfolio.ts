export type Kind = 'rate' | 'crypto' | 'cedear';
export type Period = 'year' | 'month';
export type Currency = 'USD' | 'ARS';
export type Investment = {
    id: string;
    name: string;
    amount: number;
    currency: Currency;
    date: string;
    kind: Kind;
    rate?: number;
    period?: Period;
    coin?: string;
    units?: number;
};

export type Sale = { id: string; name: string; date: string; fraction: number; proceeds: number; currency: Currency; cost: number; costCurrency: Currency };
export function cleanSale(raw: unknown): Sale | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id.trim() || s.id.length > 128 || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 70 || typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return null;
    const date = new Date(`${s.date}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== s.date) return null;
    if (typeof s.fraction !== 'number' || !Number.isFinite(s.fraction) || s.fraction <= 0 || s.fraction > 1 || typeof s.proceeds !== 'number' || !Number.isFinite(s.proceeds) || s.proceeds <= 0 || typeof s.cost !== 'number' || !Number.isFinite(s.cost) || s.cost <= 0) return null;
    if ((s.currency !== 'ARS' && s.currency !== 'USD') || (s.costCurrency !== 'ARS' && s.costCurrency !== 'USD')) return null;
    return { id: s.id, name: s.name, date: s.date, fraction: s.fraction, proceeds: s.proceeds, cost: s.cost, currency: s.currency, costCurrency: s.costCurrency };
}

export type Preferences = {
    theme: 'dark' | 'light';
    dollar: string;
    hidden: boolean;
    sidebarCollapsed: boolean;
    display: Currency;
    horizon: number;
    panels?: string[];
};

export type Portfolio = {
    investments: Investment[];
    sales?: Sale[];
    preferences: Preferences;
};

export const defaultPreferences: Preferences = {
    theme: 'dark', dollar: 'bolsa', hidden: false,
    sidebarCollapsed: false, display: 'USD', horizon: 12,
};

const dollars = ['bolsa', 'contadoconliqui', 'blue', 'oficial', 'mayorista', 'cripto', 'tarjeta'];

export function cleanPreferences(raw: unknown): Preferences {
    const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    return {
        theme: r.theme === 'light' ? 'light' : 'dark',
        dollar: typeof r.dollar === 'string' && dollars.includes(r.dollar) ? r.dollar : 'bolsa',
        hidden: r.hidden === true,
        sidebarCollapsed: r.sidebarCollapsed === true,
        display: r.display === 'ARS' ? 'ARS' : 'USD',
        horizon: typeof r.horizon === 'number' && [0, 12, 36, 60].includes(r.horizon) ? r.horizon : 12,
    };
}

// Leer no modifica el respaldo anterior: se conserva hasta completar la importación.
export function readLegacyPortfolio(storage: Pick<Storage, 'getItem'>): Portfolio {
    const preferences = { ...defaultPreferences };
    let investments: Investment[] = [];
    try {
        const raw: unknown = JSON.parse(storage.getItem('inversiones:v2') ?? '[]');
        if (Array.isArray(raw)) {
            const ids = new Set<string>();
            investments = raw.flatMap(value => {
                const investment = cleanInvestment(value);
                if (!investment || ids.has(investment.id)) return [];
                ids.add(investment.id);
                return [investment];
            });
        }
    } catch { /* Una copia inválida no impide abrir la cuenta. */ }
    try {
        Object.assign(preferences, cleanPreferences({
            theme: storage.getItem('inversiones:theme'),
            dollar: storage.getItem('inversiones:dollar'),
            hidden: storage.getItem('inversiones:hidden') === '1',
            sidebarCollapsed: storage.getItem('inversiones:sidebar-collapsed') === '1',
        }));
    } catch { /* El navegador puede impedir acceder al almacenamiento local. */ }
    return { investments, preferences };
}

export function cleanInvestment(raw: unknown): Investment | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const kind = r.kind, currency = r.currency, period = r.period, date = r.date;
    if (kind !== 'rate' && kind !== 'crypto' && kind !== 'cedear') return null;
    if (currency !== 'USD' && currency !== 'ARS') return null;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
    const amount = Number(r.amount);
    if (typeof r.name !== 'string' || !r.name.trim() || !Number.isFinite(amount) || amount <= 0) return null;
    const inv: Investment = {
        id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
        name: r.name.trim().slice(0, 70), amount, currency, date, kind,
    };
    if (kind === 'rate') {
        const rate = Number(r.rate);
        if (!Number.isFinite(rate) || rate <= -100 || (period !== 'year' && period !== 'month')) return null;
        inv.rate = rate; inv.period = period;
    } else {
        const units = Number(r.units);
        if (typeof r.coin !== 'string' || !r.coin.trim() || !Number.isFinite(units) || units <= 0) return null;
        inv.coin = kind === 'cedear' ? r.coin.trim().toUpperCase() : r.coin.trim().toLowerCase();
        inv.units = units;
    }
    return inv;
}
