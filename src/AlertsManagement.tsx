import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChevronLeft, Edit01Icon, Cancel01Icon, Alert02Icon } from '@hugeicons/core-free-icons';
import { enableDividendPush } from './DividendPushSettings';
import Select from './Select';
import { request } from './account';
import type { PriceAlert } from './portfolio';
import type { AlertStatus } from './usePriceAlerts';

const labels = {
    price: 'Precio',
    variation: 'Variación',
    concentration: 'Concentración',
    dividend: 'Dividendo',
    maturity: 'Vencimiento',
};

const field =
    'mt-1.5 w-full rounded-[11px] border border-[var(--line2)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--muted)]';
const fieldLabel = 'block text-[11px] text-[var(--muted)]';
const textLink =
    'text-[11.5px] text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline disabled:opacity-50 disabled:hover:no-underline';

function condition(alert: PriceAlert) {
    const value =
        alert.kind === 'price'
            ? `${alert.direction === 'above' ? '≥' : '≤'} $${alert.threshold.toLocaleString('es-AR')}`
            : alert.kind === 'variation'
            ? `${alert.direction === 'above' ? '+' : '−'}${alert.threshold}%`
            : alert.kind === 'concentration'
            ? `${alert.threshold}%`
            : `${alert.threshold} días antes`;
    return `${labels[alert.kind]} ${value}${alert.date ? ` · ${alert.date}` : ''}`;
}

