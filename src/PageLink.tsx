import type { ComponentProps } from 'react';
import { pages, type PageId } from './navigation';

export default function PageLink({ page, onClick, ...props }: Omit<ComponentProps<'a'>, 'href'> & { page: PageId }) {
    return <a {...props} href={pages[page].path} onClick={event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (window.location.pathname !== pages[page].path) {
            window.history.pushState(null, '', pages[page].path);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    }} />;
}
