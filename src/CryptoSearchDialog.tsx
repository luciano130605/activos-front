import { useEffect, useMemo, useRef, useState } from 'react';
import { listCryptoAssets, type CryptoAsset } from './coingecko';
import { HugeiconsIcon } from '@hugeicons/react';
import { Bitcoin, ChevronRight, LoaderIcon, Refresh04Icon, Search02Icon, XIcon } from '@hugeicons/core-free-icons';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const commonIds = ['bitcoin', 'ethereum', 'solana', 'tether', 'usd-coin', 'ripple', 'binancecoin', 'dogecoin'];
type Catalog = { status: 'ready'; coins: CryptoAsset[] } | { status: 'error'; message: string };

export default function CryptoSearchDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (coin: CryptoAsset) => void }) {
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(40);
    const [attempt, setAttempt] = useState(0);
    const dialog = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        input.current?.focus();
        return () => { previousFocus?.focus(); };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        listCryptoAssets(controller.signal).then(coins => {
            if (!controller.signal.aborted) setCatalog({ status: 'ready', coins });
        }).catch(error => {
            if (!controller.signal.aborted) setCatalog({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo cargar el catálogo. Volvé a intentar.' });
        });
        return () => controller.abort();
    }, [attempt]);
    const matches = useMemo(() => {
        if (catalog?.status !== 'ready') return [];
        const term = normalize(query);
        const score = (coin: CryptoAsset) => !term ? 0 : normalize(coin.name) === term || coin.id === term ? -2 : normalize(coin.symbol) === term ? -1 : 0;
        const commonOrder = (coin: CryptoAsset) => commonIds.includes(coin.id) ? commonIds.indexOf(coin.id) - commonIds.length : 0;
        return catalog.coins.filter(coin => !term || normalize(`${coin.name} ${coin.symbol} ${coin.id}`).includes(term)).sort((a, b) => score(a) - score(b) || commonOrder(a) - commonOrder(b) || a.name.localeCompare(b.name));
    }, [catalog, query]);
    return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-[5px] sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="crypto-search-title" className="flex max-h-[90dvh] w-full flex-col rounded-t-[22px] border border-[var(--line2)] bg-[var(--surface)] shadow-2xl sm:max-w-[540px] sm:rounded-[22px]" onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
            if (event.key !== 'Tab') return;
            const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
            const first = elements[0], last = elements.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
            <div className="shrink-0 border-b border-[var(--line)] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><h2 id="crypto-search-title" className="text-[23px] font-light tracking-tight">Buscar criptomoneda</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Explorá el catálogo de CoinGecko sin conocer el ID.</p></div><button type="button" onClick={onClose} aria-label="Cerrar buscador" className="rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"><HugeiconsIcon icon={XIcon} size={19} /></button></div>
                <label htmlFor="crypto-search" className="mb-1.5 mt-5 block text-[12px] text-[var(--muted)]">Nombre, símbolo o ID</label>
                <div className="relative"><HugeiconsIcon icon={Search02Icon} size={17} className="pointer-events-none absolute left-3 top-3 text-[var(--muted)]" /><input ref={input} id="crypto-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} placeholder="Ej: Bitcoin, BTC, Ethereum..." autoComplete="off" spellCheck={false} className="w-full rounded-[10px] border border-[var(--line2)] bg-[var(--raised)] py-2.5 pl-10 pr-3 text-[14px] outline-none focus:border-[var(--muted)]" /></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:px-4">
                {!catalog ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--muted)]"><HugeiconsIcon icon={LoaderIcon} size={17} className="animate-spin" />Cargando criptomonedas...</p> : catalog.status === 'error' ? <div className="p-4"><p role="alert" className="text-[13px] text-[#ff7d52]">{catalog.message}</p><button type="button" onClick={() => { setCatalog(null); setAttempt(value => value + 1); }} className="mt-4 inline-flex items-center gap-2 text-[12px] underline"><HugeiconsIcon icon={Refresh04Icon} size={14} />Reintentar</button></div> : <>
                    <p role="status" className="px-2 pb-2 font-mono text-[10px] text-[var(--muted)]">{matches.length.toLocaleString('es-AR')} {query.trim() ? 'resultados' : 'criptomonedas disponibles'}</p>
                    {matches.length === 0 ? <p className="px-2 py-10 text-center text-[13px] text-[var(--muted)]">No encontramos coincidencias. Probá otro nombre o símbolo.</p> : matches.slice(0, limit).map(coin => <button key={coin.id} type="button" onClick={() => onSelect(coin)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[var(--raised)] focus-visible:bg-[var(--raised)]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f5c542]/10 text-[#f5c542]"><HugeiconsIcon icon={Bitcoin} size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{coin.name}</span><span className="mt-1 block truncate font-mono text-[10px] text-[var(--muted)]">{coin.symbol.toUpperCase()} · {coin.id}</span></span><HugeiconsIcon icon={ChevronRight} size={16} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--ink)]" />
                    </button>)}
                    {matches.length > limit && <button type="button" onClick={() => setLimit(value => value + 40)} className="my-3 w-full rounded-lg border border-[var(--line2)] py-2.5 text-[12px]">Mostrar más</button>}
                </>}
            </div>
            <p className="shrink-0 border-t border-[var(--line)] px-5 py-4 text-[11px] text-[var(--muted)]">Seleccioná una criptomoneda para consultar su precio y cargar una inversión.</p>
        </div>
    </div>;
}
