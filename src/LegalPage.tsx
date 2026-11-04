import type { ReactNode } from 'react';

type Section = { title: string; body: ReactNode };
const privacy: Section[] = [
    { title: 'Datos que utilizamos', body: <>Al crear una cuenta, Alza utiliza tu dirección de correo y los datos necesarios para autenticarte. También guarda la información de cartera que ingresás, como inversiones, operaciones y preferencias.</> },
    { title: 'Conexión con Gmail', body: <>Si decidís conectar Gmail, Google te solicita autorización de solo lectura. Alza consulta los mensajes que coinciden con la búsqueda que realizás y lee su texto o PDF compatibles para extraer posibles operaciones. El acceso de Google permite leer tu correo; la búsqueda de la aplicación se limita al remitente indicado o, por defecto, a los dominios de Lemon.</> },
    { title: 'Uso y almacenamiento de los datos de Google', body: <>La información de Gmail se utiliza para mostrarte operaciones que podés revisar y confirmar. Las operaciones detectadas que conservás se guardan en tu cuenta. El token que permite mantener la conexión se almacena cifrado. Alza no usa el contenido de Gmail para entrenar modelos de inteligencia artificial ni lo vende; la importación implementada procesa los comprobantes sin IA.</> },
    { title: 'Servicios externos', body: <>Para prestar sus funciones, Alza utiliza proveedores de infraestructura, bases de datos y datos de mercado. Si elegís utilizar el asistente de IA o reenviar comprobantes por correo, los datos necesarios para esas funciones se procesan mediante los proveedores que correspondan. La conexión de Gmail utiliza los servicios de Google.</> },
    { title: 'Control de tu información', body: <>Podés desconectar Gmail desde la sección Importar; esa acción revoca el acceso y elimina el token de conexión guardado por Alza. También podés revocar el acceso desde la configuración de seguridad de tu cuenta de Google. Las operaciones detectadas que ya hayas guardado permanecen en tu cuenta; descartarlas cambia su estado en el historial de importaciones.</> },
    { title: 'Datos en tu dispositivo', body: <>La aplicación puede usar almacenamiento del navegador para recordar preferencias y mantener cachés. También utiliza una sesión para mantener tu acceso a la cuenta.</> },
    { title: 'Uso limitado de datos de Google', body: <>El tratamiento de la información recibida de las API de Google está sujeto a la <a className="underline underline-offset-4" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Política de Datos de Usuario de los Servicios de API de Google</a>, incluidos sus requisitos de uso limitado.</> },
];
const terms: Section[] = [
    { title: 'El servicio', body: <>Alza es una herramienta para registrar y consultar información sobre tu cartera, analizar su evolución e importar operaciones para revisión. Algunas funciones dependen de servicios externos y de su disponibilidad.</> },
    { title: 'Tu cuenta', body: <>Sos responsable de mantener seguros tus datos de acceso y de la información que ingresás. Revisá los datos antes de guardar o confirmar una operación y utilizá la aplicación de forma lícita.</> },
    { title: 'Importación y conexión con Gmail', body: <>La conexión de Gmail es opcional y requiere tu autorización. Las operaciones detectadas pueden contener errores o estar incompletas: revisalas antes de confirmarlas. Podés desconectar Gmail desde Importar o revocar el acceso en tu cuenta de Google.</> },
    { title: 'Información de mercado', body: <>Los precios, rendimientos, dividendos y otros datos pueden tener demoras, errores o estar incompletos. Las proyecciones y estimaciones no garantizan resultados futuros. Consultá las condiciones y registros de tu intermediario antes de tomar decisiones.</> },
    { title: 'Decisiones de inversión', body: <>El contenido de Alza es informativo y no constituye una orden de compra o venta. Las decisiones y operaciones de inversión son responsabilidad de cada usuario. La aplicación no ejecuta operaciones financieras por vos.</> },
    { title: 'Disponibilidad y cambios', body: <>Las funciones pueden modificarse o dejar de estar disponibles, por ejemplo cuando cambia un proveedor externo. Estas condiciones pueden actualizarse; la versión vigente estará disponible en esta página.</> },
];

export default function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
    const isPrivacy = page === 'privacy';
    const title = isPrivacy ? 'Política de privacidad' : 'Condiciones del servicio';
    const sections = isPrivacy ? privacy : terms;
    return <main data-theme="dark" className="app min-h-dvh px-5 py-10 sm:py-16">
        <div className="mx-auto max-w-[760px]">
            <a href="/" className="brand inline-flex items-center gap-2" aria-label="Alza, volver al inicio"><img src="/icon.png" alt="" className="brand-logo" />alza<span className="sig">.</span></a>
            <div className="mt-10 border-b border-[var(--line)] pb-7"><p className="lb">INFORMACIÓN LEGAL</p><h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] font-light leading-tight tracking-[-.04em]">{title}<span className="sig">.</span></h1><p className="mu mt-4 text-[13px] leading-6">Información sobre el uso de Alza y tus datos.</p></div>
            <div className="space-y-8 py-9">{sections.map(section => <section key={section.title}><h2 className="text-[18px] font-medium">{section.title}</h2><p className="mu mt-3 !font-sans text-[14px] leading-7">{section.body}</p></section>)}</div>
            <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--line)] pt-6 text-[12px] text-[var(--muted)]"><a href="/" className="underline underline-offset-4">Volver al inicio</a><a href={isPrivacy ? '/condiciones' : '/politicas'} className="underline underline-offset-4">{isPrivacy ? 'Condiciones del servicio' : 'Política de privacidad'}</a></footer>
        </div>
    </main>;
}
