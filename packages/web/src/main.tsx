import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { readToken, setToken } from './api/client';
import { App } from './App';
import './index.css';

// Read before the first render: it also removes the token from the address bar.
const token = readToken();
setToken(token);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App hasToken={token !== null} />
  </StrictMode>,
);
