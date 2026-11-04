import { useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { DarkModeFreeIcons, DashboardCircleEditIcon, DashboardCircleIcon, Download02Icon, LogoutCircle01Icon, MenuTwoLineIcon, MoreHorizontalIcon, ScanFaceIcon, Search01Icon, Sun03Icon, Upload06Icon, ViewIcon, ViewOffIcon, Key01Icon } from '@hugeicons/core-free-icons';
import { pages, type PageId } from './navigation';
import PageLink from './PageLink';
import PageIcon from './PageIcon';
import ContextMenu from './ContextMenu';
import AppearanceDialog from './AppearanceDialog';
import type { Currency } from './portfolio';

type Props = {
    page: PageId; count: number; theme: 'light' | 'dark' | 'system'; resolvedTheme: 'light' | 'dark'; onTheme: (theme: 'light' | 'dark' | 'system') => void; hidden: boolean; onHidden: () => void;
    display: Currency; onDisplay: (c: Currency) => void; onSearch: () => void; onExport: () => void; onImport: () => void;
    email: string; syncLabel: string; onLogout: () => void; leaving: boolean;
    onCustomize: () => void; onPasskey: () => void; passkeyCount: number | null; onAiSettings: () => void;
};

function ThemeIcon({ size = 18 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path
                d="M12 3a9 9 0 0 0 0 18z"
                fill="currentColor"
                stroke="none"
            />
        </svg>
    );
}

export default function TopBar(p: Props) {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [appearance, setAppearance] = useState(false);
    const more = useRef<HTMLButtonElement>(null);
    const openMenu = () => { const r = more.current!.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 8 }); };
    return <header className="topbar">
        <div className="brand">
            <img src="/icon.png" alt="Activos Logo" className="brand-logo" />
            <span>
                alza<span className="text-[var(--sig)]">.</span>
            </span>
        </div>
        <nav className="navpills" aria-label="Navegación principal">
            {(Object.keys(pages) as PageId[]).map(id => <PageLink key={id} page={id} aria-current={p.page === id ? 'page' : undefined} aria-label={id === 'investments' ? `${pages[id].label}, ${p.count}` : pages[id].label}><PageIcon page={id} size={15} /><span className="navpills-label" aria-hidden="true"><span>{pages[id].label}{id === 'investments' && <i>{p.count}</i>}</span></span></PageLink>)}
        </nav>
        <div className="spacer flex-1" />
        <div className="acts flex items-center gap-2">
            <div className="seg" role="group" aria-label="Moneda de visualización">{(['USD', 'ARS'] as const).map(c => <button key={c} type="button" aria-pressed={p.display === c} onClick={() => p.onDisplay(c)}>{c}</button>)}</div>
            <button type="button" className="ibtn" onClick={p.onHidden} aria-pressed={p.hidden} aria-label={p.hidden ? 'Mostrar montos' : 'Ocultar montos'} title={p.hidden ? 'Mostrar montos' : 'Ocultar montos'}><HugeiconsIcon icon={p.hidden ? ViewOffIcon : ViewIcon} size={18} /></button>

            <button ref={more} type="button" className="ibtn" aria-haspopup="menu" aria-expanded={!!menu} aria-label="Más opciones" onClick={() => menu ? setMenu(null) : openMenu()}><HugeiconsIcon icon={MenuTwoLineIcon} size={18} /></button>
        </div>
        {menu && <ContextMenu x={menu.x} y={menu.y} title={`${p.email} · ${p.syncLabel}`} onClose={() => setMenu(null)} items={[
            { label: 'Buscar activos', icon: Search01Icon, onSelect: p.onSearch, hint: '/' },
            { label: 'Apariencia', icon: DarkModeFreeIcons, onSelect: () => setAppearance(true) },
            { label: 'Personalizar panel', icon: DashboardCircleEditIcon, onSelect: p.onCustomize },
            { label: 'Claves de IA', icon: Key01Icon, onSelect: p.onAiSettings },
            { label: p.passkeyCount === null ? 'Passkeys y llaves de seguridad' : p.passkeyCount > 0 ? `Passkeys activadas (${p.passkeyCount})` : 'Activar passkey o llave de seguridad', icon: ScanFaceIcon, onSelect: p.onPasskey },
            { label: 'Exportar datos', icon: Download02Icon, onSelect: p.onExport },
            { label: 'Importar datos', icon: Upload06Icon, onSelect: p.onImport },
            { sep: true },
            { label: p.leaving ? 'Cerrando sesión…' : 'Cerrar sesión', icon: LogoutCircle01Icon, onSelect: p.onLogout, danger: true },
        ]} />}
        {appearance && <AppearanceDialog theme={p.theme} onTheme={p.onTheme} onClose={() => setAppearance(false)} />}
    </header>;
}
