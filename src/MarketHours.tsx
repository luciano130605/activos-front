import { useEffect, useState } from 'react';

function inRegularHours(now: Date, timeZone: string, opens: number, closes: number) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    return !['Sat', 'Sun'].includes(get('weekday') ?? '') && minutes >= opens && minutes < closes;
}

export default function MarketHours() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    const markets = [
        { label: 'Argentina', open: inRegularHours(now, 'America/Argentina/Buenos_Aires', 10 * 60 + 30, 18 * 60), hours: 'BYMA, acciones y CEDEARs T+1: 10:30 a 18:00 (hora argentina)' },
        { label: 'EE. UU.', open: inRegularHours(now, 'America/New_York', 9 * 60 + 30, 16 * 60), hours: 'NYSE, rueda regular: 9:30 a 16:00 (hora de Nueva York)' },
    ];
    return <>{markets.map(market => <span key={market.label} title={`${market.hours}. Horario habitual; no contempla feriados ni cierres especiales.`}>{market.label} <b style={{ color: market.open ? 'var(--sig)' : 'var(--muted)' }}>{market.open ? 'En horario' : 'Fuera de horario'}</b><span className="sr-only"> habitual; no contempla feriados ni cierres especiales</span></span>)}</>;
}
