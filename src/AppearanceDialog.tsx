import { useEffect, useRef } from 'react';

type Theme = 'dark' | 'light' | 'system';

export default function AppearanceDialog({ theme, resolvedTheme, onTheme, onClose }: { theme: Theme; resolvedTheme: 'dark' | 'light'; onTheme: (theme: Theme) => void; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
            if (event.key !== 'Tab') return;
            const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button');
            if (!buttons?.length) return;
            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
        };
        document.addEventListener('keydown', keydown);
        return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
    }, []);
    return <div className="appearance-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={ref} className="appearance-dialog" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
            <header className="appearance-header"><div><p className="lb">TU ESPACIO</p><h2 id="appearance-title">Apariencia</h2><p>Elegí cómo querés ver tu cartera.</p></div><button type="button" className="ibtn" aria-label="Cerrar apariencia" onClick={onClose}>✕</button></header>
            <div className="appearance-body">
                <div className="appearance-preview" aria-hidden="true"><div className="appearance-device" data-preview-theme={resolvedTheme}><div className="preview-top"><span className="preview-logo">a.</span><span className="preview-nav"/><span className="preview-dot"/></div><div className="preview-content"><div className="preview-caption">MI CARTERA</div><div className="preview-title">Tu resumen</div><div className="preview-card"><span>VALOR TOTAL</span><strong>$ 24.580,00</strong><small>↗ +8,42% este mes</small><div className="preview-chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="preview-cards"><div/><div/><div/></div></div></div></div>
                <div className="appearance-options"><p className="lb">TEMA</p><p className="appearance-description">El cambio se aplica al instante.</p><div role="group" aria-label="Tema de apariencia" className="appearance-choices">{([{ id: 'light', icon: '☀', label: 'Claro', detail: 'Una vista luminosa' }, { id: 'dark', icon: '☾', label: 'Oscuro', detail: 'Suave para tus ojos' }, { id: 'system', icon: '◐', label: 'Sistema', detail: 'Se adapta a tu dispositivo' }] as const).map(option => <button type="button" key={option.id} aria-pressed={theme === option.id} onClick={() => onTheme(option.id)}><span className="appearance-icon">{option.icon}</span><span className="appearance-choice-text"><strong>{option.label}</strong><small>{option.detail}</small></span><span className="appearance-radio" aria-hidden="true" /></button>)}</div></div>
            </div>
        </div>
    </div>;
}
