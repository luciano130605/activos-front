import { useEffect, useState } from 'react';
import { request } from './account';

type Event = { payDate: string; exDate: string; amountPerShare: number; eligible: boolean; estimatedGross: number };
type Position = { id: string; name: string; ticker: string; units: number; ratio?: number; status: 'ok' | 'missing_ratio' | 'unavailable'; events?: Event[] };
type Result = { configured: boolean; items: Position[] };
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-AR');
const usd = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);

export default function Dividends({ dirty, hidden }: { dirty: boolean; hidden: boolean }) {
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = { active: true };
        request<Result>('dividends').then(data => { if (controller.active) setResult(data); }).catch(() => { if (controller.active) setError('No se pudieron consultar los dividendos. Volvé a intentar más tarde.'); }).finally(() => { if (controller.active) setLoading(false); });
        return () => { controller.active = false; };
    }, []);
    return <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="text-[16px] font-medium">Próximos dividendos</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">Estimación bruta en dólares según tus CEDEARs y los pagos anunciados del activo de origen.</p>
        {dirty && <p className="mt-4 text-[12px] text-[#ffb36b]">Hay cambios sin guardar: esta sección usa la última cartera guardada en tu cuenta.</p>}
        {loading ? <p className="mt-6 text-[13px] text-[var(--muted)]" role="status">Consultando dividendos…</p> : error ? <p className="mt-6 text-[13px] text-[#ff7d52]" role="alert">{error}</p> : !result?.configured ? <p className="mt-6 text-[13px] text-[var(--muted)]">Para consultar dividendos, configurá MASSIVE_API_KEY en el backend.</p> : !result.items.length ? <p className="mt-6 text-[13px] text-[var(--muted)]">No hay CEDEARs en tu cartera guardada.</p> : <div className="mt-5 divide-y divide-[var(--line)]">{result.items.map(item => <article key={item.id} className="py-4 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-[14px] font-medium">{item.name} <span className="font-mono text-[11px] text-[var(--muted)]">{item.ticker}</span></h3><span className="font-mono text-[11px] text-[var(--muted)]">{hidden ? '****' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6 }).format(item.units)} CEDEARs</span></div>
            {item.status === 'missing_ratio' ? <p className="mt-2 text-[12px] text-[var(--muted)]">No hay un ratio disponible para calcular este activo.</p> : item.status === 'unavailable' ? <p className="mt-2 text-[12px] text-[var(--muted)]">No se pudo consultar este activo.</p> : !item.events?.length ? <p className="mt-2 text-[12px] text-[var(--muted)]">No hay próximos pagos anunciados disponibles.</p> : <div className="mt-3 space-y-3">{item.events.map((event, index) => <div key={`${event.exDate}-${index}`} className="rounded-xl bg-[var(--raised)] p-3 text-[12px]"><div className="flex flex-wrap justify-between gap-2"><span>Pago del subyacente: {date(event.payDate)}</span><strong className="font-medium">{event.eligible ? hidden ? '****' : usd(event.estimatedGross) : 'Compra posterior al corte'}</strong></div><p className="mt-1 text-[11px] text-[var(--muted)]">Fecha ex: {date(event.exDate)} · Ratio: {item.ratio}:1 · {usd(event.amountPerShare)} por acción subyacente</p></div>)}</div>}
        </article>)}</div>}
        <p className="mt-5 border-t border-[var(--line)] pt-4 text-[11px] leading-5 text-[var(--muted)]">La fecha corresponde al pago del activo de origen; la acreditación del CEDEAR puede ser posterior. El monto es estimado antes de impuestos y comisiones. La elegibilidad depende de la fecha de corte y de las tenencias efectivas. Ratios orientativos de <a className="underline" href="https://ferminrp.github.io/google-sheets-argento/" target="_blank" rel="noreferrer">Google Sheets Argento</a>; dividendos de <a className="underline" href="https://massive.com/docs/rest/stocks/corporate-actions/dividends" target="_blank" rel="noreferrer">Massive</a>. Verificá el pago en tu bróker.</p>
    </section>;
}
