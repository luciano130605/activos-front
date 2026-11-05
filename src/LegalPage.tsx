import { Pdf02Icon, Txt02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { ReactNode } from 'react';
import { useRef } from 'react';

type Section = { title: string; body: ReactNode };
const privacy: Section[] = [
    { title: 'Qué información utilizamos', body: <>Al crear una cuenta, Alza utiliza tu correo electrónico y los datos necesarios para autenticarte. También guarda la información que ingresás o confirmás: inversiones, operaciones, ventas, comprobantes procesados, objetivos, alertas y preferencias. Si registrás una passkey, se guarda la información necesaria para verificarla; Alza no recibe tus datos biométricos.</> },
    { title: 'Para qué usamos tus datos', body: <>Usamos esta información para identificarte, guardar y sincronizar tu cartera, mostrar cálculos y cotizaciones, procesar comprobantes que elegís importar, gestionar alertas y prestarte las funciones que solicitás. Los cálculos de dividendos usan las posiciones guardadas en tu cuenta.</> },
    { title: 'Gmail y comprobantes', body: <>Conectar Gmail es opcional. Con tu autorización, Alza solicita a Google acceso de solo lectura y consulta los mensajes que coinciden con el remitente indicado por vos o, por defecto, con los dominios de Lemon. Lee el contenido y los PDF compatibles para detectar operaciones que podés revisar antes de confirmar. Si subís un archivo o reenviás un correo a tu dirección de Alza, el servidor procesa ese contenido para la importación; los correos reenviados pasan por Resend.</> },
    { title: 'Uso y conservación de datos de Google', body: <>Alza utiliza la información obtenida de Gmail para la importación que solicitás. Las operaciones detectadas se guardan en tu cuenta como pendientes y, si las confirmás o descartás, permanecen en el historial con su estado. El token para mantener la conexión con Gmail se almacena cifrado. Alza no vende datos de Gmail ni usa su contenido para entrenar modelos de inteligencia artificial; la importación implementada procesa los comprobantes sin IA. Alza se compromete a usar y transferir los datos recibidos de las API de Google de acuerdo con la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-[var(--ink)]">Política de datos de usuario de los servicios de API de Google</a>, incluidos los requisitos de uso limitado.</> },
    { title: 'Desconectar Gmail', body: <>Podés desconectar Gmail desde Notificaciones, en la configuración de correos y comprobantes. La desconexión revoca el acceso y elimina el token guardado por Alza. También podés revocar el acceso desde tu cuenta de Google. Desconectar Gmail no elimina las operaciones que ya se guardaron en tu cuenta; descartarlas cambia su estado en el historial.</> },
    { title: 'Asistente e inteligencia artificial', body: <>Si usás el asistente o la ayuda para objetivos, tu consulta, el contexto de conversación y los datos de cartera pertinentes a la función pueden enviarse al proveedor de IA seleccionado para generar una respuesta. Según el proveedor, la función también puede consultar fuentes de mercado o búsqueda. El tratamiento posterior depende de las condiciones y políticas del proveedor. Las API keys que agregás se guardan cifradas; el uso de esos servicios puede generar cargos en tu cuenta del proveedor.</> },
    { title: 'Alertas y notificaciones', body: <>Las alertas y sus preferencias se guardan en tu cuenta. Si activás las notificaciones push, Alza almacena la suscripción de ese dispositivo y envía los datos necesarios al servicio de notificaciones del navegador o sistema operativo. Si conectás Telegram, se guarda el identificador de tu chat privado y se envían a Telegram los avisos solicitados. Podés desconectar Telegram o desactivar las notificaciones desde Configuración. Los avisos por correo todavía no están habilitados.</> },
    { title: 'Proveedores y datos de mercado', body: <>Alza utiliza proveedores de alojamiento, base de datos, correo, notificaciones, IA y datos financieros para las funciones correspondientes. Algunas consultas se realizan desde tu navegador y otras desde el servidor; pueden incluir el identificador del activo o los datos necesarios para responder a tu solicitud. Cada proveedor trata la información según sus propias condiciones y políticas.</> },
    { title: 'Seguridad y almacenamiento', body: <>La aplicación utiliza una sesión para mantener tu acceso y puede usar almacenamiento local o de sesión para preferencias y cachés. Los PIN se almacenan mediante una función de derivación y los tokens de Gmail y las API keys se guardan cifrados. Estas medidas reducen riesgos, pero ningún sistema garantiza seguridad absoluta. La información de cartera, alertas y preferencias se conserva en tu cuenta; los servicios externos pueden conservar sus propios registros según sus políticas.</> },
    { title: 'Tus derechos y controles', body: <>Podés consultar y modificar datos de cartera y preferencias desde la aplicación, eliminar alertas, exportar una copia y desconectar integraciones disponibles. Según corresponda, tenés derechos de acceso, rectificación, actualización y supresión de tus datos personales. Podés conocer más sobre su ejercicio y las vías de reclamo ante la <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noreferrer" className="text-[var(--ink)]">Agencia de Acceso a la Información Pública</a>. Desactivar una integración no elimina automáticamente los datos que ya se hayan guardado.</> },
];
const terms: Section[] = [
    { title: 'El servicio', body: <>Alza es una herramienta para registrar y consultar tu cartera, visualizar información de mercado, comparar rendimientos, definir objetivos, recibir alertas disponibles y revisar operaciones importadas. El acceso o algunas funciones pueden depender de la configuración y disponibilidad de servicios externos.</> },
    { title: 'Tu cuenta y seguridad', body: <>Sos responsable de mantener seguro el acceso a tu correo, PIN, dispositivos y passkeys. Revisá los datos antes de guardar o confirmar una operación y utilizá la aplicación de forma lícita. Si compartís un dispositivo, tené en cuenta que sus notificaciones pueden ser visibles para otras personas.</> },
    { title: 'Importación de operaciones', body: <>La conexión de Gmail y el reenvío o la carga de comprobantes son opcionales. La lectura automática puede contener errores, duplicados u omisiones: revisá activo, fecha, cantidad, precio, moneda y comisiones antes de confirmar. Desconectar Gmail interrumpe el acceso futuro, pero no borra por sí solo las operaciones ya guardadas.</> },
    { title: 'Precios, rendimientos y dividendos', body: <>Las cotizaciones y demás datos de terceros pueden estar demorados, ser incompletos o contener errores. Las conversiones, comparaciones, rendimientos y distribuciones dependen de los datos disponibles y de supuestos que se indican en la aplicación. Los pagos de dividendos pueden ser estimados, cambiar o no corresponder a tu posición; verificá fechas, elegibilidad, impuestos, comisiones y acreditación con tu intermediario.</> },
    { title: 'Alertas y notificaciones', body: <>Las alertas no garantizan una entrega inmediata ni la detección de todos los eventos. Dependen de los datos del proveedor, la conexión, los permisos, el dispositivo y la disponibilidad del servicio. Las alertas automáticas de precio y dividendos requieren configurar el canal y dependen del funcionamiento del servidor y de sus proveedores. El botón de prueba genera un aviso de ejemplo, no un evento real. El horario de no molestar afecta a los envíos automáticos por push y Telegram.</> },
    { title: 'Asistente e inteligencia artificial', body: <>Las respuestas y sugerencias pueden ser incorrectas, incompletas o desactualizadas. Revisá sus fuentes y cualquier acción propuesta antes de usarla o confirmarla. Al utilizar un proveedor de IA se aplican también sus condiciones y eventuales cargos; no ingreses información que no quieras compartir con ese proveedor.</> },
    { title: 'Decisiones de inversión', body: <>Alza ofrece herramientas e información para ayudarte a analizar alternativas. No garantiza resultados ni reemplaza la revisión independiente de los datos, riesgos y condiciones aplicables. Las decisiones de inversión son tuyas y la aplicación no ejecuta operaciones financieras por vos.</> },
    { title: 'Disponibilidad y cambios', body: <>Alza y sus integraciones pueden cambiar, interrumpirse o dejar de estar disponibles. Podés exportar los datos de tu cartera desde la configuración. Estas condiciones y la política de privacidad pueden actualizarse; la versión vigente estará disponible en estas páginas.</> },
];

export default function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
    const isPrivacy = page === 'privacy';
    const title = isPrivacy ? 'Política de privacidad' : 'Condiciones del servicio';
    const sections = isPrivacy ? privacy : terms;
    const contentRef = useRef<HTMLDivElement>(null);
    const downloadText = () => {
        const content = contentRef.current?.cloneNode(true) as HTMLDivElement | undefined;
        if (!content) return;
        content.querySelectorAll('a[href]').forEach(link => {
            const anchor = link as HTMLAnchorElement;
            anchor.replaceWith(`${anchor.textContent} (${anchor.href})`);
        });
        const body = Array.from(content.querySelectorAll('section')).map(section => `${section.querySelector('h2')?.textContent ?? ''}\n${section.querySelector('p')?.textContent ?? ''}`).join('\n\n');
        const blob = new Blob([`${title}\nActualizado el 5 de noviembre de 2026\n\n${body}\n`], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = isPrivacy ? 'alza-politica-de-privacidad.txt' : 'alza-condiciones-del-servicio.txt';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return <main data-theme="dark" className="app legal-page min-h-dvh px-5 py-10 sm:py-16">
        <div className="mx-auto max-w-[760px]">
            <a href="/" className="brand inline-flex items-center gap-2" aria-label="Alza, volver al inicio"><img src="/icon.png" alt="" className="brand-logo" />alza<span className="sig">.</span></a>
            <div className="mt-10 border-b border-[var(--line)] pb-7"><p className="lb">INFORMACIÓN LEGAL</p><h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] font-light leading-tight tracking-[-.04em]">{title}<span className="sig">.</span></h1><p className="mu mt-4 text-[13px] leading-6">Información sobre el uso de Alza y tus datos. · Actualizado el 5 de noviembre de 2026.</p><div className="legal-actions mt-5 flex flex-wrap gap-2"><button type="button" className="btn-ghost !min-h-10 text-[12px]" onClick={() => window.print()}>
                <HugeiconsIcon icon={Pdf02Icon} size={18} />
            </button><button type="button" className="btn-ghost !min-h-10 text-[12px]" onClick={downloadText}><HugeiconsIcon icon={Txt02Icon} size={18} /></button></div></div>
            <div ref={contentRef} className="space-y-8 py-9">{sections.map(section => <section key={section.title}><h2 className="text-[18px] font-medium">{section.title}</h2><p className="mu mt-3 !font-sans text-[14px] leading-7">{section.body}</p></section>)}</div>
            <footer className="legal-actions flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--line)] pt-6 text-[12px] text-[var(--muted)]"><a href="/" className="underline underline-offset-4">Volver al inicio</a><a href={isPrivacy ? '/condiciones' : '/politicas'} className="underline underline-offset-4">{isPrivacy ? 'Condiciones del servicio' : 'Política de privacidad'}</a></footer>
        </div>
    </main>;
}
