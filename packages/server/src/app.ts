import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  ApiError,
  ChallengeDetail,
  ChallengeSummary,
  FileContent,
  ProgressEntry,
  SavedFile,
  SaveFileRequest,
  SessionInfo,
  Settings,
  SolutionFile,
  SubmitRequest,
  SubmitResult,
  TestCaseResult,
  TestRunResult,
  WorkspaceInfo,
} from '@devdrill/shared';
import { APP_NAME } from './config.js';
import { HttpError } from './httpError.js';
import { apiSecurity, uiSecurity } from './security.js';
import type { Challenge } from './services/challengeLoader.js';
import {
  createProgressStore,
  createSettingsStore,
  emptyProgress,
  parseSettingsPatch,
} from './services/stores.js';
import { MAX_FILE_BYTES, WorkspaceManager } from './services/workspaceManager.js';

export interface AppOptions {
  challenges: Map<string, Challenge>;
  /** Where workspaces, progress.json and settings.json live (normally ~/.devdrill). */
  dataDir: string;
  token: string;
  extraOrigins?: string[];
  testTimeoutMs?: number;
  /** The built web UI to serve, if any (in development Vite serves it instead). */
  uiDir?: string | null;
}

export function createApp(options: AppOptions) {
  const { challenges, dataDir } = options;
  const workspaces = new WorkspaceManager(path.join(dataDir, 'workspaces'), options.testTimeoutMs);
  const progress = createProgressStore(dataDir);
  const settings = createSettingsStore(dataDir);

  const app = express();
  app.disable('x-powered-by');

  const api = express.Router();
  api.use(apiSecurity({ token: options.token, extraOrigins: options.extraOrigins ?? [] }));
  // JSON bodies can carry a whole file, plus a little room for the wrapper.
  api.use(express.json({ limit: MAX_FILE_BYTES * 2 }));

  const challengeById = (id: string | string[] | undefined): Challenge => {
    const challenge = typeof id === 'string' ? challenges.get(id) : undefined;
    if (!challenge) throw new HttpError(404, 'Challenge not found.');
    return challenge;
  };

  const progressOf = async (id: string): Promise<ProgressEntry> =>
    (await progress.get()).challenges[id] ?? emptyProgress();

  const markStarted = (id: string) =>
    progress.update((p) => {
      const entry = p.challenges[id] ?? emptyProgress();
      if (entry.status === 'not_started') entry.status = 'in_progress';
      entry.startedAt ??= new Date().toISOString();
      p.challenges[id] = entry;
      return p;
    });

  // ---- Session ----

  // Lets the UI check its token at startup, and a second launch find this server.
  api.get('/session', (_req, res: Response<SessionInfo>) => {
    res.json({ ok: true, appName: APP_NAME });
  });

  // ---- Challenges ----

  api.get('/challenges', async (_req, res: Response<ChallengeSummary[]>) => {
    const all = (await progress.get()).challenges;
    res.json(
      [...challenges.values()].map(({ meta: { hints: _hints, ...meta } }) => ({
        ...meta,
        progress: all[meta.id] ?? emptyProgress(),
      })),
    );
  });

  api.get('/challenges/:id', async (req, res: Response<ChallengeDetail>) => {
    const challenge = challengeById(req.params.id);
    res.json({
      ...challenge.meta,
      progress: await progressOf(challenge.meta.id),
      readme: challenge.readme,
    });
  });

  api.post('/challenges/:id/start', async (req, res: Response<WorkspaceInfo>) => {
    const challenge = challengeById(req.params.id);
    const files = await workspaces.start(challenge);
    await markStarted(challenge.meta.id);
    res.json({ challengeId: challenge.meta.id, files });
  });

  api.get('/challenges/:id/solution', async (req, res: Response<SolutionFile[]>) => {
    res.json(await workspaces.solution(challengeById(req.params.id)));
  });

  // ---- Workspaces ----

  api.get('/workspaces/:id', async (req, res: Response<WorkspaceInfo>) => {
    const challenge = challengeById(req.params.id);
    res.json({ challengeId: challenge.meta.id, files: await workspaces.files(challenge) });
  });

  api.get('/workspaces/:id/files', async (req, res: Response<FileContent>) => {
    const challenge = challengeById(req.params.id);
    res.json(await workspaces.readFile(challenge, queryPath(req)));
  });

  api.put('/workspaces/:id/files', async (req, res: Response<SavedFile>) => {
    const challenge = challengeById(req.params.id);
    const body = (req.body ?? {}) as Partial<Record<keyof SaveFileRequest, unknown>>;
    res.json(await workspaces.writeFile(challenge, queryPath(req), body.content, body.baseMtimeMs));
  });

  api.delete('/workspaces/:id/files', async (req, res: Response<{ ok: true }>) => {
    await workspaces.deleteFile(challengeById(req.params.id), queryPath(req));
    res.json({ ok: true });
  });

  api.post('/workspaces/:id/reset', async (req, res: Response<WorkspaceInfo>) => {
    const challenge = challengeById(req.params.id);
    res.json({ challengeId: challenge.meta.id, files: await workspaces.reset(challenge) });
  });

  api.post('/workspaces/:id/run', async (req, res: Response<TestRunResult>) => {
    res.json(await workspaces.run(challengeById(req.params.id)));
  });

  api.post('/workspaces/:id/submit', async (req, res: Response<SubmitResult>) => {
    const challenge = challengeById(req.params.id);
    const elapsedMs = parseElapsed((req.body as SubmitRequest | undefined)?.elapsedMs);
    const fullRun = await workspaces.submit(challenge);
    const solved = fullRun.status === 'passed';
    // Until it's solved, a failing hidden test shows only its name: its expected values
    // would give the answer away.
    const run = solved ? fullRun : { ...fullRun, tests: fullRun.tests.map(withholdHiddenDetails) };

    const updated = await progress.update((p) => {
      const entry = p.challenges[challenge.meta.id] ?? emptyProgress();
      entry.attempts += 1;
      if (solved) {
        entry.status = 'solved';
        entry.solvedAt ??= new Date().toISOString();
        if (
          elapsedMs !== undefined &&
          (entry.bestTimeMs === undefined || elapsedMs < entry.bestTimeMs)
        ) {
          entry.bestTimeMs = elapsedMs;
        }
      } else if (entry.status === 'not_started') {
        entry.status = 'in_progress';
      }
      p.challenges[challenge.meta.id] = entry;
      return p;
    });

    res.json({ run, solved, progress: updated.challenges[challenge.meta.id] ?? emptyProgress() });
  });

  // ---- Settings ----

  api.get('/settings', async (_req, res: Response<Settings>) => {
    res.json(await settings.get());
  });

  api.put('/settings', async (req, res: Response<Settings>) => {
    const patch = parseSettingsPatch(req.body);
    res.json(await settings.update((current) => ({ ...current, ...patch })));
  });

  // "Reset progress" in Settings: a fresh start, including the code in every workspace.
  api.delete('/progress', async (_req, res: Response<{ ok: true }>) => {
    await workspaces.removeAll();
    await progress.update(() => ({ challenges: {} }));
    res.json({ ok: true });
  });

  api.use((_req, _res) => {
    throw new HttpError(404, 'Unknown API route.');
  });

  app.use('/api', api, apiErrorHandler);

  if (options.uiDir) {
    const uiDir = options.uiDir;
    app.use(uiSecurity);
    // Built assets have content hashes in their names, so they can be cached for good.
    // A missing asset is a real 404 (e.g. an old tab asking for a chunk from before an
    // upgrade), not the app page with a 200.
    app.use(
      '/assets',
      express.static(path.join(uiDir, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      }),
    );
    app.use(express.static(uiDir, { index: false }));
    // Every other page is the single-page app; it reads the route from the URL. Paths that
    // look like files (have an extension) and weren't found above are 404s.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (path.extname(req.path) !== '') {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.set('Cache-Control', 'no-cache').sendFile(path.join(uiDir, 'index.html'));
    });
    app.use(staticErrorHandler);
  }

  return app;
}

function withholdHiddenDetails(test: TestCaseResult): TestCaseResult {
  if (!test.hidden || test.status !== 'failed') return test;
  const { message: _message, ...rest } = test;
  return { ...rest, detailsHidden: true };
}

function queryPath(req: Request): string | undefined {
  return typeof req.query.path === 'string' ? req.query.path : undefined;
}

function parseElapsed(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, '"elapsedMs" must be a positive number.');
  }
  return Math.round(value);
}

/** Errors from express.static (404 for missing assets, 400 for malformed paths) as plain text. */
function staticErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express recognises error handlers by their four parameters.
  _next: NextFunction,
): void {
  const status = (err as { status?: unknown }).status;
  const code = typeof status === 'number' && status >= 400 && status < 500 ? status : 500;
  res
    .status(code)
    .type('text/plain')
    .send(code === 404 ? 'Not found' : 'Bad request');
}

function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiError>,
  // Express recognises error handlers by their four parameters.
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Errors from express.json() (bad JSON, too large) carry a status.
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: (err as Error).message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Check the terminal.' });
}
