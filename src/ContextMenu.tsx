import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';

export type MenuItem =
    | { sep: true }
    | { label: string; icon?: Parameters<typeof HugeiconsIcon>[0]['icon']; visibilityHidden?: boolean; searchIcon?: boolean; shareIcon?: boolean; spaceIcon?: boolean; accountIcon?: boolean; notificationIcon?: boolean; logoutIcon?: boolean; onSelect?: () => void; href?: string; danger?: boolean; hint?: string };

function VisibilityIcon({ hidden }: { hidden: boolean }) {
    return <svg className={`menu-visibility-icon${hidden ? ' is-hidden' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g className="menu-eye-open"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></g><path className="menu-eye-closed" d="M3 11c2.2 3 5.2 4.5 9 4.5s6.8-1.5 9-4.5M7 14l-1.5 2M17 14l1.5 2M12 15.5v2" /></svg>;
}

function SpaceIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="12" r="6" opacity=".45" /><circle cx="12" cy="12" r="10" opacity=".45" /><g className="space-planet-inner"><circle cx="12" cy="6" r="1.5" fill="var(--surface)" /></g><g className="space-planet-outer"><circle cx="19" cy="19" r="1.5" fill="var(--surface)" /></g></svg>;
}

function AccountIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3M9 10v1M15 10v1" /><path className="account-mouth-serious" d="M9 15h6" /><path className="account-mouth-smile" d="M9 14.5c.8 1.3 2 2 3 2s2.2-.7 3-2" /></svg>;
}

function NotificationIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m4 8 8 6 8-6" /><circle className="menu-notification-dot" cx="19" cy="5" r="3" fill="var(--sig)" stroke="var(--surface)" strokeWidth="2" /></svg>;
}

function LogoutIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18" /><path className="menu-logout-arrow" d="M10 12h11m-4-4 4 4-4 4" /></svg>;
}

function ShareIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4" className="menu-share-arrow" /><path d="M5 13v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5" /></svg>;
}

// Menú flotante accesible: clic derecho, botón "⋯" o tecla Menú. Flechas, Inicio/Fin, Esc.
export default function ContextMenu({ x, y, title, items, onClose, currency }: { x: number; y: number; title?: string; items: MenuItem[]; onClose: () => void; currency?: { value: 'USD' | 'ARS'; onChange: (value: 'USD' | 'ARS') => void } }) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });
    useLayoutEffect(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        setPos({ left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)) });
    }, [x, y]);
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLElement>('[role=menuitem], [role=menuitemradio]')?.focus({ preventScroll: true });
        const outside = (event: Event) => {
            const target = event.target as Element;
            if (ref.current?.contains(target) || (event.type === 'pointerdown' && target.closest?.('[aria-haspopup="menu"]'))) return; // el botón que lo abre lo cierra
            onClose();
        };
        const close = (event: Event) => { if (event.type !== 'scroll' || !(event.target instanceof Node) || !ref.current?.contains(event.target)) onClose(); };
        window.addEventListener('pointerdown', outside, true);
        window.addEventListener('contextmenu', outside, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('pointerdown', outside, true);
            window.removeEventListener('contextmenu', outside, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
            if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        };
    }, [onClose]);
    function onKeyDown(event: React.KeyboardEvent) {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem], [role=menuitemradio]') ?? []);
        const at = nodes.indexOf(document.activeElement as HTMLElement);
        const go = (index: number) => { event.preventDefault(); nodes[(index + nodes.length) % nodes.length]?.focus(); };
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        else if (event.key === 'ArrowDown') go(at + 1);
        else if (event.key === 'ArrowUp') go(at - 1);
        else if (event.key === 'Home') go(0);
        else if (event.key === 'End') go(nodes.length - 1);
        else if (event.key === 'Tab') { event.preventDefault(); onClose(); }
    }
    return <div ref={ref} role="menu" aria-label={title ?? 'Acciones'} className="ctx" style={pos} onKeyDown={onKeyDown} onContextMenu={event => event.preventDefault()}>
        {title && <p className="ctx-head" title={title}>{title}</p>}
        {currency && <div className="menu-currency" role="group" aria-label="Moneda de visualización"><span>Moneda</span><div className="menu-currency-options">{(['USD', 'ARS'] as const).map(value => <button key={value} type="button" role="menuitemradio" aria-checked={currency.value === value} onClick={() => currency.onChange(value)}>{value}</button>)}</div></div>}
        {currency && <div className="sep" role="separator" />}
        {items.map((item, index) => 'sep' in item ? <div key={index} className="sep" role="separator" /> :
            item.href ? <a key={item.label} role="menuitem" href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>{item.icon && <HugeiconsIcon icon={item.icon} size={16} />}{item.label}{item.hint && <kbd>{item.hint}</kbd>}</a> :
                <button key={item.label} type="button" role="menuitem" className={`${item.danger ? 'danger ' : ''}${item.visibilityHidden !== undefined ? 'menu-visibility' : ''}${item.searchIcon ? ' menu-search' : ''}${item.shareIcon ? ' menu-share' : ''}${item.spaceIcon ? ' menu-space' : ''}${item.accountIcon ? ' menu-account' : ''}${item.notificationIcon ? ' menu-notification' : ''}${item.logoutIcon ? ' menu-logout' : ''}`} onClick={() => { onClose(); item.onSelect?.(); }}>{item.visibilityHidden !== undefined ? <VisibilityIcon hidden={item.visibilityHidden} /> : item.spaceIcon ? <SpaceIcon /> : item.accountIcon ? <AccountIcon /> : item.notificationIcon ? <NotificationIcon /> : item.logoutIcon ? <LogoutIcon /> : item.shareIcon ? <ShareIcon /> : item.icon && (item.searchIcon ? <span className="header-search-icon" aria-hidden="true"><HugeiconsIcon icon={item.icon} size={16} /><span className="header-search-dollar">$</span></span> : <HugeiconsIcon icon={item.icon} size={16} />)}{item.label}{item.hint && <kbd>{item.hint}</kbd>}</button>)}
    </div>;
}
