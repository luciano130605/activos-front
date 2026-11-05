import { useEffect, useState } from 'react';
import { request } from './account';
import Select from './Select';

type Settings = { enabled: boolean; frequency: 'daily' | 'weekly'; time: string; day: number; channels: 'push' | 'telegram' | 'both' };
const initial: Settings = { enabled: false, frequency: 'daily', time: '09:00', day: 1, channels: 'both' };
const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function ScheduledSummarySettings() {
    const [settings, setSettings] = useState<Settings>(initial), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    useEffect(() => { let active = true; request<{ settings: Settings }>('summaries').then(data => { if (active) setSettings(data.settings); }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'No se pudo cargar la configuración.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    async function save() {
        setBusy(true); setMessage('');
        try { const data = await request<{ settings: Settings }>('summaries', 'PUT', settings); setSettings(data.settings); setMessage(data.settings.enabled ? 'Resumen programado. Activá los canales elegidos en esta pantalla para recibirlo.' : 'Resumen programado desactivado.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el resumen.'); }
        finally { setBusy(false); }
    }
    return <form className="settings-channel" onSubmit={event => { event.preventDefault(); void save(); }}><div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-medium">Resumen programado</p><p className="mu mt-2 text-[11px] leading-5">Recibí el valor de tu cartera, su cambio desde el resumen anterior y próximos dividendos. El cambio puede incluir aportes o retiros.</p></div><input type="checkbox" aria-label="Activar resumen programado" checked={settings.enabled} disabled={loading || busy} onChange={event => { setSettings({ ...settings, enabled: event.target.checked }); setMessage(''); }} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="mu mb-1 text-[11px]">Frecuencia</p><Select label="Frecuencia del resumen" value={settings.frequency} disabled={loading || busy} onChange={frequency => setSettings({ ...settings, frequency })} options={[{ value: 'daily', label: 'Todos los días' }, { value: 'weekly', label: 'Una vez por semana' }]} /></div>{settings.frequency === 'weekly' && <div><p className="mu mb-1 text-[11px]">Día</p><Select label="Día del resumen" value={String(settings.day)} disabled={loading || busy} onChange={value => setSettings({ ...settings, day: Number(value) })} options={weekdays.map((label, value) => ({ value: String(value), label }))} /></div>}<label className="mu text-[11px]">Horario (Argentina)<input required type="time" value={settings.time} disabled={loading || busy} onChange={event => setSettings({ ...settings, time: event.target.value })} className="settings-time mt-1 block w-full" /></label><div><p className="mu mb-1 text-[11px]">Recibir por</p><Select label="Canal del resumen" value={settings.channels} disabled={loading || busy} onChange={channels => setSettings({ ...settings, channels })} options={[{ value: 'both', label: 'Push y Telegram' }, { value: 'push', label: 'Solo push' }, { value: 'telegram', label: 'Solo Telegram' }]} /></div></div>
        <p className="mu mt-3 text-[11px] leading-5">Activá push en cada dispositivo o conectá Telegram arriba. Se respeta el horario de no molestar; el envío puede demorarse unos minutos.</p><button type="submit" className="btn-ghost mt-3 !min-h-10 text-[12px]" disabled={loading || busy}>{busy ? 'Guardando…' : 'Guardar resumen'}</button>{message && <p role="status" className="mu mt-2 text-[11px]">{message}</p>}
    </form>;
}
