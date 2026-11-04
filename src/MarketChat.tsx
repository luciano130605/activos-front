import { useEffect, useRef, useState, type FormEvent } from 'react';
import './market-avatar.css';
import { request } from './account';
import { INDEXES, listCedears } from './assets';
import { listCryptoAssets } from './coingecko';
import { cleanInvestment, type Investment } from './portfolio';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp, ArrowUp02Icon, Cancel01Icon, ChevronRight, CircleFadingPlusIcon, CopyCheckIcon, CopyIcon, Edit01Icon, Key01Icon, TrashIcon } from '@hugeicons/core-free-icons';

type Provider = 'openai' | 'claude' | 'gemini';
type Message = { role: 'user' | 'assistant'; content: string; citations?: { url: string; title: string }[] };
const labels: Record<Provider, string> = { openai: 'OpenAI', claude: 'Claude', gemini: 'Gemini' };
const suggestions = ['¿Qué pasó hoy en los mercados?', 'Analizá los riesgos de mi cartera', '¿Cómo afecta el dólar MEP a mis CEDEARs?'];

function Avatar({ thinking = false }: { thinking?: boolean }) {
    return <span className={`market-avatar${thinking ? ' is-thinking' : ''}`} aria-hidden="true"><span className="avatar-shape" /><svg viewBox="0 0 80 80" className="avatar-face"><g className="avatar-eyes"><ellipse cx="32" cy="39" rx="3.5" ry="5" /><ellipse cx="48" cy="39" rx="3.5" ry="5" /><circle cx="33" cy="37.5" r="1.1" fill="white" /><circle cx="49" cy="37.5" r="1.1" fill="white" /></g><path d="M35 49c3 2.8 7 2.8 10 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><ellipse cx="27" cy="46" rx="3" ry="1.5" fill="#f5ac77" opacity=".45" /><ellipse cx="53" cy="46" rx="3" ry="1.5" fill="#f5ac77" opacity=".45" /></svg></span>;
}

