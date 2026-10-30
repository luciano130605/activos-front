import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckIcon, ChevronDown } from '@hugeicons/core-free-icons';

type Option<Value extends string> = { value: Value; label: string; disabled?: boolean };
type Props<Value extends string> = {
    id?: string;
    label: string;
    value: Value;
    onChange: (value: Value) => void;
    options: readonly Option<Value>[];
    className?: string;
    size?: 'regular' | 'compact';
    disabled?: boolean;
};

export default function Select<Value extends string>({ id, label, value, onChange, options, className = 'w-full', size = 'regular', disabled = false }: Props<Value>) {
    const generatedId = useId();
    const triggerId = id ?? `select-${generatedId}`;
    const listId = `${triggerId}-options`;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const typeahead = useRef({ text: '', time: 0 });
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [position, setPosition] = useState({ left: 0, top: 0, width: 160, height: 260, above: false });
    const selectedIndex = options.findIndex(option => option.value === value);
    const enabledIndices = options.flatMap((option, index) => option.disabled ? [] : [index]);

    const closeMenu = useCallback((restoreFocus = false) => {
        if (menuRef.current?.matches(':popover-open')) menuRef.current.hidePopover();
        setOpen(false);
        typeahead.current = { text: '', time: 0 };
        if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    }, []);

    const positionMenu = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        if (!rect.width || !rect.height) { closeMenu(); return; }
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight;
        const width = Math.min(Math.max(rect.width, 160), viewportWidth - 16);
        const below = viewportHeight - rect.bottom - 14;
        const above = rect.top - 14;
        const desiredHeight = Math.min(options.length * 36 + 12, 260);
        const placeAbove = below < desiredHeight && above > below;
        setPosition({
            left: Math.max(8, Math.min(rect.left, viewportWidth - width - 8)),
            top: placeAbove ? rect.top - 6 : rect.bottom + 6,
            width,
            height: Math.max(0, Math.min(260, placeAbove ? above : below)),
            above: placeAbove,
        });
    }, [options.length, closeMenu]);

    function openMenu(index = selectedIndex) {
        if (disabled || !enabledIndices.length) return;
        setActiveIndex(enabledIndices.includes(index) ? index : enabledIndices[0]);
        positionMenu();
        menuRef.current?.showPopover();
        setOpen(true);
    }

    function choose(index: number) {
        const option = options[index];
        if (!option || option.disabled) return;
        onChange(option.value);
        closeMenu(true);
    }

    useEffect(() => {
        if (!open) return;
        const onScroll = (event: Event) => {
            if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
            positionMenu();
        };
        const onFocus = (event: FocusEvent) => {
            if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) closeMenu();
        };
        const onNavigate = () => closeMenu();
        const observer = new ResizeObserver(positionMenu);
        if (triggerRef.current) observer.observe(triggerRef.current);
        window.addEventListener('resize', positionMenu);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('popstate', onNavigate);
        document.addEventListener('focusin', onFocus);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', positionMenu);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('popstate', onNavigate);
            document.removeEventListener('focusin', onFocus);
        };
    }, [open, positionMenu, closeMenu]);

    useEffect(() => {
        if (open && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex, listId]);

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'Tab') { closeMenu(); return; }
        if (event.key === 'Escape' && open) {
            event.preventDefault(); event.stopPropagation(); closeMenu(true); return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(activeIndex); else openMenu();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!enabledIndices.length) return;
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            if (!open) openMenu(selectedIndex >= 0 ? selectedIndex : direction > 0 ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1]);
            else {
                const current = enabledIndices.indexOf(activeIndex);
                setActiveIndex(enabledIndices[(current + direction + enabledIndices.length) % enabledIndices.length]);
            }
            return;
        }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const index = event.key === 'Home' ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1];
            if (index == null) return;
            if (open) setActiveIndex(index); else openMenu(index);
            return;
        }
        if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
        event.preventDefault();
        const now = performance.now();
        const text = `${now - typeahead.current.time < 700 ? typeahead.current.text : ''}${event.key.toLocaleLowerCase('es')}`;
        typeahead.current = { text, time: now };
        const query = [...text].every(letter => letter === text[0]) ? text[0] : text;
        const start = open ? activeIndex : selectedIndex;
        const indices = Array.from({ length: options.length }, (_, offset) => (Math.max(start, 0) + offset + (query.length === 1 ? 1 : 0)) % options.length);
        const index = indices.find(index => !options[index].disabled && options[index].label.toLocaleLowerCase('es').startsWith(query));
        if (index != null) {
            if (open) setActiveIndex(index); else openMenu(index);
        }
    }

    // Solo la posición medida es dinámica; la apariencia se define con Tailwind.
    const positionStyle = {
        '--select-left': `${position.left}px`,
        '--select-top': `${position.top}px`,
        '--select-width': `${position.width}px`,
        '--select-height': `${position.height}px`,
    } as CSSProperties;

    return <div className={`min-w-0 ${className}`}>
        <button ref={triggerRef} id={triggerId} type="button" role="combobox" aria-label={label}
            aria-expanded={open} aria-haspopup="listbox" aria-controls={listId}
            aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            disabled={disabled || !enabledIndices.length} onKeyDown={onKeyDown} onClick={() => open ? closeMenu() : openMenu()}
            className={`flex w-full items-center justify-between gap-2 border bg-[var(--raised)] text-left text-[var(--ink)] outline-none transition-colors hover:border-[var(--line2)] focus-visible:border-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--line2)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${open ? 'border-[var(--muted)]' : 'border-[var(--line)]'} ${size === 'compact' ? 'rounded-lg px-2 py-1 text-[12px]' : 'rounded-[10px] px-3 py-2.5 text-[14px]'}`}>
            <span className="min-w-0 truncate">{options[selectedIndex]?.label ?? value}</span>
            <HugeiconsIcon icon={ChevronDown} aria-hidden="true" size={14} strokeWidth={1.6} className={`shrink-0 text-[var(--muted)] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
        <div ref={menuRef} id={listId} popover="auto" role="listbox" aria-label={label}
            onToggle={event => { const visible = event.newState === 'open'; setOpen(visible); if (!visible) typeahead.current = { text: '', time: 0 }; }}
            style={positionStyle}
            className={`fixed left-[var(--select-left)] top-[var(--select-top)] z-[100] m-0 max-h-[var(--select-height)] w-[var(--select-width)] max-w-[calc(100vw-16px)] scale-100 overflow-y-auto overscroll-contain rounded-xl border border-[var(--line2)] bg-[var(--surface)] p-1.5 text-[var(--ink)] opacity-100 shadow-[0_12px_40px_rgba(0,0,0,.25)] transition-[opacity,scale] duration-150 starting:scale-95 starting:opacity-0 motion-reduce:transition-none [scrollbar-width:thin] ${position.above ? '-translate-y-full origin-bottom' : 'origin-top'} ${size === 'compact' ? 'text-[12px]' : 'text-[14px]'}`}>
            {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
                onPointerDown={event => event.preventDefault()} onPointerMove={event => { if (event.pointerType === 'mouse' && !option.disabled) setActiveIndex(index); }} onClick={() => choose(index)}
                className={`flex h-9 items-center justify-between gap-3 rounded-lg px-3 ${option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${activeIndex === index && !option.disabled ? 'bg-[var(--raised)]' : ''} ${option.value === value ? 'font-medium text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                <span className="min-w-0 truncate">{option.label}</span>
                {option.value === value && <HugeiconsIcon icon={CheckIcon} aria-hidden="true" size={14} strokeWidth={1.8} className="shrink-0 text-[var(--ink)]" />}
            </div>)}
        </div>
    </div>;
}
