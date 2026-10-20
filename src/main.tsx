import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './app/App';

// Inside the claude.ai Artifact viewer the host pads for safe areas itself (see tokens.css).
if (import.meta.env.VITE_ARTIFACT) document.documentElement.dataset.host = 'artifact';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
