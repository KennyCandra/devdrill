import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  ApiError,
  ChallengeDetail,
  ChallengeSummary,
  FileContent,
  Language,
  ProgressEntry,
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
  progressKey,
} from './services/stores.js';
import { gradeReview } from './services/reviewGrading.js';
import { ReviewService } from './services/reviewService.js';
import { MAX_FILE_BYTES, WorkspaceManager, type Target } from './services/workspaceManager.js';

export interface AppOptions {
  challenges: Map<string, Challenge>;
  /** Where workspaces, progress.json and settings.json live (normally ~/.devdrill). */
  dataDir: string;
  token: string;
  extraOrigins?: string[];
  testTimeoutMs?: number;
  /** The built web UI to serve, if any (in development Vite serves it instead). */
  uiDir?: string | null;
  /** Hosted mode: the public URL, allowed by the Host and Origin checks. */
  publicUrl?: string;
}

export function createApp(options: AppOptions) {
  const { challenges, dataDir } = options;
  const workspaces = new WorkspaceManager(path.join(dataDir, 'workspaces'), options.testTimeoutMs);
  const progress = createProgressStore(dataDir);
  const settings = createSettingsStore(dataDir);
  const reviews = new ReviewService(workspaces);

  const app = express();
  app.disable('x-powered-by');

  const api = express.Router();
  api.use(
    apiSecurity({
      token: options.token,
      extraOrigins: options.extraOrigins ?? [],
      ...(options.publicUrl ? { publicUrl: options.publicUrl } : {}),
    }),
  );
  // JSON bodies can carry a whole file, plus a little room for the wrapper.
  api.use(express.json({ limit: MAX_FILE_BYTES * 2 }));

  const challengeById = (id: string | string[] | undefined): Challenge => {
    const challenge = typeof id === 'string' ? challenges.get(id) : undefined;
    if (!challenge) throw new HttpError(404, 'Challenge not found.');
    return challenge;
  };

  /** The challenge in the language the UI asked for (`?lang=js|ts`, default js). */
  const targetOf = (req: Request): Target => {
    const challenge = challengeById(req.params.id);
    const lang = languageOf(req);
    if (!challenge.languages.includes(lang)) {
      throw new HttpError(404, `This challenge isn't available in ${LANGUAGE_NAMES[lang]} yet.`);
    }
    return { challenge, lang };
  };

  /** Debug and feature challenges: there's code to edit and tests to run. */
  const codeTargetOf = (req: Request): Target => {
    const target = targetOf(req);
    if (target.challenge.meta.mode === 'review') {
      throw new HttpError(400, 'A review challenge has no code to edit or tests to run.');
    }
    return target;
  };

  const progressOf = async ({ challenge, lang }: Target): Promise<ProgressEntry> =>
    (await progress.get()).challenges[progressKey(lang, challenge.meta.id)] ?? emptyProgress();

  const markStarted = ({ challenge, lang }: Target) =>
    progress.update((p) => {
      const key = progressKey(lang, challenge.meta.id);
      const entry = p.challenges[key] ?? emptyProgress();
      if (entry.status === 'not_started') entry.status = 'in_progress';
      entry.startedAt ??= new Date().toISOString();
      p.challenges[key] = entry;
      return p;
    });

  /** Counts a submit; a solved one also records when and the best time. */
  const recordAttempt = async (
    { challenge, lang }: Target,
    solved: boolean,
    elapsedMs?: number,
  ) => {
    const key = progressKey(lang, challenge.meta.id);
    const updated = await progress.update((p) => {
      const entry = p.challenges[key] ?? emptyProgress();
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
      p.challenges[key] = entry;
      return p;
    });
    return updated.challenges[key] ?? emptyProgress();
  };

  // ---- Session ----

  // Lets the UI check its token at startup, and a second launch find this server.
  api.get('/session', (_req, res: Response<SessionInfo>) => {
    res.json({ ok: true, appName: APP_NAME });
  });

  // ---- Challenges ----

  // Every challenge, with progress in the asked-for language (?lang=, default js).
  api.get('/challenges', async (req, res: Response<ChallengeSummary[]>) => {
    const lang = languageOf(req);
    const all = (await progress.get()).challenges;
    res.json(
      [...challenges.values()].map(
        ({ languages, meta: { hints: _hints, hiddenTestRules: _rules, ...meta } }) => ({
          ...meta,
          languages,
          progress: all[progressKey(lang, meta.id)] ?? emptyProgress(),
        }),
      ),
    );
  });

  api.get('/challenges/:id', async (req, res: Response<ChallengeDetail>) => {
    const target = targetOf(req);
    const { hiddenTestRules: _rules, ...meta } = target.challenge.meta;
    res.json({
      ...meta,
      languages: target.challenge.languages,
      progress: await progressOf(target),
      readme: target.challenge.readme,
    });
  });

  api.post('/challenges/:id/start', async (req, res: Response<WorkspaceInfo>) => {
    const target = targetOf(req);
    const files = await workspaces.start(target);
    await markStarted(target);
    res.json({ challengeId: target.challenge.meta.id, files: visibleFiles(target, files) });
  });

  api.get('/challenges/:id/solution', async (req, res: Response<SolutionFile[]>) => {
    res.json(await workspaces.solution(codeTargetOf(req)));
  });

  // The hidden tests unlock once you've solved the challenge, like their failure details.
  api.get('/challenges/:id/hidden-tests', async (req, res: Response<FileContent[]>) => {
    const target = codeTargetOf(req);
    if ((await progressOf(target)).status !== 'solved') {
      throw new HttpError(403, 'Solve the challenge to see its hidden tests.');
    }
    res.json(await workspaces.hiddenTests(target));
  });

  // ---- Workspaces ----

  api.get('/workspaces/:id', async (req, res: Response<WorkspaceInfo>) => {
    const target = targetOf(req);
    res.json({
      challengeId: target.challenge.meta.id,
      files: visibleFiles(target, await workspaces.files(target)),
    });
  });

  api.get('/workspaces/:id/files', async (req, res: Response<FileContent>) => {
    res.json(await workspaces.readFile(codeTargetOf(req), queryPath(req)));
  });

  api.put('/workspaces/:id/files', async (req, res: Response<SavedFile>) => {
    const body = (req.body ?? {}) as Partial<Record<keyof SaveFileRequest, unknown>>;
    res.json(
      await workspaces.writeFile(codeTargetOf(req), queryPath(req), body.content, body.baseMtimeMs),
    );
  });

  api.delete('/workspaces/:id/files', async (req, res: Response<{ ok: true }>) => {
    await workspaces.deleteFile(codeTargetOf(req), queryPath(req));
    res.json({ ok: true });
  });

  api.post('/workspaces/:id/reset', async (req, res: Response<WorkspaceInfo>) => {
    const target = targetOf(req);
    const files = await workspaces.reset(target);
    reviews.forget(target);
    res.json({ challengeId: target.challenge.meta.id, files: visibleFiles(target, files) });
  });

  api.post('/workspaces/:id/run', async (req, res: Response<TestRunResult>) => {
    res.json(await workspaces.run(codeTargetOf(req)));
  });

  api.post('/workspaces/:id/submit', async (req, res: Response<SubmitResult>) => {
    const target = codeTargetOf(req);
    const { challenge } = target;
    const elapsedMs = parseElapsed((req.body as SubmitRequest | undefined)?.elapsedMs);
    const submitted = await workspaces.submit(target);
    // Each hidden test says which rule from the task it checks, solved or not.
    const rules = challenge.meta.hiddenTestRules ?? {};
    const fullRun = {
      ...submitted,
      tests: submitted.tests.map((t) =>
        t.hidden && rules[t.name] ? { ...t, rule: rules[t.name] } : t,
      ),
    };
    const solved = fullRun.status === 'passed';
    // Until it's solved, hidden tests give nothing away: a failing one shows only its name
    // (its expected values would be the answer), and no hidden test shows console output
    // (a console.log in your code would print the hidden inputs).
    const run = solved
      ? fullRun
      : {
          ...fullRun,
          tests: fullRun.tests.map(withholdHiddenDetails),
          ...(fullRun.logs
            ? { logs: fullRun.logs.filter((l) => !/\.hidden\.test\.m?[jt]s$/.test(l.file ?? '')) }
            : {}),
        };

    res.json({ run, solved, progress: await recordAttempt(target, solved, elapsedMs) });
  });

  // ---- Reviews ----

  api.get('/challenges/:id/review', async (req, res: Response<ReviewPullRequest>) => {
    const target = targetOf(req);
    res.json({ files: await reviews.files(target), issueTypes: reviews.issueTypes(target) });
  });

  // The answer key, like a debug challenge's solution: the UI asks before showing it.
  api.get('/challenges/:id/answer-key', (req, res: Response<ReviewIssue[]>) => {
    res.json(reviews.issues(targetOf(req)));
  });

  api.get('/workspaces/:id/review', async (req, res: Response<ReviewDraft>) => {
    res.json(await reviews.draft(targetOf(req)));
  });

  api.put('/workspaces/:id/review', async (req, res: Response<ReviewDraft>) => {
    res.json(await reviews.saveDraft(targetOf(req), req.body));
  });

  // Grades the saved draft: the UI saves before it submits.
  api.post('/workspaces/:id/review/submit', async (req, res: Response<ReviewResult>) => {
    const target = targetOf(req);
    const elapsedMs = parseElapsed((req.body as ReviewSubmitRequest | undefined)?.elapsedMs);
    const draft = await reviews.draft(target);
    if (draft.verdict === null) {
      throw new HttpError(400, 'Pick a verdict (Approve or Request changes) before submitting.');
    }
    const graded = gradeReview(
      reviews.issues(target),
      draft.comments,
      draft.verdict,
      reviews.issueTypes(target),
      (await progressOf(target)).status === 'solved',
    );
    res.json({ ...graded, progress: await recordAttempt(target, graded.solved, elapsedMs) });
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
    reviews.forget();
    await progress.update(() => ({ challenges: {} }));
    res.json({ ok: true });
  });

  api.use((_req, _res) => {
    throw new HttpError(404, 'Unknown API route.');
  });

  app.use('/api', api, apiErrorHandler);

  if (options.uiDir) {
    const uiDir = options.uiDir;
    app.use(uiSecurity(options.publicUrl));
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

/** A review's workspace only holds its draft, which isn't a file to edit. */
function visibleFiles({ challenge }: Target, files: string[]): string[] {
  return challenge.meta.mode === 'review' ? [] : files;
}

function withholdHiddenDetails(test: TestCaseResult): TestCaseResult {
  if (!test.hidden) return test;
  const { message: _message, logs: _logs, ...rest } = test;
  return test.status === 'failed' ? { ...rest, detailsHidden: true } : rest;
}

const LANGUAGE_NAMES: Record<Language, string> = { js: 'JavaScript', ts: 'TypeScript' };

/** `?lang=` on a request; JavaScript when it's missing. */
function languageOf(req: Request): Language {
  const lang = req.query.lang;
  if (lang === undefined) return 'js';
  if (lang === 'js' || lang === 'ts') return lang;
  throw new HttpError(400, '"lang" must be js or ts.');
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
