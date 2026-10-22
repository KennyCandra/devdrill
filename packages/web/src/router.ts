import { useSyncExternalStore } from 'react';

// A tiny path router: the app has a handful of screens, so a router library isn't worth it.

export type Route =
  | { name: 'list' }
  | { name: 'settings' }
  | { name: 'workspace'; id: string }
  | { name: 'results'; id: string }
  | { name: 'notFound' };

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function navigate(path: string): void {
  if (path === window.location.pathname) return;
  history.pushState(null, '', path);
  for (const listener of listeners) listener();
}

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'list' };
  if (pathname === '/settings' || pathname === '/settings/') return { name: 'settings' };
  const match = /^\/challenge\/([^/]+)\/?$/.exec(pathname);
  if (match?.[1]) return { name: 'workspace', id: decodeURIComponent(match[1]) };
  const results = /^\/challenge\/([^/]+)\/results\/?$/.exec(pathname);
  if (results?.[1]) return { name: 'results', id: decodeURIComponent(results[1]) };
  return { name: 'notFound' };
}

export function challengePath(id: string): string {
  return `/challenge/${encodeURIComponent(id)}`;
}

export function resultsPath(id: string): string {
  return `${challengePath(id)}/results`;
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parseRoute(pathname);
}
