import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Notification = { id: string; title: string; message: string; time: number };
export default function NotificationsMenu({ x, y, items, onClose, onOpen, onClear }: { x: number; y: number; items: Notification[]; onClose: () => void; onOpen: () => void; onClear: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: x, top: y });
    useLayoutEffect(() => { const box = ref.current?.getBoundingClientRect(); if (box) setPosition({ left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)) }); }, [x, y]);
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
        const outside = (event: PointerEvent) => { const target = event.target as Element; if (!ref.current?.contains(target) && !target.closest?.('[aria-label="Notificaciones"]')) onClose(); };
        const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
        const resize = () => onClose();
        window.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', keydown); window.addEventListener('resize', resize);
        return () => { window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', keydown); window.removeEventListener('resize', resize); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
    }, [onClose]);
    const open = () => { onClose(); onOpen(); };
    return <div ref={ref} className="notifications-menu" style={position} role="dialog" aria-label="Notificaciones">
        <div className="notifications-head"><div><p>Notificaciones</p><span>{items.length ? `${items.length} ${items.length === 1 ? 'aviso' : 'avisos'}` : 'Tus avisos recientes'}</span></div>{items.length > 0 && <button type="button" onClick={onClear}>Limpiar</button>}</div>
        <div className="notifications-list">{items.length ? items.map(item => <button key={item.id} type="button" className="notification-item" onClick={open}><span className="notification-dot" aria-hidden="true" /><span className="notification-content"><strong>{item.title}</strong><span>{item.message}</span><time dateTime={new Date(item.time).toISOString()}>{new Date(item.time).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></span></button>) : <p className="notifications-empty">Todavía no tenés notificaciones.</p>}</div>
        <button type="button" className="notifications-manage" onClick={open}>Ver y administrar alertas </button>
    </div>;
}
