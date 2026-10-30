import { useEffect, useRef, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalculateIcon, ChartLineData01Icon, CoinsBitcoinIcon, DarkModeFreeIcons, DashboardCircleIcon, Download02Icon, LogoutCircle01Icon, PanelLeftCloseFreeIcons, PanelLeftOpenIcon, Search01Icon, Sun03Icon, Upload06Icon, ViewIcon, ViewOffIcon, XIcon } from '@hugeicons/core-free-icons';
import { pages, type PageId } from './navigation';
import PageLink from './PageLink';

type Filter = 'all' | 'rate' | 'cedear' | 'crypto';
type Props = {
    page: PageId;
    collapsed: boolean;
    onToggle: () => void;
    mobile?: boolean;
    onClose: () => void;
    filter: Filter;
    onFilter: (filter: Filter) => void;
    kinds: { id: Filter; label: string; color: string }[];
    count: (filter: Filter) => number;
    theme: 'light' | 'dark';
    onTheme: () => void;
    hidden: boolean;
    onHidden: () => void;
    onSearch: () => void;
    onExport: () => void;
    onImport: () => void;
    email: string;
    syncLabel: string;
    onLogout: () => void;
    leaving: boolean;
};

const iconClass = 'grid h-5 w-5 shrink-0 place-items-center';
const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--muted)]';
const headingClass = 'h-[26px] px-2.5 pb-2 font-mono text-[11px] text-[var(--faint)]';
const kindColors: Record<Filter, string> = {
    all: 'bg-[#929292] ring-[#929292]/15',
    rate: 'bg-[#7f96ff] ring-[#7f96ff]/15',
    cedear: 'bg-[#ff7d52] ring-[#ff7d52]/15',
    crypto: 'bg-[#f5c542] ring-[#f5c542]/15',
};

