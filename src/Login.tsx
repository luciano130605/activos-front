import { loginWithPasskey, supportsPasskeys } from './passkeys';
import { useState, type FormEvent, type ReactNode } from 'react';
import { request, type Account } from './account';
import { HugeiconsIcon } from '@hugeicons/react';
import { EyeClosedFreeIcons, LoaderIcon, ViewIcon, ScanFaceIcon } from '@hugeicons/core-free-icons';

type Props = { onLogin: (account: Account) => void; initialError?: string; fixedEmail?: string; onCancel?: () => void };
type Mode = 'login' | 'register' | 'legacy';

const MIN_PASSWORD = 12;
const input = 'w-full rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-3.5 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--sig)] focus:ring-1 focus:ring-[var(--sig)]/30';
const pinInput = `${input} font-mono text-[18px] tracking-[.35em]`;
const labelClass = 'mb-1.5 block text-[11.5px] font-medium text-[var(--muted)]';

/** PINs fáciles de adivinar (mismo criterio que el servidor): todos iguales o seguidos. */
function weakPin(pin: string) {
    if (!/^\d{6}$/.test(pin)) return false;
    if (/^(\d)\1{5}$/.test(pin)) return true;
    const steps = [...pin].slice(1).map((d, i) => Number(d) - Number(pin[i]));
    return steps.every(step => step === 1) || steps.every(step => step === -1);
}

/**
 * Ingreso y registro de la web.
 * - Crear cuenta: nombre, correo, contraseña y PIN (el PIN se usa para desbloquear la app de iOS).
 * - Ingresar: correo y contraseña.
 * - Cuentas viejas (solo PIN): entran una vez con el PIN y completan nombre y contraseña.
 */
