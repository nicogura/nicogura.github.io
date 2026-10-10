import { readFile, readdir, stat, realpath } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from '../assets/data-validation.js';
import { publicRoots, htmlPaths } from './site-config.mjs';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [];
const required = [...htmlPaths, 'assets/style.css', 'assets/app.js', 'data/rules.json', 'robots.txt', 'sitemap.xml'];
const allowedExtensions = new Set(['.html', '.css', '.js', '.json', '.svg', '.png', '.webp', '.jpg', '.jpeg', '.ico', '.xml', '.txt', '.woff2']);
const textExtensions = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);
const secretPatterns = [
  [/gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}/, 'GitHub token'],
  [/AKIA[A-Z0-9]{16}/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/(?:api[_-]?key|password|client[_-]?secret|bot[_-]?token)["']?\s*[=:]\s*["'][A-Za-z0-9+\/_=-]{16,}["']/i, 'credential assignment'],
  [/\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/, 'private IP address'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, 'IP address'],
  [/[A-Z]:\\(?:Users|ゲーム|Program Files)\\/i, 'internal filesystem path']
];
for (const file of required) {
  try { if (!(await stat(resolve(root, file))).isFile()) throw new Error(); }
  catch { errors.push(`必要な公開ファイルがありません: ${file}`); }
}
let data;
try {
  data = JSON.parse(await readFile(resolve(root, 'data/rules.json'), 'utf8'));
  errors.push(...validateData(data));
  if (data?.site?.assets) for (const asset of Object.values(data.site.assets)) {
    if (typeof asset !== 'string' || !asset.startsWith('assets/')) continue;
    try { if (!(await stat(resolve(root, asset))).isFile()) throw new Error(); }
    catch { errors.push(`設定された画像がありません: ${asset}`); }
  }
} catch (error) { errors.push(`rules.jsonの読み込みに失敗: ${error.message}`); }
let count = 0;
async function inspect(path) {
  let info;
  try { info = await stat(path); } catch { return; }
  const canonical = await realpath(path);
  if (!canonical.startsWith(`${root}${sep}`)) { errors.push(`公開範囲外への参照: ${relative(root, path)}`); return; }
  if (info.isDirectory()) {
    for (const entry of await readdir(path)) {
      if (entry.startsWith('.')) { errors.push(`公開ディレクトリに隠しファイルがあります: ${relative(root, resolve(path, entry))}`); continue; }
      await inspect(resolve(path, entry));
    }
    return;
  }
  const name = relative(root, path).replaceAll('\\', '/');
  const extension = extname(path).toLowerCase();
  if (name !== '.nojekyll' && !allowedExtensions.has(extension)) errors.push(`公開範囲に許可されていない拡張子があります: ${name}`);
  if (info.size > 5 * 1024 * 1024) errors.push(`公開ファイルが5MBを超えています: ${name}`);
  count++;
  if (!textExtensions.has(extension)) return;
  const source = await readFile(path, 'utf8');
  for (const [pattern, label] of secretPatterns) if (pattern.test(source)) errors.push(`${name}: ${label} らしい文字列を検出しました`);
  if (/\b(?:server\.cfg|mysql_connection_string|sv_licenseKey|steam_webApiKey)\b/.test(source)) errors.push(`${name}: ゲームサーバー内部設定を検出しました`);
}
for (const entry of publicRoots) await inspect(resolve(root, entry));
if (errors.length) {
  console.error(`公開前チェック FAIL (${errors.length}件)`);
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const published = data.rules.filter((rule) => rule.status === 'published').length;
  console.log(`公開前チェック PASS · ${count}ファイル · 正式ルール${published}件 · 準備中${data.rules.length - published}件 · カテゴリー${data.categories.length}件`);
  console.log('JSON構造・ID/番号・参照・日付・リンク・画像・公開ファイル・認証情報の検査を完了しました。');
}
