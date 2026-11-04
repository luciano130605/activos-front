import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ModalScrollLock from './ModalScrollLock';
import './Style.css';

const root = document.getElementById('root');

if (!root) throw new Error('No se encontró #root');

createRoot(root).render(
  <StrictMode>
    <ModalScrollLock />
    <App />
  </StrictMode>
);