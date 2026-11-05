import { ChevronLeft } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState } from 'react';

const sections = [
    { id: 'value', title: 'Valor y capital', description: 'Valor actual, resultado y referencia del dólar' },
    { id: 'macro', title: 'Tablero macro', description: 'Dólares, riesgo país, inflación y tasa de referencia' },
    { id: 'streak', title: 'Racha de aportes', description: 'Grilla mensual y constancia de tus inversiones' },
    { id: 'evolution', title: 'Evolución', description: 'Gráfico de evolución de tu cartera' },
    { id: 'distribution', title: 'Distribución', description: 'Distribución por activo, tipo, moneda, sector y país' },
    { id: 'investments', title: 'Mis inversiones', description: 'Listado y filtros de tus posiciones' },
] as const;
type Panel = typeof sections[number]['id'];
const ids = sections.map(section => section.id);

export default function PanelEditor({ selected, showChatButton, showQuotesBar, onClose, onSave }: { selected: string[]; showChatButton: boolean; showQuotesBar: boolean; onClose: () => void; onSave: (ids: string[], options: { showChatButton: boolean; showQuotesBar: boolean }) => void }) {
    const [visible, setVisible] = useState<Panel[]>(() => selected.filter((id): id is Panel => ids.includes(id as Panel)));
    const [order, setOrder] = useState<Panel[]>(() => [...selected.filter((id): id is Panel => ids.includes(id as Panel)), ...ids.filter(id => !selected.includes(id))].filter((id, i, arr) => arr.indexOf(id) === i));
    const [chatVisible, setChatVisible] = useState(showChatButton);
    const [quotesVisible, setQuotesVisible] = useState(showQuotesBar);
    const [dragged, setDragged] = useState<Panel | null>(null);
    const dialog = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
        function keydown(event: KeyboardEvent) {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key !== 'Tab') return;
            const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href]');
            if (!elements?.length) return;
            const first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        document.addEventListener('keydown', keydown);
        return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
    }, [onClose]);
    function move(id: Panel, to: number) {
        setOrder(current => { const next = [...current]; const from = next.indexOf(id); if (to < 0 || to >= next.length || from === to) return current; next.splice(from, 1); next.splice(to, 0, id); return next; });
    }
    const shown = order.filter(id => visible.includes(id));
    return <div className="settings-subscreen fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm sm:p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="customize-title" className="card flex h-[100dvh] max-h-[100dvh] w-full max-w-[940px] flex-col overflow-hidden !rounded-none shadow-2xl sm:h-auto sm:max-h-[min(90dvh,850px)] sm:!rounded-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:py-5"><div><p className="lb">TU ESPACIO</p><h2 id="customize-title" className="mt-2 text-[21px] font-light sm:text-[24px]">Personalizar panel</h2><p className="mu mt-1 text-[12px]">Elegí qué mostrar y acomodá las secciones a tu manera.</p></div><button type="button" className="btn-ghost shrink-0" onClick={onClose}><span aria-hidden="true"><HugeiconsIcon icon={ChevronLeft} size={20} /></span></button></header>
            <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1fr_1fr]">
                <div className="p-4 sm:p-6"><p className="lb">SECCIONES</p><p className="mu mt-2 text-[11px]">Usá las flechas para cambiar el orden. En computadora también podés arrastrar.</p><div className="mt-4 space-y-2">{order.map((id, index) => { const section = sections.find(x => x.id === id)!; const checked = visible.includes(id); return <div key={id} draggable onDragStart={e => { setDragged(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }} onDragEnd={() => setDragged(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const source = (dragged ?? e.dataTransfer.getData('text/plain')) as Panel; if (ids.includes(source)) move(source, index); setDragged(null); }} className={`flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3 sm:gap-3 ${dragged === id ? 'opacity-50' : ''}`}><span aria-hidden="true" className="hidden cursor-grab text-[var(--faint)] sm:block">⠿</span><label className="min-w-0 flex-1 cursor-pointer"><span className="flex items-center gap-2 text-[13px] font-medium"><input type="checkbox" className="h-4 w-4 shrink-0" checked={checked} onChange={e => setVisible(current => e.target.checked ? [...current, id] : current.filter(x => x !== id))} />{section.title}</span><span className="mu mt-1 block pl-5 text-[11px]">{section.description}</span></label><div className="flex gap-1"><button type="button" className="ibtn !h-10 !w-10 sm:!h-8 sm:!w-8" aria-label={`Subir ${section.title}`} disabled={index === 0} onClick={() => move(id, index - 1)}>↑</button><button type="button" className="ibtn !h-10 !w-10 sm:!h-8 sm:!w-8" aria-label={`Bajar ${section.title}`} disabled={index === order.length - 1} onClick={() => move(id, index + 1)}>↓</button></div></div>; })}</div><div className="mt-6"><p className="lb">ELEMENTOS GENERALES</p><p className="mu mt-2 text-[11px]">Se muestran en todas las pantallas.</p><div className="mt-3 space-y-2"><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={chatVisible} onChange={event => setChatVisible(event.target.checked)} /><span><span className="block text-[13px] font-medium">Botón flotante del chat</span><span className="mu mt-1 block text-[11px]">La pantalla del asistente sigue disponible en el menú.</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={quotesVisible} onChange={event => setQuotesVisible(event.target.checked)} /><span><span className="block text-[13px] font-medium">Barra de cotizaciones</span><span className="mu mt-1 block text-[11px]">USDC, tipos de dólar y hora de actualización.</span></span></label></div></div></div>
                <div className="border-t border-[var(--line)] bg-[var(--raised)] p-4 sm:p-6 md:border-l md:border-t-0"><div className="flex items-center justify-between"><p className="lb">VISTA PREVIA</p><span className="mu text-[10px]">Datos de ejemplo</span></div><div className="mx-auto mt-4 max-w-[300px] rounded-[2rem] border-[5px] border-[var(--line2)] bg-[var(--bg)] p-3 shadow-lg md:max-w-none md:rounded-2xl md:border md:p-4 md:shadow-none"><div aria-hidden="true" className="mx-auto mb-4 h-1 w-16 rounded-full bg-[var(--line2)] md:hidden" /><div className="mb-4 flex items-center justify-between"><div><p className="lb !text-[9px]">PANEL PERSONAL / RESUMEN</p><p className="mt-2 text-[20px] font-light">Mi cartera<span className="sig">.</span></p></div><span className="mu text-[10px]">● ● ●</span></div><div className="relative transition-[height] duration-300 motion-reduce:transition-none" style={{ height: Math.max(92, shown.length * 94) }}>{order.map(id => {
                    const index = shown.indexOf(id); return <div key={id} aria-hidden={index < 0} className="absolute left-0 right-0 h-[86px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateY(${(index < 0 ? shown.length : index) * 94}px) scale(${index < 0 ? 0.97 : 1})`, opacity: index < 0 ? 0 : 1, pointerEvents: 'none' }}>
                        {id === 'value' && <><p className="lb !text-[9px]">VALOR ACTUAL</p><p className="mt-2 text-[18px] font-light">$ 1.245.800 <span className="ml-2 text-[10px] text-[var(--sig)]">+12,4%</span></p><div className="mt-2 h-1 w-4/5 rounded-full bg-[var(--line2)]"><div className="h-full w-2/3 rounded-full bg-[var(--sig)]" /></div></>}
                        {id === 'macro' && <><p className="lb !text-[9px]">TABLERO MACRO</p><div className="mt-3 flex gap-4 text-[10px]"><span>Dólar MEP<br /><b>$ 1.250</b></span><span>Inflación<br /><b>2,5%</b></span><span>Riesgo país<br /><b>650 pb</b></span></div></>}
                        {id === 'streak' && <><p className="lb !text-[9px]">RACHA DE APORTES</p><div className="mt-3 flex gap-1">{Array.from({ length: 12 }, (_, n) => <span key={n} className={`h-4 w-4 rounded-sm ${n % 4 ? 'bg-[var(--sig)]' : 'bg-[var(--line2)]'}`} />)}</div><p className="mu mt-2 text-[10px]">3 meses consecutivos</p></>}
                        {id === 'evolution' && <><p className="lb !text-[9px]">EVOLUCIÓN</p><svg viewBox="0 0 300 45" preserveAspectRatio="none" className="mt-1 h-12 w-full" aria-hidden="true"><path d="M0 37 L40 30 L80 34 L120 20 L155 25 L200 10 L240 16 L300 4" fill="none" stroke="var(--sig)" strokeWidth="2" /></svg></>}
                        {id === 'distribution' && <><p className="lb !text-[9px]">DISTRIBUCIÓN</p><div className="mt-3 flex items-center gap-4"><div className="h-10 w-10 rounded-full border-[6px] border-[var(--sig)] border-r-[var(--c-cedear)]" /><div className="flex-1 space-y-2"><div className="h-1.5 w-4/5 rounded bg-[var(--line2)]" /><div className="h-1.5 w-3/5 rounded bg-[var(--line2)]" /></div></div></>}
                        {id === 'investments' && <><p className="lb !text-[9px]">MIS INVERSIONES</p><div className="mt-3 space-y-2">{['CEDEAR', 'Cripto'].map(text => <div key={text} className="flex justify-between text-[10px]"><span>{text}</span><span className="mu">••••••</span></div>)}</div></>}
                    </div>;
                })}{!shown.length && <p className="mu py-8 text-center text-[11px]">Activá una sección para verla acá.</p>}</div></div><p className="mu mt-3 text-[11px]">La vista previa se actualiza al instante. Los cambios se aplican al guardar.</p></div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6"><button type="button" className="text-[12px] text-[var(--muted)] underline" onClick={() => { setOrder([...ids]); setVisible([...ids]); setChatVisible(true); setQuotesVisible(true); }}>Restablecer</button><div className="flex w-full gap-2 sm:w-auto"><button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary flex-1 sm:flex-none" onClick={() => onSave(order.filter(id => visible.includes(id)), { showChatButton: chatVisible, showQuotesBar: quotesVisible })}>Guardar cambios</button></div></footer>
        </div>
    </div>;
}
