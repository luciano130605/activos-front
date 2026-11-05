import { useEffect, useState } from 'react';
import { request } from './account';
import Select from './Select';

type Wallet = { id: string; address: string; network: string; label: string };
const networks: Record<string, string> = { bitcoin: 'Bitcoin', solana: 'Solana', ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base', arbitrum: 'Arbitrum', optimism: 'Optimism', bnb: 'BNB Smart Chain', gnosis: 'Gnosis', celo: 'Celo', zksync: 'zkSync Era', scroll: 'Scroll', linea: 'Linea' };

export default function WalletSettings() {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [address, setAddress] = useState(''), [label, setLabel] = useState(''), [network, setNetwork] = useState('');
    const [candidates, setCandidates] = useState<string[]>([]), [detecting, setDetecting] = useState(false), [detectError, setDetectError] = useState('');
    const [balanceCheck, setBalanceCheck] = useState('');
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState('');
    function updateAddress(value: string) { setNetwork(''); setCandidates([]); setDetectError(''); setBalanceCheck(''); setDetecting(!!value.trim()); setAddress(value); }
    useEffect(() => { let active = true; request<{ wallets: Wallet[] }>('wallets').then(data => { if (active) setWallets(data.wallets); }).catch(() => { if (active) setMessage('No se pudieron cargar las direcciones. Cerrá y volvé a abrir la configuración para reintentar.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    useEffect(() => {
        let active = true;
        setCandidates([]); setNetwork(''); setDetectError('');
        if (!address.trim()) { setDetecting(false); return () => { active = false; }; }
        setDetecting(true);
        const timer = window.setTimeout(() => {
            request<{ networks: string[] }>('wallets/detect', 'POST', { address }).then(data => {
                if (!active) return;
                setCandidates(data.networks); if (data.networks.length === 1) setNetwork(data.networks[0]);
            }).catch(() => { if (active) setDetectError('No se pudo detectar la red. Revisá tu conexión e intentá de nuevo.'); }).finally(() => { if (active) setDetecting(false); });
        }, 400);
        return () => { active = false; window.clearTimeout(timer); };
    }, [address]);
    useEffect(() => {
        if (!network || !address.trim()) { setBalanceCheck(''); return; }
        let active = true;
        setBalanceCheck('Consultando disponibilidad del saldo…');
        request<{ holdings: unknown[]; notice?: string }>('wallets/check', 'POST', { address, network }).then(data => {
            if (!active) return;
            const zero = network === 'bitcoin' ? 'No se encontró saldo confirmado en esta dirección. Si es una dirección de depósito de un exchange como Lemon, su saldo en la cadena puede no reflejar tu saldo en la cuenta.' : 'No se encontró saldo en esta dirección para la red elegida.';
            setBalanceCheck(`${data.holdings.length ? 'Se pudo consultar el saldo de esta dirección.' : zero}${data.notice ? ` ${data.notice}` : ''}`);
        }).catch(() => { if (active) setBalanceCheck('No se pudo consultar el saldo de esta dirección en este momento. Podés guardarla e intentar nuevamente desde Importar.'); });
        return () => { active = false; };
    }, [address, network]);
    async function change(method: 'POST' | 'DELETE', body: unknown) {
        setBusy(true); setMessage('');
        try { const data = await request<{ wallets: Wallet[] }>('wallets', method, body); setWallets(data.wallets); if (method === 'POST') { setAddress(''); setLabel(''); } setMessage(method === 'POST' ? 'Dirección guardada.' : 'Dirección eliminada.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
        finally { setBusy(false); }
    }
    return <div className="settings-channel"><p className="text-[13px] font-medium">Wallets cripto</p><p className="mu mt-2 text-[11px] leading-5">Guardá una dirección pública por red para consultar sus saldos desde Importar. Nunca ingreses tu frase de recuperación ni tu clave privada.</p>
        <form className="mt-3 grid gap-3" onSubmit={event => { event.preventDefault(); void change('POST', { address, label, network }); }}>
            <div><label htmlFor="wallet-address" className="mu text-[11px]">Dirección pública</label><div className="mt-1 flex gap-2"><input id="wallet-address" required maxLength={90} value={address} onChange={event => updateAddress(event.target.value)} placeholder="Pegá tu dirección pública" autoComplete="off" className="settings-time block min-w-0 flex-1" /><button type="button" className="btn-ghost shrink-0 text-[12px]" onClick={async () => { try { const text = await navigator.clipboard.readText(); if (!text.trim()) { setMessage('El portapapeles está vacío.'); return; } if (text.trim() !== address) updateAddress(text.trim()); setMessage('Dirección pegada.'); } catch { setMessage('No se pudo acceder al portapapeles. Pegá la dirección en el campo.'); } }}>Pegar</button></div>{network === 'bitcoin' && <p className="mu mt-1 text-[11px]">Se consulta el saldo confirmado de esta dirección de Bitcoin; una wallet puede tener varias direcciones.</p>}</div>
            {address.trim() && <div aria-live="polite"><p className="mu mb-1 text-[11px]">Red</p>{detecting ? <p className="mu text-[12px]">Detectando red…</p> : detectError ? <p className="mu text-[12px]">{detectError}</p> : candidates.length === 1 ? <p className="text-[12px]">{networks[candidates[0]]} · detectada automáticamente</p> : candidates.length > 1 ? <><Select className="w-full" label="Red de la wallet" value={network} onChange={setNetwork} options={[{ value: '', label: 'Seleccioná una red', disabled: true }, ...candidates.map(value => ({ value, label: networks[value] }))]} /><p className="mu mt-1 text-[11px]">Esta dirección puede usarse en varias redes. Elegí la red que querés consultar.</p></> : <p className="mu text-[12px]">No se reconoce una dirección válida para las redes disponibles.</p>}</div>}
            {balanceCheck && <p role="status" className="rounded-xl border border-[var(--line2)] bg-[var(--raised)] p-3 text-[11px] leading-5 text-[var(--muted)]">{balanceCheck}</p>}
            <label className="mu text-[11px]">Nombre (opcional)<input maxLength={60} value={label} onChange={event => setLabel(event.target.value)} placeholder="Mi wallet" className="settings-time mt-1 block w-full" /></label>
            <button className="btn-ghost !min-h-10 justify-self-start text-[12px]" disabled={busy || loading || detecting || !network}>Guardar dirección</button>
        </form>
        {loading ? <p className="mu mt-3 text-[11px]">Cargando direcciones…</p> : wallets.map(wallet => <div key={wallet.id} className="mt-3 rounded-xl border border-[var(--line)] p-3"><p className="text-[12px]">{wallet.label || 'Wallet'} · {networks[wallet.network]}</p><p className="mu mt-1 break-all font-mono text-[11px]">{wallet.address}</p><button type="button" disabled={busy} className="btn-ghost mt-2 text-[11px]" onClick={() => void change('DELETE', { id: wallet.id })}>Eliminar</button></div>)}
        {message && <p role="status" className="mu mt-3 text-[11px]">{message}</p>}
    </div>;
}
