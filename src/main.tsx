import { StrictMode, Suspense, lazy, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LegalPage from './LegalPage';
import NotFound from './NotFound';
import { isAppPath } from './navigation';
import ModalScrollLock from './ModalScrollLock';
import './Style.css';

const Widgets = lazy(() => import('./Widgets'));

const root = document.getElementById('root');

if (!root) throw new Error('No se encontró #root');

const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/';
function Router() {
  const path = useSyncExternalStore(subscribe, currentPath, () => '/');
  if (path === '/politicas') return <LegalPage page="privacy" />;
  if (path === '/condiciones') return <LegalPage page="terms" />;
  if (!isAppPath(path)) return <NotFound />;
  return <App />;
}

const widgetMode = new URLSearchParams(window.location.search).has('widget');

createRoot(root).render(<StrictMode>{widgetMode ? <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-[#0a0a09] font-mono text-[12px] text-[#9a9a94]">Abriendo widget…</main>}><Widgets /></Suspense> : <><ModalScrollLock /><Router /></>}</StrictMode>);
