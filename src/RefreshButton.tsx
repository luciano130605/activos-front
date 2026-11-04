import { HugeiconsIcon } from '@hugeicons/react';
import { Refresh04Icon } from '@hugeicons/core-free-icons';

export default function RefreshButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
    return <button type="button" onClick={onClick} disabled={loading} aria-label={loading ? 'Actualizando…' : label} title={loading ? 'Actualizando…' : label} className="ibtn shrink-0 disabled:opacity-50"><HugeiconsIcon icon={Refresh04Icon} size={18} aria-hidden="true" className={loading ? 'animate-spin motion-reduce:animate-none' : ''} /></button>;
}
