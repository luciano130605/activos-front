import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';

export default function ShareDialog({ onClose }: { onClose: () => void }) {
    const dialog = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const [message, setMessage] = useState('');
    const url = `${window.location.origin}/`;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => previous?.focus({ preventScroll: true });
    }, []);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setMessage('Enlace copiado');
        } catch {
            input.current?.focus(); input.current?.select();
            setMessage('Seleccioná y copiá el enlace.');
        }
    };
    const share = async () => {
        try {
            await navigator.share({ title: 'Alza', text: 'Conocé Alza, un espacio para seguir tus inversiones.', url });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            setMessage('No se pudo abrir el menú para compartir. Podés copiar el enlace.');
        }
    };
    return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="share-title" className="w-full max-w-[430px] overflow-y-auto rounded-[24px] border border-[var(--line2)] bg-[var(--surface)] p-5 shadow-2xl sm:p-6" style={{ maxHeight: '90dvh' }} onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
            if (event.key === 'Tab') {
                const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
                if (!elements.length) return;
                if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus(); }
                else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus(); }
            }
        }}>
            <div className="flex items-start justify-between gap-3"><div><p className="lb">COMPARTIR ALZA</p><h2 id="share-title" className="mt-2 text-[22px] font-light tracking-tight">Compartí algo bueno<span className="sig">.</span></h2><p className="mu mt-2 text-[12px] leading-5">Invitá a alguien a seguir sus inversiones en un solo lugar.</p></div><button type="button" onClick={onClose} aria-label="Cerrar" className="ibtn shrink-0"><X size={17}/></button></div>
            <div className="mt-5 rounded-2xl border border-[var(--line2)] bg-[var(--raised)] p-4"><div className="flex items-center gap-3"><img src="/icon.png" alt="" className="h-11 w-11 rounded-xl"/><div><p className="text-[16px] font-medium">alza<span className="sig">.</span></p><p className="mu mt-0.5 text-[11px]">Tus inversiones, más claras.</p></div></div><label htmlFor="share-url" className="mu mt-5 block text-[10px] uppercase tracking-wider">Enlace de la página</label><div className="mt-2 flex items-center gap-2"><input id="share-url" ref={input} value={url} readOnly onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--muted)] outline-none"/><button type="button" onClick={() => void copy()} className="ibtn shrink-0" aria-label="Copiar enlace" title="Copiar enlace">{message === 'Enlace copiado' ? <Check size={17}/> : <Copy size={17}/>}</button></div></div>
            <p role="status" className="mu mt-3 min-h-4 text-[11px]">{message}</p>
            <div className="mt-3 flex gap-2"><button type="button" onClick={() => void copy()} className="btn-ghost flex-1 justify-center"><Copy size={15}/> Copiar enlace</button>{typeof navigator.share === 'function' && <button type="button" onClick={() => void share()} className="btn-primary flex-1 justify-center"><Share2 size={15}/> Compartir</button>}</div>
        </div>
    </div>;
}
