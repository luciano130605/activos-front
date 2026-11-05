import { useEffect, useState } from 'react';
import { request } from './account';

type Status = { configured: boolean; connected: boolean };
export default function TelegramSettings() {
    const [status, setStatus] = useState<Status | null>(null), [link, setLink] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    async function refresh() { const data = await request<Status>('telegram'); setStatus(data); if (data.connected) setLink(''); }
    useEffect(() => { let active = true; const load = () => { void request<Status>('telegram').then(data => { if (active) { setStatus(data); if (data.connected) setLink(''); } }).catch(() => { if (active) setMessage('No se pudo consultar Telegram.'); }); }; load(); const visibility = () => { if (document.visibilityState === 'visible') load(); }; document.addEventListener('visibilitychange', visibility); return () => { active = false; document.removeEventListener('visibilitychange', visibility); }; }, []);
    async function action(kind: 'connect' | 'disconnect' | 'test' | 'refresh') {
        setBusy(true); setMessage('');
        try {
            if (kind === 'connect') { const result = await request<{ url: string }>('telegram/connect', 'POST'); setLink(result.url); setMessage('Abrí Telegram y tocá Iniciar. Luego volvé a esta pantalla.'); }
            if (kind === 'disconnect') { await request('telegram', 'DELETE'); setLink(''); await refresh(); setMessage('Telegram desconectado.'); }
            if (kind === 'test') { await request('telegram/test', 'POST', {}); setMessage('Mensaje de prueba enviado.'); }
            if (kind === 'refresh') { await refresh(); setMessage('Estado actualizado.'); }
        } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
        finally { setBusy(false); }
    }
    return <div className="settings-channel"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[12px] font-medium">Telegram</p><span className="settings-soon">{status?.connected ? 'Conectado' : 'Desconectado'}</span></div><p className="mu mt-2 text-[11px] leading-5">Recibí tus alertas de precio y dividendos en Telegram. Se respeta el horario de no molestar.</p>
        {!status ? <p className="mu mt-3 text-[11px]">Consultando…</p> : !status.configured ? <p className="mu mt-3 text-[11px]">Telegram todavía no está configurado en el servidor.</p> : status.connected ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className="btn-ghost !min-h-10 text-[12px]" onClick={() => void action('test')}>Enviar prueba</button><button type="button" disabled={busy} className="btn-ghost !min-h-10 text-[12px]" onClick={() => void action('disconnect')}>Desconectar</button></div> : <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className="btn-ghost !min-h-10 text-[12px]" onClick={() => void action('connect')}>Conectar Telegram</button>{link && <><a className="btn-primary inline-flex !min-h-10 items-center text-[12px]" href={link} target="_blank" rel="noopener noreferrer">Abrir Telegram</a><button type="button" disabled={busy} className="btn-ghost !min-h-10 text-[12px]" onClick={() => void action('refresh')}>Ya inicié el bot</button></>}</div>}
        {message && <p role="status" className="mu mt-3 text-[11px]">{message}</p>}
    </div>;
}
