import { useEffect, useState } from 'react';
import { request } from './account';

type Authorization = { id: string; name: string; scopes: string[]; updatedAt?: string | null };
type AuthorizationResponse = { authorizations: Authorization[] };
const endpoint = 'https://activos-nu.vercel.app/mcp';

export default function McpSettings() {
    const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState('');

    async function load() {
        try {
            setAuthorizations((await request<AuthorizationResponse>('mcp/authorizations')).authorizations);
            setMessage('');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las conexiones.');
        } finally {
            setLoading(false);
        }
    }

    async function refresh() {
        setLoading(true);
        await load();
    }

    useEffect(() => { void load(); }, []);

    async function copyEndpoint() {
        try {
            await navigator.clipboard.writeText(endpoint);
            setMessage('URL copiada.');
        } catch {
            setMessage('No se pudo copiar. Seleccioná la URL y copiala manualmente.');
        }
    }

    async function revoke(client: Authorization) {
        if (!window.confirm(`¿Revocar el acceso de ${client.name}? Dejará de poder consultar y modificar tu cartera.`)) return;
        setBusy(client.id);
        try {
            await request('mcp/authorizations', 'DELETE', { id: client.id });
            setAuthorizations(current => current.filter(item => item.id !== client.id));
            setMessage(`Se revocó el acceso de ${client.name}.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'No se pudo revocar la conexión.');
        } finally {
            setBusy('');
        }
    }

    return <section className="settings-channel mt-4">
        <p className="text-[13px] font-medium">Conectá ChatGPT o Claude</p>
        <p className="mu mt-2 text-[11px] leading-5">MCP conecta tu cuenta de Activos con un agente de IA mediante OAuth. El proveedor no recibe tu PIN ni tus claves de API de Activos.</p>
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--raised)] p-3">
            <p className="mu text-[10px]">URL del servidor MCP</p>
            <code className="mt-2 block break-all text-[12px] text-[var(--ink)]">{endpoint}</code>
            <button type="button" className="btn-ghost mt-3 !min-h-9 text-[11px]" onClick={() => void copyEndpoint()}>Copiar URL</button>
        </div>
        <ol className="mu mt-4 list-decimal space-y-2 pl-4 text-[11px] leading-5">
            <li>En la configuración de ChatGPT, agregá un conector personalizado; en Claude, agregá un conector personalizado desde Conectores.</li>
            <li>Pegá la URL de arriba. Al continuar, Activos te pedirá iniciar sesión y autorizar los permisos.</li>
            <li>La lectura es necesaria. El permiso para agregar, editar y eliminar inversiones es opcional y se puede rechazar.</li>
        </ol>
        <div className="mt-4 rounded-xl border border-[var(--line)] p-3">
            <p className="text-[11px] font-medium">Qué puede hacer</p>
            <p className="mu mt-2 text-[11px] leading-5">Consultar las posiciones (activo, tipo, moneda, monto, unidades y fecha), y leer algunas preferencias. Si autorizás escritura, también puede agregar, editar o eliminar posiciones. Los cambios se guardan en tu cartera con control de versiones.</p>
            <p className="mu mt-2 text-[11px] leading-5">No puede operar en mercados, mover dinero, administrar alertas, modificar ventas, acceder a comprobantes ni leer tus claves de API. Revisá las solicitudes de cambio del agente antes de confirmarlas; los datos que consultes se compartirán con el proveedor de IA según sus propias políticas.</p>
        </div>
        <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-medium">Agentes autorizados</p>
                <button type="button" className="btn-ghost !min-h-9 text-[11px]" onClick={() => void refresh()} disabled={loading}>Actualizar</button>
            </div>
            {loading ? <p className="mu mt-3 text-[11px]">Cargando conexiones…</p> : authorizations.length === 0
                ? <p className="mu mt-3 text-[11px]">Todavía no hay agentes conectados.</p>
                : <ul className="mt-2 divide-y divide-[var(--line)]">{authorizations.map(client => <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className="text-[12px] font-medium">{client.name}</p><p className="mu mt-1 text-[10px]">{client.scopes.includes('portfolio:write') ? 'Lectura y cambios de cartera' : 'Solo lectura'}</p></div>
                    <button type="button" className="btn-ghost !min-h-9 text-[11px]" disabled={busy === client.id} onClick={() => void revoke(client)}>{busy === client.id ? 'Revocando…' : 'Revocar'}</button>
                </li>)}</ul>}
        </div>
        {message && <p role="status" className="mu mt-3 text-[11px]">{message}</p>}
    </section>;
}
