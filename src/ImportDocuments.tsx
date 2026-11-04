import { useState, type ChangeEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload06Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { request } from './account';
import type { ImportOperation, Portfolio, Investment } from './portfolio';

const fields = ['asset', 'name', 'kind', 'side', 'date', 'quantity', 'price', 'amount', 'currency', 'fee', 'externalId'] as const;
const labels: Record<typeof fields[number], string> = { asset: 'Ticker o ID', name: 'Nombre', kind: 'Tipo de activo', side: 'Operación', date: 'Fecha', quantity: 'Cantidad', price: 'Precio', amount: 'Importe', currency: 'Moneda', fee: 'Comisiones', externalId: 'ID de operación' };
const decimal = (s: string) => /^\d+(?:\.\d+)?$/.test(s) && Number.isFinite(Number(s));
const canonical = (s: string) => { const [a, b = ''] = s.split('.'); return `${a.replace(/^0+(?=\d)/, '')}${b.replace(/0+$/, '') ? `.${b.replace(/0+$/, '')}` : ''}`; };
const value = (input: unknown) => typeof input === 'string' ? input.slice(0, 300) : '';
const textInput = 'w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--raised)] px-3 py-2 text-[13px] text-[var(--ink)]';

export default function ImportDocuments({ portfolio, update }: { portfolio: Portfolio; update: (change: (current: Portfolio) => Portfolio) => void }) {
    const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [selection, setSelection] = useState<Record<string, string>>({});
    const operations = portfolio.imports ?? [];
    async function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_200_000) { setMessage('Elegí un PDF, JPG, PNG o WebP de hasta 1,2 MB.'); return; }
        setBusy(true); setMessage('');
        try {
            const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('No se pudo leer el archivo.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file); });
            const result = await request<{ operations: Record<string, unknown>[] }>('imports/extract', 'POST', { type: file.type, data: encoded });
            const parsed: ImportOperation[] = result.operations.map(raw => {
                if (!raw || typeof raw !== 'object') throw new Error('El lector devolvió una operación inválida.');
                const exec = JSON.stringify(Array.isArray(raw.executions) ? raw.executions : []);
                if (exec.length > 20000) throw new Error('El detalle de ejecuciones es demasiado extenso para guardarlo.');
                const item = Object.fromEntries(fields.map(key => [key, value(raw[key])])) as Pick<ImportOperation, typeof fields[number]>;
                return { ...item, id: crypto.randomUUID(), source: file.name.slice(0, 300), status: 'pending', executions: exec };
            });
            if (!parsed.length) { setMessage('No se detectaron operaciones en el archivo.'); return; }
            update(current => ({ ...current, imports: [...(current.imports ?? []), ...parsed] })); setMessage(`Se detectaron ${parsed.length} operaciones. Revisá los datos antes de confirmar.`);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo analizar el archivo.'); } finally { setBusy(false); }
    }
    function edit(id: string, field: typeof fields[number], next: string) { update(current => ({ ...current, imports: (current.imports ?? []).map(op => op.id === id && op.status === 'pending' ? { ...op, [field]: next.slice(0, 300) } : op) })); }
    function discard(id: string) { update(current => ({ ...current, imports: (current.imports ?? []).map(op => op.id === id && op.status === 'pending' ? { ...op, status: 'discarded' } : op) })); }
    function duplicate(op: ImportOperation) { return operations.some(other => other.id !== op.id && other.status !== 'discarded' && ((op.externalId && other.externalId && op.externalId.toLowerCase() === other.externalId.toLowerCase()) || (op.asset && op.date && decimal(op.quantity) && decimal(op.amount) && other.asset.toUpperCase() === op.asset.toUpperCase() && other.side === op.side && other.date === op.date && other.currency === op.currency && decimal(other.quantity) && decimal(other.amount) && canonical(other.quantity) === canonical(op.quantity) && canonical(other.amount) === canonical(op.amount)))); }
    function confirm(op: ImportOperation) {
        setMessage('');
        if (!op.asset.trim() || !op.name.trim() || !['stock', 'cedear', 'crypto'].includes(op.kind) || !['buy', 'sell'].includes(op.side) || !['USD', 'ARS'].includes(op.currency) || !/^\d{4}-\d{2}-\d{2}$/.test(op.date) || !Number.isFinite(Date.parse(`${op.date}T00:00:00Z`)) || new Date(`${op.date}T00:00:00Z`).toISOString().slice(0, 10) !== op.date || op.date > new Date().toLocaleDateString('en-CA') || !decimal(op.quantity) || Number(op.quantity) <= 0 || !decimal(op.amount) || Number(op.amount) <= 0 || !decimal(op.price) || Number(op.price) <= 0 || (op.fee && !decimal(op.fee))) { setMessage('Completá todos los campos obligatorios con datos válidos; usá punto para los decimales.'); return; }
        if ((op.kind === 'stock' && op.currency !== 'USD') || (op.kind === 'cedear' && op.currency !== 'ARS')) { setMessage('Las acciones se registran en USD y los CEDEARs en ARS.'); return; }
        if (duplicate(op)) { setMessage('Hay otra operación con el mismo ID o datos coincidentes. Revisala y descartá el duplicado antes de confirmar.'); return; }
        const quantity = Number(op.quantity), amount = Number(op.amount), price = Number(op.price);
        if ([op.quantity, op.amount, op.price].some((x, i) => canonical(x) !== canonical(String([quantity, amount, price][i])))) { setMessage('La cartera no admite esta precisión decimal. No se aplicó la operación.'); return; }
        const position = portfolio.investments.find(i => i.id === selection[op.id]);
        if (op.side === 'sell' && (!position || position.kind !== op.kind || position.coin?.toUpperCase() !== op.asset.toUpperCase() || !position.units || quantity > position.units)) { setMessage('Elegí una posición del mismo activo con suficientes unidades para registrar la venta.'); return; }
        update(current => {
            const existing = current.imports?.find(row => row.id === op.id);
            if (!existing || existing.status !== 'pending' || JSON.stringify(existing) !== JSON.stringify(op)) return current;
            let investments = current.investments; let sales = current.sales ?? [];
            if (op.side === 'buy') {
                const investment: Investment = { id: `import-${op.id}`, name: op.name.trim().slice(0, 70), kind: op.kind as 'stock' | 'cedear' | 'crypto', coin: op.kind === 'crypto' ? op.asset.trim().toLowerCase() : op.asset.trim().toUpperCase(), currency: op.currency as 'USD' | 'ARS', amount, units: quantity, date: op.date, purchasePrice: price };
                investments = [...investments, investment];
            } else {
                const match = investments.find(i => i.id === position?.id); if (!match?.units || quantity > match.units) return current;
                const fraction = quantity / match.units; const cost = match.amount * fraction;
                sales = [...sales, { id: `import-${op.id}`, name: match.name, date: op.date, fraction, proceeds: amount, currency: op.currency as 'USD' | 'ARS', cost, costCurrency: match.currency }];
                investments = investments.flatMap(i => i.id !== match.id ? [i] : fraction === 1 ? [] : [{ ...i, units: i.units! - quantity, amount: i.amount - cost }]);
            }
            return { ...current, investments, sales, imports: current.imports!.map(row => row.id === op.id ? { ...row, status: 'confirmed' } : row) };
        });
        setMessage('Operación confirmada. Se está guardando en tu cartera.');
    }
    return <div className="space-y-4"><section className="card p-6"><p className="lb">COMPROBANTES</p><p className="mu mt-2 text-[13px]">Subí un PDF o una imagen. Se envía a OpenAI para leerlo; revisá los datos antes de confirmar.</p><label className="btn-primary mt-4 inline-flex cursor-pointer items-center gap-2"><HugeiconsIcon icon={Upload06Icon} size={17} />{busy ? 'Analizando…' : 'Subir PDF o imagen'}<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => void upload(event)} disabled={busy} /></label><p className="mu mt-2 text-[11px]">Hasta 1,2 MB. Necesitás una API key de OpenAI en la configuración de la app.</p>{message && <p role="status" className="mt-3 text-[12px]">{message}</p>}</section>
        <section><h2 className="mb-3 text-xl font-light">Pendientes <span className="mu text-sm">{operations.filter(op => op.status === 'pending').length}</span></h2><div className="space-y-3">{operations.filter(op => op.status === 'pending').map(op => <article key={op.id} className="card p-5"><div className="flex justify-between gap-3"><p className="mu break-all text-xs">{op.source}</p><button type="button" onClick={() => discard(op.id)} aria-label="Descartar operación"><HugeiconsIcon icon={Delete02Icon} size={17} /></button></div>{duplicate(op) && <p className="mt-3 text-xs text-[var(--neg)]">Posible duplicado: hay otra operación con el mismo ID o datos coincidentes.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-3">{fields.map(field => <label key={field} className="mu text-xs">{labels[field]}{field === 'kind' || field === 'side' || field === 'currency' ? <select className={`${textInput} mt-1`} value={op[field]} onChange={e => edit(op.id, field, e.target.value)}><option value="">Elegir</option>{(field === 'kind' ? [['stock','Acción'],['cedear','CEDEAR'],['crypto','Cripto']] : field === 'side' ? [['buy','Compra'],['sell','Venta']] : [['USD','USD'],['ARS','ARS']]).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select> : <input className={`${textInput} mt-1`} type={field === 'date' ? 'date' : 'text'} value={op[field]} onChange={e => edit(op.id, field, e.target.value)} />}</label>)}</div>{op.executions !== '[]' && <details className="mu mt-4 text-xs"><summary>Ver ejecuciones detectadas</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap">{op.executions}</pre></details>}{op.side === 'sell' && <label className="mu mt-4 block text-xs">Posición a reducir<select className={`${textInput} mt-1`} value={selection[op.id] ?? ''} onChange={e => setSelection(v => ({ ...v, [op.id]: e.target.value }))}><option value="">Elegir posición</option>{portfolio.investments.filter(i => i.kind === op.kind && i.coin?.toUpperCase() === op.asset.toUpperCase()).map(i => <option key={i.id} value={i.id}>{i.name} · {i.units} unidades</option>)}</select></label>}<p className="mu mt-4 text-xs">¿Los datos son correctos?</p><button type="button" className="btn-primary mt-2" onClick={() => confirm(op)}>Confirmar operación</button></article>)}</div></section>
        <section className="card p-5"><h2 className="text-xl font-light">Historial</h2>{operations.filter(op => op.status !== 'pending').length ? <ul className="mt-3 divide-y divide-[var(--line)]">{operations.filter(op => op.status !== 'pending').map(op => <li key={op.id} className="flex justify-between gap-3 py-3 text-xs"><span>{op.name || op.asset} · {op.date}</span><span className="mu">{op.status === 'confirmed' ? 'Confirmada' : 'Descartada'}</span></li>)}</ul> : <p className="mu mt-3 text-xs">Todavía no hay operaciones procesadas.</p>}</section></div>;
}
