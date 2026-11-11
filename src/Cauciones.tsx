import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChevronRight, LoaderIcon } from '@hugeicons/core-free-icons';
import { request } from './account';
import type { Investment } from './portfolio';

export type Caucion = { plazo: number; tasa: number; monto: number; fecha: string; bucket: string | null; usual: number | null };
export type RateHistory = { bucket: string; date: string; tasa: number };
type Option = { kind: string; name: string; tna: number; days: number; gain: number };
export type Rates = { fecha: string; live: boolean; cauciones: Caucion[]; history?: RateHistory[]; spikes: { plazo: number }[]; options: Option[] };

const today = () => new Date().toLocaleDateString('en-CA');
const pct = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
const pesos = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const dias = (days: number) => `${days} ${days === 1 ? 'día' : 'días'}`;
const formatDate = (iso: string) => iso.split('-').reverse().join('/');
function addDays(iso: string, days: number) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

// Listado de cauciones colocadoras en pesos: se cargan como inversión con tasa y vencimiento.
export default function Cauciones({ onAdd, onChoose }: { onAdd?: (investment: Investment) => void; onChoose?: (row: Caucion) => void }) {
    const [rates, setRates] = useState<Rates | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [selected, setSelected] = useState<Caucion | null>(null);
    const [amount, setAmount] = useState('');
    const [rate, setRate] = useState('');
    const [date, setDate] = useState(today);
    const [formError, setFormError] = useState('');
    useEffect(() => {
        let active = true;
        setRates(null); setError('');
        request<Rates>('rates').then(data => { if (active) setRates(data); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron consultar las tasas.'); });
        return () => { active = false; };
    }, [attempt]);
    function choose(row: Caucion) { if (onChoose) return onChoose(row); setSelected(row); setRate(String(row.tasa)); setFormError(''); }
    function add() {
        if (!selected || !onAdd) return;
        const value = Number(amount), tna = Number(rate);
        if (!Number.isFinite(value) || value <= 0) return setFormError('Ingresá un monto mayor a cero.');
        if (!rate.trim() || !Number.isFinite(tna) || tna < 0) return setFormError('Ingresá la tasa anual que te tomaron.');
        const check = new Date(`${date}T12:00:00Z`);
        if (!date || !Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== date || date > today()) return setFormError('Ingresá una fecha válida que no sea futura.');
        onAdd({ id: crypto.randomUUID(), name: `Caución ${dias(selected.plazo)}`, amount: value, currency: 'ARS', date, kind: 'rate', rate: tna, period: 'year', maturityDate: addDays(date, selected.plazo) });
    }
    if (error) return <div className="p-4"><p role="alert" className="text-[13px] text-[var(--neg)]">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 text-[12px] underline">Reintentar</button></div>;
    if (!rates) return <p role="status" className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--muted)]"><HugeiconsIcon icon={LoaderIcon} size={17} className="animate-spin" />Cargando cauciones…</p>;
    const spikes = new Set(rates.spikes.map(row => row.plazo));
    const value = Number(amount), tna = Number(rate);
    const gain = selected && value > 0 && tna >= 0 ? value * tna / 100 * selected.plazo / 365 : NaN;
    const others = rates.options.filter(option => option.kind !== 'caucion');
    return <section>
        <p role="status" className="mu px-2 pb-2 text-[10px]">{rates.cauciones.length} plazos · pesos · ArgentinaDatos (IOL){rates.fecha && ` · rueda del ${formatDate(rates.fecha)}`}</p>
        {onChoose && <p className="mx-2 mb-2 rounded-lg border border-[var(--line2)] bg-[var(--raised)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">La comparación simula renovar la caución todo el período. Usa las tasas diarias que registró el radar y, para las fechas anteriores, la tasa actual: no es el rendimiento histórico real.</p>}
        {!onChoose && !rates.live && rates.cauciones.length > 0 && <p className="mx-2 mb-2 rounded-lg border border-[var(--line2)] bg-[var(--raised)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">Estas tasas no son de la rueda de hoy. Usalas como referencia y corregí la tasa con la que te tomaron.</p>}
        {rates.cauciones.length === 0 ? <p className="px-2 py-10 text-center text-[13px] text-[var(--muted)]">El proveedor no informa cauciones en este momento.</p> : rates.cauciones.map(row => <button key={row.plazo} type="button" aria-pressed={selected?.plazo === row.plazo} onClick={() => choose(row)} className={`group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[var(--raised)] focus-visible:bg-[var(--raised)] ${selected?.plazo === row.plazo ? 'bg-[var(--raised)]' : ''}`}>
            <span className="tk !h-9 !w-9 !rounded-[10px] !text-[9.5px]" style={{ ['--c' as string]: 'var(--c-rate)' }}>{row.plazo}D</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">Caución a {dias(row.plazo)}{spikes.has(row.plazo) && <span className="ml-2 rounded-full border border-[var(--line2)] px-2 py-0.5 text-[10px] font-normal">Por encima de lo habitual</span>}</span><span className="mu mt-1 block truncate text-[10px]">{row.usual != null ? `Habitual ${pct(row.usual)} · ` : ''}cada $100.000 ≈ {pesos(100_000 * row.tasa / 100 * row.plazo / 365)}</span></span>
            <span className="shrink-0 text-right text-[13px] font-medium">{pct(row.tasa)}<span className="mu block text-[10px] font-normal">TNA</span></span><HugeiconsIcon icon={ChevronRight} size={16} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--ink)]" />
        </button>)}
        {selected && <div className="mt-3 space-y-3 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-4">
            <p className="text-[13px] font-medium">Agregar caución a {dias(selected.plazo)}</p>
            <div className="grid grid-cols-2 gap-3"><label className="mu block text-[11px]">Monto colocado (ARS)<input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[14px] text-[var(--ink)]" /></label><label className="mu block text-[11px]">Tasa anual (%)<input type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={event => setRate(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[14px] text-[var(--ink)]" /></label></div>
            <label className="mu block text-[11px]">Fecha de colocación<input type="date" value={date} max={today()} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[14px] text-[var(--ink)]" /></label>
            {Number.isFinite(gain) && date && <p className="mu text-[11px] leading-5">Vence el {formatDate(addDays(date, selected.plazo))} · interés estimado {pesos(gain)} antes de comisiones.</p>}
            {formError && <p role="alert" className="text-[12px] text-[var(--neg)]">{formError}</p>}
            <div className="flex gap-2"><button type="button" className="btn-primary" onClick={add}>Agregar inversión</button><button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Cancelar</button></div>
        </div>}
        {!onChoose && others.length > 0 && <div className="mt-4 border-t border-[var(--line)] px-2 pt-4"><p className="lb mb-2">OTRAS OPCIONES HOY</p>{others.map(option => <div key={option.name} className="flex items-center justify-between gap-3 py-1.5 text-[12px]"><span className="min-w-0 truncate">{option.name}<span className="mu"> · {dias(option.days)}</span></span><span className="shrink-0">{pct(option.tna)}<span className="mu"> · {pesos(option.gain)}</span></span></div>)}<p className="mu mt-2 text-[10px]">Ganancia bruta estimada cada $100.000 al plazo indicado.</p></div>}
    </section>;
}
