import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Cancel01Icon,
    ChartLineData01Icon,
    PieChart02Icon,
    Coins01Icon,
    TargetDollarIcon,
    ChevronRight,
    LoaderIcon,
} from '@hugeicons/core-free-icons';
import { isTauriApp, request, type Account } from './account';
import type { Investment, Kind } from './portfolio';

type WidgetKind = 'market' | 'portfolio' | 'dollar' | 'asset';
type AssetKind = Exclude<Kind, 'rate'>;
type TauriAPI = NonNullable<Window['__TAURI__']>;

export default function DesktopWidgets() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Investment[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState('');

    useEffect(() => {
        const show = () => {
            setOpen(true);
            setError('');
        };
        window.addEventListener('open-desktop-widgets', show);
        return () => window.removeEventListener('open-desktop-widgets', show);
    }, []);

    useEffect(() => {
        if (!open) return;
        let active = true;
        setBusy(true);
        request<Account>('session')
            .then(account => {
                if (active) {
                    const valid = account.portfolio.investments.filter(item => item.coin);
                    setItems(valid);
                    setSelected(valid[0]?.id ?? '');
                }
            })
            .catch(cause => {
                if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los activos.');
            })
            .finally(() => {
                if (active) setBusy(false);
            });
        return () => {
            active = false;
        };
    }, [open]);

    const launch = async (widget: WidgetKind, item?: Investment) => {
        const tauri = window.__TAURI__ as TauriAPI | undefined;
        if (!tauri) return;
        setBusy(true);
        setError('');
        try {
            await tauri.core.invoke('open_widget', {
                widget,
                ...(item ? { kind: item.kind as AssetKind, id: item.coin } : {}),
            });
            setOpen(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudo abrir el widget.');
        } finally {
            setBusy(false);
        }
    };

    if (!isTauriApp || !open) return null;

    const chosen = items.find(item => item.id === selected);

    return (
        <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150"
            onMouseDown={event => {
                if (event.target === event.currentTarget && !busy) setOpen(false);
            }}
        >
            <section
                className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line2)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150"
                role="dialog"
                aria-modal="true"
                aria-labelledby="widget-launch-title"
            >
                {/* Botón cerrar */}
                <button
                    type="button"
                    className="ibtn absolute top-5 right-5 !h-8 !w-8"
                    aria-label="Cerrar panel de widgets"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                >
                    <HugeiconsIcon icon={Cancel01Icon} size={16} />
                </button>

                {/* Encabezado */}
                <div>
                    <span className="lb text-[10.5px]">ACTIVOS · ESCRITORIO</span>
                    <h2 id="widget-launch-title" className="mt-1 text-2xl font-light tracking-tight text-[var(--ink)]">
                        Widgets flotantes
                    </h2>
                    <p className="mu mt-1 text-[12.5px]">
                        Dejá cotizaciones en tiempo real, tu cartera o un activo flotando sobre tu pantalla.
                    </p>
                </div>

                {/* Opciones principales de widgets */}
                <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void launch('market')}
                        className="group flex flex-col items-start rounded-xl border border-[var(--line)] bg-[var(--raised)]/50 p-4 text-left transition-all hover:border-[var(--line2)] hover:bg-[var(--raised)] disabled:opacity-50"
                    >
                        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--sig)] group-hover:scale-105 transition-transform">
                            <HugeiconsIcon icon={ChartLineData01Icon} size={16} />
                        </span>
                        <strong className="mt-3 text-[13px] font-medium text-[var(--ink)]">Mercado</strong>
                        <span className="mu mt-1 text-[11px] leading-snug">Cotizaciones con sparklines en vivo</span>
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void launch('portfolio')}
                        className="group flex flex-col items-start rounded-xl border border-[var(--line)] bg-[var(--raised)]/50 p-4 text-left transition-all hover:border-[var(--line2)] hover:bg-[var(--raised)] disabled:opacity-50"
                    >
                        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--sig)] group-hover:scale-105 transition-transform">
                            <HugeiconsIcon icon={PieChart02Icon} size={16} />
                        </span>
                        <strong className="mt-3 text-[13px] font-medium text-[var(--ink)]">Mi cartera</strong>
                        <span className="mu mt-1 text-[11px] leading-snug">Patrimonio total y variación del día</span>
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void launch('dollar')}
                        className="group flex flex-col items-start rounded-xl border border-[var(--line)] bg-[var(--raised)]/50 p-4 text-left transition-all hover:border-[var(--line2)] hover:bg-[var(--raised)] disabled:opacity-50"
                    >
                        <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--sig)] group-hover:scale-105 transition-transform">
                            <HugeiconsIcon icon={TargetDollarIcon} size={16} />
                        </span>
                        <strong className="mt-3 text-[13px] font-medium text-[var(--ink)]">Dólares</strong>
                        <span className="mu mt-1 text-[11px] leading-snug">MEP, CCL, Blue y conversor rápido</span>
                    </button>
                </div>

                {/* Activo Individual */}
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--raised)]/30 p-4">
                    <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--raised)] text-[var(--muted)]">
                            <HugeiconsIcon icon={Coins01Icon} size={13} />
                        </span>
                        <label htmlFor="widget-asset-choice" className="text-[12px] font-medium text-[var(--ink)]">
                            Activo individual
                        </label>
                    </div>
                    <p className="mu mt-1 text-[11.5px]">Elegí una posición para monitorear su precio e historial.</p>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <select
                            id="widget-asset-choice"
                            value={selected}
                            onChange={event => setSelected(event.target.value)}
                            disabled={busy || !items.length}
                            className="flex-1 rounded-xl border border-[var(--line2)] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[var(--muted)] disabled:opacity-50"
                        >
                            <option value="">{busy ? 'Cargando activos…' : 'Elegí un activo de tu cartera'}</option>
                            {items.map(item => (
                                <option value={item.id} key={item.id}>
                                    {item.name} · {item.coin}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            disabled={busy || !chosen}
                            onClick={() => chosen && void launch('asset', chosen)}
                            className="btn-primary !min-h-10 text-[12.5px] disabled:opacity-40"
                        >
                            {busy ? <HugeiconsIcon icon={LoaderIcon} size={14} className="animate-spin" /> : null}
                            <span>Abrir widget</span>
                        </button>
                    </div>
                </div>

                {error && (
                    <p role="alert" className="mt-4 rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] px-3.5 py-2.5 text-[11.5px] text-[var(--neg)]">
                        {error}
                    </p>
                )}
            </section>
        </div>
    );
}
