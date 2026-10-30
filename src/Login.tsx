import { useState, type FormEvent } from 'react';
import { request, type Account } from './account';
import { HugeiconsIcon } from '@hugeicons/react';
import { EyeClosedFreeIcons, LoaderPinwheel, LoaderPinwheelIcon, ViewIcon } from '@hugeicons/core-free-icons';

type Props = { onLogin: (account: Account) => void; initialError?: string; fixedEmail?: string; onCancel?: () => void };

export default function Login({ onLogin, initialError = '', fixedEmail, onCancel }: Props) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState(fixedEmail ?? '');
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

    return <main className="grid min-h-dvh place-items-center bg-[#0a0a0a] px-5 py-12 font-sans text-[#ededed] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:22px_22px]">
        <div className="w-full max-w-[420px]">
            <div className="mb-9 flex items-center gap-3 text-[17px] tracking-tight"><img src="/icon.png" width="32" height="32" alt="" className="rounded-lg" />Inversiones</div>
            <section className="rounded-[24px] border border-white/10 bg-[#121212] p-7 shadow-2xl sm:p-9">

                <p className="mb-2 font-mono text-[10px] tracking-[.14em] text-[#888]">TU CARTERA PERSONAL</p>
                <h1 className="text-[32px] font-light tracking-[-.04em]">{mode === 'register' ? 'Crear cuenta' : fixedEmail ? 'Volvé a ingresar' : 'Bienvenido de nuevo'}<span className="text-[#666]">.</span></h1>
                <p className="mt-3 text-[13px] leading-6 text-[#999]">{mode === 'register'
                    ? 'Registrate con tu correo y elegí un PIN de 6 dígitos. Vas a entrar directamente a tu cartera, sin códigos por correo.'
                    : 'Ingresá con tu correo y el PIN de tu cuenta para ver y guardar tus inversiones.'}</p>
                <form onSubmit={submit} className="mt-7 space-y-5">
                    <div><label htmlFor="account-email" className="mb-2 block text-[12px] text-[#aaa]">Correo electrónico</label><input id="account-email" type="email" autoComplete="email" required maxLength={254} readOnly={Boolean(fixedEmail)} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@correo.com" className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3.5 py-3 text-[14px] outline-none focus:border-[#7f96ff]" /></div>
                    <div><label htmlFor="account-pin" className="mb-2 block text-[12px] text-[#aaa]">{mode === 'register' ? 'Elegí un PIN de 6 dígitos' : 'PIN'}</label><div className="relative"><input id="account-pin" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-describedby="pin-help" placeholder="••••••" className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] py-3 pl-3.5 pr-12 font-mono text-[18px] tracking-[.35em] outline-none focus:border-[#7f96ff]" /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ocultar PIN' : 'Mostrar PIN'} aria-pressed={visible} className="absolute inset-y-0 right-0 px-3.5 text-[#999] hover:text-white">{visible ? <HugeiconsIcon icon={EyeClosedFreeIcons} size={17} /> : <HugeiconsIcon icon={ViewIcon} size={17} />}</button></div><p id="pin-help" className="mt-2 text-[11px] text-[#888]">{mode === 'register' ? 'Recordalo: lo vas a necesitar para ingresar a tu cuenta.' : 'Usá tu PIN fijo de 6 dígitos.'}</p></div>
                    {mode === 'register' && <div><label htmlFor="account-confirm-pin" className="mb-2 block text-[12px] text-[#aaa]">Confirmá tu PIN</label><input id="account-confirm-pin" type={visible ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" required pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3.5 py-3 font-mono text-[18px] tracking-[.35em] outline-none focus:border-[#7f96ff]" />{confirmPin && pin !== confirmPin && <p className="mt-2 text-[11px] text-[#ffb399]">Los PINs no coinciden.</p>}</div>}
                    {error && <p role="alert" className="rounded-lg border border-[#ff7d52]/20 bg-[#ff7d52]/5 p-3 text-[12px] leading-5 text-[#ffb399]">{error}</p>}
                    <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ededed] px-4 py-3 text-[13px] font-medium text-[#111] hover:bg-white disabled:cursor-wait disabled:opacity-60">{busy ? <><HugeiconsIcon icon={LoaderPinwheelIcon} size={16} className="animate-spin motion-reduce:animate-none" />{mode === 'register' ? 'Creando cuenta…' : 'Ingresando…'}</> : mode === 'register' ? 'Crear cuenta y entrar' : 'Ingresar'}</button>
                    {!fixedEmail && <button type="button" disabled={busy} onClick={() => { setMode(value => value === 'login' ? 'register' : 'login'); setPin(''); setConfirmPin(''); setError(''); }} className="w-full text-[12px] text-[#aaa] hover:text-white disabled:opacity-60">{mode === 'register' ? '¿Ya tenés cuenta? Ingresar' : '¿Primera vez? Crear cuenta'}</button>}
                    {onCancel && <button type="button" onClick={onCancel} className="w-full text-[12px] text-[#aaa]">Volver a mi cartera</button>}
                </form>
            </section>
            <p className="mt-6 text-center font-mono text-[10px] leading-5 text-[#777]">Criptomonedas, CEDEARs y tasas.<br />Todo en tu cuenta.</p>
        </div>
    </main>;
}
