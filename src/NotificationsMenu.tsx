import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Notification01Icon,
    Cancel01Icon,
    ChevronRight,
    Alert02Icon,
    Coins01Icon,
    CheckIcon,
    Delete02Icon,
} from '@hugeicons/core-free-icons';

type Notification = { id: string; title: string; message: string; time: number };

export default function NotificationsMenu({
    x,
    y,
    items,
    onClose,
    onOpen,
    onClear,
}: {
    x: number;
    y: number;
    items: Notification[];
    onClose: () => void;
    onOpen: () => void;
    onClear: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<CSSProperties>({ left: x, top: y });

    useLayoutEffect(() => {
        const isMobile = window.innerWidth < 640;
        if (isMobile) {
            setPosition({
                left: 12,
                right: 12,
                top: Math.max(60, Math.min(y, window.innerHeight - 420)),
                maxWidth: 'calc(100vw - 24px)',
            });
            return;
        }
        const box = ref.current?.getBoundingClientRect();
        if (box) {
            const left = Math.max(12, Math.min(x, window.innerWidth - box.width - 12));
            const top = Math.max(12, Math.min(y, window.innerHeight - box.height - 12));
            setPosition({ left, top, width: 360 });
        }
    }, [x, y]);

    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
        const outside = (event: PointerEvent) => {
            const target = event.target as Element;
            if (!ref.current?.contains(target) && !target.closest?.('[aria-label="Notificaciones"]')) {
                onClose();
            }
        };
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        const resize = () => onClose();
        window.addEventListener('pointerdown', outside, true);
        window.addEventListener('keydown', keydown);
        window.addEventListener('resize', resize);
        return () => {
            window.removeEventListener('pointerdown', outside, true);
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('resize', resize);
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, [onClose]);

    const open = () => {
        onClose();
        onOpen();
    };

    return (
        <div
            ref={ref}
            className="notifications-menu fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--line2)] bg-[var(--surface)] shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
            style={position}
            role="dialog"
            aria-label="Notificaciones"
        >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--raised)] text-[var(--muted)]">
                        <HugeiconsIcon icon={Notification01Icon} size={14} />
                    </span>
                    <h2 className="text-[13px] font-medium text-[var(--ink)]">Notificaciones</h2>
                    {items.length > 0 && (
                        <span className="rounded-full bg-[var(--sigbg)] px-2 py-0.5 font-mono text-[10.5px] font-medium text-[var(--sig)]">
                            {items.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)] transition-colors"
                        >
                            Limpiar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar notificaciones"
                        className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)] transition-colors"
                    >
                        <HugeiconsIcon icon={Cancel01Icon} size={15} />
                    </button>
                </div>
            </div>

            {/* Lista de Notificaciones */}
            <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--line)]">
                {items.length ? (
                    items.map(item => {
                        const isDividend = item.title.toLowerCase().includes('dividendo');
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className="group flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:bg-[var(--raised)]"
                                onClick={open}
                            >
                                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                                    isDividend
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                        : 'border-[var(--line)] bg-[var(--raised)] text-[var(--muted)] group-hover:text-[var(--ink)]'
                                }`}>
                                    <HugeiconsIcon icon={isDividend ? Coins01Icon : Alert02Icon} size={14} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="truncate text-[12.5px] font-medium text-[var(--ink)]">
                                            {item.title}
                                        </p>
                                        <time
                                            className="shrink-0 font-mono text-[10px] text-[var(--faint)]"
                                            dateTime={new Date(item.time).toISOString()}
                                        >
                                            {new Date(item.time).toLocaleDateString('es-AR', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </time>
                                    </div>
                                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                                        {item.message}
                                    </p>
                                </div>
                                <span
                                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sig)]"
                                    aria-hidden="true"
                                />
                            </button>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center px-6 py-9 text-center">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--raised)] text-[var(--muted)]">
                            <HugeiconsIcon icon={CheckIcon} size={20} />
                        </div>
                        <p className="mt-3 text-[13px] font-medium text-[var(--ink)]">Todo al día</p>
                        <p className="mu mt-1 max-w-[210px] text-[11.5px]">
                            No tenés notificaciones pendientes. Te avisaremos cuando haya novedades en tus activos.
                        </p>
                    </div>
                )}
            </div>

            {/* Pie de Panel */}
            <div className="border-t border-[var(--line)] bg-[var(--raised)]/40 p-2">
                <button
                    type="button"
                    onClick={open}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)] transition-colors"
                >
                    <span>Ver y administrar alertas</span>
                    <HugeiconsIcon icon={ChevronRight} size={14} />
                </button>
            </div>
        </div>
    );
}
