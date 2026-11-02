import { HugeiconsIcon } from '@hugeicons/react';
import { ChartLineData01Icon, CoinsBitcoinIcon, DashboardCircleIcon, Estimate01Icon } from '@hugeicons/core-free-icons';
import type { PageId } from './navigation';

const icons = { summary: DashboardCircleIcon, evolution: ChartLineData01Icon, investments: CoinsBitcoinIcon, dividends: Estimate01Icon } satisfies Record<PageId, typeof DashboardCircleIcon>;

export default function PageIcon({ page, size = 18 }: { page: PageId; size?: number }) {
    return <HugeiconsIcon icon={icons[page]} size={size} fill={page === 'summary' ? 'currentColor' : 'none'} strokeWidth={page === 'investments' ? 1.6 : undefined} />;
}
