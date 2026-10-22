import { cp, lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../httpError.js';

/** Files macOS and editors create on their own; never copied or listed. */
export const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

/** Folders that are never listed, copied into a test run, or written into. */
const SKIPPED_DIRS = new Set(['node_modules', '.git']);

/** Converts an OS path to the `/`-separated form used everywhere in the API. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * True if any part of the path is a skipped folder. Case-insensitive, and ignores
 * trailing dots/spaces, because macOS and Windows treat `Node_Modules.` as `node_modules`.
 */
export function isInSkippedDir(relPath: string): boolean {
  return relPath
    .split(/[\\/]+/)
    .some((part) => SKIPPED_DIRS.has(part.toLowerCase().replace(/[. ]+$/, '')));
}

/** Copies a folder, skipping ignored files, skipped folders, and symlinks. */
export async function copyDir(from: string, to: string): Promise<void> {
  await cp(from, to, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
    filter: async (src) => {
      const rel = path.relative(from, src);
      if (IGNORED_FILES.has(path.basename(src)) || isInSkippedDir(rel)) return false;
      return !(await lstat(src)).isSymbolicLink();
    },
  });
}

/** Every regular file under `root`, relative, `/`-separated, sorted. Never enters skipped folders. */
export async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isInSkippedDir(entry.name)) await walk(full);
      } else if (entry.isFile() && !IGNORED_FILES.has(entry.name)) {
        files.push(toPosix(path.relative(root, full)));
      }
    }
  };
  await walk(root);
  return files.sort();
}

/**
 * Resolves a user-supplied relative path inside `root`, or throws a 400.
 * Blocks `..`, absolute paths, drive letters, NUL bytes, and symlinks that point outside.
 */
export async function resolveInside(root: string, relPath: unknown): Promise<string> {
  if (typeof relPath !== 'string' || relPath.trim() === '' || relPath.includes('\0')) {
    throw new HttpError(400, 'A file path is required.');
  }
  const outside = new HttpError(400, 'File paths must stay inside the workspace.');
  const parts = relPath.split(/[\\/]+/);
  if (path.isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath) || parts.includes('..')) {
    throw outside;
  }

  const resolved = path.resolve(root, ...parts.filter((p) => p !== '' && p !== '.'));
  if (!isStrictlyInside(root, resolved)) throw outside;

  // The lexical check passed; now make sure no symlink on the way leads out.
  let real: string;
  try {
    real = await realpath(await nearestExisting(resolved));
  } catch {
    throw outside; // e.g. a dangling symlink
  }
  const realRoot = await realpath(root);
  if (real !== realRoot && !isStrictlyInside(realRoot, real)) throw outside;

  return resolved;
}

/** True if `target` is below `root` (not `root` itself). */
function isStrictlyInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), target);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function nearestExisting(p: string): Promise<string> {
  let current = p;
  for (;;) {
    try {
      await lstat(current);
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return current;
      current = parent;
    }
  }
}

/** Turns common filesystem errors into messages the user can act on. */
export function fsErrorToHttp(err: unknown, relPath: string): HttpError {
  const shown = relPath.length > 200 ? `${relPath.slice(0, 200)}…` : relPath;
  switch ((err as NodeJS.ErrnoException).code) {
    case 'ENOENT':
      return new HttpError(404, `File not found: ${shown}`);
    case 'EISDIR':
      return new HttpError(400, `${shown} is a folder, not a file.`);
    case 'ENOTDIR':
    case 'EEXIST':
      return new HttpError(400, `Part of ${shown} is a file, not a folder.`);
    case 'ENAMETOOLONG':
      return new HttpError(400, 'That file name is too long.');
    default:
      throw err;
  }
}
