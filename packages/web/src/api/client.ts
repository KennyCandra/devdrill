import type {
  ApiError,
  ChallengeDetail,
  ChallengeSummary,
  FileContent,
  Language,
  ReviewDraft,
  ReviewIssue,
  ReviewPullRequest,
  ReviewResult,
  ReviewSubmitRequest,
  SavedFile,
  SaveFileRequest,
  SessionInfo,
  Settings,
  SolutionFile,
  SubmitRequest,
  SubmitResult,
  TestRunResult,
  WorkspaceInfo,
} from '@devdrill/shared';

const TOKEN_HEADER = 'x-devdrill-token';
const TOKEN_KEY = 'devdrill-token';

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

let language: Language = 'js';

/** The language challenge and workspace requests are for (from Settings). */
export function setLanguage(value: Language): void {
  language = value;
}

export function currentLanguage(): Language {
  return language;
}

/**
 * Challenge and workspace routes are per language; the server reads `?lang=`.
 * Pass `lang` explicitly from anything tied to one language (a workspace, a result):
 * the setting can change while its requests are still running.
 */
function withLanguage(path: string, lang: Language = language): string {
  if (!path.startsWith('/challenges') && !path.startsWith('/workspaces')) return path;
  return `${path}${path.includes('?') ? '&' : '?'}lang=${lang}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  lang?: Language,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers[TOKEN_HEADER] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${withLanguage(path, lang)}`, {
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
  challenge: (id: string, lang?: Language) =>
    request<ChallengeDetail>('GET', `/challenges/${enc(id)}`, undefined, lang),
  start: (id: string, lang?: Language) =>
    request<WorkspaceInfo>('POST', `/challenges/${enc(id)}/start`, undefined, lang),
  solution: (id: string, lang?: Language) =>
    request<SolutionFile[]>('GET', `/challenges/${enc(id)}/solution`, undefined, lang),
  hiddenTests: (id: string, lang?: Language) =>
    request<FileContent[]>('GET', `/challenges/${enc(id)}/hidden-tests`, undefined, lang),

  workspace: (id: string, lang?: Language) =>
    request<WorkspaceInfo>('GET', `/workspaces/${enc(id)}`, undefined, lang),
  readFile: (id: string, path: string, lang?: Language) =>
    request<FileContent>('GET', fileUrl(id, path), undefined, lang),
  saveFile: (id: string, path: string, body: SaveFileRequest, lang?: Language) =>
    request<SavedFile>('PUT', fileUrl(id, path), body, lang),
  deleteFile: (id: string, path: string, lang?: Language) =>
    request<{ ok: true }>('DELETE', fileUrl(id, path), undefined, lang),
  reset: (id: string, lang?: Language) =>
    request<WorkspaceInfo>('POST', `/workspaces/${enc(id)}/reset`, undefined, lang),
  run: (id: string, lang?: Language) =>
    request<TestRunResult>('POST', `/workspaces/${enc(id)}/run`, undefined, lang),
  submit: (id: string, body: SubmitRequest, lang?: Language) =>
    request<SubmitResult>('POST', `/workspaces/${enc(id)}/submit`, body, lang),

  /**
   * Last-chance save while the page closes: `keepalive` lets the request outlive the page.
   * Browsers cap keepalive bodies at 64 KB, so very large files can't be saved this way.
   */
  saveFileOnUnload: (id: string, path: string, body: SaveFileRequest, lang?: Language) => {
    void fetch(`/api${withLanguage(fileUrl(id, path), lang)}`, {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { [TOKEN_HEADER]: token } : {}) },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  },

  reviewPullRequest: (id: string, lang?: Language) =>
    request<ReviewPullRequest>('GET', `/challenges/${enc(id)}/review`, undefined, lang),
  answerKey: (id: string, lang?: Language) =>
    request<ReviewIssue[]>('GET', `/challenges/${enc(id)}/answer-key`, undefined, lang),
  reviewDraft: (id: string, lang?: Language) =>
    request<ReviewDraft>('GET', `/workspaces/${enc(id)}/review`, undefined, lang),
  saveReview: (id: string, draft: ReviewDraft, lang?: Language) =>
    request<ReviewDraft>('PUT', `/workspaces/${enc(id)}/review`, draft, lang),
  submitReview: (id: string, body: ReviewSubmitRequest, lang?: Language) =>
    request<ReviewResult>('POST', `/workspaces/${enc(id)}/review/submit`, body, lang),

  /** The review draft's last-chance save while the page closes (see saveFileOnUnload). */
  saveReviewOnUnload: (id: string, draft: ReviewDraft, lang?: Language) => {
    void fetch(`/api${withLanguage(`/workspaces/${enc(id)}/review`, lang)}`, {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { [TOKEN_HEADER]: token } : {}) },
      body: JSON.stringify(draft),
    }).catch(() => undefined);
  },

  settings: () => request<Settings>('GET', '/settings'),
  saveSettings: (patch: Partial<Settings>) => request<Settings>('PUT', '/settings', patch),
  resetProgress: () => request<{ ok: true }>('DELETE', '/progress'),
};
