import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Search01Icon } from '@hugeicons/core-free-icons';

export default function NotFound() {
    useEffect(() => { document.title = 'Página no encontrada · Alza'; }, []);
    return <main data-theme="dark" className="app relative flex min-h-dvh flex-col overflow-hidden px-5 py-7 sm:px-10 sm:py-9">
        <header className="relative z-10 mx-auto w-full max-w-[1100px]">
            <a href="/" className="brand inline-flex items-center gap-2" aria-label="Alza, ir al inicio"><img src="/icon.png" alt="" className="brand-logo" />alza<span className="sig">.</span></a>
        </header>
        <div className="relative mx-auto flex w-full max-w-[1100px] flex-1 items-center py-16">
            <section className="relative z-10 w-full max-w-[620px]">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--line2)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[10px] tracking-[.1em] text-[var(--muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--sig)]" />ERROR 404</div>
                <h1 className="text-[clamp(3rem,8vw,5.7rem)] font-light leading-[.98] tracking-[-.065em]">Esta página se perdió en el camino<span className="sig">.</span></h1>
                <p className="mu mt-6 max-w-[420px] !font-sans text-[15px] leading-7">La dirección que buscás no existe o ya no está disponible. Volvé al inicio y seguí explorando tu cartera.</p>
                <div className="mt-8 flex flex-wrap gap-3"><a href="/" className="btn-primary inline-flex items-center gap-2 no-underline"><HugeiconsIcon icon={ArrowLeft01Icon} size={17} />Volver al inicio</a><a href="/mis-inversiones" className="btn-ghost inline-flex items-center gap-2 no-underline"><HugeiconsIcon icon={Search01Icon} size={16} />Mis inversiones</a></div>
            </section>
            <div aria-hidden="true" className="pointer-events-none absolute right-[-7%] top-1/2 hidden h-[470px] w-[470px] -translate-y-1/2 place-items-center lg:grid">
                <div className="absolute h-[400px] w-[400px] rounded-full border border-[var(--line)]" /><div className="absolute h-[315px] w-[315px] rounded-full border border-[var(--line)]" /><div className="absolute h-[230px] w-[230px] rounded-full border border-[var(--line2)]" />
                <div className="absolute h-[290px] w-[290px] rounded-full bg-[var(--sig)] opacity-[.05] blur-[90px]" /><span className="relative font-mono text-[116px] font-light tracking-[-.1em] text-[var(--ink)] opacity-[.09]">404</span><span className="absolute right-[83px] top-[108px] h-2.5 w-2.5 rounded-full bg-[var(--sig)] shadow-[0_0_24px_var(--sig)]" /><span className="absolute bottom-[105px] left-[97px] h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />
            </div>
        </div>
        <footer className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5 font-mono text-[10px] text-[var(--faint)]"><span>ALZA / PANEL PERSONAL</span><span>INVERSIONES EN CLARO</span></footer>
    </main>;
}
