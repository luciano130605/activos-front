
const sources = {
    dollar: { name: 'DolarAPI', url: 'https://dolarapi.com/v1/dolares' },
    crypto: { name: 'CoinGecko', url: 'https://www.coingecko.com/' },
    cedear: { name: 'Data912', url: 'https://data912.com/live/arg_cedears' },
};

export default function QuoteSource({ source, asset, historical = false, label = 'Fuente', className = '' }: {
    source: keyof typeof sources;
    asset?: string;
    historical?: boolean;
    label?: string;
    className?: string;
}) {
    const provider = sources[source];
    const href = source === 'crypto' && asset
        ? `https://www.coingecko.com/en/coins/${encodeURIComponent(asset)}`
        : source === 'cedear' && asset && historical
            ? `https://data912.com/historical/cedears/${encodeURIComponent(asset)}`
            : provider.url;

    return <span className={`inline-flex max-w-full flex-wrap items-center gap-x-1 font-mono text-[10px] leading-5 text-[var(--muted)] ${className}`}>
        <span>{label}:</span>
        <a href={href} target="_blank" rel="noopener noreferrer" title={`Ver fuente en ${provider.name} (abre en otra pestaña)`}
            className="inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-sm underline decoration-[var(--line2)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--muted)]">
            <span className="truncate">{provider.name}</span>
        </a>
    </span>;
}
