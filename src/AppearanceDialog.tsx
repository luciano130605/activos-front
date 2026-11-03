import { useEffect, useRef } from 'react';

type Theme = 'dark' | 'light' | 'system';

export default function AppearanceDialog({ theme, onTheme, onClose }: { theme: Theme; onTheme: (theme: Theme) => void; onClose: () => void }) {
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
                <div className="appearance-options"><p className="lb">TEMA</p><p className="appearance-description">El cambio se aplica al instante.</p><div role="group" aria-label="Tema de apariencia" className="appearance-choices">{([{ id: 'light', icon: '☀', label: 'Claro', detail: 'Una vista luminosa' }, { id: 'dark', icon: '☾', label: 'Oscuro', detail: 'Suave para tus ojos' }, { id: 'system', icon: '◐', label: 'Sistema', detail: 'Se adapta a tu dispositivo' }] as const).map(option => <button type="button" key={option.id} aria-pressed={theme === option.id} onClick={() => onTheme(option.id)}><span className="appearance-icon">{option.icon}</span><span className="appearance-choice-text"><strong>{option.label}</strong><small>{option.detail}</small></span><span className="appearance-radio" aria-hidden="true" /></button>)}</div></div>
                <div className="border-t border-[var(--line)] bg-[var(--raised)] p-4 sm:p-6 md:border-l md:border-t-0"><div className="flex items-center justify-between"><p className="lb">VISTA PREVIA</p><span className="mu text-[10px]">Datos de ejemplo</span></div><div aria-hidden="true" className="mx-auto mt-4 max-w-[300px] rounded-[2rem] border-[5px] border-[var(--line2)] bg-[var(--bg)] p-3 shadow-lg transition-colors duration-300 motion-reduce:transition-none md:max-w-none md:rounded-2xl md:border md:p-4 md:shadow-none"><div className="mx-auto mb-4 h-1 w-16 rounded-full bg-[var(--line2)] md:hidden" /><div className="mb-4 flex items-center justify-between"><div><p className="lb !text-[9px]">PANEL PERSONAL / RESUMEN</p><p className="mt-2 text-[20px] font-light">Mi cartera<span className="sig">.</span></p></div><span className="mu text-[10px]">● ● ●</span></div><div className="space-y-2"><div className="h-[86px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors duration-300 motion-reduce:transition-none"><p className="lb !text-[9px]">VALOR ACTUAL</p><p className="mt-2 text-[18px] font-light">$ 1.245.800 <span className="ml-2 text-[10px] text-[var(--sig)]">+12,4%</span></p><div className="mt-2 h-1 w-4/5 rounded-full bg-[var(--line2)]"><div className="h-full w-2/3 rounded-full bg-[var(--sig)]" /></div></div><div className="h-[86px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors duration-300 motion-reduce:transition-none"><p className="lb !text-[9px]">EVOLUCIÓN</p><svg viewBox="0 0 300 45" preserveAspectRatio="none" className="mt-1 h-12 w-full"><path d="M0 37 L40 30 L80 34 L120 20 L155 25 L200 10 L240 16 L300 4" fill="none" stroke="var(--sig)" strokeWidth="2" /></svg></div><div className="h-[86px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors duration-300 motion-reduce:transition-none"><p className="lb !text-[9px]">MIS INVERSIONES</p><div className="mt-3 space-y-2">{['CEDEAR', 'Cripto'].map(text => <div key={text} className="flex justify-between text-[10px]"><span>{text}</span><span className="mu">••••••</span></div>)}</div></div></div></div><p className="mu mt-3 text-[11px]">La vista previa se actualiza al instante.</p></div>
            </div>
        </div>
    </div>;
}
