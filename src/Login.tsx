import { loginWithPasskey, supportsPasskeys } from './passkeys';
import { useState, type FormEvent } from 'react';
import { request, type Account } from './account';
import { HugeiconsIcon } from '@hugeicons/react';
import { EyeClosedFreeIcons, LoaderPinwheel, LoaderPinwheelIcon, ViewIcon } from '@hugeicons/core-free-icons';

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
        catch { setError('No se pudo ingresar con la passkey. Volvé a intentar o usá tu PIN.'); }
        finally { setBusy(false); }
    }

    const input = 'w-full rounded-xl border border-[var(--line2)] bg-[var(--raised)] px-3.5 py-3 text-[14px] outline-none transition-colors focus:border-[var(--sig)]';
    const pinInput = `${input} font-mono text-[18px] tracking-[.35em]`;
    return <main data-theme="dark" className="app grid min-h-dvh place-items-center px-5 py-12">
        <div className="w-full max-w-[430px]">
            <div className="brand mb-9"><img src='/icon.png' alt="Activos Logo" className="brand-logo" />activos<span className="sig">.</span></div>
            <section className="card hero-glow p-7 shadow-2xl sm:p-9">
                <p className="lb mb-3">TU CARTERA PERSONAL</p>
                <h1 className="text-[34px] font-light leading-[1.05] tracking-[-.045em]">{mode === 'register' ? 'Crear cuenta' : fixedEmail ? 'Volvé a ingresar' : 'Bienvenido de nuevo'}<span className="sig">.</span></h1>
                <p className="mu mt-3 !font-sans text-[13px] leading-6">{mode === 'register'
                    ? 'Registrate con tu correo y elegí un PIN de 6 dígitos. Vas a entrar directamente a tu cartera, sin códigos por correo.'
                    : 'Ingresá con tu correo y el PIN de tu cuenta para ver y guardar tus inversiones.'}</p>
                <form onSubmit={submit} className="mt-7 space-y-5">
                    <div><label htmlFor="account-email" className="mb-2 block text-[12px] text-[var(--muted)]">Correo electrónico</label><input id="account-email" type="email" autoComplete="email" required maxLength={254} readOnly={Boolean(fixedEmail)} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@correo.com" className={input} /></div>
                    <div><label htmlFor="account-pin" className="mb-2 block text-[12px] text-[var(--muted)]">{mode === 'register' ? 'Elegí un PIN de 6 dígitos' : 'PIN'}</label><div className="relative"><input id="account-pin" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-describedby="pin-help" placeholder="••••••" className={`${pinInput} pr-12`} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ocultar PIN' : 'Mostrar PIN'} aria-pressed={visible} className="absolute inset-y-0 right-0 px-3.5 text-[var(--muted)] hover:text-[var(--ink)]">{visible ? <HugeiconsIcon icon={EyeClosedFreeIcons} size={17} /> : <HugeiconsIcon icon={ViewIcon} size={17} />}</button></div><p id="pin-help" className="mu mt-2 !font-sans text-[11px]">{mode === 'register' ? 'Recordalo: lo vas a necesitar para ingresar a tu cuenta.' : 'Usá tu PIN fijo de 6 dígitos.'}</p></div>
                    {mode === 'register' && <div><label htmlFor="account-confirm-pin" className="mb-2 block text-[12px] text-[var(--muted)]">Confirmá tu PIN</label><input id="account-confirm-pin" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" required pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className={pinInput} />{confirmPin && pin !== confirmPin && <p className="mt-2 text-[11px] text-[var(--neg)]">Los PINs no coinciden.</p>}</div>}
                    {error && <p role="alert" className="rounded-lg border border-[var(--neg)]/25 bg-[var(--negbg)] p-3 text-[12px] leading-5">{error}</p>}
                    <button type="submit" disabled={busy} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">{busy ? <><HugeiconsIcon icon={LoaderPinwheelIcon} size={16} className="animate-spin motion-reduce:animate-none" />{mode === 'register' ? 'Creando cuenta…' : 'Ingresando…'}</> : mode === 'register' ? 'Crear cuenta y entrar' : 'Ingresar'}</button>
                    {mode === 'login' && !fixedEmail && supportsPasskeys() && <div><button type="button" disabled={busy} onClick={() => void passkeyLogin()} className="btn-ghost w-full disabled:opacity-60">Ingresar con passkey o llave de seguridad</button><p className="mu mt-2 text-center !font-sans text-[11px] leading-5">Elegí Face ID, una llave de seguridad o una passkey en otro dispositivo. Si aparece un QR, escanealo con tu iPhone.</p></div>}
                    {!fixedEmail && <button type="button" disabled={busy} onClick={() => { setMode(value => value === 'login' ? 'register' : 'login'); setPin(''); setConfirmPin(''); setError(''); }} className="w-full text-[12px] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-60">{mode === 'register' ? '¿Ya tenés cuenta? Ingresar' : '¿Primera vez? Crear cuenta'}</button>}
                    {onCancel && <button type="button" onClick={onCancel} className="w-full text-[12px] text-[var(--muted)]">Volver a mi cartera</button>}
                </form>
            </section>
            <p className="mu mt-6 text-center text-[10px] leading-5">Cripto, CEDEARs, índices y tasas.<br />Todo en tu cuenta.</p>
        </div>
    </main>;
}
