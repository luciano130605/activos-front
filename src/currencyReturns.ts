export function portfolioReturns(startArs: number, endArs: number, startDollar?: number, endDollar?: number) {
    const pesos = (endArs / startArs - 1) * 100;
    const dollars = startDollar && endDollar ? ((endArs / endDollar) / (startArs / startDollar) - 1) * 100 : null;
    return { pesos, dollars };
}