export default function Sidebar(props: Props) {
    const { page, collapsed, onToggle, mobile, onClose, filter, onFilter, kinds, count, theme, onTheme, hidden, onHidden, onSearch, onExport, onImport } = props;
    const ref = useRef<HTMLElement>(null);
    const compact = collapsed && !mobile;
    const labelClass = `block overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${compact ? 'max-w-0 opacity-0' : 'max-w-[210px] opacity-100'}`;
    const countClass = `ml-auto overflow-hidden font-mono text-[11px] text-[var(--faint)] transition-[max-width,opacity] duration-[280ms] motion-reduce:transition-none ${compact ? 'max-w-0 opacity-0' : 'max-w-12 opacity-100'}`;
    const itemClass = (active = false) => `flex min-h-[41px] w-full items-center rounded-[10px] border px-3 py-2.5 text-left text-[13px] no-underline transition-[color,background-color,gap] duration-[280ms] hover:bg-[var(--raised)] hover:text-[var(--ink)] motion-reduce:transition-none ${focusClass} ${compact ? 'gap-0' : 'gap-2.5'} ${active ? 'border-[var(--line2)] bg-[var(--raised)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)]'}`;
    const icons: Record<PageId, ReactNode> = {
        summary: <HugeiconsIcon icon={DashboardCircleIcon} size={18} fill={page === 'summary' ? 'currentColor' : 'none'} />,
        evolution: <HugeiconsIcon icon={ChartLineData01Icon} size={18} fill={page === 'evolution' ? 'none' : 'none'} />,

        investments: <HugeiconsIcon icon={CoinsBitcoinIcon} size={18} strokeWidth={1.6} fill={page === 'investments' ? 'none' : 'none'} />,
    };

    useEffect(() => {
        if (!mobile) return;
        const opener = document.querySelector<HTMLButtonElement>('button[aria-controls="mobile-navigation"]');
        const alreadyLocked = document.body.classList.contains('overflow-hidden');
        document.body.classList.add('overflow-hidden');
        ref.current?.querySelector<HTMLElement>('button')?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key !== 'Tab') return;
            const focusable = ref.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            if (!focusable?.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        const desktop = window.matchMedia('(min-width: 1024px)');
        const onResize = () => { if (desktop.matches) onClose(); };
        document.addEventListener('keydown', onKeyDown);
        desktop.addEventListener('change', onResize);
        return () => {
            if (!alreadyLocked) document.body.classList.remove('overflow-hidden');
            document.removeEventListener('keydown', onKeyDown);
            desktop.removeEventListener('change', onResize);
            opener?.focus({ preventScroll: true });
        };
    }, [mobile, onClose]);

    function action(label: string, icon: ReactNode, onClick: () => void, pressed?: boolean) {
        return <button type="button" className={itemClass()} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
            <span className={iconClass}>{icon}</span><span className={`${labelClass} flex-1`}>{label}</span>
        </button>;
    }

    return <aside ref={ref} id={mobile ? 'mobile-navigation' : 'desktop-navigation'}
        role={mobile ? 'dialog' : undefined} aria-modal={mobile || undefined} aria-label={mobile ? 'Menú de navegación' : 'Barra lateral'}
        className={`shrink-0 border-r border-[var(--line)] bg-[var(--side)] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${mobile ? 'relative h-full w-[min(280px,85vw)] translate-x-0 transition-transform duration-[240ms] starting:-translate-x-full' : `sticky top-0 hidden h-dvh transition-[width] duration-[280ms] lg:block ${compact ? 'w-[78px]' : 'w-[250px]'}`}`}>
        {mobile ? <button type="button" className={`absolute right-4 top-6 rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)] ${focusClass}`} onClick={onClose} aria-label="Cerrar menú"><HugeiconsIcon icon={XIcon} size={20} /></button> :
            <button type="button" className={`absolute -right-3.5 top-[30px] z-20 grid h-7 w-7 place-items-center rounded-[9px] border border-[var(--line2)] bg-[var(--surface)] text-[var(--muted)] transition-colors duration-[160ms] hover:bg-[var(--raised)] hover:text-[var(--ink)] motion-reduce:transition-none ${focusClass}`} onClick={onToggle} aria-expanded={!collapsed} aria-controls="desktop-navigation" aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'} title={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}>
                {collapsed ? <HugeiconsIcon icon={PanelLeftCloseFreeIcons} size={16} /> : <HugeiconsIcon icon={PanelLeftOpenIcon} size={16} />}
            </button>}
        <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto px-3.5 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0">
            <div className={`mb-8 flex min-h-7 items-center px-2.5 text-[17px] font-medium tracking-[-.025em] ${compact ? 'gap-0' : 'gap-2.5'}`}><img src="/icon.png" alt="" width="28" height="28" className="shrink-0 rounded-lg" /><span className={labelClass}>Inversiones</span></div>
            <p className={headingClass}><span className={labelClass}>GENERAL</span></p>
            <nav className="space-y-1" aria-label="Navegación principal">
                {(Object.keys(pages) as PageId[]).map(id => <PageLink key={id} page={id} className={itemClass(page === id)} aria-current={page === id ? 'page' : undefined} aria-label={pages[id].label} title={pages[id].label}
                    onClick={() => { if (id === 'summary' || id === 'investments') onFilter('all'); onClose(); }}>
                    <span className={iconClass}>{icons[id]}</span><span className={`${labelClass} flex-1`}>{pages[id].label}</span>
                    {(id === 'summary' || id === 'investments') && <span className={countClass}>{count('all')}</span>}
                </PageLink>)}
            </nav>
            <div className="mt-2">{action('Buscar criptomonedas', <HugeiconsIcon icon={Search01Icon} size={18} />, () => { onClose(); onSearch(); })}</div>
            <div className="mx-2 my-5 h-px shrink-0 bg-[var(--line)]" />
            <p className={headingClass}><span className={labelClass}>MI CARTERA</span></p>
            <nav className="space-y-1" aria-label="Filtrar inversiones">
                {kinds.filter(k => k.id !== 'all').map(k => <PageLink key={k.id} page="investments" className={itemClass(page === 'investments' && filter === k.id)}
                    aria-label={k.label} title={k.label} onClick={() => { onFilter(k.id); onClose(); }}>
                    <span className={iconClass}><span className={`h-2 w-2 rounded-full ${kindColors[k.id]} ${page === 'investments' && filter === k.id ? 'ring-4' : ''}`} /></span>
                    <span className={`${labelClass} flex-1`}>{k.label}</span><span className={countClass}>{count(k.id)}</span>
                </PageLink>)}
            </nav>
            <div className="mt-auto pt-6">
                <div className="border-t border-[var(--line)] pt-5">
                    <p className={headingClass}><span className={labelClass}>PREFERENCIAS</span></p>
                    {action(`Tema ${theme === 'dark' ? 'oscuro' : 'claro'}`, <HugeiconsIcon icon={theme === 'dark' ? DarkModeFreeIcons : Sun03Icon} size={18} />, onTheme)}
                    {action(hidden ? 'Mostrar montos' : 'Ocultar montos', <HugeiconsIcon icon={hidden ? ViewOffIcon : ViewIcon} size={18} />, onHidden, hidden)}
                    {action('Exportar datos', <HugeiconsIcon icon={Download02Icon} size={18} />, onExport)}
                    {action('Importar datos', <HugeiconsIcon icon={Upload06Icon} size={18} />, () => { onImport(); onClose(); })}
                    <button type="button" className={itemClass()} disabled={props.leaving} onClick={props.onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><span className={iconClass}><HugeiconsIcon icon={LogoutCircle01Icon} size={18} /></span><span className={labelClass}>{props.leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}</span></button>
                    <div className={`overflow-hidden px-2.5 font-mono text-[10px] leading-5 text-[var(--faint)] transition-[max-height,margin,opacity] duration-[280ms] motion-reduce:transition-none ${compact ? 'mt-0 max-h-0 opacity-0' : 'mt-5 max-h-16 opacity-100'}`}><p className="truncate" title={props.email}>{props.email}</p><p>{props.syncLabel}</p><p>Cotizaciones de terceros.</p></div>
                </div>
            </div>
        </div>
    </aside>;
}
