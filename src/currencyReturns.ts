export function portfolioReturns(startArs: number, endArs: number, startDollar?: number, endDollar?: number) {
    const pesos = (endArs / startArs - 1) * 100;
    const dollars = startDollar && endDollar ? ((endArs / endDollar) / (startArs / startDollar) - 1) * 100 : null;
    return { pesos, dollars };
}

export function estimatedPesos(purchaseUsd: number, currentUsd: number, fraction: number, dollar: number) {
    return (purchaseUsd + (currentUsd - purchaseUsd) * fraction) * dollar;
}

export function estimatedAnnualReference(currentUsd: number, annualRate: number, elapsedYears: number, dollar: number) {
    return currentUsd * Math.pow(1 + annualRate, elapsedYears) * dollar;
}
