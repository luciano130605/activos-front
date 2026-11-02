import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';

export type MenuItem =
    | { sep: true }
    | { label: string; icon?: Parameters<typeof HugeiconsIcon>[0]['icon']; onSelect?: () => void; href?: string; danger?: boolean; hint?: string };

// Menú flotante accesible: clic derecho, botón "⋯" o tecla Menú. Flechas, Inicio/Fin, Esc.
export default function ContextMenu({ x, y, title, items, onClose }: { x: number; y: number; title?: string; items: MenuItem[]; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });
    useLayoutEffect(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        setPos({ left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)) });
    }, [x, y]);
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true });
        const outside = (event: Event) => {
            const target = event.target as Element;
            if (ref.current?.contains(target) || (event.type === 'pointerdown' && target.closest?.('[aria-haspopup="menu"]'))) return; // el botón que lo abre lo cierra
            onClose();
        };
        const close = () => onClose();
        window.addEventListener('pointerdown', outside, true);
        window.addEventListener('contextmenu', outside, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('pointerdown', outside, true);
            window.removeEventListener('contextmenu', outside, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
            if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        };
    }, [onClose]);
    function onKeyDown(event: React.KeyboardEvent) {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []);
        const at = nodes.indexOf(document.activeElement as HTMLElement);
        const go = (index: number) => { event.preventDefault(); nodes[(index + nodes.length) % nodes.length]?.focus(); };
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        else if (event.key === 'ArrowDown') go(at + 1);
        else if (event.key === 'ArrowUp') go(at - 1);
        else if (event.key === 'Home') go(0);
        else if (event.key === 'End') go(nodes.length - 1);
        else if (event.key === 'Tab') { event.preventDefault(); onClose(); }
    }
    return <div ref={ref} role="menu" aria-label={title ?? 'Acciones'} className="ctx" style={pos} onKeyDown={onKeyDown} onContextMenu={event => event.preventDefault()}>
        {title && <p className="ctx-head" title={title}>{title}</p>}
        {items.map((item, index) => 'sep' in item ? <div key={index} className="sep" role="separator" /> :
            item.href ? <a key={item.label} role="menuitem" href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>{item.icon && <HugeiconsIcon icon={item.icon} size={16} />}{item.label}{item.hint && <kbd>{item.hint}</kbd>}</a> :
                <button key={item.label} type="button" role="menuitem" className={item.danger ? 'danger' : undefined} onClick={() => { onClose(); item.onSelect?.(); }}>{item.icon && <HugeiconsIcon icon={item.icon} size={16} />}{item.label}{item.hint && <kbd>{item.hint}</kbd>}</button>)}
    </div>;
}
