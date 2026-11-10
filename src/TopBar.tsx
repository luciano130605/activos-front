import { useCallback, useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { DarkModeFreeIcons, PlusIcon, Search01Icon, Share08Icon, Notification01Icon, DashboardSquare02Icon } from '@hugeicons/core-free-icons';
import { pages, type PageId } from './navigation';
import PageLink from './PageLink';
import PageIcon from './PageIcon';
import ContextMenu from './ContextMenu';
import NotificationsMenu from './NotificationsMenu';
import SettingsDialog from './SettingsDialog';
import AlertsManagement from './AlertsManagement';
import AppearanceDialog from './AppearanceDialog';
import ShareDialog from './ShareDialog';
import type { Currency, Preferences, PriceAlert } from './portfolio';
import type { AlertStatus } from './usePriceAlerts';
import { isTauriApp } from './account';

type Props = {
    page: PageId; count: number; theme: 'light' | 'dark' | 'system'; resolvedTheme: 'light' | 'dark'; onTheme: (theme: 'light' | 'dark' | 'system') => void; hidden: boolean; onHidden: () => void;
    display: Currency; onDisplay: (c: Currency) => void; onSearch: () => void; onAdd: () => void; onExport: () => void; onImport: () => void;
    email: string; syncLabel: string; onLogout: () => void; leaving: boolean;
    onMailSettings: () => void; onCustomize: () => void; customizing: boolean; spaceSubscreen: boolean; onPasskey: () => void; passkeyCount: number | null;
    alerts: PriceAlert[]; alertStatuses: Record<string, AlertStatus>; onDeleteAlert: (id: string) => void; onSaveAlert: (alert: PriceAlert) => void; alertHistory: { id: string; alertId: string; title: string; message: string; time: number }[]; onClearHistory: () => void;
    quietHours?: Preferences['quietHours']; onQuietHours: (value: NonNullable<Preferences['quietHours']>) => void; alertCount: number; triggeredCount: number;
};

export default function TopBar(p: Props) {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [settings, setSettings] = useState<'personalizacion' | 'cuenta' | 'notificaciones' | 'integracion' | null>(() => window.location.pathname.replace(/\/+$/, '') === '/espacio' ? 'personalizacion' : null);
    const [notifications, setNotifications] = useState<{ x: number; y: number } | null>(null);
    const [manageAlerts, setManageAlerts] = useState(false);
    const closeNotifications = useCallback(() => setNotifications(null), []);
    const [appearance, setAppearance] = useState(false);
    const [sharing, setSharing] = useState(false);
    const closeMenu = useCallback(() => setMenu(null), []);
    const more = useRef<HTMLButtonElement>(null);
    const openMenu = () => { const r = more.current!.getBoundingClientRect(); setMenu({ x: r.right - 230, y: r.bottom + 8 }); };
    useEffect(() => {
        const onNavigate = () => {
            if (window.location.pathname.replace(/\/+$/, '') === '/espacio') setSettings(current => current ?? 'personalizacion');
            else { setSettings(null); setAppearance(false); setManageAlerts(false); }
        };
        window.addEventListener('popstate', onNavigate);
        return () => window.removeEventListener('popstate', onNavigate);
    }, []);
    const openSettings = (section: 'personalizacion' | 'cuenta' | 'notificaciones' | 'integracion') => {
        if (window.location.pathname !== '/espacio') {
            window.history.pushState({ espacioFrom: `${window.location.pathname}${window.location.search}${window.location.hash}` }, '', '/espacio');
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        setSettings(section);
    };
    useEffect(() => { const open = () => { openSettings('notificaciones'); setManageAlerts(true); }; window.addEventListener('open-alert-settings', open); return () => window.removeEventListener('open-alert-settings', open); }, []);
    useEffect(() => { const open = () => openSettings('integracion'); window.addEventListener('open-mcp-settings', open); return () => window.removeEventListener('open-mcp-settings', open); }, []);
    const closeSettings = () => {
        const from = window.history.state?.espacioFrom;
        const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/espacio') ? from : '/';
        window.history.replaceState(null, '', destination);
        window.dispatchEvent(new PopStateEvent('popstate'));
        setSettings(null); setManageAlerts(false);
    };
    return <header className="topbar">
        <div className="brand">
            <img src="/icon.png" alt="Activos Logo" className="brand-logo" />
            <span>
                alza<span className="text-[var(--sig)]">.</span>
            </span>
        </div>
        <nav className="navpills" aria-label="Navegación principal">
            {(Object.keys(pages) as PageId[]).map(id => <PageLink key={id} page={id} className={id === 'summary' ? 'nav-summary' : id === 'evolution' ? 'nav-evolution' : id === 'inflation' ? 'nav-inflation' : id === 'investments' ? 'nav-investments' : id === 'goals' ? 'nav-goals' : id === 'prices' ? 'nav-prices' : id === 'marketCalendar' ? 'nav-calendar' : id === 'dividends' ? 'nav-dividends' : id === 'imports' ? 'nav-imports' : undefined} aria-current={p.page === id ? 'page' : undefined} aria-label={id === 'investments' ? `${pages[id].label}, ${p.count}` : pages[id].label}><PageIcon page={id} size={15} active={p.page === id} /><span className="navpills-label" aria-hidden="true"><span>{pages[id].label}{id === 'investments' && <i>{p.count}</i>}</span></span></PageLink>)}
        </nav>
        <div className="spacer flex-1" />
        <div className="acts flex items-center gap-2">

            <button type="button" className="ibtn white" onClick={p.onAdd} aria-label="Nueva inversión" title="Nueva inversión"><HugeiconsIcon icon={PlusIcon} size={18} /></button>
            <button type="button" className="ibtn header-search" onClick={p.onSearch} aria-label="Buscar activos" title="Buscar activos"><span className="header-search-icon" aria-hidden="true"><HugeiconsIcon icon={Search01Icon} size={18} /><span className="header-search-dollar">$</span></span></button>

            <button type="button" className="ibtn relative header-notifications" aria-label="Notificaciones" aria-haspopup="menu" aria-expanded={!!notifications} onClick={event => { const r = event.currentTarget.getBoundingClientRect(); setNotifications(current => current ? null : { x: r.right - 340, y: r.bottom + 8 }); }}>{<HugeiconsIcon icon={Notification01Icon} size={18} />}{p.alertHistory.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--sig)]" />}</button>
            <button ref={more} type="button" className="ibtn header-menu" aria-haspopup="menu" aria-expanded={!!menu} aria-label="Más opciones" onClick={() => menu ? setMenu(null) : openMenu()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path className="header-menu-top" d="M4 8h16" /><path className="header-menu-bottom" d="M4 16h10" /></svg></button>
        </div>
        {menu && <ContextMenu x={menu.x} y={menu.y} title={`${p.email} · ${p.syncLabel}`} onClose={closeMenu} currency={{ value: p.display, onChange: p.onDisplay }} items={[
            { label: p.hidden ? 'Mostrar montos' : 'Ocultar montos', visibilityHidden: p.hidden, onSelect: p.onHidden },
            { label: 'Buscar activos', icon: Search01Icon, searchIcon: true, onSelect: p.onSearch, hint: '/' },
            ...(isTauriApp ? [{ label: 'Widgets de escritorio', icon: DashboardSquare02Icon, onSelect: () => window.dispatchEvent(new Event('open-desktop-widgets')) }] : []),
            { label: 'Compartir página', icon: Share08Icon, shareIcon: true, onSelect: () => setSharing(true) },
            { sep: true },
            { label: 'Tu espacio', spaceIcon: true, onSelect: () => openSettings('personalizacion') },
            { label: 'Cuenta', accountIcon: true, onSelect: () => openSettings('cuenta') },
            { label: 'Notificaciones', notificationIcon: true, onSelect: () => openSettings('notificaciones') },
            { sep: true },
            { label: p.leaving ? 'Cerrando sesión…' : 'Cerrar sesión', logoutIcon: true, onSelect: p.onLogout, danger: true },
        ]} />}
        {notifications && <NotificationsMenu x={notifications.x} y={notifications.y} items={p.alertHistory} onClose={closeNotifications} onClear={p.onClearHistory} onOpen={() => { openSettings('notificaciones'); setManageAlerts(true); }} />}
        {sharing && <ShareDialog onClose={() => setSharing(false)} />}
        {settings && !manageAlerts && !appearance && !p.customizing && !p.spaceSubscreen && <SettingsDialog initial={settings} manageAlerts={manageAlerts} onManageAlerts={setManageAlerts} alerts={p.alerts} alertStatuses={p.alertStatuses} onDeleteAlert={p.onDeleteAlert} onSectionChange={setSettings} onClose={closeSettings} onAppearance={() => setAppearance(true)} onCustomize={p.onCustomize} onPasskey={p.onPasskey} passkeyCount={p.passkeyCount} onMailSettings={p.onMailSettings} onExport={p.onExport} onImport={p.onImport} quietHours={p.quietHours} onQuietHours={p.onQuietHours} alertCount={p.alertCount} triggeredCount={p.triggeredCount} />}
        {settings && manageAlerts && !appearance && !p.spaceSubscreen && <div className="settings-subscreen settings-subscreen-narrow fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="alerts-management-title" className="card w-full max-w-md overflow-y-auto p-6 shadow-2xl"><AlertsManagement alerts={p.alerts} statuses={p.alertStatuses} onDelete={p.onDeleteAlert} onSave={p.onSaveAlert} onBack={() => setManageAlerts(false)} /></section></div>}
        {appearance && <AppearanceDialog theme={p.theme} onTheme={p.onTheme} onClose={() => setAppearance(false)} />}
    </header>;
}
