import { useEffect, useRef } from 'react';

export default function MarketIndices({ theme }: { theme: 'dark' | 'light' }) {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = container.current;
        if (!element) return;
        element.replaceChildren();
        const widget = document.createElement('div');
        widget.className = 'tradingview-widget-container__widget';
        const attribution = document.createElement('div');
        attribution.className = 'tradingview-widget-copyright';
        const link = document.createElement('a');
        link.href = 'https://www.tradingview.com/markets/indices/';
        link.target = '_blank';
        link.rel = 'noopener noreferrer nofollow';
        link.textContent = 'Índices por TradingView';
        attribution.append(link);
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
        script.async = true;
        script.textContent = JSON.stringify({
            colorTheme: theme, locale: 'es', isTransparent: true, width: '100%', height: 400,
            showChart: false, showSymbolLogo: false,
            tabs: [{ title: 'Índices', symbols: [
                { s: 'SP:SPX', d: 'S&P 500' },
                { s: 'NASDAQ:NDX', d: 'Nasdaq 100' },
                { s: 'TVC:DJI', d: 'Dow Jones' },
                { s: 'TVC:NI225', d: 'Nikkei 225' },
                { s: 'XETR:DAX', d: 'DAX' },
            ] }],
        });
        element.append(widget, attribution, script);
        return () => { element.replaceChildren(); };
    }, [theme]);

    return <section className="mb-3.5 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="text-[16px] font-medium tracking-tight">Índices de mercado</h2>
        <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">Seguimiento de los principales mercados · Datos de TradingView</p>
        <div ref={container} className="tradingview-widget-container mt-4 min-h-[400px]" />
    </section>;
}
