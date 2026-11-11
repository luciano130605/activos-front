import { loginWithPasskey, supportsPasskeys } from './passkeys';
import { useState, type FormEvent } from 'react';
import { request, type Account } from './account';
import { HugeiconsIcon } from '@hugeicons/react';
import { EyeClosedFreeIcons, LoaderIcon, ViewIcon, FingerPrintIcon, ScanFaceIcon } from '@hugeicons/core-free-icons';

type Props = { onLogin: (account: Account) => void; initialError?: string; fixedEmail?: string; onCancel?: () => void };

export default function Login({ onLogin, initialError = '', fixedEmail, onCancel }: Props) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState(fixedEmail ?? '@gmail.com');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(initialError);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try {
            if (mode === 'register' && pin !== confirmPin) throw new Error('Los PINs no coinciden.');
            const account = await request<Account>(mode === 'register' ? 'register' : 'login', 'POST', mode === 'register'
                ? { email: email.trim(), pin, confirmPin }
                : { email: email.trim(), pin });
            setPin(''); setConfirmPin('');
            onLogin(account);
        } catch (error) {
            setError(error instanceof Error ? error.message : mode === 'register' ? 'No se pudo crear la cuenta.' : 'No se pudo iniciar sesión.');
            setPin(''); setConfirmPin('');
        }
        finally { setBusy(false); }
    }

    async function passkeyLogin() {
        setBusy(true); setError('');
        try { onLogin(await loginWithPasskey()); }
        catch { setError('No se pudo ingresar con passkey. Probá de nuevo o usá tu PIN.'); }
        finally { setBusy(false); }
    }

    const input = 'w-full rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-3.5 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--sig)] focus:ring-1 focus:ring-[var(--sig)]/30';
    const pinInput = `${input} font-mono text-[18px] tracking-[.35em]`;

    return <main data-theme="dark" className="app grid min-h-dvh place-items-center px-4 py-10 selection:bg-[var(--sig)] selection:text-[#09090b]">
        <div className="w-full max-w-[400px]">
            {/* Logo minimalista */}
            <div className="mb-8 flex items-center justify-center gap-2.5">
                <img src="/icon.png" alt="Activos Logo" className="h-8 w-8 rounded-xl object-contain shadow-xs" />
                <span className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    alza<span className="text-[var(--sig)]">.</span>
                </span>
            </div>

            {/* Tarjeta de Acceso */}
            <section className="card hero-glow p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                {!fixedEmail && (
                    <div className="seg mb-6 w-full grid grid-cols-2 p-1 align-center justify-center" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'login'}
                            aria-pressed={mode === 'login'}
                            onClick={() => { setMode('login'); setError(''); }}
                            className="!min-h-[34px] w-full !text-xs font-medium"
                        >
                            Ingresar
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'register'}
                            aria-pressed={mode === 'register'}
                            onClick={() => { setMode('register'); setError(''); }}
                            className="!min-h-[34px] w-full !text-xs font-medium"
                        >
                            Crear cuenta
                        </button>
                    </div>
                )}

                <div className="mb-6">
                    <h1 className="text-[22px] font-medium tracking-tight text-[var(--ink)]">
                        {mode === 'register' ? 'Creá tu cuenta' : fixedEmail ? 'Volvé a ingresar' : 'Bienvenido'}
                    </h1>
                    <p className="mu mt-1 text-[12px] text-[var(--muted)]">
                        {mode === 'register'
                            ? 'Elegí un PIN de 6 dígitos para acceder a tu cartera.'
                            : 'Ingresá tu correo y PIN para ver tus activos.'}
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label htmlFor="account-email" className="mb-1.5 block text-[11.5px] font-medium text-[var(--muted)]">
                            Correo electrónico
                        </label>
                        <input
                            id="account-email"
                            type="text"
                            inputMode="email"
                            autoComplete="email"
                            required
                            pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                            onFocus={event => { if (event.currentTarget.value === '@gmail.com') event.currentTarget.setSelectionRange(0, 0); }}
                            maxLength={254}
                            readOnly={Boolean(fixedEmail)}
                            disabled={busy}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="vos@correo.com"
                            className={input}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="account-pin" className="block text-[11.5px] font-medium text-[var(--muted)]">
                                {mode === 'register' ? 'Elegí tu PIN de 6 dígitos' : 'PIN de 6 dígitos'}
                            </label>
                        </div>
                        <div className="relative">
                            <input
                                id="account-pin"
                                type={visible ? 'text' : 'password'}
                                inputMode="numeric"
                                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                required
                                pattern="[0-9]{6}"
                                minLength={6}
                                maxLength={6}
                                disabled={busy}
                                value={pin}
                                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="••••••"
                                className={pinInput}
                            />
                            <button
                                type="button"
                                onClick={() => setVisible(v => !v)}
                                aria-label={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
                                className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--muted)] hover:text-[var(--ink)]"
                            >
                                <HugeiconsIcon icon={visible ? EyeClosedFreeIcons : ViewIcon} size={16} />
                            </button>
                        </div>
                    </div>

                    {mode === 'register' && (
                        <div>
                            <label htmlFor="account-confirm-pin" className="mb-1.5 block text-[11.5px] font-medium text-[var(--muted)]">
                                Confirmá tu PIN
                            </label>
                            <input
                                id="account-confirm-pin"
                                type={visible ? 'text' : 'password'}
                                inputMode="numeric"
                                autoComplete="new-password"
                                required
                                pattern="[0-9]{6}"
                                minLength={6}
                                maxLength={6}
                                disabled={busy}
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="••••••"
                                className={pinInput}
                            />
                            {confirmPin && pin !== confirmPin && (
                                <p className="mt-1.5 text-[11px] text-[var(--neg)]">Los PINs no coinciden.</p>
                            )}
                        </div>
                    )}

                    {error && (
                        <p role="alert" className="rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] p-3 text-[12px] leading-5 text-[var(--neg)]">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="btn-primary w-full !min-h-11 !rounded-xl !text-sm font-medium disabled:opacity-60"
                    >
                        {busy ? (
                            <>
                                <HugeiconsIcon icon={LoaderIcon} size={16} className="animate-spin motion-reduce:animate-none" />
                                {mode === 'register' ? 'Creando cuenta…' : 'Ingresando…'}
                            </>
                        ) : mode === 'register' ? 'Crear cuenta y entrar' : 'Ingresar'}
                    </button>

                    {mode === 'login' && !fixedEmail && supportsPasskeys() && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void passkeyLogin()}
                            className="btn-ghost w-full !min-h-10 !rounded-xl !text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] flex items-center justify-center gap-2"
                        >
                            <HugeiconsIcon icon={ScanFaceIcon} size={16} />
                            <span>Ingresar con Face ID o passkey</span>
                        </button>
                    )}

                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--ink)] pt-1"
                        >
                            Volver a mi cartera
                        </button>
                    )}
                </form>
            </section>

            <nav aria-label="Información legal" className="mt-6 flex justify-center gap-4 text-[11px] text-[var(--muted)]">
                <a className="hover:text-[var(--ink)] transition-colors" href="/politicas">Privacidad</a>
                <span>·</span>
                <a className="hover:text-[var(--ink)] transition-colors" href="/condiciones">Términos</a>
            </nav>
        </div>
    </main>;
}
