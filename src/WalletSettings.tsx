import { useEffect, useState } from 'react';
import { request } from './account';
import Select from './Select';

type Wallet = { id: string; address: string; network: string; label: string };
const networks: Record<string, string> = { bitcoin: 'Bitcoin', solana: 'Solana', ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base', arbitrum: 'Arbitrum', optimism: 'Optimism', bnb: 'BNB Smart Chain', gnosis: 'Gnosis', celo: 'Celo', zksync: 'zkSync Era', scroll: 'Scroll', linea: 'Linea' };

export default function WalletSettings() {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [address, setAddress] = useState(''), [label, setLabel] = useState(''), [network, setNetwork] = useState('ethereum');
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState('');
    useEffect(() => { let active = true; request<{ wallets: Wallet[] }>('wallets').then(data => { if (active) setWallets(data.wallets); }).catch(() => { if (active) setMessage('No se pudieron cargar las direcciones. Cerrá y volvé a abrir la configuración para reintentar.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    async function change(method: 'POST' | 'DELETE', body: unknown) {
        setBusy(true); setMessage('');
        try { const data = await request<{ wallets: Wallet[] }>('wallets', method, body); setWallets(data.wallets); if (method === 'POST') { setAddress(''); setLabel(''); } setMessage(method === 'POST' ? 'Dirección guardada.' : 'Dirección eliminada.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
        finally { setBusy(false); }
    }
    return <div className="settings-channel"><p className="text-[13px] font-medium">Wallets cripto</p><p className="mu mt-2 text-[11px] leading-5">Guardá una dirección pública por red para consultar sus saldos desde Importar. Nunca ingreses tu frase de recuperación ni tu clave privada.</p>
        <form className="mt-3 grid gap-3" onSubmit={event => { event.preventDefault(); void change('POST', { address, label, network }); }}>
            <div><p className="mu mb-1 text-[11px]">Red</p><Select className="w-full" label="Red de la wallet" value={network} onChange={setNetwork} options={Object.entries(networks).map(([value, name]) => ({ value, label: name }))} /></div>
            <div><label htmlFor="wallet-address" className="mu text-[11px]">Dirección pública</label><div className="mt-1 flex gap-2"><input id="wallet-address" required value={address} onChange={event => setAddress(event.target.value)} placeholder={network === 'bitcoin' ? 'bc1… / 1… / 3…' : network === 'solana' ? 'Dirección de Solana' : '0x…'} autoComplete="off" className="settings-time block min-w-0 flex-1" /><button type="button" className="btn-ghost shrink-0 text-[12px]" onClick={async () => { try { const text = await navigator.clipboard.readText(); if (!text.trim()) { setMessage('El portapapeles está vacío.'); return; } setAddress(text.trim()); setMessage('Dirección pegada.'); } catch { setMessage('No se pudo acceder al portapapeles. Pegá la dirección en el campo.'); } }}>Pegar</button></div>{network === 'bitcoin' && <p className="mu mt-1 text-[11px]">Se consulta el saldo confirmado de esta dirección de Bitcoin; una wallet puede tener varias direcciones.</p>}</div>
            <label className="mu text-[11px]">Nombre (opcional)<input maxLength={60} value={label} onChange={event => setLabel(event.target.value)} placeholder="Mi wallet" className="settings-time mt-1 block w-full" /></label>
            <button className="btn-ghost !min-h-10 justify-self-start text-[12px]" disabled={busy || loading}>Guardar dirección</button>
        </form>
        {loading ? <p className="mu mt-3 text-[11px]">Cargando direcciones…</p> : wallets.map(wallet => <div key={wallet.id} className="mt-3 rounded-xl border border-[var(--line)] p-3"><p className="text-[12px]">{wallet.label || 'Wallet'} · {networks[wallet.network]}</p><p className="mu mt-1 break-all font-mono text-[11px]">{wallet.address}</p><button type="button" disabled={busy} className="btn-ghost mt-2 text-[11px]" onClick={() => void change('DELETE', { id: wallet.id })}>Eliminar</button></div>)}
        {message && <p role="status" className="mu mt-3 text-[11px]">{message}</p>}
    </div>;
}
