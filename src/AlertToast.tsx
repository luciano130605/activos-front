import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

export default function AlertToast({ title, message, onClose, onOpen }: { title: string; message: string; onClose: () => void; onOpen: () => void }) {
    const [leaving, setLeaving] = useState(false);
    const closeRef = useRef(onClose); closeRef.current = onClose;
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closing = useRef(false);
    const dismiss = () => {
        if (closing.current) return;
        closing.current = true;
        setLeaving(true);
        timer.current = setTimeout(() => closeRef.current(), 250);
    };
    useEffect(() => {
        const expiry = setTimeout(dismiss, 9750);
        return () => { clearTimeout(expiry); if (timer.current) clearTimeout(timer.current); };
    }, []);
    return <div role="status" className={`active-alert${leaving ? ' active-alert-leaving' : ''}`}><div className="min-w-0 flex-1"><p className="active-alert-label">{title}</p><p className="active-alert-text">{message}</p><button type="button" className="active-alert-link" onClick={onOpen}>Ver</button></div><button type="button" className="active-alert-close" aria-label="Cerrar aviso de alerta" onClick={dismiss}><HugeiconsIcon icon={Cancel01Icon} size={16} /></button><span className="active-alert-timer" aria-hidden="true" /></div>;
}
