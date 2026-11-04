import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp02Icon, Cancel01Icon, ChevronRight, Key01Icon } from '@hugeicons/core-free-icons';
import { Avatar } from './MarketChat';
import type { AiProvider } from './ai-provider';
import { parseAllocationResponse } from './goal-ai-response';
import type { AllocationCategory, AllocationTargets } from './portfolio';

type Category = { id: AllocationCategory; label: string; value: number };
type Message = { role: 'user' | 'assistant'; content: string; display?: string; choices?: string[] };


export default function GoalsAssistant({ categories, incompleteQuotes, provider, onApply, onClose, onSettings }: { categories: Category[]; incompleteQuotes: boolean; provider: AiProvider; onApply: (targets: AllocationTargets) => void; onClose: () => void; onSettings: () => void }) {
    const total = categories.reduce((sum, category) => sum + category.value, 0);
    const context = total > 0 && !incompleteQuotes ? `Distribución actual orientativa: ${categories.map(category => `${category.id} ${(category.value / total * 100).toFixed(1)}%`).join(', ')}.` : 'No se cuenta con una distribución actual completa y confiable.';
    const [messages, setMessages] = useState<Message[]>([{ role: 'user', content: `Quiero definir mi distribución objetivo. ${context}` }, { role: 'assistant', content: JSON.stringify({ message: '¿Por cuánto tiempo pensás mantener la inversión?', allocation: null }), display: '¿Por cuánto tiempo pensás mantener la inversión?', choices: ['Corto: menos de 1 año', 'Mediano: de 1 a 3 años', 'Largo: más de 3 años', 'Todavía no lo sé'] }]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [suggested, setSuggested] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const end = useRef<HTMLDivElement>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);
    async function send(answerText: string) {
        const value = answerText.trim();
        if (!value || busy) return;
        if (value.length > 4000) { setError('El mensaje puede tener hasta 4000 caracteres.'); return; }
        const next: Message[] = [...messages, { role: 'user', content: value }];
        setMessages(next); setInput(''); setError(''); setBusy(true);
        const request = new AbortController(); controller.current = request;
        try {
            const response = await fetch('/api/ai/chat', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Activos-Request': '1' }, body: JSON.stringify({ provider, mode: 'allocation', messages: next.slice(-19).map(({ role, content }) => ({ role, content })) }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(100_000)]) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo consultar la IA.');
            const answer = parseAllocationResponse(data.text);
            setMessages(current => [...current, { role: 'assistant', content: data.text, display: answer.message, choices: answer.choices }]);
            if (answer.allocation) { onApply(answer.allocation); setSuggested(true); }
        } catch (e) { if (!request.signal.aborted) { setInput(value); setMessages(messages); setError(e instanceof Error ? e.message : 'No se pudo consultar la IA.'); } }
        finally { if (controller.current === request) controller.current = null; setBusy(false); }
    }
    function submit(event: FormEvent) { event.preventDefault(); void send(input); }
    const options = !busy && !error && messages.at(-1)?.role === 'assistant' ? messages.at(-1)?.choices ?? [] : [];
    return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="goals-ai-title" className="flex h-[min(720px,100dvh)] w-full max-w-[520px] flex-col overflow-hidden border border-[var(--line2)] bg-[var(--surface)] shadow-[0_20px_80px_rgba(0,0,0,.35)] sm:h-[min(720px,calc(100dvh-40px))] sm:rounded-[24px]" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--sig)]/15 text-[var(--sig)]"><Avatar thinking={busy} /></div><div className="min-w-0 flex-1"><h2 id="goals-ai-title" className="text-[15px] font-medium">Armemos tu distribución</h2><p className="mu mt-0.5 text-[11px]">Objetivos con IA · una pregunta a la vez</p></div><button type="button" onClick={onSettings} title="Configurar IA" aria-label="Configurar IA" className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={Key01Icon} size={17} /></button><button type="button" onClick={onClose} aria-label="Cerrar conversación" className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={Cancel01Icon} size={19} /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite"><div className="space-y-5">{messages.slice(1).map((message, index) => <div key={index} className={message.role === 'user' ? 'ml-8 rounded-2xl rounded-tr-sm bg-[var(--raised)] px-4 py-3' : 'mr-2'}><p className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">{message.role === 'user' ? 'Vos' : 'Asistente'}</p><p className="whitespace-pre-wrap break-words text-[13px] leading-6">{message.display ?? message.content}</p></div>)}{busy && <p role="status" className="mu flex items-center gap-2 text-[12px]"><span className="h-10 w-10 shrink-0"><Avatar thinking /></span> Pensando tu distribución…</p>}{options.length > 0 && <div className="space-y-2" role="group" aria-label="Respuestas sugeridas">{options.map(option => <button key={option} type="button" onClick={() => void send(option)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--raised)] px-3.5 py-3 text-left text-[12px] transition-colors hover:border-[#a8d943] focus-visible:outline-2 focus-visible:outline-[#a8d943]"><span>{option}</span><HugeiconsIcon icon={ChevronRight} size={14} className="shrink-0 text-[var(--muted)]" /></button>)}</div>}{suggested && <p className="rounded-xl border border-[#a8d943]/30 bg-[#a8d943]/10 p-3 text-[11px] leading-5 text-[var(--ink)]">Cargué la propuesta en los campos en color lima. Cerrá esta charla para revisarla y guardarla.</p>}<div ref={end} /></div></div>
        {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-[var(--neg)]/10 p-3 text-[11px] text-[var(--neg)]">{error}</p>}
        <div className="border-t border-[var(--line)] p-4"><form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-[var(--line2)] bg-[var(--raised)] p-2"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(input); } }} placeholder={options.length ? 'O escribí otra respuesta…' : 'Escribí tu respuesta…'} rows={1} maxLength={4000} aria-label="Tu respuesta" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[13px] outline-none" /><button type="submit" disabled={busy || !input.trim()} aria-label="Enviar respuesta" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--bg)] disabled:opacity-35"><HugeiconsIcon icon={ArrowUp02Icon} size={18} /></button></form><p className="mu mt-2 text-center text-[10px]">La IA recibe tus respuestas y porcentajes de cartera disponibles. Puede equivocarse.</p></div>
    </section></div>;
}
