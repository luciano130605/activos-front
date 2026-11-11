import { useCallback, useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusIcon, Search01Icon, Share08Icon, Notification01Icon, DashboardSquare02Icon, MoreHorizontalIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
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

const mobileMainPages: { id: PageId; label: string }[] = [
    { id: 'summary', label: 'Resumen' },
    { id: 'investments', label: 'Cartera' },
    { id: 'prices', label: 'Precios' },
    { id: 'evolution', label: 'Evolución' },
];

const mobileExtraPages: { id: PageId; label: string }[] = [
    { id: 'goals', label: 'Objetivos' },
    { id: 'dividends', label: 'Dividendos' },
    { id: 'marketCalendar', label: 'Calendario' },
    { id: 'inflation', label: 'Inflación' },
    { id: 'imports', label: 'Importar' },
];

export default function TopBar(p: Props) {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [mobileMore, setMobileMore] = useState(false);
    const [settings, setSettings] = useState<'personalizacion' | 'cuenta' | 'notificaciones' | 'integracion' | null>(() => window.location.pathname.replace(/\/+$/, '') === '/espacio' ? 'personalizacion' : null);
    const [notifications, setNotifications] = useState<{ x: number; y: number } | null>(null);
    const [manageAlerts, setManageAlerts] = useState(false);
    const closeNotifications = useCallback(() => setNotifications(null), []);
    const [appearance, setAppearance] = useState(false);
    const [sharing, setSharing] = useState(false);
    const closeMenu = useCallback(() => setMenu(null), []);
    const more = useRef<HTMLButtonElement>(null);
    const openMenu = () => { const r = more.current!.getBoundingClientRect(); setMenu({ x: Math.min(window.innerWidth - 240, Math.max(12, r.right - 230)), y: r.bottom + 8 }); };
    
    useEffect(() => {
        const onNavigate = () => {
            if (window.location.pathname.replace(/\/+$/, '') === '/espacio') setSettings(current => current ?? 'personalizacion');
            else { setSettings(null); setAppearance(false); setManageAlerts(false); setMobileMore(false); }
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
        setMobileMore(false);
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

    const isExtraPage = mobileExtraPages.some(item => item.id === p.page);

    return <>
        <header className="topbar w-full max-w-full flex items-center justify-between gap-3 overflow-hidden">
            {/* Marca */}
            <div className="brand select-none shrink-0">
                <img src="/icon.png" alt="Activos Logo" className="brand-logo shadow-xs" />
                <span>
                    alza<span className="text-[var(--sig)]">.</span>
                </span>
            </div>

            {/* Navegación Desktop: Píldoras centradas sin scroll */}
            <nav className="navpills hidden md:flex items-center shrink-0" aria-label="Navegación principal">
                {(Object.keys(pages) as PageId[]).map(id => (
                    <PageLink
                        key={id}
                        page={id}
                        className={id === 'summary' ? 'nav-summary' : id === 'evolution' ? 'nav-evolution' : id === 'inflation' ? 'nav-inflation' : id === 'investments' ? 'nav-investments' : id === 'goals' ? 'nav-goals' : id === 'prices' ? 'nav-prices' : id === 'marketCalendar' ? 'nav-calendar' : id === 'dividends' ? 'nav-dividends' : id === 'imports' ? 'nav-imports' : undefined}
                        aria-current={p.page === id ? 'page' : undefined}
                        aria-label={id === 'investments' ? `${pages[id].label}, ${p.count}` : pages[id].label}
                    >
                        <PageIcon page={id} size={15} active={p.page === id} />
                        <span className="navpills-label" aria-hidden="true">
                            <span>{pages[id].label}{id === 'investments' && p.count > 0 && <i>{p.count}</i>}</span>
                        </span>
                    </PageLink>
                ))}
            </nav>

            {/* Acciones Rápidas */}
            <div className="acts flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                    type="button"
                    className="btn-primary !min-h-9 !px-3 sm:!px-4 !text-xs !rounded-xl !bg-[var(--pbg)] !text-[var(--on-pbg)] font-medium"
                    onClick={p.onAdd}
                    aria-label="Nueva inversión"
                    title="Nueva inversión"
                >
                    <HugeiconsIcon icon={PlusIcon} size={16} />
                    <span className="hidden sm:inline">Invertir</span>
                </button>

                <button
                    type="button"
                    className="ibtn header-search"
                    onClick={p.onSearch}
                    aria-label="Buscar activos"
                    title="Buscar activos (/)"
                >
                    <span className="header-search-icon" aria-hidden="true">
                        <HugeiconsIcon icon={Search01Icon} size={17} />
                        <span className="header-search-dollar">$</span>
                    </span>
                </button>

                <button
                    type="button"
                    className="ibtn relative header-notifications"
                    aria-label="Notificaciones"
                    aria-haspopup="menu"
                    aria-expanded={!!notifications}
                    onClick={event => {
                        const r = event.currentTarget.getBoundingClientRect();
                        setNotifications(current => current ? null : { x: Math.max(12, r.right - 340), y: r.bottom + 8 });
                    }}
                >
                    <HugeiconsIcon icon={Notification01Icon} size={17} />
                    {p.alertHistory.length > 0 && (
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--sig)] shadow-[0_0_8px_var(--sig)]" />
                    )}
                </button>

                <button
                    ref={more}
                    type="button"
                    className="ibtn header-menu"
                    aria-haspopup="menu"
                    aria-expanded={!!menu}
                    aria-label="Más opciones"
                    onClick={() => menu ? setMenu(null) : openMenu()}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                        <path className="header-menu-top" d="M4 8h16" />
                        <path className="header-menu-bottom" d="M4 16h10" />
                    </svg>
                </button>
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
            {settings && manageAlerts && !appearance && !p.spaceSubscreen && <div className="appearance-overlay settings-subscreen settings-subscreen-narrow" onMouseDown={event => { if (event.target === event.currentTarget) setManageAlerts(false); }}><section role="dialog" aria-modal="true" aria-labelledby="alerts-management-title" className="settings-dialog flex !w-[min(460px,100%)] flex-col !overflow-hidden px-5 pt-5 pb-[max(8px,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6"><AlertsManagement alerts={p.alerts} statuses={p.alertStatuses} onDelete={p.onDeleteAlert} onSave={p.onSaveAlert} onBack={() => setManageAlerts(false)} /></section></div>}
            {appearance && <AppearanceDialog theme={p.theme} onTheme={p.onTheme} onClose={() => setAppearance(false)} />}
        </header>

        {/* ───────── Barra de Navegación Móvil (Bottom Dock) ───────── */}
        <nav
            aria-label="Navegación móvil"
            className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 z-40 mx-auto flex max-w-md items-center justify-around rounded-2xl border border-[var(--line2)] bg-[var(--surface)]/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:hidden"
        >
            {mobileMainPages.map(item => {
                const active = p.page === item.id;
                return (
                    <PageLink
                        key={item.id}
                        page={item.id}
                        className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                            active ? 'text-[var(--ink)] font-medium' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                        aria-current={active ? 'page' : undefined}
                    >
                        <div className={`relative grid place-items-center h-8 w-12 rounded-xl transition-all ${active ? 'bg-[var(--raised)] text-[var(--sig)] shadow-xs ring-1 ring-[var(--line2)]' : ''}`}>
                            <PageIcon page={item.id} size={18} active={active} />
                            {item.id === 'investments' && p.count > 0 && (
                                <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sig)] px-1 font-mono text-[9px] font-bold text-[#09090b]">
                                    {p.count}
                                </span>
                            )}
                        </div>
                        <span className="mt-0.5 text-[10px] tracking-tight">{item.label}</span>
                    </PageLink>
                );
            })}

            {/* Botón "Más" para acceder a Objetivos, Dividendos, Calendario, Inflación, Importar */}
            <button
                type="button"
                onClick={() => setMobileMore(true)}
                className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                    isExtraPage ? 'text-[var(--ink)] font-medium' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                aria-label="Más secciones"
                aria-expanded={mobileMore}
            >
                <div className={`grid place-items-center h-8 w-12 rounded-xl transition-all ${isExtraPage ? 'bg-[var(--raised)] text-[var(--sig)] shadow-xs ring-1 ring-[var(--line2)]' : ''}`}>
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                    {isExtraPage && (
                        <span className="absolute -top-0.5 right-2 h-1.5 w-1.5 rounded-full bg-[var(--sig)]" />
                    )}
                </div>
                <span className="mt-0.5 text-[10px] tracking-tight">Más</span>
            </button>
        </nav>

        {/* Modal / Bottom Sheet para secciones extendidas en móvil */}
        {mobileMore && (
            <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
                onMouseDown={e => { if (e.target === e.currentTarget) setMobileMore(false); }}
            >
                <div className="w-full max-w-sm rounded-3xl border border-[var(--line2)] bg-[var(--surface)] p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
                    <div className="h-1 w-10 rounded-full bg-[var(--line2)] mx-auto mb-3" />
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                        <span className="lb">MÁS SECCIONES</span>
                        <button
                            type="button"
                            onClick={() => setMobileMore(false)}
                            aria-label="Cerrar menú"
                            className="rounded-lg p-1 text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={18} />
                        </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {mobileExtraPages.map(item => {
                            const active = p.page === item.id;
                            return (
                                <PageLink
                                    key={item.id}
                                    page={item.id}
                                    onClick={() => setMobileMore(false)}
                                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                                        active
                                            ? 'border-[var(--sig)] bg-[var(--sigbg)] text-[var(--sig)] font-semibold'
                                            : 'border-[var(--line)] bg-[var(--raised)] text-[var(--ink)] hover:border-[var(--line2)]'
                                    }`}
                                >
                                    <PageIcon page={item.id} size={17} active={active} />
                                    <span>{item.label}</span>
                                </PageLink>
                            );
                        })}
                    </div>

                    <div className="mt-4 border-t border-[var(--line)] pt-3 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => { setMobileMore(false); openSettings('personalizacion'); }}
                            className="btn-ghost flex-1 text-xs"
                        >
                            Tu Espacio
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMobileMore(false); openSettings('cuenta'); }}
                            className="btn-ghost flex-1 text-xs"
                        >
                            Mi Cuenta
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>;
}
