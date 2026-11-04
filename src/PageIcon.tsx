import { HugeiconsIcon } from '@hugeicons/react';
import { Upload06Icon, Calendar01Icon, ChartAnalysisIcon, ChartBubble02Icon, ChartLineData01Icon, ChartLineIcon, Coins01Icon, CoinsBitcoinIcon, DashboardCircleIcon, Estimate01Icon, PieChart01Icon, PieChart02Icon, FileAddIcon } from '@hugeicons/core-free-icons';
import type { PageId } from './navigation';
import { Avatar } from './MarketChat';

const icons = { prices: ChartAnalysisIcon, imports: FileAddIcon, summary: ChartBubble02Icon, evolution: ChartLineIcon, inflation: Coins01Icon, investments: PieChart02Icon, dividends: Estimate01Icon, marketCalendar: Calendar01Icon, assistant: DashboardCircleIcon } satisfies Record<PageId, typeof DashboardCircleIcon>;

export default function PageIcon({ page, size = 18 }: { page: PageId; size?: number }) {
    if (page === 'assistant') return <span className="avatar-nav" style={{ width: size, height: size, filter: 'grayscale(1)', opacity: .65, display: 'inline-block', flexShrink: 0 }}><Avatar /></span>;
    return <HugeiconsIcon icon={icons[page]} size={size} strokeWidth={page === 'investments' ? 1.6 : undefined} />;
}

