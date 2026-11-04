import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LegalPage from './LegalPage';
import NotFound from './NotFound';
import { pages } from './navigation';
import ModalScrollLock from './ModalScrollLock';
import './Style.css';

const root = document.getElementById('root');

if (!root) throw new Error('No se encontró #root');

const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/';
function Router() {
  const path = useSyncExternalStore(subscribe, currentPath, () => '/');
  if (path === '/politicas') return <LegalPage page="privacy" />;
  if (path === '/condiciones') return <LegalPage page="terms" />;
  if (!Object.values(pages).some(page => page.path === path)) return <NotFound />;
  return <App />;
}

createRoot(root).render(
  <StrictMode>
    <ModalScrollLock />
    <Router />
  </StrictMode>
);
