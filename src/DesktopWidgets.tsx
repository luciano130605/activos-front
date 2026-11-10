import { useEffect, useState } from 'react';
import { isTauriApp, request, type Account } from './account';
import type { Investment, Kind } from './portfolio';
import './Widgets.css';

type WidgetKind = 'market' | 'portfolio' | 'dollar' | 'asset';
type AssetKind = Exclude<Kind, 'rate'>;
type TauriAPI = NonNullable<Window['__TAURI__']>;

export default function DesktopWidgets() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Investment[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState('');
    useEffect(() => {
        const show = () => { setOpen(true); setError(''); };
        window.addEventListener('open-desktop-widgets', show);
        return () => window.removeEventListener('open-desktop-widgets', show);
    }, []);
    useEffect(() => {
        if (!open) return;
        let active = true; setBusy(true);
        request<Account>('session').then(account => {
            if (active) { setItems(account.portfolio.investments.filter(item => item.coin)); setSelected(account.portfolio.investments.find(item => item.coin)?.id ?? ''); }
        }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los activos.'); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [open]);
    const launch = async (widget: WidgetKind, item?: Investment) => {
        const tauri = window.__TAURI__ as TauriAPI | undefined;
        if (!tauri) return;
        setBusy(true); setError('');
        try { await tauri.core.invoke('open_widget', { widget, ...(item ? { kind: item.kind as AssetKind, id: item.coin } : {}) }); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir el widget.'); }
        finally { setBusy(false); }
    };
    if (!isTauriApp || !open) return null;
    const chosen = items.find(item => item.id === selected);
    return <div className="widget-launch-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section className="widget-launch-dialog" role="dialog" aria-modal="true" aria-labelledby="widget-launch-title">
        <button type="button" className="widget-launch-close" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button><p className="widget-eyebrow">ACTIVOS · ESCRITORIO</p><h2 id="widget-launch-title">Abrí un widget</h2><p className="widget-launch-description">Dejá a la vista tus cotizaciones, tu cartera o un activo.</p>
        <div className="widget-launch-buttons"><button disabled={busy} onClick={() => void launch('market')}>Mercado<span>Activos de tu cartera</span></button><button disabled={busy} onClick={() => void launch('portfolio')}>Mi cartera<span>Patrimonio y rendimiento</span></button><button disabled={busy} onClick={() => void launch('dollar')}>Dólares<span>MEP y cotizaciones disponibles</span></button></div>
        <div className="widget-launch-asset"><label htmlFor="widget-asset-choice">Activo individual</label><div><select id="widget-asset-choice" value={selected} onChange={event => setSelected(event.target.value)} disabled={busy || !items.length}><option value="">{busy ? 'Cargando activos…' : 'Elegí un activo de tu cartera'}</option>{items.map(item => <option value={item.id} key={item.id}>{item.name} · {item.coin}</option>)}</select><button disabled={busy || !chosen} onClick={() => chosen && void launch('asset', chosen)}>Abrir</button></div></div>
        {error && <p className="widget-launch-error" role="alert">{error}</p>}
    </section></div>;
}
