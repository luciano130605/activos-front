import { useCallback, useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { DarkModeFreeIcons, LogoutCircle01Icon, MenuTwoLineIcon, Mail01Icon, PlusIcon, ScanFaceIcon, Search01Icon, Share08Icon, ViewIcon, ViewOffIcon, SolarSystem01Icon } from '@hugeicons/core-free-icons';
import { pages, type PageId } from './navigation';
import PageLink from './PageLink';
import PageIcon from './PageIcon';
import ContextMenu from './ContextMenu';
import SettingsDialog from './SettingsDialog';
import AppearanceDialog from './AppearanceDialog';
import ShareDialog from './ShareDialog';
import type { Currency, Preferences } from './portfolio';

type Props = {
    page: PageId; count: number; theme: 'light' | 'dark' | 'system'; resolvedTheme: 'light' | 'dark'; onTheme: (theme: 'light' | 'dark' | 'system') => void; hidden: boolean; onHidden: () => void;
    display: Currency; onDisplay: (c: Currency) => void; onSearch: () => void; onAdd: () => void; onExport: () => void; onImport: () => void;
    email: string; syncLabel: string; onLogout: () => void; leaving: boolean;
    onMailSettings: () => void; onCustomize: () => void; customizing: boolean; spaceSubscreen: boolean; onPasskey: () => void; passkeyCount: number | null; onAiSettings: () => void;
    quietHours?: Preferences['quietHours']; onQuietHours: (value: NonNullable<Preferences['quietHours']>) => void; alertCount: number; triggeredCount: number;
};

export default function TopBar(p: Props) {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [settings, setSettings] = useState<'personalizacion' | 'cuenta' | 'notificaciones' | null>(() => window.location.pathname.replace(/\/+$/, '') === '/espacio' ? 'personalizacion' : null);
    const [appearance, setAppearance] = useState(false);
    const [sharing, setSharing] = useState(false);
    const closeMenu = useCallback(() => setMenu(null), []);
    const more = useRef<HTMLButtonElement>(null);
    const openMenu = () => { const r = more.current!.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 8 }); };
    useEffect(() => {
        const onNavigate = () => {
            if (window.location.pathname.replace(/\/+$/, '') === '/espacio') setSettings(current => current ?? 'personalizacion');
            else { setSettings(null); setAppearance(false); }
        };
        window.addEventListener('popstate', onNavigate);
        return () => window.removeEventListener('popstate', onNavigate);
    }, []);
    const openSettings = (section: 'personalizacion' | 'cuenta' | 'notificaciones') => {
        if (window.location.pathname !== '/espacio') {
            window.history.pushState({ espacioFrom: `${window.location.pathname}${window.location.search}${window.location.hash}` }, '', '/espacio');
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        setSettings(section);
    };
    const closeSettings = () => {
        const from = window.history.state?.espacioFrom;
        const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/espacio') ? from : '/';
        window.history.replaceState(null, '', destination);
        window.dispatchEvent(new PopStateEvent('popstate'));
        setSettings(null);
    };
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

            <button type="button" className="ibtn white" onClick={p.onAdd} aria-label="Nueva inversión" title="Nueva inversión"><HugeiconsIcon icon={PlusIcon} size={18} /></button>
            <button type="button" className="ibtn" onClick={p.onSearch} aria-label="Buscar activos" title="Buscar activos"><HugeiconsIcon icon={Search01Icon} size={18} /></button>
            <button type="button" className="ibtn" onClick={p.onHidden} aria-pressed={p.hidden} aria-label={p.hidden ? 'Mostrar montos' : 'Ocultar montos'} title={p.hidden ? 'Mostrar montos' : 'Ocultar montos'}><HugeiconsIcon icon={p.hidden ? ViewOffIcon : ViewIcon} size={18} /></button>

            <button ref={more} type="button" className="ibtn" aria-haspopup="menu" aria-expanded={!!menu} aria-label="Más opciones" onClick={() => menu ? setMenu(null) : openMenu()}><HugeiconsIcon icon={MenuTwoLineIcon} size={18} /></button>
        </div>
        {menu && <ContextMenu x={menu.x} y={menu.y} title={`${p.email} · ${p.syncLabel}`} onClose={closeMenu} currency={{ value: p.display, onChange: p.onDisplay }} items={[
            { label: 'Buscar activos', icon: Search01Icon, onSelect: p.onSearch, hint: '/' },
            { label: 'Compartir página', icon: Share08Icon, onSelect: () => setSharing(true) },
            { sep: true },
            { label: 'Tu espacio', icon: SolarSystem01Icon, onSelect: () => openSettings('personalizacion') },
            { label: 'Cuenta', icon: ScanFaceIcon, onSelect: () => openSettings('cuenta') },
            { label: 'Notificaciones', icon: Mail01Icon, onSelect: () => openSettings('notificaciones') },
            { sep: true },
            { label: p.leaving ? 'Cerrando sesión…' : 'Cerrar sesión', icon: LogoutCircle01Icon, onSelect: p.onLogout, danger: true },
        ]} />}
        {sharing && <ShareDialog onClose={() => setSharing(false)} />}
        {settings && !appearance && !p.customizing && !p.spaceSubscreen && <SettingsDialog initial={settings} onSectionChange={setSettings} onClose={closeSettings} onAppearance={() => setAppearance(true)} onCustomize={p.onCustomize} onPasskey={p.onPasskey} passkeyCount={p.passkeyCount} onAiSettings={p.onAiSettings} onMailSettings={p.onMailSettings} onExport={p.onExport} onImport={p.onImport} quietHours={p.quietHours} onQuietHours={p.onQuietHours} alertCount={p.alertCount} triggeredCount={p.triggeredCount} />}
        {appearance && <AppearanceDialog theme={p.theme} onTheme={p.onTheme} onClose={() => setAppearance(false)} />}
    </header>;
}
