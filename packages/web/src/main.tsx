import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { readToken, setToken } from './api/client';
import { App } from './App';
import { applyInitialTheme } from './theme';
import './index.css';

applyInitialTheme();

// Read before the first render: it also removes the token from the address bar.
const token = readToken();
setToken(token);

// Pasting the terminal link into an open tab only changes the hash, which doesn't reload.
window.addEventListener('hashchange', () => {
  if (/(?:^#|&)token=/.test(window.location.hash)) window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App hasToken={token !== null} />
  </StrictMode>,
);
