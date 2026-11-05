import { useEffect, useState } from 'react';
import { request } from './account';
import Select from './Select';
import type { Portfolio } from './portfolio';

type Wallet = { id: string; address: string; network: string; label: string };
type Holding = { key: string; name: string; symbol: string; units: number; coin: string; purchasePrice?: number; purchaseDate?: string };
type Draft = { price: string; date: string };
const platforms: Record<string, string> = { solana: 'solana', ethereum: 'ethereum', polygon: 'polygon-pos', base: 'base', arbitrum: 'arbitrum-one', optimism: 'optimistic-ethereum', bnb: 'binance-smart-chain', gnosis: 'xdai', celo: 'celo', zksync: 'zksync', scroll: 'scroll', linea: 'linea' };

export default function WalletImport({ portfolio, update }: { portfolio: Portfolio; update: (change: (current: Portfolio) => Portfolio) => void }) {
    const [wallets, setWallets] = useState<Wallet[]>([]), [selected, setSelected] = useState('');
    const [holdings, setHoldings] = useState<Holding[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [adding, setAdding] = useState(''), [message, setMessage] = useState('');
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    useEffect(() => { let active = true; request<{ wallets: Wallet[] }>('wallets').then(data => { if (active) { setWallets(data.wallets); setSelected(data.wallets[0]?.id || ''); } }).catch(() => { if (active) setMessage('No se pudieron cargar tus wallets.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    async function load() {
        setBusy(true); setMessage(''); setHoldings([]); setDrafts({});
        try { const data = await request<{ holdings: Holding[]; truncated: boolean }>(`wallets/holdings?id=${encodeURIComponent(selected)}`); setHoldings(data.holdings); setDrafts(Object.fromEntries(data.holdings.map(item => [item.key, { price: typeof item.purchasePrice === 'number' && Number.isFinite(item.purchasePrice) && item.purchasePrice > 0 ? String(item.purchasePrice) : '', date: typeof item.purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.purchaseDate) ? item.purchaseDate : '' }]))); setMessage(data.holdings.length ? `Revisá la fecha y el precio de compra antes de agregar.${data.truncated ? ' Se muestran hasta 500 tokens.' : ''}` : 'No se encontraron saldos en esta red.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo consultar la wallet.'); }
        finally { setBusy(false); }
    }
    async function add(item: Holding) {
        const wallet = wallets.find(row => row.id === selected); if (!wallet) return;
        const draft = drafts[item.key]; const price = Number(draft?.price); const date = draft?.date ?? '';
        const today = new Date().toLocaleDateString('en-CA');
        const parsed = new Date(`${date}T12:00:00Z`);
        if (!Number.isFinite(price) || price <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today || !Number.isFinite(price * item.units) || price * item.units <= 0) { setMessage('Ingresá un precio de compra válido y una fecha que no sea futura.'); return; }
        setAdding(item.key); setMessage('');
        try {
            let coin = item.coin, name = item.name;
            if (!coin) {
                const platform = platforms[wallet.network];
                if (!platform) throw new Error('No se pudo identificar este token.');
                const response = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(platform)}/contract/${encodeURIComponent(item.key)}`, { signal: AbortSignal.timeout(15000) });
                if (!response.ok) throw new Error('No se pudo identificar este token en CoinGecko. Revisá su contrato e intentá más tarde.');
                const data = await response.json();
                if (typeof data.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,149}$/.test(data.id)) throw new Error('CoinGecko no pudo identificar este token.');
                coin = data.id; if (typeof data.name === 'string' && data.name.trim()) name = data.name.trim().slice(0, 70);
            }
            const id = `wallet-${wallet.id}-${item.key}`;
            update(current => current.investments.some(investment => investment.id === id) ? current : { ...current, investments: [...current.investments, { id, name, kind: 'crypto', coin, currency: 'USD', units: item.units, amount: price * item.units, purchasePrice: price, date }] });
            setMessage('Tenencia agregada con la fecha y el precio de compra ingresados.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo agregar el token.'); }
        finally { setAdding(''); }
    }
    return <section className="card p-6"><p className="lb">WALLETS CRIPTO</p><h2 className="mt-2 text-xl font-light">Importar tenencias</h2><p className="mu mt-2 text-[12px] leading-5">Consultá los saldos e ingresá la fecha y el precio promedio de compra por unidad en USD. La cantidad importada no se actualiza automáticamente.</p>
        {loading ? <p className="mu mt-3 text-xs">Cargando wallets…</p> : wallets.length === 0 ? <p className="mu mt-3 text-xs">Agregá primero una dirección pública en Configuración → Cuenta.</p> : <><div className="mt-4 flex flex-wrap items-center gap-3"><Select className="min-w-[220px] flex-1" label="Wallet para importar" value={selected} disabled={busy || !!adding} onChange={value => { setSelected(value); setHoldings([]); setMessage(''); }} options={wallets.map(wallet => ({ value: wallet.id, label: `${wallet.label || 'Wallet'} · ${wallet.network} · ${wallet.address.slice(0, 8)}…${wallet.address.slice(-4)}` }))} /><button type="button" className="btn-ghost text-[12px]" disabled={busy || !!adding} onClick={() => void load()}>{busy ? 'Consultando…' : 'Buscar saldos'}</button></div>
            {holdings.map(item => { const already = portfolio.investments.some(investment => investment.id === `wallet-${selected}-${item.key}`); const draft = drafts[item.key] ?? { price: '', date: '' }; const edit = (change: Partial<Draft>) => setDrafts(current => ({ ...current, [item.key]: { ...draft, ...change } })); return <form key={item.key} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4" onSubmit={event => { event.preventDefault(); void add(item); }}><p className="text-[13px] font-medium">{item.name} {item.symbol && `· ${item.symbol}`}</p><p className="mu mt-1 break-all text-[11px]">Cantidad: {item.units} {item.key !== 'native' && `· Contrato: ${item.key}`}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="mu text-[11px]">Precio promedio de compra por unidad (USD)<input required type="number" inputMode="decimal" min="0.000000000000000001" step="any" value={draft.price} onChange={event => edit({ price: event.target.value })} disabled={already || !!adding} className="settings-time mt-1 block w-full" /></label><label className="mu text-[11px]">Fecha de compra<input required type="date" max={new Date().toLocaleDateString('en-CA')} value={draft.date} onChange={event => edit({ date: event.target.value })} disabled={already || !!adding} className="settings-time mt-1 block w-full" /></label></div><button type="submit" className="btn-ghost mt-3 text-[12px]" disabled={already || !!adding || busy}>{already ? 'Ya agregada' : adding === item.key ? 'Identificando…' : 'Agregar a mi cartera'}</button></form>; })}</>}
        {message && <p role="status" className="mu mt-3 text-[12px]">{message}</p>}
    </section>;
}
