import { useState } from 'react';

export default function AlertDays({ values, onChange }: { values: number[]; onChange: (value: number[]) => void }) {
    const [custom, setCustom] = useState(false);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const toggle = (days: number) => onChange(values.includes(days) ? values.filter(value => value !== days) : [...values, days]);
    const customValues = values.filter(value => ![0, 1, 7].includes(value));
    return <fieldset>
        <legend className="text-[11px] text-[var(--muted)]">Cuándo avisar <span className="text-[var(--faint)]">· Podés elegir varias opciones</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
            {([[0, 'En el día'], [1, '1 día antes'], [7, '1 semana antes']] as const).map(([days, label]) => <button type="button" key={days} aria-pressed={values.includes(days)} onClick={() => toggle(days)} className={`rounded-lg border px-3 py-2 text-[12px] transition-colors ${values.includes(days) ? 'border-[var(--sig)] bg-[var(--sigbg)] text-[var(--sig)]' : 'border-[var(--line2)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>{label}</button>)}
            <button type="button" aria-expanded={custom} onClick={() => setCustom(open => !open)} className={`rounded-lg border px-3 py-2 text-[12px] transition-colors ${custom || customValues.length ? 'border-[var(--sig)] text-[var(--sig)]' : 'border-[var(--line2)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>Personalizado</button>
        </div>
        {custom && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="block text-[11px] text-[var(--muted)]">Días antes<input type="text" inputMode="numeric" value={input.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} onChange={event => { setInput(event.target.value.replace(/\D/g, '')); setError(''); }} placeholder="Cantidad de días" className="mt-1.5 block w-40 rounded-[10px] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5 text-[12px] text-[var(--ink)]" /></label><button type="button" className="btn-ghost !min-h-10 text-[12px]" onClick={() => { const days = Number(input); if (!input || !Number.isSafeInteger(days) || days > 1e15) { setError('Ingresá una cantidad de días válida.'); return; } if (!values.includes(days)) onChange([...values, days]); setInput(''); setError(''); }}>Agregar</button></div>}
        {error && <p role="status" className="mu mt-2 text-[11px]">{error}</p>}
        {customValues.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{customValues.map(days => <button type="button" key={days} onClick={() => toggle(days)} aria-label={`Quitar aviso de ${days} días antes`} className="rounded-lg border border-[var(--line2)] px-3 py-2 text-[11px] text-[var(--muted)]">{days.toLocaleString('es-AR')} días antes ×</button>)}</div>}
    </fieldset>;
}
