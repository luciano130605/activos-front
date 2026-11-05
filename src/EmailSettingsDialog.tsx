import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ChevronLeftIcon, CopyCheckIcon, CopyIcon, Mail01Icon } from '@hugeicons/core-free-icons';
import { request } from './account';

type Gmail = { configured: boolean; connected: boolean; email: string | null };
type Mailbox = { configured: boolean; address?: string };
export default function EmailSettingsDialog({ onClose, returnToSpace = false }: { onClose: () => void; returnToSpace?: boolean }) {
    const dialog = useRef<HTMLDivElement>(null);
    const [gmail, setGmail] = useState<Gmail | null>(null);
    const [mailbox, setMailbox] = useState<Mailbox | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
        let active = true;
        void Promise.allSettled([request<Gmail>('imports/gmail'), request<Mailbox>('imports/resend')]).then(([g, m]) => {
            if (!active) return;
            setGmail(g.status === 'fulfilled' ? g.value : { configured:false, connected:false, email:null });
            setMailbox(m.status === 'fulfilled' ? m.value : { configured:false });
        });
        return () => { active = false; previous?.focus({ preventScroll:true }); };
    }, []);
    async function connect() {
        setBusy(true); setMessage('');
        try { const result = await request<{url:string}>('imports/gmail/start', 'POST'); window.location.assign(result.url); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo conectar Gmail.'); setBusy(false); }
    }
    async function disconnect() {
        setBusy(true); setMessage('');
        try { await request('imports/gmail', 'POST'); setGmail(current => current ? { ...current, connected:false, email:null } : current); setMessage('Gmail desconectado.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo desconectar Gmail.'); } finally { setBusy(false); }
    }
    async function copy() {
        if (!mailbox?.address) return;
        try { await navigator.clipboard.writeText(mailbox.address); setMessage(''); setCopied(true); }
        catch { setMessage('No se pudo copiar. Seleccioná la dirección para copiarla.'); }
    }
    return <div className="settings-subscreen settings-subscreen-narrow fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="email-settings-title" className="max-h-[90dvh] w-full max-w-[500px] overflow-y-auto rounded-t-[24px] border border-[var(--line2)] bg-[var(--surface)] p-5 shadow-2xl sm:rounded-[24px] sm:p-6" onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
            if (event.key !== 'Tab') return;
            const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
            if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
            else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
        }}>
            <div className="flex items-start justify-between gap-3"><div><p className="lb">CONFIGURACIÓN</p><h2 id="email-settings-title" className="mt-2 text-[22px] font-light tracking-tight">Correos y comprobantes<span className="sig">.</span></h2><p className="mu mt-2 text-[12px] leading-5">Conectá tu correo o reenviá comprobantes para revisarlos en Importar.</p></div>{returnToSpace ? <button type="button" className="btn-ghost shrink-0" onClick={onClose}><span aria-hidden="true"><HugeiconsIcon icon={ChevronLeftIcon} size={20}/> </span></button> : <button type="button" className="ibtn shrink-0" aria-label="Cerrar" onClick={onClose}><HugeiconsIcon icon={Cancel01Icon} size={17} /></button>}</div>
            <section className="mt-5 rounded-2xl border border-[var(--line2)] bg-[var(--raised)] p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line2)] bg-[var(--surface)]"><HugeiconsIcon icon={Mail01Icon} size={19} /></span><div><h3 className="text-[14px] font-medium">Gmail</h3><p className="mu mt-1 text-[11px]">{!gmail ? 'Consultando conexión…' : gmail.connected ? 'Conectado' : gmail.configured ? 'Sin conectar' : 'No configurado'}</p></div></div><p className="mu mt-3 text-[12px] leading-5">Buscá comprobantes directamente en tu bandeja. Google solicita acceso de solo lectura.</p>{gmail?.connected && <p className="mt-3 break-all text-[12px]">{gmail.email}</p>}{gmail?.configured && <button type="button" disabled={busy} onClick={() => void (gmail.connected ? disconnect() : connect())} className="btn-ghost mt-3 disabled:opacity-50">{busy ? 'Procesando…' : gmail.connected ? 'Desconectar Gmail' : 'Conectar Gmail'}</button>}</section>
            <section className="mt-3 rounded-2xl border border-[var(--line2)] bg-[var(--raised)] p-4"><h3 className="text-[14px] font-medium">Reenviar comprobantes</h3><p className="mu mt-2 text-[12px] leading-5">Reenviá tus correos a tu dirección personal de Alza y después buscalos en Importar.</p>{mailbox?.configured && mailbox.address ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><span className="min-w-0 flex-1 break-all font-mono text-[11px]">{mailbox.address}</span><button type="button" className="ibtn !h-9 !w-9 shrink-0" onClick={() => void copy()} aria-label={copied ? 'Dirección copiada' : 'Copiar dirección'} title={copied ? 'Dirección copiada' : 'Copiar dirección'}><HugeiconsIcon icon={copied ? CopyCheckIcon : CopyIcon} size={17} /></button></div> : <p className="mu mt-3 text-[11px]">{mailbox ? 'La recepción de correos no está configurada.' : 'Consultando dirección…'}</p>}</section>
            <p role="status" className="mu mt-3 text-[12px]">{message}</p>
        </div>
    </div>;
}
