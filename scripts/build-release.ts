// Builds the publishable package into release/:
//
//   release/
//   ├── package.json        name, bin, runtime dependencies
//   ├── dist/cli.js         the server, bundled (npm dependencies stay external)
//   ├── ui/                 the built web app
//   ├── assets/             the Vitest config used for challenge runs
//   ├── challenges/         every challenge
//   ├── README.md, LICENSE
//
//   npm run build:release
//   npm pack ./release      # then try it: npx ./bughunt-<version>.tgz
//
// packages/server/src/config.ts knows this layout (see appPaths()).

import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import { APP_NAME } from '../packages/server/src/config.js';
import { IGNORED_FILES } from '../packages/server/src/services/files.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'release');
const SERVER = path.join(ROOT, 'packages/server');

interface PackageJson {
  version: string;
  dependencies: Record<string, string>;
}

const serverPkg = JSON.parse(
  await readFile(path.join(SERVER, 'package.json'), 'utf8'),
) as PackageJson;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

console.log('Building the web UI…');
await viteBuild({
  root: path.join(ROOT, 'packages/web'),
  logLevel: 'warn',
  build: { outDir: path.join(OUT, 'ui'), emptyOutDir: true },
});

console.log('Bundling the server…');
const cli = path.join(OUT, 'dist/cli.js');
await esbuild({
  entryPoints: [path.join(SERVER, 'src/index.ts')],
  outfile: cli,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // express, open and vitest are installed as dependencies of the published package.
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
});
await chmod(cli, 0o755);

console.log('Copying challenges and assets…');
const skipJunk = (src: string) => !IGNORED_FILES.has(path.basename(src));
await cp(path.join(ROOT, 'challenges'), path.join(OUT, 'challenges'), {
  recursive: true,
  filter: skipJunk,
});
await cp(path.join(SERVER, 'assets'), path.join(OUT, 'assets'), { recursive: true });
await cp(path.join(ROOT, 'README.md'), path.join(OUT, 'README.md'));
await cp(path.join(ROOT, 'LICENSE'), path.join(OUT, 'LICENSE'));

const releasePkg = {
  name: APP_NAME,
  version: serverPkg.version,
  description:
    'Practice the skills interviews test in the AI era: debug code you did not write and add features without breaking it. Runs locally in your browser.',
  keywords: ['interview', 'practice', 'debugging', 'javascript', 'coding-challenges'],
  license: 'MIT',
  type: 'module',
  bin: { [APP_NAME]: 'dist/cli.js' },
  files: ['dist', 'ui', 'assets', 'challenges'],
  engines: { node: '>=22.12.0' },
  dependencies: serverPkg.dependencies,
};
await writeFile(path.join(OUT, 'package.json'), JSON.stringify(releasePkg, null, 2) + '\n');

console.log(`Done: release/ (${APP_NAME}@${serverPkg.version})`);
