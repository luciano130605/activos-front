import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LegalPage from './LegalPage';
import ModalScrollLock from './ModalScrollLock';
import './Style.css';

const root = document.getElementById('root');

if (!root) throw new Error('No se encontró #root');

createRoot(root).render(
  <StrictMode>
    <ModalScrollLock />
    {location.pathname.replace(/\/$/, '') === '/politicas' ? <LegalPage page="privacy" /> : location.pathname.replace(/\/$/, '') === '/condiciones' ? <LegalPage page="terms" /> : <App />}
  </StrictMode>
);