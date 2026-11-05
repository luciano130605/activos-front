import { useEffect, useState } from 'react';

const formatters = new Map<string, Intl.DateTimeFormat>();
function inRegularHours(now: Date, timeZone: string, opens: number, closes: number) {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        formatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    return !['Sat', 'Sun'].includes(get('weekday') ?? '') && minutes >= opens && minutes < closes;
}

function nextChange(now: Date, timeZone: string, opens: number, closes: number, open: boolean) {
    // Los horarios de ambas ruedas caen en horas o medias horas.
    let time = Math.floor(now.getTime() / 1_800_000) * 1_800_000 + 1_800_000;
    for (let i = 0; i < 8 * 48; i++, time += 1_800_000) {
        const candidate = new Date(time);
        if (inRegularHours(candidate, timeZone, opens, closes) !== open) {
            const date = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(candidate);
            return `${open ? 'Cierra' : 'Abre'} ${date}`;
        }
    }
    return 'Horario no disponible';
}

export default function MarketHours() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    const markets = [
        { label: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', opens: 10 * 60 + 30, closes: 18 * 60, hours: 'BYMA, acciones y CEDEARs T+1: 10:30 a 18:00 (hora argentina)' },
        { label: 'EE. UU.', timeZone: 'America/New_York', opens: 9 * 60 + 30, closes: 16 * 60, hours: 'NYSE, rueda regular: 9:30 a 16:00 (hora de Nueva York)' },
    ];
    return <>{markets.map(market => {
        const open = inRegularHours(now, market.timeZone, market.opens, market.closes);
        return <span key={market.label} title={`${market.hours}. Próximo horario en hora argentina. Horario habitual; no contempla feriados ni cierres especiales.`}>{market.label} <b style={{ color: open ? 'var(--sig)' : 'var(--muted)' }}>{nextChange(now, market.timeZone, market.opens, market.closes, open)}</b><span className="sr-only">, hora argentina, horario habitual; no contempla feriados ni cierres especiales</span></span>;
    })}</>;
}
