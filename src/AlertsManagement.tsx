import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ChevronLeft,
    Delete02Icon,
    Edit01Icon,
    LoaderIcon,
    Alert02Icon,
    Coins01Icon,
    CheckIcon,
} from '@hugeicons/core-free-icons';
import { enableDividendPush } from './DividendPushSettings';
import Select from './Select';
import { request } from './account';
import type { PriceAlert } from './portfolio';
import type { AlertStatus } from './usePriceAlerts';

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
    const [editing, setEditing] = useState<PriceAlert | null>(null);
    const [threshold, setThreshold] = useState('');
    const [error, setError] = useState('');
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

    const [testing, setTesting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ id: string; text: string } | null>(null);

    const labels = {
        price: 'Precio objetivo',
        variation: 'Variación',
        concentration: 'Concentración',
        dividend: 'Dividendo',
        maturity: 'Vencimiento',
    };

    const field =
        'mt-1.5 w-full rounded-xl border border-[var(--line2)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--muted)]';

    async function testTelegram(alert: PriceAlert) {
        setTesting(`telegram:${alert.id}`);
        setMessage(null);
        try {
            await request('telegram/test', 'POST', { alertId: alert.id });
            setMessage({ id: alert.id, text: 'Prueba enviada a Telegram.' });
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
        <div className="space-y-5">
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-3">
                    <button
                        ref={backRef}
                        type="button"
                        className="ibtn !h-8 !w-8"
                        aria-label="Volver a configuración"
                        onClick={onBack}
                    >
                        <HugeiconsIcon icon={ChevronLeft} size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 id="alerts-management-title" className="text-lg font-medium text-[var(--ink)]">
                                Mis alertas
                            </h2>
                            {alerts.length > 0 && (
                                <span className="rounded-full bg-[var(--raised)] border border-[var(--line)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                                    {alerts.length}
                                </span>
                            )}
                        </div>
                        <p className="mu mt-0.5 text-[11.5px]">Revisá, editá o probá tus alertas activas.</p>
                    </div>
                </div>
            </div>

            {/* Listado de alertas en tarjetas */}
            <div className="space-y-3">
                {alerts.length ? (
                    alerts.map(alert => {
                        const status = statuses[alert.id];
                        const isTriggered = status?.state === 'triggered';
                        const isWaiting = status?.state === 'waiting';

                        return (
                            <article
                                key={alert.id}
                                className="rounded-xl border border-[var(--line)] bg-[var(--raised)]/40 p-4 transition-all hover:border-[var(--line2)]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-[13px] font-medium text-[var(--ink)]">
                                                {alert.assetName}
                                            </p>
                                            {alert.assetId && (
                                                <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                                                    {alert.assetId}
                                                </span>
                                            )}
                                            <span
                                                className={`pill text-[10px] ${
                                                    isTriggered
                                                        ? ''
                                                        : isWaiting
                                                        ? 'opacity-85'
                                                        : 'opacity-50'
                                                }`}
                                            >
                                                {isTriggered ? 'Activada' : isWaiting ? 'En seguimiento' : 'Sin datos'}
                                            </span>
                                        </div>

                                        <p className="mt-1 text-[12px] text-[var(--muted)] font-mono">
                                            {labels[alert.kind]} ·{' '}
                                            {alert.kind === 'price'
                                                ? `${alert.direction === 'above' ? '≥' : '≤'} $${alert.threshold.toLocaleString('es-AR')}`
                                                : `${alert.threshold}${
                                                      alert.kind === 'variation' || alert.kind === 'concentration'
                                                          ? '%'
                                                          : ' días antes'
                                                  }`}
                                            {alert.date ? ` · ${alert.date}` : ''}
                                        </p>

                                        {status?.message && (
                                            <p className="mu mt-1 text-[11px]">{status.message}</p>
                                        )}

                                        {(alert.kind === 'price' || alert.kind === 'dividend') && (
                                            <p className="mu mt-1 text-[10.5px]">
                                                Canal:{' '}
                                                <span className="text-[var(--ink)] font-medium">
                                                    {alert.channels === 'push'
                                                        ? 'Solo Push'
                                                        : alert.channels === 'telegram'
                                                        ? 'Solo Telegram'
                                                        : 'Push y Telegram'}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Botones de acción */}
                                    <div className="flex shrink-0 items-center gap-1">
                                        <button
                                            type="button"
                                            className="ibtn !h-8 !w-8"
                                            title="Editar alerta"
                                            aria-label={`Editar alerta de ${alert.assetName}`}
                                            onClick={() => {
                                                setEditing({ ...alert });
                                                setThreshold(String(alert.threshold));
                                                setError('');
                                            }}
                                        >
                                            <HugeiconsIcon icon={Edit01Icon} size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            className="ibtn !h-8 !w-8 text-[var(--muted)] hover:text-[var(--neg)]"
                                            title="Eliminar alerta"
                                            aria-label={`Eliminar alerta de ${alert.assetName}`}
                                            onClick={() => {
                                                if (window.confirm(`¿Eliminar la alerta de ${alert.assetName}?`)) {
                                                    if (editing?.id === alert.id) setEditing(null);
                                                    onDelete(alert.id);
                                                }
                                            }}
                                        >
                                            <HugeiconsIcon icon={Delete02Icon} size={15} />
                                        </button>
                                    </div>
                                </div>

                                {/* Botones para probar canales */}
                                {(alert.kind === 'price' || alert.kind === 'dividend') && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                                        <button
                                            type="button"
                                            className="btn-ghost !min-h-8 text-[11px]"
                                            disabled={testing !== null}
                                            onClick={() => {
                                                setTesting(alert.id);
                                                setMessage(null);
                                                void enableDividendPush(true, alert.id)
                                                    .then(() =>
                                                        setMessage({
                                                            id: alert.id,
                                                            text: 'Prueba enviada a este dispositivo.',
                                                        })
                                                    )
                                                    .catch(error =>
                                                        setMessage({
                                                            id: alert.id,
                                                            text:
                                                                error instanceof Error
                                                                    ? error.message
                                                                    : 'No se pudo enviar la prueba.',
                                                        })
                                                    )
                                                    .finally(() => setTesting(null));
                                            }}
                                        >
                                            {testing === alert.id ? (
                                                <HugeiconsIcon icon={LoaderIcon} size={13} className="animate-spin" />
                                            ) : null}
                                            {testing === alert.id ? 'Enviando…' : 'Probar push'}
                                        </button>

                                        <button
                                            type="button"
                                            className="btn-ghost !min-h-8 text-[11px]"
                                            disabled={testing !== null}
                                            onClick={() => void testTelegram(alert)}
                                        >
                                            {testing === `telegram:${alert.id}` ? (
                                                <HugeiconsIcon icon={LoaderIcon} size={13} className="animate-spin" />
                                            ) : null}
                                            {testing === `telegram:${alert.id}` ? 'Enviando…' : 'Probar en Telegram'}
                                        </button>
                                    </div>
                                )}

                                {message?.id === alert.id && (
                                    <p role="status" className="mu mt-2 text-[11px] text-[var(--sig)]">
                                        {message.text}
                                    </p>
                                )}

                                {/* Formulario de edición */}
                                {editing?.id === alert.id && (
                                    <form
                                        className="mt-3 space-y-3.5 rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-4 shadow-sm"
                                        onSubmit={save}
                                    >
                                        <div>
                                            <p className="text-[12.5px] font-medium text-[var(--ink)]">Editar alerta</p>
                                            <p className="mu mt-0.5 text-[11px]">
                                                Ajustá los umbrales de aviso para {alert.assetName}.
                                            </p>
                                        </div>

                                        <label className="block text-[11px] text-[var(--muted)]">
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
                                            <div>
                                                <p className="mu mb-1 text-[11px]">Condición</p>
                                                <Select
                                                    label="Condición de la alerta"
                                                    value={editing.direction}
                                                    onChange={direction => setEditing({ ...editing, direction })}
                                                    options={[
                                                        {
                                                            value: 'above',
                                                            label: editing.kind === 'price' ? 'Igual o superior' : 'Sube',
                                                        },
                                                        {
                                                            value: 'below',
                                                            label: editing.kind === 'price' ? 'Igual o inferior' : 'Baja',
                                                        },
                                                    ]}
                                                />
                                            </div>
                                        )}

                                        {editing.kind === 'maturity' && (
                                            <label className="block text-[11px] text-[var(--muted)]">
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

                                        {(editing.kind === 'price' || editing.kind === 'dividend') && (
                                            <div>
                                                <p className="mu mb-1 text-[11px]">Recibir por</p>
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
                                        )}

                                        {error && (
                                            <p role="alert" className="text-[11px] text-[var(--neg)]">
                                                {error}
                                            </p>
                                        )}

                                        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
                                            <button
                                                type="button"
                                                className="btn-ghost !min-h-8 text-[12px]"
                                                onClick={() => setEditing(null)}
                                            >
                                                Cancelar
                                            </button>
                                            <button type="submit" className="btn-primary !min-h-8 text-[12px]">
                                                Guardar
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </article>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--raised)]/30 px-6 py-10 text-center">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--raised)] text-[var(--muted)]">
                            <HugeiconsIcon icon={Alert02Icon} size={20} />
                        </div>
                        <p className="mt-3 text-[13px] font-medium text-[var(--ink)]">Sin alertas activas</p>
                        <p className="mu mt-1 max-w-[240px] text-[11.5px]">
                            Podés crear alertas de precio desde la vista de <strong>Precios</strong> o alertas de cobro
                            desde <strong>Dividendos</strong>.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
