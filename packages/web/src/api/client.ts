import type {
  ApiError,
  ChallengeDetail,
  ChallengeSummary,
  FileContent,
  SavedFile,
  SaveFileRequest,
  SessionInfo,
  Settings,
  SolutionFile,
  SubmitRequest,
  SubmitResult,
  TestRunResult,
  WorkspaceInfo,
} from '@bughunt/shared';

const TOKEN_HEADER = 'x-bughunt-token';
const TOKEN_KEY = 'bughunt-token';

/** An error response from the API, with its HTTP status. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Reads the session token from `#token=...` (the link the server prints), keeps it in
 * sessionStorage for reloads, and removes it from the address bar.
 */
export function readToken(location: Location = window.location): string | null {
  const match = /(?:^#|&)token=([^&]+)/.exec(location.hash);
  if (match?.[1]) {
    const token = decodeURIComponent(match[1]);
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Private mode: the token still works for this page load.
    }
    history.replaceState(null, '', location.pathname + location.search);
    return token;
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token: string | null = null;

export function setToken(value: string | null): void {
  token = value;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers[TOKEN_HEADER] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      message = ((await res.json()) as ApiError).error || message;
    } catch {
      // Not JSON (e.g. the dev proxy can't reach the server).
    }
    throw new ApiRequestError(res.status, message);
  }
  return (await res.json()) as T;
}

const enc = encodeURIComponent;
const fileUrl = (id: string, path: string) => `/workspaces/${enc(id)}/files?path=${enc(path)}`;

export const api = {
  session: () => request<SessionInfo>('GET', '/session'),

  challenges: () => request<ChallengeSummary[]>('GET', '/challenges'),
  challenge: (id: string) => request<ChallengeDetail>('GET', `/challenges/${enc(id)}`),
  start: (id: string) => request<WorkspaceInfo>('POST', `/challenges/${enc(id)}/start`),
  solution: (id: string) => request<SolutionFile[]>('GET', `/challenges/${enc(id)}/solution`),

  workspace: (id: string) => request<WorkspaceInfo>('GET', `/workspaces/${enc(id)}`),
  readFile: (id: string, path: string) => request<FileContent>('GET', fileUrl(id, path)),
  saveFile: (id: string, path: string, body: SaveFileRequest) =>
    request<SavedFile>('PUT', fileUrl(id, path), body),
  deleteFile: (id: string, path: string) => request<{ ok: true }>('DELETE', fileUrl(id, path)),
  reset: (id: string) => request<WorkspaceInfo>('POST', `/workspaces/${enc(id)}/reset`),
  run: (id: string) => request<TestRunResult>('POST', `/workspaces/${enc(id)}/run`),
  submit: (id: string, body: SubmitRequest) =>
    request<SubmitResult>('POST', `/workspaces/${enc(id)}/submit`, body),

  /**
   * Last-chance save while the page closes: `keepalive` lets the request outlive the page.
   * Browsers cap keepalive bodies at 64 KB, so very large files can't be saved this way.
   */
  saveFileOnUnload: (id: string, path: string, body: SaveFileRequest) => {
    void fetch(`/api${fileUrl(id, path)}`, {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { [TOKEN_HEADER]: token } : {}) },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  },

  settings: () => request<Settings>('GET', '/settings'),
  saveSettings: (patch: Partial<Settings>) => request<Settings>('PUT', '/settings', patch),
  resetProgress: () => request<{ ok: true }>('DELETE', '/progress'),
};
