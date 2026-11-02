import { useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { DarkModeFreeIcons, Download02Icon, LogoutCircle01Icon, MoreHorizontalIcon, Search01Icon, Sun03Icon, Upload06Icon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { pages, type PageId } from './navigation';
import PageLink from './PageLink';
import PageIcon from './PageIcon';
import ContextMenu from './ContextMenu';
import type { Currency } from './portfolio';

type Props = {
    page: PageId; count: number; theme: 'light' | 'dark'; onTheme: () => void; hidden: boolean; onHidden: () => void;
    display: Currency; onDisplay: (c: Currency) => void; onSearch: () => void; onExport: () => void; onImport: () => void;
    email: string; syncLabel: string; onLogout: () => void; leaving: boolean;
};

export function Logo({ size = 26 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2.5a9.5 9.5 0 0 1 0 19z" fill="var(--sig)" /><circle cx="12" cy="12" r="2.2" fill="var(--bg)" /></svg>;
}

export default function TopBar(p: Props) {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const more = useRef<HTMLButtonElement>(null);
    const openMenu = () => { const r = more.current!.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 8 }); };
    return <header className="topbar">
        <div className="brand"><Logo />activos<span className="text-[var(--sig)]">.</span></div>
        <nav className="navpills" aria-label="Navegación principal">
            {(Object.keys(pages) as PageId[]).map(id => <PageLink key={id} page={id} aria-current={p.page === id ? 'page' : undefined}><PageIcon page={id} size={15} />{pages[id].label}{id === 'investments' && <i>{p.count}</i>}</PageLink>)}
        </nav>
        <div className="spacer flex-1" />
        <div className="acts flex items-center gap-2">
            <div className="seg" role="group" aria-label="Moneda de visualización">{(['USD', 'ARS'] as const).map(c => <button key={c} type="button" aria-pressed={p.display === c} onClick={() => p.onDisplay(c)}>{c}</button>)}</div>
            <button type="button" className="ibtn" onClick={p.onHidden} aria-pressed={p.hidden} aria-label={p.hidden ? 'Mostrar montos' : 'Ocultar montos'} title={p.hidden ? 'Mostrar montos' : 'Ocultar montos'}><HugeiconsIcon icon={p.hidden ? ViewOffIcon : ViewIcon} size={18} /></button>
            <button type="button" className="ibtn" onClick={p.onTheme} aria-label={`Cambiar a tema ${p.theme === 'dark' ? 'claro' : 'oscuro'}`} title="Cambiar tema"><HugeiconsIcon icon={p.theme === 'dark' ? DarkModeFreeIcons : Sun03Icon} size={18} /></button>
            <button ref={more} type="button" className="ibtn" aria-haspopup="menu" aria-expanded={!!menu} aria-label="Más opciones" onClick={() => menu ? setMenu(null) : openMenu()}><HugeiconsIcon icon={MoreHorizontalIcon} size={18} /></button>
        </div>
        {menu && <ContextMenu x={menu.x} y={menu.y} title={`${p.email} · ${p.syncLabel}`} onClose={() => setMenu(null)} items={[
            { label: 'Buscar activos', icon: Search01Icon, onSelect: p.onSearch, hint: '/' },
            { label: 'Exportar datos', icon: Download02Icon, onSelect: p.onExport },
            { label: 'Importar datos', icon: Upload06Icon, onSelect: p.onImport },
            { sep: true },
            { label: p.leaving ? 'Cerrando sesión…' : 'Cerrar sesión', icon: LogoutCircle01Icon, onSelect: p.onLogout, danger: true },
        ]} />}
    </header>;
}
