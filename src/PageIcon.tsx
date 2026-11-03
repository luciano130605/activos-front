import { HugeiconsIcon } from '@hugeicons/react';
import { ChartAnalysisIcon, ChartBubble02Icon, ChartLineData01Icon, ChartLineIcon, Coins01Icon, CoinsBitcoinIcon, DashboardCircleIcon, Estimate01Icon, PieChart01Icon, PieChart02Icon } from '@hugeicons/core-free-icons';
import type { PageId } from './navigation';

const icons = { summary: ChartBubble02Icon, evolution: ChartLineIcon, inflation: Coins01Icon, investments: PieChart02Icon}, dividends: Estimate01Icon } satisfies Record<PageId, typeof DashboardCircleIcon>;

export default function PageIcon({ page, size = 18 }: { page: PageId; size?: number }) {
    return <HugeiconsIcon icon={icons[page]} size={size} strokeWidth={page === 'investments' ? 1.6 : undefined} />;
}
