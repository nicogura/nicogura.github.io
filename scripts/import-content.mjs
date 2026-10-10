import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from '../assets/data-validation.js';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.argv[2]) throw new Error('Usage: npm run import-content -- /path/to/exported-rules.json');
const candidate = JSON.parse((await readFile(resolve(process.argv[2]), 'utf8')).replace(/^\uFEFF/, ''));
const errors = validateData(candidate);
if (errors.length) throw new Error(errors.join('\n'));
const configPath = resolve(root, 'content/site.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const modules = await Promise.all(config.modules.map(async path => ({ path, value: JSON.parse(await readFile(resolve(root, path), 'utf8')) })));
const categoryOwner = new Map(modules.flatMap((m,i) => m.value.categories.map(c => [c.id, i])));
for (const m of modules) { m.value.categories = []; m.value.rules = []; }
for (const category of candidate.categories) modules[categoryOwner.get(category.id) ?? 0].value.categories.push(category);
for (const rule of candidate.rules) modules[categoryOwner.get(rule.category) ?? 0].value.rules.push(rule);
// Keep editorial page selections in one place; never silently lose published anchors.
const ids = new Set(candidate.rules.map(r => r.id));
for (const [key,p] of Object.entries(config.pages)) for (const id of p.ruleIds || []) if (!ids.has(id)) throw new Error(`${key} references deleted entry ${id}; update content/site.json first.`);
for (const key of ['site', 'settings', 'changelog']) config[key] = candidate[key];
for (const m of modules) await writeFile(resolve(root, m.path), JSON.stringify(m.value, null, 2) + '\n');
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Imported into content modules. Run npm run build and npm test, then review the diff.');
