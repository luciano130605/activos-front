import { useEffect, useState } from 'react';
import { request } from './account';
import Select from './Select';
import type { Portfolio } from './portfolio';

type Wallet = { id: string; address: string; network: string; label: string };
type Holding = { key: string; name: string; symbol: string; units: number; coin: string };
const field = 'w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--raised)] px-3 py-2 text-[13px] text-[var(--ink)]';

export default function WalletImport({ portfolio, update }: { portfolio: Portfolio; update: (change: (current: Portfolio) => Portfolio) => void }) {
    const [wallets, setWallets] = useState<Wallet[]>([]), [selected, setSelected] = useState('');
    const [holdings, setHoldings] = useState<Holding[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const [drafts, setDrafts] = useState<Record<string, { coin: string; amount: string; date: string }>>({});
    useEffect(() => { let active = true; request<{ wallets: Wallet[] }>('wallets').then(data => { if (active) { setWallets(data.wallets); setSelected(data.wallets[0]?.id || ''); } }).catch(() => { if (active) setMessage('No se pudieron cargar tus wallets.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    async function load() {
        setBusy(true); setMessage(''); setHoldings([]); setDrafts({});
        try {
            const data = await request<{ holdings: Holding[]; truncated: boolean }>(`wallets/holdings?id=${encodeURIComponent(selected)}`);
            setHoldings(data.holdings); setDrafts(Object.fromEntries(data.holdings.map(item => [item.key, { coin: item.coin, amount: '', date: '' }])));
            setMessage(data.holdings.length ? `Revisá las tenencias antes de cargarlas.${data.truncated ? ' Se muestran hasta 500 tokens.' : ''}` : 'No se encontraron saldos en esta red.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo consultar la wallet.'); }
        finally { setBusy(false); }
    }
    function add(item: Holding) {
        const draft = drafts[item.key], amount = Number(draft.amount), date = draft.date, coin = draft.coin.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{0,149}$/.test(coin) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toLocaleDateString('en-CA')) { setMessage('Completá el ID de CoinGecko, el costo total en USD y la fecha de compra.'); return; }
        const id = `wallet-${selected}-${item.key}`;
        update(current => current.investments.some(investment => investment.id === id) ? current : { ...current, investments: [...current.investments, { id, name: item.name, kind: 'crypto', coin, currency: 'USD', units: item.units, amount, date }] });
        setMessage('Tenencia agregada. Se está guardando en tu cartera.');
    }
    return <section className="card p-6"><p className="lb">WALLETS CRIPTO</p><h2 className="mt-2 text-xl font-light">Importar tenencias</h2><p className="mu mt-2 text-[12px] leading-5">Consultá los saldos de una dirección guardada y elegí cuáles agregar. Las tenencias importadas no se actualizan automáticamente.</p>
        {loading ? <p className="mu mt-3 text-xs">Cargando wallets…</p> : wallets.length === 0 ? <p className="mu mt-3 text-xs">Agregá primero una dirección pública en Configuración → Cuenta.</p> : <><div className="mt-4 flex flex-wrap items-center gap-3"><Select className="min-w-[220px] flex-1" label="Wallet para importar" value={selected} onChange={value => { setSelected(value); setHoldings([]); setMessage(''); }} options={wallets.map(wallet => ({ value: wallet.id, label: `${wallet.label || 'Wallet'} · ${wallet.network} · ${wallet.address.slice(0, 8)}…${wallet.address.slice(-4)}` }))} /><button type="button" className="btn-ghost text-[12px]" disabled={busy} onClick={() => void load()}>{busy ? 'Consultando…' : 'Buscar saldos'}</button></div>
            {holdings.map(item => { const draft = drafts[item.key]; if (!draft) return null; const already = portfolio.investments.some(investment => investment.id === `wallet-${selected}-${item.key}`); const edit = (change: Partial<typeof draft>) => setDrafts(current => ({ ...current, [item.key]: { ...current[item.key], ...change } })); return <div key={item.key} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4"><p className="text-[13px] font-medium">{item.name} {item.symbol && `· ${item.symbol}`}</p><p className="mu mt-1 break-all text-[11px]">Cantidad: {item.units} {item.key !== 'native' && `· Contrato: ${item.key}`}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="mu text-[11px]">ID en CoinGecko<input className={`${field} mt-1`} value={draft.coin} onChange={event => edit({ coin: event.target.value })} placeholder="ej. usd-coin" /></label><label className="mu text-[11px]">Costo total de compra (USD)<input className={`${field} mt-1`} type="number" min="0" step="any" value={draft.amount} onChange={event => edit({ amount: event.target.value })} /></label><label className="mu text-[11px]">Fecha de compra<input className={`${field} mt-1`} type="date" value={draft.date} onChange={event => edit({ date: event.target.value })} /></label></div><button type="button" className="btn-ghost mt-3 text-[12px]" disabled={already} onClick={() => add(item)}>{already ? 'Ya agregada' : 'Agregar a mi cartera'}</button></div>; })}</>}
        {message && <p role="status" className="mu mt-3 text-[12px]">{message}</p>}
    </section>;
}
