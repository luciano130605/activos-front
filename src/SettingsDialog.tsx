import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import DividendPushSettings from './DividendPushSettings';
import WalletSettings from './WalletSettings';
import TelegramSettings from './TelegramSettings';
import ScheduledSummarySettings from './ScheduledSummarySettings';
import type { Preferences, PriceAlert } from './portfolio';
import type { AlertStatus } from './usePriceAlerts';

type Section = 'personalizacion' | 'cuenta' | 'notificaciones';
type QuietHours = NonNullable<Preferences['quietHours']>;
type Props = { manageAlerts: boolean; onManageAlerts: (value: boolean) => void; alerts: PriceAlert[]; alertStatuses: Record<string, AlertStatus>; onDeleteAlert: (id: string) => void; initial: Section; onSectionChange: (section: Section) => void; onClose: () => void; onAppearance: () => void; onCustomize: () => void; onPasskey: () => void; passkeyCount: number | null; onAiSettings: () => void; onMailSettings: () => void; onExport: () => void; onImport: () => void; quietHours?: QuietHours; onQuietHours: (value: QuietHours) => void; alertCount: number; triggeredCount: number };
const labels: Record<Section, string> = { personalizacion: 'Personalización', cuenta: 'Cuenta', notificaciones: 'Notificaciones' };

export default function SettingsDialog(p: Props) {
    const [section, setSection] = useState<Section>(p.initial);
    const [quiet, setQuiet] = useState<QuietHours>(p.quietHours ?? { enabled: false, start: '22:00', end: '08:00' });
    const [message, setMessage] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(p.onClose); closeRef.current = p.onClose;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
            if (event.key !== 'Tab') return;
            const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]') ?? []);
            if (!nodes.length) return;
            if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
            else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
        };
        document.addEventListener('keydown', keydown);
        return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
    }, []);
    const action = (fn: () => void) => { p.onClose(); fn(); };
    const row = (title: string, detail: string, fn: () => void, close = true) => <button type="button" className="settings-row" onClick={() => close ? action(fn) : fn()}><span><strong>{title}</strong><small>{detail}</small></span><span aria-hidden="true">›</span></button>;
    return <div className="appearance-overlay settings-screen" onMouseDown={event => { if (event.target === event.currentTarget) p.onClose(); }}>
        <div ref={ref} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header className="settings-header"><div><p className="lb">TU ESPACIO</p><h2 id="settings-title">Configuración</h2></div><button type="button" className="ibtn !h-9 !w-9" onClick={p.onClose} aria-label="Cerrar configuración"><HugeiconsIcon icon={Cancel01Icon} size={18} /></button></header>
            <div className="settings-layout"><nav className="settings-nav" aria-label="Secciones de configuración">{(Object.keys(labels) as Section[]).map(key => <button key={key} type="button" aria-current={section === key ? 'page' : undefined} onClick={() => { setSection(key); p.onSectionChange(key); p.onManageAlerts(false); setMessage(''); }}>{labels[key]}</button>)}</nav>
                <div className="settings-content"><h3>{labels[section]}</h3>
                    {section === 'personalizacion' && <><p className="mu mt-2 text-[12px]">Elegí cómo querés ver tu espacio.</p><div className="settings-rows mt-4">{row('Apariencia', 'Elegí el tema y mirá una vista previa.', p.onAppearance, false)}{row('Personalizar panel', 'Elegí qué mostrar y en qué orden.', p.onCustomize, false)}</div></>}
                    {section === 'cuenta' && <><p className="mu mt-2 text-[12px]">Administrá el acceso y los datos de tu cuenta.</p><div className="settings-rows mt-4">{row('Passkeys y llaves de seguridad', p.passkeyCount === null ? 'Gestioná tus métodos de acceso.' : `${p.passkeyCount} ${p.passkeyCount === 1 ? 'llave registrada' : 'llaves registradas'}.`, p.onPasskey, false)}{row('API Keys', 'Configurá los proveedores de IA.', p.onAiSettings, false)}</div><WalletSettings /></>}
                    {section === 'notificaciones' && !p.manageAlerts && <><p className="mu mt-2 text-[12px]">Administrá los avisos de tu cartera.</p><DividendPushSettings /><div className="settings-channel"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[12px] font-medium">Correo electrónico</p><span className="settings-soon">Avisos próximamente</span></div><p className="mu mt-2 text-[11px]">Próximamente vas a poder recibir alertas por correo. Tu conexión de Gmail y tus comprobantes se administran acá.</p><button type="button" className="btn-ghost mt-3 !min-h-10 text-[12px]" onClick={p.onMailSettings}>Configurar Gmail y comprobantes</button></div><TelegramSettings /><ScheduledSummarySettings /><form className="settings-quiet" onSubmit={event => { event.preventDefault(); if (quiet.enabled && quiet.start === quiet.end) return setMessage('Elegí horarios de inicio y fin diferentes.'); p.onQuietHours(quiet); setMessage('Horario actualizado. Se está guardando en tu cuenta.'); }}><div className="flex items-center justify-between gap-3"><div><p className="text-[12px] font-medium">No molestar</p><p className="mu mt-1 text-[11px]">No se envían avisos automáticos durante este horario · hora argentina.</p></div><input type="checkbox" aria-label="Activar horario de no molestar" checked={quiet.enabled} onChange={event => { setQuiet({ ...quiet, enabled: event.target.checked }); setMessage(''); }} /></div><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-[11px] text-[var(--muted)]">Desde<input type="time" required value={quiet.start} onChange={event => { setQuiet({ ...quiet, start: event.target.value }); setMessage(''); }} className="settings-time" /></label><label className="text-[11px] text-[var(--muted)]">Hasta<input type="time" required value={quiet.end} onChange={event => { setQuiet({ ...quiet, end: event.target.value }); setMessage(''); }} className="settings-time" /></label><button className="btn-ghost !min-h-10 text-[12px]" type="submit">Guardar horario</button></div>{message && <p role="status" className="mu mt-2 text-[11px]">{message}</p>}</form><div className="settings-alerts"><div><p className="text-[12px] font-medium">Alertas de tu cartera</p><p className="mu mt-1 text-[11px]">{p.alertCount} configuradas · {p.triggeredCount} activadas</p></div><button type="button" className="btn-ghost !min-h-10 text-[12px]" onClick={() => p.onManageAlerts(true)}>Ver alertas</button></div></>}
                </div>
            </div>
        </div>
    </div>;
}
