import { useSyncExternalStore } from 'react';

// A tiny path router: the app has three screens, so a router library isn't worth it.

export type Route = { name: 'list' } | { name: 'workspace'; id: string } | { name: 'notFound' };

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
  const match = /^\/challenge\/([^/]+)\/?$/.exec(pathname);
  if (match?.[1]) return { name: 'workspace', id: decodeURIComponent(match[1]) };
  return { name: 'notFound' };
}

export function challengePath(id: string): string {
  return `/challenge/${encodeURIComponent(id)}`;
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parseRoute(pathname);
}
