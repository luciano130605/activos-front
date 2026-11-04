import { useEffect } from 'react';

// Observa los diálogos reales para mantener el bloqueo mientras quede uno abierto,
// incluso cuando un modal abre otro o se desmonta por un cambio de pantalla.
export default function ModalScrollLock() {
    useEffect(() => {
        const body = document.body;
        let saved: { scrollY: number; position: string; top: string; left: string; right: string; width: string; overflow: string } | null = null;
        const unlock = () => {
            if (!saved) return;
            const previous = saved;
            saved = null;
            Object.assign(body.style, { position: previous.position, top: previous.top, left: previous.left, right: previous.right, width: previous.width, overflow: previous.overflow });
            window.scrollTo({ top: previous.scrollY, behavior: 'instant' });
        };
        const sync = () => {
            const hasModal = Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]'));
            if (!hasModal) { unlock(); return; }
            if (saved) return;
            saved = { scrollY: window.scrollY, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
            Object.assign(body.style, { position: 'fixed', top: `-${saved.scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
        };
        const observer = new MutationObserver(sync);
        observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] });
        sync();
        return () => { observer.disconnect(); unlock(); };
    }, []);
    return null;
}
