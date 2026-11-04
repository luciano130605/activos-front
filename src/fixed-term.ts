export function fixedTermValue(principal: number, annualRate: number, startDate: string, maturityDate: string, at: number): number {
    const date = new Date(at);
    const localDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const maturity = Date.parse(`${maturityDate}T00:00:00Z`);
    if (localDay < start) return 0;
    const days = Math.max(0, (Math.min(localDay, maturity) - start) / 86_400_000);
    return principal * (1 + annualRate / 100 * days / 365);
}
