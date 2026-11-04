import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AiProvider } from './ai-provider';
import { parseAllocationResponse } from './goal-ai-response';
import type { AllocationCategory, AllocationTargets } from './portfolio';

type Category = { id: AllocationCategory; label: string; value: number };
type Message = { role: 'user' | 'assistant'; content: string; display?: string };


export default function GoalsAssistant({ categories, incompleteQuotes, provider, onApply, onClose, onSettings }: { categories: Category[]; incompleteQuotes: boolean; provider: AiProvider; onApply: (targets: AllocationTargets) => void; onClose: () => void; onSettings: () => void }) {
    const total = categories.reduce((sum, category) => sum + category.value, 0);
    const context = total > 0 && !incompleteQuotes ? `Distribución actual orientativa: ${categories.map(category => `${category.id} ${(category.value / total * 100).toFixed(1)}%`).join(', ')}.` : 'No se cuenta con una distribución actual completa y confiable.';
    const [messages, setMessages] = useState<Message[]>([{ role: 'user', content: `Quiero definir mi distribución objetivo. ${context}` }, { role: 'assistant', content: JSON.stringify({ message: '¿Por cuánto tiempo pensás mantener la inversión?', allocation: null }), display: '¿Por cuánto tiempo pensás mantener la inversión?' }]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [suggested, setSuggested] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const end = useRef<HTMLDivElement>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);
    async function send(event: FormEvent) {
        event.preventDefault();
        const value = input.trim();
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
            setMessages(current => [...current, { role: 'assistant', content: data.text, display: answer.message }]);
            if (answer.allocation) { onApply(answer.allocation); setSuggested(true); }
        } catch (e) { if (!request.signal.aborted) { setInput(value); setMessages(messages); setError(e instanceof Error ? e.message : 'No se pudo consultar la IA.'); } }
        finally { if (controller.current === request) controller.current = null; setBusy(false); }
    }
    return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-3 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="goals-ai-title" className="flex max-h-[min(680px,90dvh)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--line2)] bg-[var(--surface)] shadow-2xl" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-[#a8d943]">OBJETIVOS CON IA</p><h2 id="goals-ai-title" className="mt-1 text-[20px] font-light">Armemos tu distribución</h2><p className="mu mt-1 text-[11px]">Una charla para encontrar un punto de partida.</p></div><button type="button" onClick={onClose} aria-label="Cerrar conversación" className="rounded-lg px-2 py-1 text-xl text-[var(--muted)] hover:bg-[var(--raised)]">×</button></header>
        <div className="min-h-[220px] flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">{messages.slice(1).map((message, index) => <div key={index} className={message.role === 'user' ? 'ml-8 rounded-2xl rounded-tr-sm bg-[var(--raised)] px-4 py-3' : 'mr-6 rounded-2xl rounded-tl-sm border border-[#a8d943]/30 bg-[#a8d943]/10 px-4 py-3'}><p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">{message.role === 'user' ? 'Vos' : 'Asistente'}</p><p className="whitespace-pre-wrap break-words text-[13px] leading-6">{message.display ?? message.content}</p></div>)}{busy && <p role="status" className="mu text-[12px]">Pensando tu distribución…</p>}{suggested && <p className="rounded-xl border border-[#a8d943]/30 bg-[#a8d943]/10 p-3 text-[11px] leading-5 text-[var(--ink)]">Cargué la propuesta en los campos en color lima. Cerrá esta charla para revisarla y guardarla.</p>}<div ref={end} /></div>
        <form onSubmit={send} className="border-t border-[var(--line)] p-4">{error && <p role="alert" className="mb-2 text-[11px] text-[var(--neg)]">{error} <button type="button" onClick={onSettings} className="underline">Configurar IA</button></p>}<div className="flex gap-2"><input autoFocus value={input} onChange={event => setInput(event.target.value)} aria-label="Tu respuesta" placeholder="Escribí tu respuesta…" className="min-w-0 flex-1 rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-3 py-3 text-[13px] outline-none focus:border-[#a8d943]" /><button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-[#b9ec50] px-4 py-3 text-[12px] font-semibold text-[#1a2608] disabled:opacity-40">Enviar</button></div></form>
    </section></div>;
}
