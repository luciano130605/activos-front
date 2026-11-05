import { useEffect, useState } from 'react';
import { request } from './account';

function keyBytes(value: string): Uint8Array<ArrayBuffer> {
    const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(bytes, character => character.charCodeAt(0));
}

export async function enableDividendPush(test = false, alertId?: string) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !window.isSecureContext) throw new Error('Este navegador no admite notificaciones push en esta página. En iPhone o iPad, agregá Alza a la pantalla de inicio y abrila desde ahí.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permití las notificaciones en la configuración del navegador para recibir avisos.');
    const { publicKey } = await request<{ publicKey: string }>('push/config');
    const registration = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        const existing = subscription.options.applicationServerKey;
        const expected = keyBytes(publicKey);
        if (!existing || new Uint8Array(existing).length !== expected.length || !new Uint8Array(existing).every((byte, index) => byte === expected[index])) { await subscription.unsubscribe(); subscription = null; }
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    await request('push/subscribe', 'POST', subscription.toJSON());
    if (test) await request('push/test', 'POST', { endpoint: subscription.endpoint, ...(alertId ? { alertId } : {}) });
}

export default function DividendPushSettings() {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [enabled, setEnabled] = useState<boolean | null>(null);
    useEffect(() => {
        let active = true;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setEnabled(false); return; }
        void navigator.serviceWorker.getRegistration('/').then(async registration => {
            const subscription = await registration?.pushManager.getSubscription();
            const result = subscription ? await request<{ enabled: boolean }>('push/status', 'POST', { endpoint: subscription.endpoint }) : { enabled: false };
            if (active) setEnabled(result.enabled);
        }).catch(() => { if (active) setEnabled(null); });
        return () => { active = false; };
    }, []);
    async function activate(test: boolean) {
        setBusy(true); setMessage('');
        try {
            await enableDividendPush(test);
            setEnabled(true);
            if (test) { setMessage('Prueba enviada. Revisá las notificaciones de este dispositivo.'); }
            else setMessage('Notificaciones activadas en este dispositivo.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.'); }
        finally { setBusy(false); }
    }
    async function deactivate() {
        setBusy(true); setMessage('');
        try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            const subscription = await registration?.pushManager.getSubscription();
            if (subscription) { await request('push/unsubscribe', 'POST', { endpoint: subscription.endpoint }); await subscription.unsubscribe(); }
            setEnabled(false); setMessage('Notificaciones desactivadas en este dispositivo.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron desactivar las notificaciones.'); }
        finally { setBusy(false); }
    }
    return <div className="mt-4 border-t border-[var(--line)] pt-4">
        <p className="text-[12px] font-medium">Notificaciones en este dispositivo</p>
        <p className="mu mt-1 text-[11px]">Recibí avisos de tus dividendos aunque no tengas Alza abierta. En iPhone o iPad, primero agregá Alza a la pantalla de inicio.</p>
        <p className="mu mt-2 text-[11px]">{enabled === null ? 'Estado no disponible' : enabled ? 'Activadas en este dispositivo' : 'Desactivadas en este dispositivo'}</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void (enabled ? deactivate() : activate(false))} className="btn-ghost text-[12px] disabled:opacity-50">{enabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}</button><button type="button" disabled={busy} onClick={() => void activate(true)} className="btn-ghost text-[12px] disabled:opacity-50">{busy ? 'Preparando…' : 'Enviar prueba'}</button></div>
        {message && <p role="status" className="mu mt-3 text-[11px]">{message}</p>}
    </div>;
}
