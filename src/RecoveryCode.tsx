import { useEffect, useState } from 'react';
import { request } from './account';

/** El código se muestra solo en esta sesión y desaparece al cerrar la sección o vencer. */
export default function RecoveryCode() {
    const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!result) return;
        const timeout = setTimeout(() => setResult(null), Math.max(0, new Date(result.expiresAt).getTime() - Date.now()));
        return () => clearTimeout(timeout);
    }, [result]);
    async function generate() {
        setBusy(true); setError(''); setResult(null);
        try { setResult(await request<{ code: string; expiresAt: string }>('password/recovery-code', 'POST', {})); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el código.'); }
        finally { setBusy(false); }
    }
    return <div className="settings-channel">
        <p className="text-[13px] font-medium">Recuperar contraseña</p>
        <p className="mu mt-2 text-[11px] leading-5">Generá un código para ingresar en la app junto con tu correo y PIN. Dura 10 minutos, se usa una vez y reemplaza cualquier código anterior. No lo compartas.</p>
        <button type="button" className="btn-ghost mt-3 !min-h-10 text-[12px]" disabled={busy} onClick={() => { void generate(); }}>{busy ? 'Generando…' : result ? 'Generar otro código' : 'Generar código'}</button>
        {result && <div className="mt-3 rounded-xl border border-[var(--line)] p-3"><p className="mu text-[11px]">Código de recuperación · válido hasta {new Date(result.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p><p className="mt-2 break-all font-mono text-lg tracking-widest select-all" aria-label={`Código de recuperación: ${result.code}`}>{result.code}</p></div>}
        {error && <p role="alert" className="mt-2 text-[11px] text-[var(--neg)]">{error}</p>}
    </div>;
}
