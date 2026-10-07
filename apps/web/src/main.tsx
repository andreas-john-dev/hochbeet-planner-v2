import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadConfig } from './lib/config';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root missing');

const config = await loadConfig();
// Loaded on demand, so the mock and its test users stay out of the code that prod runs.
const auth =
  config.authMode === 'mock'
    ? (await import('./lib/auth/mock-adapter')).createMockAuthAdapter()
    : (await import('./lib/auth/amplify-adapter')).createAmplifyAuthAdapter(config);

createRoot(root).render(
  <StrictMode>
    <App auth={auth} />
  </StrictMode>,
);
