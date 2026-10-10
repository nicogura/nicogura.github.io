import { cp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './generate.mjs';
import { publicRoots, htmlPaths } from './site-config.mjs';
await import('./validate.mjs');
if (process.exitCode) process.exit(process.exitCode);
const output = resolve(root, '_site');
await mkdir(output, { recursive: true });
for (const path of publicRoots) await cp(resolve(root, path), resolve(output, path), { recursive: true });
// Refuse stale or unexpected build files rather than publishing them silently.
async function checkOutput(path = '') {
  for (const item of await readdir(resolve(output, path), { withFileTypes: true })) {
    const relative = path ? `${path}/${item.name}` : item.name;
    if (!publicRoots.some(p => relative === p || relative.startsWith(p + '/'))) throw new Error(`Unexpected build file: ${relative}`);
    if (item.isSymbolicLink()) throw new Error(`Symlink in build: ${relative}`);
    if (item.isDirectory()) await checkOutput(relative);
    else if (!(await stat(resolve(root, relative))).isFile()) throw new Error(`Stale build file: ${relative}`);
  }
}
await checkOutput();
const version = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(version)) throw new Error('Invalid build version');
for (const path of htmlPaths) {
  const file = resolve(output, path);
  await writeFile(file, (await readFile(file, 'utf8')).replace(/((?:\.\.\/|\.\/)?assets\/[^"'?\s]+\.(?:css|js))(["'])/g, `$1?v=${version}$2`));
}
for (const path of ['assets/app.js', 'assets/editor.js']) {
  const file = resolve(output, path);
  await writeFile(file, (await readFile(file, 'utf8')).replace(/(from\s+["'])(\.\/[^"']+\.js)(["'])/g, `$1$2?v=${version}$3`));
}
console.log(`Build PASS: _site (public files only), version ${version}`);