export default function AlertsManagement({
    alerts,
    statuses,
    onDelete,
    onSave,
    onBack,
}: {
    alerts: PriceAlert[];
    statuses: Record<string, AlertStatus>;
    onDelete: (id: string) => void;
    onSave: (alert: PriceAlert) => void;
    onBack: () => void;
}) {
    const backRef = useRef<HTMLButtonElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [editing, setEditing] = useState<PriceAlert | null>(null);
    const [threshold, setThreshold] = useState('');
    const [error, setError] = useState('');
    const [testing, setTesting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
    const editingRef = useRef(editing);
    editingRef.current = editing;
    const onBackRef = useRef(onBack);
    onBackRef.current = onBack;

    useEffect(() => {
        backRef.current?.focus();
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (editingRef.current) setEditing(null);
                else onBackRef.current();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    const editingId = editing?.id;
    useEffect(() => {
        if (editingId) formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [editingId]);

    async function test(alert: PriceAlert, channel: 'push' | 'telegram') {
        setTesting(`${channel}:${alert.id}`);
        setMessage(null);
        try {
            if (channel === 'push') await enableDividendPush(true, alert.id);
            else await request('telegram/test', 'POST', { alertId: alert.id });
            setMessage({
                id: alert.id,
                text: channel === 'push' ? 'Prueba enviada a este dispositivo.' : 'Prueba enviada a Telegram.',
            });
        } catch (error) {
            setMessage({
                id: alert.id,
                text: error instanceof Error ? error.message : 'No se pudo enviar la prueba.',
            });
        } finally {
            setTesting(null);
        }
    }

    function save(event: FormEvent) {
        event.preventDefault();
        if (!editing) return;
        const value = Number(threshold.replace(',', '.'));
        const days = editing.kind === 'dividend' || editing.kind === 'maturity';
        if (
            !threshold.trim() ||
            !Number.isFinite(value) ||
            value > 1e15 ||
            (days ? value < 0 || !Number.isInteger(value) : value <= 0) ||
            (editing.kind === 'concentration' && value > 100)
        )
            return setError(
                days
                    ? 'Ingresá una cantidad entera de días igual o mayor a cero.'
                    : 'Ingresá un valor válido para la alerta.'
            );
        if (editing.kind === 'maturity' && !editing.date) return setError('Elegí la fecha de vencimiento.');
        onSave({ ...editing, threshold: value });
        setEditing(null);
        setError('');
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Cabecera (fija) */}
            <header className="flex shrink-0 items-center gap-3 pb-4">
                <button
                    ref={backRef}
                    type="button"
                    className="ibtn !h-9 !w-9"
                    aria-label="Volver a configuración"
                    onClick={onBack}
                >
                    <HugeiconsIcon icon={ChevronLeft} size={18} />
                </button>
                <div className="min-w-0">
                    <h2
                        id="alerts-management-title"
                        className="text-[17px] font-medium tracking-[-0.02em] text-[var(--ink)]"
                    >
                        Mis alertas
                    </h2>
                    <p className="mu !text-[11.5px]">
                        {alerts.length
                            ? `${alerts.length} ${alerts.length === 1 ? 'configurada' : 'configuradas'}`
                            : 'Ninguna configurada'}
                    </p>
                </div>
            </header>

            {/* Listado (con scroll propio) */}
            <div className="-mr-3 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--line)] pr-3">
                {alerts.length ? (
                    <ul className="divide-y divide-[var(--line)]">
                        {alerts.map(alert => {
                            const status = statuses[alert.id];
                            const triggered = status?.state === 'triggered';
                            const waiting = status?.state === 'waiting';
                            const open = editing?.id === alert.id;
                            const testable = alert.kind === 'price' || alert.kind === 'dividend';
                            const ticker = alert.assetId && alert.assetId.length <= 10 ? alert.assetId : '';

                            return (
                                <li key={alert.id} className="py-3.5">
                                    <div className="flex items-center gap-3">
                                        <span
                                            aria-hidden="true"
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{
                                                background: triggered
                                                    ? 'var(--sig)'
                                                    : waiting
                                                    ? 'var(--muted)'
                                                    : 'var(--line2)',
                                            }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-baseline gap-2 text-[13px] font-medium text-[var(--ink)]">
                                                <span className="truncate">{alert.assetName}</span>
                                                {ticker && (
                                                    <span className="shrink-0 font-mono text-[10.5px] font-normal text-[var(--muted)]">
                                                        {ticker}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                                                {condition(alert)}
                                                <span className={triggered ? 'text-[var(--sig)]' : ''}>
                                                    {' · '}
                                                    {triggered ? 'Activada' : waiting ? 'En seguimiento' : 'Sin datos'}
                                                </span>
                                            </p>
                                            {status?.message && (
                                                <p className="mt-0.5 hidden truncate text-[11px] text-[var(--muted)] opacity-80 sm:block">
                                                    {status.message}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="ibtn !h-8 !w-8 !border-transparent !bg-transparent hover:!bg-[var(--raised)]"
                                            aria-expanded={open}
                                            aria-label={`${open ? 'Cerrar edición de' : 'Editar'} alerta de ${alert.assetName}`}
                                            onClick={() => {
                                                if (open) return setEditing(null);
                                                setEditing({ ...alert });
                                                setThreshold(String(alert.threshold));
                                                setError('');
                                                setMessage(null);
                                            }}
                                        >
                                            <HugeiconsIcon icon={open ? Cancel01Icon : Edit01Icon} size={15} />
                                        </button>
                                    </div>

                                    {/* Edición */}
                                    {open && editing && (
                                        <form
                                            ref={formRef}
                                            className="mt-3 space-y-3 rounded-[14px] bg-[var(--raised)] p-3.5"
                                            onSubmit={save}
                                        >
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <label className={fieldLabel}>
                                                    {editing.kind === 'price'
                                                        ? 'Precio objetivo'
                                                        : editing.kind === 'variation' || editing.kind === 'concentration'
                                                        ? 'Porcentaje'
                                                        : 'Días antes'}
                                                    <input
                                                        className={field}
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        max={editing.kind === 'concentration' ? '100' : '1000000000000000'}
                                                        step={
                                                            editing.kind === 'dividend' || editing.kind === 'maturity'
                                                                ? '1'
                                                                : 'any'
                                                        }
                                                        value={threshold}
                                                        onChange={event => setThreshold(event.target.value)}
                                                        required
                                                    />
                                                </label>

                                                {(editing.kind === 'price' || editing.kind === 'variation') && (
                                                    <div className={fieldLabel}>
                                                        Condición
                                                        <div className="mt-1.5">
                                                            <Select
                                                                label="Condición de la alerta"
                                                                value={editing.direction}
                                                                onChange={direction => setEditing({ ...editing, direction })}
                                                                options={[
                                                                    {
                                                                        value: 'above',
                                                                        label:
                                                                            editing.kind === 'price'
                                                                                ? 'Igual o superior'
                                                                                : 'Sube',
                                                                    },
                                                                    {
                                                                        value: 'below',
                                                                        label:
                                                                            editing.kind === 'price'
                                                                                ? 'Igual o inferior'
                                                                                : 'Baja',
                                                                    },
                                                                ]}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {editing.kind === 'maturity' && (
                                                    <label className={fieldLabel}>
                                                        Fecha de vencimiento
                                                        <input
                                                            className={field}
                                                            type="date"
                                                            value={editing.date}
                                                            onChange={event =>
                                                                setEditing({ ...editing, date: event.target.value })
                                                            }
                                                            required
                                                        />
                                                    </label>
                                                )}

                                                {testable && (
                                                    <div className={fieldLabel}>
                                                        Recibir por
                                                        <div className="mt-1.5">
                                                            <Select
                                                                label="Canal de la alerta"
                                                                value={editing.channels ?? 'both'}
                                                                onChange={channels => setEditing({ ...editing, channels })}
                                                                options={[
                                                                    { value: 'both', label: 'Push y Telegram' },
                                                                    { value: 'push', label: 'Solo push' },
                                                                    { value: 'telegram', label: 'Solo Telegram' },
                                                                ]}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {testable && (
                                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted)]">
                                                    Probar aviso:
                                                    <button
                                                        type="button"
                                                        className={textLink}
                                                        disabled={testing !== null}
                                                        onClick={() => void test(alert, 'push')}
                                                    >
                                                        {testing === `push:${alert.id}` ? 'Enviando…' : 'Push'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={textLink}
                                                        disabled={testing !== null}
                                                        onClick={() => void test(alert, 'telegram')}
                                                    >
                                                        {testing === `telegram:${alert.id}` ? 'Enviando…' : 'Telegram'}
                                                    </button>
                                                </p>
                                            )}

                                            {message?.id === alert.id && (
                                                <p role="status" className="text-[11.5px] text-[var(--muted)]">
                                                    {message.text}
                                                </p>
                                            )}
                                            {error && (
                                                <p role="alert" className="text-[11.5px] text-[var(--neg)]">
                                                    {error}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    className="mr-auto text-[12px] text-[var(--neg)] underline-offset-4 hover:underline"
                                                    onClick={() => {
                                                        if (window.confirm(`¿Eliminar la alerta de ${alert.assetName}?`)) {
                                                            setEditing(null);
                                                            onDelete(alert.id);
                                                        }
                                                    }}
                                                >
                                                    Eliminar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-ghost !min-h-9 !text-[12px]"
                                                    onClick={() => setEditing(null)}
                                                >
                                                    Cancelar
                                                </button>
                                                <button type="submit" className="btn-primary !min-h-9 !text-[12px]">
                                                    Guardar
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center px-6 py-12 text-center">
                        <span className="text-[var(--muted)]">
                            <HugeiconsIcon icon={Alert02Icon} size={22} />
                        </span>
                        <p className="mt-3 text-[13px] font-medium text-[var(--ink)]">Sin alertas</p>
                        <p className="mu mt-1 max-w-[240px] !text-[11.5px]">
                            Creá alertas de precio desde Precios o de cobro desde Dividendos.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