export default function MarketChat({ items, settingsRequest, onAdd, onSell, dirty }: { items: Investment[]; settingsRequest: number; onAdd: (investment: Investment) => void; onSell: (item: Investment) => void; dirty: boolean }) {
    const [open, setOpen] = useState(false), [settings, setSettings] = useState(false);
    const [provider, setProvider] = useState<Provider>('openai'), [configured, setConfigured] = useState<Provider[]>([]);
    const [masks, setMasks] = useState<Partial<Record<Provider, string>>>({});
    const [key, setKey] = useState(''), [input, setInput] = useState(''), [messages, setMessages] = useState<Message[]>([]);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [selectSale, setSelectSale] = useState(false);
    const [selectDollar, setSelectDollar] = useState(false);
    const [draft, setDraft] = useState<{ step: string; data: Partial<Investment> } | null>(null);
    const [editingKey, setEditingKey] = useState<Provider | null>(null), [copied, setCopied] = useState<Provider | null>(null);
    const end = useRef<HTMLDivElement>(null);
    const activeRequest = useRef<AbortController | null>(null);
    const [editing, setEditing] = useState<number | null>(null);
    useEffect(() => { if (settingsRequest) { setSettings(true); setError(''); } }, [settingsRequest]);
    useEffect(() => { if (open || settings) void request<{ providers: Provider[]; masks: Partial<Record<Provider, string>> }>('ai/keys').then(result => { setConfigured(result.providers); setMasks(result.masks ?? {}); setProvider(current => result.providers.includes(current) ? current : result.providers[0] ?? current); }).catch(() => setError('No se pudo consultar la configuración.')); }, [open, settings]);
    useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
    async function saveKey(remove = false, target = provider) {
        setError(''); setBusy(true);
        try { const result = await request<{ providers: Provider[]; provider: Provider; masks: Partial<Record<Provider, string>> }>('ai/keys', 'POST', { ...(remove ? { provider: target, remove: true } : { key, ...(editingKey ? { expectedProvider: editingKey } : {}) }) }); setConfigured(result.providers); setMasks(result.masks ?? {}); setKey(''); setEditingKey(null); if (!remove) setProvider(result.provider); else if (result.providers.length) setProvider(result.providers[0]); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la clave.'); } finally { setBusy(false); }
    }
    async function copyKey(target: Provider) {
        setError('');
        try {
            const result = await request<{ key: string }>('ai/keys', 'POST', { provider: target, copy: true });
            await navigator.clipboard.writeText(result.key);
            setCopied(target); window.setTimeout(() => setCopied(current => current === target ? null : current), 2000);
        } catch { setError('No se pudo copiar la clave.'); }
    }
    function closeSettings() { setSettings(false); setKey(''); setEditingKey(null); setError(''); }
    function startInvestment() {
        setDraft({ step: 'kind', data: {} }); setEditing(null); setSelectSale(false); setError('');
        setMessages(current => [...current, { role: 'user', content: 'Quiero cargar una inversión' }, { role: 'assistant', content: '¿Qué tipo de inversión es? Escribí CEDEAR, cripto o tasa.' }]);
    }
    async function investmentReply(value: string) {
        if (!draft) return;
        const answer = value.trim(), lower = answer.toLocaleLowerCase('es-AR');
        let { step, data } = draft; data = { ...data };
        let reply = '';
        const number = Number(answer.replace(',', '.'));
        if (/^(cancelar|cancelá|salir)$/i.test(answer)) { setDraft(null); reply = 'Carga cancelada.'; }
        else if (step === 'kind') {
            if (/^(cedear|cedears)$/i.test(answer)) data.kind = 'cedear';
            else if (/^(cripto|crypto|criptomoneda)$/i.test(answer)) data.kind = 'crypto';
            else if (/^(tasa|plazo fijo)$/i.test(answer)) data.kind = 'rate';
            else reply = 'Elegí CEDEAR, cripto o tasa.';
            if (!reply) { step = 'name'; reply = '¿Qué nombre querés darle?'; }
        } else if (step === 'name') {
            if (answer.length > 70) reply = 'El nombre puede tener hasta 70 caracteres.';
            else { data.name = answer; step = data.kind === 'rate' ? 'currency' : 'coin'; reply = data.kind === 'rate' ? '¿La inversión está en ARS o USD?' : data.kind === 'crypto' ? '¿Cuál es el identificador de CoinGecko? Por ejemplo: bitcoin o ethereum.' : '¿Cuál es el ticker? Por ejemplo: AAPL.'; }
        } else if (step === 'coin') {
            if (!/^[a-z0-9][a-z0-9.-]{0,49}$/i.test(answer)) reply = 'Ingresá un ticker o identificador válido, sin espacios.';
            else {
                setInput(''); setBusy(true);
                try {
                    const catalog = data.kind === 'crypto'
                        ? (await listCryptoAssets()).map(asset => ({ id: asset.id, symbol: asset.symbol, name: asset.name }))
                        : [...await listCedears(), ...INDEXES].map(asset => ({ id: asset.symbol, symbol: asset.symbol, name: asset.name }));
                    const exactId = catalog.find(asset => asset.id.toLowerCase() === lower);
                    const symbols = catalog.filter(asset => asset.symbol.toLowerCase() === lower);
                    const exact = exactId ?? (symbols.length === 1 ? symbols[0] : undefined);
                    if (exact) { data.coin = data.kind === 'cedear' ? exact.id.toUpperCase() : exact.id; step = 'currency'; reply = `Encontré ${exact.name || exact.symbol} (${exact.symbol.toUpperCase()}). ¿En qué moneda pagaste? ARS o USD.`; }
                    else {
                        const candidates = (symbols.length > 1 ? symbols : catalog.filter(asset => asset.symbol.toLowerCase().startsWith(lower) || asset.id.toLowerCase().startsWith(lower) || (lower.length > 1 && asset.name.toLowerCase().includes(lower)))).slice(0, 3);
                        reply = candidates.length ? `No encontré una coincidencia exacta para “${answer}”. ¿Quisiste decir ${candidates.map(asset => `${asset.name || asset.symbol} (${data.kind === 'crypto' ? asset.id : asset.symbol})`).join(', ')}? Escribí el identificador correcto.` : `No encontré “${answer}” en el catálogo. Probá con otro ${data.kind === 'crypto' ? 'identificador de CoinGecko' : 'ticker'}.`;
                    }
                } catch { reply = 'No pude consultar el catálogo para validar el activo. Probá de nuevo en un momento.'; }
                finally { setBusy(false); }
            }
        } else if (step === 'currency') {
            if (!/^(ars|usd|pesos|d[oó]lares)$/i.test(answer)) reply = 'Indicá ARS o USD.';
            else { data.currency = /^(ars|pesos)$/i.test(answer) ? 'ARS' : 'USD'; step = data.kind === 'rate' ? 'amount' : 'units'; reply = data.kind === 'rate' ? '¿Cuál fue el monto invertido?' : '¿Cuántas unidades compraste?'; }
        } else if (step === 'amount' || step === 'units' || step === 'price') {
            if (!Number.isFinite(number) || number <= 0) reply = 'Ingresá un número mayor a cero, sin separador de miles.';
            else if (step === 'amount') { data.amount = number; step = 'rate'; reply = '¿Qué tasa porcentual tiene? Por ejemplo: 35.'; }
            else if (step === 'units') { data.units = number; step = 'price'; reply = `¿Cuál fue el precio por unidad en ${data.currency}?`; }
            else { data.purchasePrice = number; data.amount = number * data.units!; step = 'date'; reply = '¿En qué fecha compraste? Escribí DD/MM/AAAA o AAAA-MM-DD.'; }
        } else if (step === 'rate') {
            if (!Number.isFinite(number) || number <= -100) reply = 'Ingresá una tasa válida, superior a -100.';
            else { data.rate = number; step = 'period'; reply = '¿La tasa es anual o mensual?'; }
        } else if (step === 'period') {
            if (!/^(anual|mensual)$/i.test(answer)) reply = 'Indicá anual o mensual.';
            else { data.period = lower === 'anual' ? 'year' : 'month'; step = 'date'; reply = '¿En qué fecha invertiste? Escribí DD/MM/AAAA o AAAA-MM-DD.'; }
        } else if (step === 'date') {
            const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(answer);
            const date = match ? `${match[3]}-${match[2]}-${match[1]}` : answer;
            const parsed = new Date(`${date}T12:00:00Z`), now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today) reply = 'Ingresá una fecha válida que no sea futura.';
            else { data.date = date; step = 'confirm'; reply = `Revisá los datos:\n${data.name}${data.coin ? ` (${data.coin})` : ''} · ${data.kind}\n${data.units ? `${data.units} unidades × ${data.purchasePrice} ${data.currency}\n` : ''}Monto: ${data.amount} ${data.currency}\n${data.rate != null ? `Tasa: ${data.rate}% ${data.period === 'year' ? 'anual' : 'mensual'}\n` : ''}Fecha: ${date.split('-').reverse().join('/')}\n¿Confirmás la carga? Respondé sí o cancelar.`; }
        } else if (step === 'confirm') {
            if (/^(s[ií]|confirmar|confirmo)$/i.test(answer)) {
                const investment = cleanInvestment({ ...data, id: crypto.randomUUID() });
                if (investment) { onAdd(investment); setDraft(null); reply = 'Listo, agregué la inversión a tu cartera. Se está sincronizando.'; }
                else reply = 'No pude validar los datos. Escribí cancelar para empezar de nuevo.';
            } else reply = 'Respondé sí para guardar o cancelar para descartar.';
        }
        if (reply !== 'Carga cancelada.' && !(step === 'confirm' && /^(s[ií]|confirmar|confirmo)$/i.test(answer) && reply.startsWith('Listo,'))) setDraft({ step, data });
        setMessages(current => [...current, { role: 'user', content: answer }, { role: 'assistant', content: reply }]); setInput('');
    }
    async function showDollar(question: string) {
        setInput(''); setError(''); setMessages(current => [...current, { role: 'user', content: question }]); setBusy(true);
        try {
            const response = await fetch('https://dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(20000) });
            if (!response.ok) throw new Error();
            const rows: { casa: string; venta: number; fechaActualizacion?: string }[] = await response.json();
            const requested = /\bmep\b|\bbolsa\b/i.test(question) ? ['bolsa'] : /\bblue\b/i.test(question) ? ['blue'] : /\boficial\b/i.test(question) ? ['oficial'] : /\bccl\b|contado con liqui/i.test(question) ? ['contadoconliqui'] : ['oficial', 'blue', 'bolsa', 'contadoconliqui'];
            const labels: Record<string, string> = { oficial: 'Oficial', blue: 'Blue', bolsa: 'MEP', contadoconliqui: 'CCL' };
            const found = requested.flatMap(id => { const row = rows.find(item => item.casa === id && Number.isFinite(item.venta) && item.venta > 0); return row ? [row] : []; });
            if (!found.length) throw new Error();
            const lines = found.map(row => `• ${labels[row.casa]}: $${row.venta.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`);
            const dates = found.map(row => row.fechaActualizacion ? Date.parse(row.fechaActualizacion) : NaN).filter(Number.isFinite);
            const updated = dates.length ? `\nActualizado: ${new Date(Math.min(...dates)).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })}.` : '';
            setMessages(current => [...current, { role: 'assistant', content: `Dólar venta:\n${lines.join('\n')}${updated}`, citations: [{ title: 'DolarAPI', url: 'https://dolarapi.com/' }] }]);
        } catch { setMessages(current => [...current, { role: 'assistant', content: 'No pude consultar el dólar en este momento. Intentá de nuevo.' }]); } finally { setBusy(false); }
    }
    async function send(value: string) {
        const trimmed = value.trim(); if (!trimmed || busy) return;
        if (trimmed.toLowerCase() === '/clear') { setMessages([]); setInput(''); setEditing(null); setError(''); setSelectSale(false); setSelectDollar(false); setDraft(null); return; }
        if (draft) { await investmentReply(trimmed); return; }
        if (selectDollar) {
            if (/^(cancelar|salir)$/i.test(trimmed)) { setSelectDollar(false); setInput(''); setMessages(current => [...current, { role: 'user', content: trimmed }, { role: 'assistant', content: 'Consulta cancelada.' }]); return; }
            if (/\b(mep|bolsa|blue|oficial|ccl|todos)\b|contado con liqui/i.test(trimmed)) { setSelectDollar(false); void showDollar(trimmed); return; }
            setInput(''); setMessages(current => [...current, { role: 'user', content: trimmed }, { role: 'assistant', content: '¿Oficial, blue, MEP o CCL?' }]); return;
        }
        const intent = trimmed.toLocaleLowerCase('es-AR');
        if (/^(quiero |necesito |pod[eé]s |puedo )?(cargar|agregar|registrar) (una? )?(inversi[oó]n|activo|compra)/.test(intent)) { setInput(''); startInvestment(); return; }
        if (/^(quiero |necesito |pod[eé]s |puedo )?(vender|registrar (una? )?venta)\b/.test(intent)) { setInput(''); setSelectSale(true); return; }
        if (/^(?:(?:decime|dec[ií]me|mostrame|cu[aá]l es|a cu[aá]nto (?:est[aá]|cotiza)|cu[aá]nto (?:est[aá]|vale)|cotizaci[oó]n (?:del|de)|precio (?:del|de))\s+)?(?:el\s+)?d[oó]lar(?:\s+(?:mep|bolsa|blue|oficial|ccl|contado con liqui))?(?:\s+hoy)?[?¿.!]*$/i.test(trimmed)) {
            if (/\b(mep|bolsa|blue|oficial|ccl)\b|contado con liqui/i.test(trimmed)) void showDollar(trimmed);
            else { setInput(''); setSelectDollar(true); setMessages(current => [...current, { role: 'user', content: trimmed }, { role: 'assistant', content: '¿Qué dólar querés consultar: oficial, blue, MEP o CCL?' }]); }
            return;
        }
        if (/dividendo/.test(intent) && /(mis |me |m[ií]o|cartera|acciones|cedears|pr[oó]ximo|ver|consultar|mostrar|mostrame)/.test(intent)) { setInput(''); void showDividends(trimmed); return; }
        if (!configured.includes(provider)) { setSettings(true); setError('Primero agregá una API key.'); return; }
        const next: Message[] = [...(editing == null ? messages : messages.slice(0, editing)), { role: 'user', content: trimmed }]; setMessages(next); setInput(''); setEditing(null); setBusy(true); setError('');
        const controller = new AbortController(); activeRequest.current = controller;
        try {
            const response = await fetch('/api/ai/chat', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Activos-Request': '1' }, body: JSON.stringify({ provider, messages: next.slice(-20).map(({ role, content }) => ({ role, content })), assets: items.map(i => `${i.name}${i.coin ? ` (${i.coin})` : ''} · ${i.kind}`) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]) });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo obtener una respuesta.');
            setMessages(current => [...current, { role: 'assistant', content: result.text, citations: result.citations }]);
        } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo obtener una respuesta.'); }
        finally { if (activeRequest.current === controller) activeRequest.current = null; setBusy(false); }
    }
    async function showDividends(question = 'Ver mis dividendos') {
        if (busy) return;
        if (dirty) { setError('Esperá a que termine de sincronizarse tu cartera para consultar dividendos actualizados.'); return; }
        setMessages(current => [...current, { role: 'user', content: question }]); setBusy(true); setError('');
        try {
            const data = await request<{ configured: boolean; items: { name: string; ticker: string; status: string; events?: { payDate: string; estimatedGross: number; eligible: boolean }[] }[] }>('dividends');
            const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const events = data.items.flatMap(item => (item.events ?? []).filter(event => event.payDate >= today && event.eligible).map(event => ({ ...event, name: item.name, ticker: item.ticker }))).sort((a, b) => a.payDate.localeCompare(b.payDate));
            const unavailable = data.items.filter(item => item.status !== 'ok').map(item => item.ticker);
            const nextOnly = /\b(pr[oó]ximo|siguiente|primero)\s+dividendo\b|\b(el|cu[aá]l es el)\s+pr[oó]ximo\b/i.test(question);
            const shown = nextOnly && events.length ? events.filter(event => event.payDate === events[0].payDate) : events;
            const total = shown.reduce((sum, event) => sum + event.estimatedGross, 0);
            const amount = (value: number) => `US$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const content = !data.configured ? 'El servicio de dividendos todavía no está configurado.' : shown.length
                ? `${nextOnly ? 'Próximo pago' : 'Próximos dividendos'}:\n${shown.map(event => `• ${event.payDate.split('-').reverse().join('/')} · ${event.ticker} · ${amount(event.estimatedGross)}`).join('\n')}\nTotal estimado: ${amount(total)} brutos.${unavailable.length ? `\nSin datos completos: ${unavailable.join(', ')}.` : ''}\nLa acreditación puede ser posterior a la fecha indicada.`
                : `No hay próximos dividendos elegibles disponibles.${unavailable.length ? `\nSin datos completos: ${unavailable.join(', ')}.` : ''}`;
            setMessages(current => [...current, { role: 'assistant', content }]);
        } catch { setError('No se pudieron consultar los dividendos.'); } finally { setBusy(false); }
    }
    function submit(e: FormEvent) { e.preventDefault(); void send(input); }
    return <>
        {!open && <button type="button" onClick={() => { setSettings(false); setOpen(true); }} className="fixed bottom-5 right-5 z-40 h-[72px] w-[72px] rounded-full border border-[var(--line2)] bg-[var(--surface)] p-1 shadow-[0_12px_40px_rgba(0,0,0,.28)] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-[var(--sig)]" aria-label="Abrir asistente de mercado" title="Abrir asistente de mercado"><Avatar /></button>}
        {open && <section role="dialog" aria-label="Asistente de mercado" className="fixed bottom-0 right-0 z-50 flex h-[min(720px,100dvh)] w-full flex-col overflow-hidden border border-[var(--line2)] bg-[var(--surface)] shadow-[0_20px_80px_rgba(0,0,0,.35)] sm:bottom-5 sm:right-5 sm:h-[min(720px,calc(100dvh-40px))] sm:w-[420px] sm:rounded-[24px]">
            <header className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--sig)]/15 text-[var(--sig)]"><Avatar thinking={busy} /></div><div className="min-w-0 flex-1"><h2 className="text-[15px] font-medium">Asistente de mercado</h2><p className="mu mt-0.5 text-[11px]">Tu espacio para entender e investigar</p></div><button type="button" title="Nueva conversación" aria-label="Nueva conversación" disabled={busy} onClick={() => { setMessages([]); setDraft(null); setSelectDollar(false); setError(''); }} className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={CircleFadingPlusIcon} size={18} /></button><button type="button" title="Configurar API key" aria-label="Configurar API key" onClick={() => { setSettings(true); setError(''); }} className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={Key01Icon} size={17} /></button><button type="button" aria-label="Cerrar chat" onClick={() => setOpen(false)} className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={Cancel01Icon} size={19} /></button></header>
            {configured.length > 0 && <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3"><span className="mu mr-1 text-[11px]">Proveedor</span>{configured.map(p => <button key={p} type="button" onClick={() => { setProvider(p); setError(''); }} aria-pressed={provider === p} className={`rounded-full border px-3 py-1.5 text-[11px] ${provider === p ? 'border-[var(--sig)] text-[var(--sig)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{labels[p]}</button>)}</div>}
            {<div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">{!messages.length ? <div className="flex h-full flex-col justify-center"><div className="grid h-14 w-14 place-items-center rounded-[20px] border border-[var(--line2)] bg-[var(--raised)] text-[var(--sig)]"><Avatar /></div><p className="mu mt-6 text-[10px] uppercase tracking-[.18em]">Tu copiloto financiero</p><h3 className="mt-2 text-[25px] font-light leading-tight tracking-tight">El mercado, un poco<br />más claro<span className="sig">.</span></h3><p className="mu mt-3 max-w-[300px] text-[12px] leading-5">Preguntá sobre activos, noticias o conceptos. Puedo investigar y ayudarte a entender tu cartera.</p><div className="mt-6 space-y-2">{suggestions.map(s => <button type="button" key={s} onClick={() => void send(s)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--raised)] px-3.5 py-3 text-left text-[12px] transition-colors hover:border-[var(--line2)]"><span>{s}</span><HugeiconsIcon icon={ChevronRight} size={14} className=" text-[var(--muted)]" /></button>)}</div></div> : <div className="space-y-5">{messages.map((m, index) => <div key={index} className={m.role === 'user' ? 'ml-8 rounded-2xl rounded-tr-sm bg-[var(--raised)] px-4 py-3' : 'mr-2'}><p className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">{m.role === 'assistant' ? <>Asistente</> : 'Vos'}</p><p className="whitespace-pre-wrap break-words text-[13px] leading-6">{m.content}</p>{m.role === 'user' && !busy && !draft && <button type="button" className="mu mt-2 text-[10px] underline" onClick={() => { setEditing(index); setInput(m.content); }}>Editar pregunta</button>}{!!m.citations?.length && <div className="mt-3 flex flex-wrap gap-2">{m.citations.map((c, i) => <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="max-w-full truncate rounded-full border border-[var(--line2)] px-3 py-1 text-[10px] text-[var(--sig)]">{c.title || `Fuente ${i + 1}`} ↗</a>)}</div>}</div>)}{busy && <p role="status" className="mu flex items-center gap-2 text-[12px]"><span className="h-10 w-10 shrink-0"><Avatar thinking /></span> Investigando tu consulta…</p>}<div ref={end} /></div>}</div>}
            {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-[var(--neg)]/10 p-3 text-[11px] text-[var(--neg)]">{error}</p>}
            {selectSale && <div className="mx-4 mb-2 max-h-36 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3"><div className="flex items-center justify-between"><p className="text-[12px]">Elegí la inversión para registrar la venta</p><button type="button" onClick={() => setSelectSale(false)} aria-label="Cerrar selección"><HugeiconsIcon icon={Cancel01Icon} size={16} /></button></div>{items.length ? items.map(item => <button key={item.id} type="button" className="mt-2 block w-full rounded-lg border border-[var(--line)] px-3 py-2 text-left text-[12px]" onClick={() => { setSelectSale(false); setOpen(false); onSell(item); }}>{item.name}{item.coin ? ` · ${item.coin}` : ''}</button>) : <p className="mu mt-2 text-[11px]">No hay inversiones cargadas.</p>}</div>}
            {busy && activeRequest.current && <button type="button" onClick={() => activeRequest.current?.abort()} className="mu mx-4 mb-2 self-start rounded-full border border-[var(--line2)] px-3 py-1.5 text-[11px]">Detener respuesta</button>}{editing != null && <div className="mu mx-4 mb-2 text-[11px]">Editando pregunta · se reemplazarán las respuestas posteriores. <button type="button" className="underline" onClick={() => { setEditing(null); setInput(''); }}>Cancelar edición</button></div>}{<div className="flex flex-wrap gap-2 px-4 pb-2"><button type="button" disabled={!!draft || busy} onClick={startInvestment} className="rounded-full border border-[var(--line2)] px-3 py-1.5 text-[10px]">+ Cargar inversión</button><button type="button" disabled={!!draft || busy} onClick={() => setSelectSale(true)} className="rounded-full border border-[var(--line2)] px-3 py-1.5 text-[10px]">Registrar venta</button><button type="button" disabled={busy || !!draft} onClick={() => void showDividends()} className="rounded-full border border-[var(--line2)] px-3 py-1.5 text-[10px]">Ver dividendos</button></div>}
            {<div className="border-t border-[var(--line)] p-4"><form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-[var(--line2)] bg-[var(--raised)] p-2"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }} placeholder="Preguntá lo que quieras…" rows={1} maxLength={4000} aria-label="Tu pregunta" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[13px] outline-none" /><button disabled={busy || !input.trim()} aria-label="Enviar pregunta" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--bg)] disabled:opacity-35"><HugeiconsIcon icon={ArrowUp02Icon} size={18} /></button></form><p className="mu mt-2 text-center text-[10px]">Se comparten los nombres de tus activos, no los importes. La IA puede equivocarse.</p></div>}
        </section>}
        {settings && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onMouseDown={e => { if (e.target === e.currentTarget) closeSettings(); }} onKeyDown={e => { if (e.key === 'Escape') closeSettings(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="api-keys-title" className="w-full max-w-md rounded-[24px] border border-[var(--line2)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,.4)]">
                <div className="flex items-start justify-between gap-4"><div><div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-[var(--sig)]/15 text-[var(--sig)]"><HugeiconsIcon icon={Key01Icon} size={19} /></div><h2 id="api-keys-title" className="text-xl font-medium">Claves de API</h2><p className="mu mt-2 text-[12px] leading-5">Conectá OpenAI, Claude o Gemini. Tus claves se guardan cifradas y las consultas se cobran en tu cuenta.</p></div><button type="button" onClick={closeSettings} aria-label="Cerrar configuración" className="rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><HugeiconsIcon icon={Cancel01Icon} size={19} /></button></div>
                <div className="mt-5 space-y-2">{configured.map(p => <div key={p} className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--raised)] p-3"><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{labels[p]}</p><p className="mu mt-1 font-mono text-[11px]">{masks[p] ?? '••••••••'}</p></div><button type="button" onClick={() => void copyKey(p)} title="Copiar clave" aria-label={`Copiar clave de ${labels[p]}`} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)]">{copied === p ? <HugeiconsIcon icon={CopyCheckIcon} size={16} /> : <HugeiconsIcon icon={CopyIcon} size={16} />}</button><button type="button" onClick={() => { setEditingKey(p); setKey(''); setError(''); }} title="Editar clave" aria-label={`Editar clave de ${labels[p]}`} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)]"><HugeiconsIcon icon={Edit01Icon} size={16} /></button><button type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar la clave de ${labels[p]}?`)) void saveKey(true, p); }} title="Eliminar clave" aria-label={`Eliminar clave de ${labels[p]}`} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--neg)]"><HugeiconsIcon icon={TrashIcon} size={16} /></button></div>)}</div>
                <label htmlFor="ai-key" className="mu mt-5 block text-[11px]">{editingKey ? `Reemplazar clave de ${labels[editingKey]}` : 'Agregar una clave'}</label><input id="ai-key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="Pegá tu API key" className="mt-2 w-full rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-3 py-3 text-[13px] outline-none focus:border-[var(--sig)]" /><p className="mu mt-2 text-[11px]">{editingKey ? 'Pegá la nueva clave para reemplazar la anterior.' : 'Detectamos el proveedor automáticamente.'}</p>
                {error && <p role="alert" className="mt-3 text-[11px] text-[var(--neg)]">{error}</p>}<div className="mt-4 flex gap-2"><button type="button" disabled={busy || !key.trim()} onClick={() => void saveKey()} className="flex-1 rounded-xl bg-[var(--ink)] px-4 py-3 text-[12px] font-medium text-[var(--bg)] disabled:opacity-40">{editingKey ? 'Guardar cambios' : 'Guardar clave'}</button>{editingKey && <button type="button" onClick={() => { setEditingKey(null); setKey(''); }} className="rounded-xl border border-[var(--line2)] px-4 text-[12px]">Cancelar</button>}</div>
            </section>
        </div>}
    </>;
}