export default function Login({ onLogin, initialError = '', fixedEmail, onCancel }: Props) {
    const [mode, setMode] = useState<Mode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState(fixedEmail ?? '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(initialError);

    function switchMode(next: Mode) {
        setMode(next); setError('');
        setPassword(''); setConfirmPassword(''); setPin(''); setConfirmPin('');
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try {
            let account: Account;
            if (mode === 'register') {
                if (password.length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
                if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');
                if (weakPin(pin)) throw new Error('Ese PIN es muy fácil de adivinar. Evitá números repetidos o seguidos.');
                if (pin !== confirmPin) throw new Error('Los PINs no coinciden.');
                account = await request<Account>('register', 'POST', { name: name.trim(), email: email.trim(), password, confirmPassword, pin, confirmPin });
            } else if (mode === 'legacy') {
                account = await request<Account>('login', 'POST', { email: email.trim(), pin, legacy: true });
            } else {
                account = await request<Account>('login', 'POST', { email: email.trim(), password });
            }
            setPassword(''); setConfirmPassword(''); setPin(''); setConfirmPin('');
            onLogin(account);
        } catch (error) {
            setError(error instanceof Error ? error.message : mode === 'register' ? 'No se pudo crear la cuenta.' : 'No se pudo iniciar sesión.');
            setPassword(''); setConfirmPassword(''); setPin(''); setConfirmPin('');
        }
        finally { setBusy(false); }
    }

    async function passkeyLogin() {
        setBusy(true); setError('');
        try { onLogin(await loginWithPasskey()); }
        catch { setError('No se pudo ingresar con passkey. Probá de nuevo o usá tu contraseña.'); }
        finally { setBusy(false); }
    }

    const eye = <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Ocultar' : 'Mostrar'}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--muted)] hover:text-[var(--ink)]">
        <HugeiconsIcon icon={visible ? EyeClosedFreeIcons : ViewIcon} size={16} />
    </button>;

    const title = mode === 'register' ? 'Creá tu cuenta' : mode === 'legacy' ? 'Entrá con tu PIN' : fixedEmail ? 'Volvé a ingresar' : 'Bienvenido';
    const subtitle = mode === 'register'
        ? 'Tu contraseña es para entrar desde la web o un dispositivo nuevo. El PIN desbloquea la app de iOS.'
        : mode === 'legacy'
            ? 'Tu cuenta es de antes de las contraseñas. Entrá una última vez con tu PIN y elegí una contraseña.'
            : 'Ingresá tu correo y tu contraseña para ver tus activos.';

    return <AuthShell>
        {!fixedEmail && mode !== 'legacy' && (
            <div className="seg mb-6 w-full grid grid-cols-2 p-1 align-center justify-center" role="tablist">
                {(['login', 'register'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={mode === value} aria-pressed={mode === value}
                    onClick={() => switchMode(value)} className="!min-h-[34px] w-full !text-xs font-medium">
                    {value === 'login' ? 'Ingresar' : 'Crear cuenta'}
                </button>)}
            </div>
        )}

        <div className="mb-6">
            <h1 className="text-[22px] font-medium tracking-tight text-[var(--ink)]">{title}</h1>
            <p className="mu mt-1 text-[12px] text-[var(--muted)]">{subtitle}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && <div>
                <label htmlFor="account-name" className={labelClass}>Nombre</label>
                <input id="account-name" type="text" autoComplete="name" required maxLength={60} disabled={busy}
                    value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className={input} />
            </div>}

            <div>
                <label htmlFor="account-email" className={labelClass}>Correo electrónico</label>
                <input id="account-email" type="text" inputMode="email" autoComplete={mode === 'register' ? 'email' : 'username'} required
                    pattern="[^@\s]+@[^@\s]+\.[^@\s]+" maxLength={254} readOnly={Boolean(fixedEmail)} disabled={busy}
                    value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@correo.com" className={input} />
            </div>

            {mode !== 'legacy' && <div>
                <label htmlFor="account-password" className={labelClass}>{mode === 'register' ? `Contraseña (mínimo ${MIN_PASSWORD} caracteres)` : 'Contraseña'}</label>
                <div className="relative">
                    <input id="account-password" type={visible ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required
                        minLength={mode === 'register' ? MIN_PASSWORD : 1} maxLength={128} disabled={busy}
                        value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'Una frase que recuerdes' : 'Tu contraseña'} className={`${input} pr-11`} />
                    {eye}
                </div>
            </div>}

            {mode === 'register' && <div>
                <label htmlFor="account-confirm-password" className={labelClass}>Repetí la contraseña</label>
                <input id="account-confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} disabled={busy}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={input} />
                {confirmPassword && password !== confirmPassword && <p className="mt-1.5 text-[11px] text-[var(--neg)]">Las contraseñas no coinciden.</p>}
            </div>}

            {(mode === 'register' || mode === 'legacy') && <div>
                <label htmlFor="account-pin" className={labelClass}>{mode === 'register' ? 'Elegí un PIN de 6 dígitos' : 'PIN de 6 dígitos'}</label>
                <div className="relative">
                    <input id="account-pin" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete={mode === 'register' ? 'off' : 'current-password'} required
                        pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy}
                        value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className={pinInput} />
                    {mode === 'legacy' && eye}
                </div>
                {mode === 'register' && weakPin(pin) && <p className="mt-1.5 text-[11px] text-[var(--neg)]">Muy fácil de adivinar: evitá números repetidos o seguidos.</p>}
            </div>}

            {mode === 'register' && <div>
                <label htmlFor="account-confirm-pin" className={labelClass}>Repetí el PIN</label>
                <input id="account-confirm-pin" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete="off" required
                    pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy}
                    value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className={pinInput} />
                {confirmPin.length === 6 && pin !== confirmPin && <p className="mt-1.5 text-[11px] text-[var(--neg)]">Los PINs no coinciden.</p>}
            </div>}

            {error && <ErrorBox>{error}</ErrorBox>}

            <button type="submit" disabled={busy} className="btn-primary w-full !min-h-11 !rounded-xl !text-sm font-medium disabled:opacity-60">
                {busy ? <>
                    <HugeiconsIcon icon={LoaderIcon} size={16} className="animate-spin motion-reduce:animate-none" />
                    {mode === 'register' ? 'Creando cuenta…' : 'Ingresando…'}
                </> : mode === 'register' ? 'Crear cuenta y entrar' : 'Ingresar'}
            </button>

            {mode === 'login' && !fixedEmail && supportsPasskeys() && (
                <button type="button" disabled={busy} onClick={() => void passkeyLogin()}
                    className="btn-ghost w-full !min-h-10 !rounded-xl !text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] flex items-center justify-center gap-2">
                    <HugeiconsIcon icon={ScanFaceIcon} size={16} />
                    <span>Ingresar con Face ID o passkey</span>
                </button>
            )}

            {mode === 'login' && !fixedEmail && <button type="button" onClick={() => switchMode('legacy')} className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--ink)] pt-1">
                ¿Tu cuenta es de antes y solo tenés PIN?
            </button>}
            {mode === 'legacy' && <button type="button" onClick={() => switchMode('login')} className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--ink)] pt-1">
                Volver a ingresar con contraseña
            </button>}

            {onCancel && <button type="button" onClick={onCancel} className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--ink)] pt-1">
                Volver a mi cartera
            </button>}
        </form>
    </AuthShell>;
}

