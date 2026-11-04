export function meetsInflation(first: number, last: number, inflation: number): boolean {
    return Number.isFinite(first) && first > 0 && Number.isFinite(last) && last > 0 && Number.isFinite(inflation) && (last / first - 1) * 100 >= inflation - 5 - 1e-9;
}