/** Cuentas viejas: después de entrar con el PIN, completan nombre y contraseña. */
export function CompleteAccount({ account, onDone, onLogout }: { account: Account; onDone: (account: Account) => void; onLogout: () => void }) {
    const [name, setName] = useState(account.user.name ?? '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try {
            if (password.length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
            if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');
            const result = await request<{ ok: boolean; name: string }>('account/setup', 'POST', { name: name.trim(), password, confirmPassword });
            onDone({ ...account, setupRequired: false, user: { ...account.user, name: result.name } });
        } catch (error) {
            setError(error instanceof Error ? error.message : 'No se pudo guardar.');
            setPassword(''); setConfirmPassword('');
        } finally { setBusy(false); }
    }

    return <AuthShell>
        <div className="mb-6">
            <h1 className="text-[22px] font-medium tracking-tight text-[var(--ink)]">Completá tu cuenta</h1>
            <p className="mu mt-1 text-[12px] text-[var(--muted)]">Desde ahora se entra con correo y contraseña. Tu PIN sigue sirviendo para desbloquear la app de iOS.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
            <div>
                <label htmlFor="setup-name" className={labelClass}>Nombre</label>
                <input id="setup-name" type="text" autoComplete="name" required maxLength={60} disabled={busy} value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className={input} />
            </div>
            <input type="text" autoComplete="username" value={account.user.email} readOnly hidden />
            <div>
                <label htmlFor="setup-password" className={labelClass}>Contraseña (mínimo {MIN_PASSWORD} caracteres)</label>
                <input id="setup-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} disabled={busy} value={password} onChange={e => setPassword(e.target.value)} className={input} />
            </div>
            <div>
                <label htmlFor="setup-confirm" className={labelClass}>Repetí la contraseña</label>
                <input id="setup-confirm" type="password" autoComplete="new-password" required maxLength={128} disabled={busy} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={input} />
                {confirmPassword && password !== confirmPassword && <p className="mt-1.5 text-[11px] text-[var(--neg)]">Las contraseñas no coinciden.</p>}
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={busy} className="btn-primary w-full !min-h-11 !rounded-xl !text-sm font-medium disabled:opacity-60">
                {busy ? <><HugeiconsIcon icon={LoaderIcon} size={16} className="animate-spin motion-reduce:animate-none" />Guardando…</> : 'Guardar y entrar'}
            </button>
            <button type="button" onClick={onLogout} className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--ink)] pt-1">Cerrar sesión</button>
        </form>
    </AuthShell>;
}

function ErrorBox({ children }: { children: ReactNode }) {
    return <p role="alert" className="rounded-xl border border-[var(--neg)]/30 bg-[var(--negbg)] p-3 text-[12px] leading-5 text-[var(--neg)]">{children}</p>;
}

function AuthShell({ children }: { children: ReactNode }) {
    return <main data-theme="dark" className="app grid min-h-dvh place-items-center px-4 py-10 selection:bg-[var(--sig)] selection:text-[#09090b]">
        <div className="w-full max-w-[400px]">
            <div className="mb-8 flex items-center justify-center gap-2.5">
                <img src="/icon.png" alt="Activos Logo" className="h-8 w-8 rounded-xl object-contain shadow-xs" />
                <span className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    alza<span className="text-[var(--sig)]">.</span>
                </span>
            </div>
            <section className="card hero-glow p-6 sm:p-8 shadow-2xl backdrop-blur-xl">{children}</section>
            <nav aria-label="Información legal" className="mt-6 flex justify-center gap-4 text-[11px] text-[var(--muted)]">
                <a className="hover:text-[var(--ink)] transition-colors" href="/politicas">Privacidad</a>
                <span>·</span>
                <a className="hover:text-[var(--ink)] transition-colors" href="/condiciones">Términos</a>
            </nav>
        </div>
    </main>;
}
