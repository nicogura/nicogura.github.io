import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from './site-config.mjs';
import { validateData } from '../assets/data-validation.js';
export const root = fileURLToPath(new URL('../', import.meta.url));
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const config = await json('content/site.json');
const sections = await Promise.all(config.modules.map(json));
const data = { site: config.site, categories: sections.flatMap(s => s.categories), rules: sections.flatMap(s => s.rules), changelog: config.changelog, settings: config.settings, pages: {} };
for (const [key, route] of Object.entries(routes)) {
  const selection = config.pages[key] || {};
  const ruleIds = [...new Set([...(selection.ruleIds || []), ...data.rules.filter(r => (selection.categories || []).includes(r.category)).map(r => r.id)])];
  data.pages[key] = { kicker: `NICOGURA / ${key.toUpperCase()}`, title: route[1], description: route[2], ruleIds };
}
const errors = validateData(data);
for (const [key, page] of Object.entries(data.pages)) for (const id of page.ruleIds) if (!data.rules.some(r => r.id === id)) errors.push(`${key}: unknown rule ${id}`);
if (errors.length) throw new Error(errors.join('\n'));
await writeFile(resolve(root, 'data/rules.json'), JSON.stringify(data, null, 2) + '\n');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
function blockHTML(b) {
  if (b.type === 'list') return `<ul>${b.items.map(i => `<li>${escape(i)}</li>`).join('')}</ul>`;
  if (b.type === 'table') return `<table><caption>${escape(b.caption || '')}</caption><thead><tr>${b.headers.map(h => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row => `<tr>${row.map((cell,i) => `<td data-label="${escape(b.headers[i])}">${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<${b.type === 'heading' ? 'h3' : 'p'}>${escape(b.text)}</${b.type === 'heading' ? 'h3' : 'p'}>`;
}
for (const [key, [path, label, description]] of Object.entries(routes)) {
  const base = path ? '../' : './';
  const title = key === 'home' ? label : `${label} | NicoGura にこぐら`;
  const canonical = `https://nicogura.github.io/${path ? path + '/' : ''}`;
  const ids = data.pages[key].ruleIds;
  const fallback = ids.map(id => data.rules.find(r => r.id === id)).map(r => `<section><h2>${escape(r.title)}</h2>${r.content.map(blockHTML).join('')}</section>`).join('\n');
  const source = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="site-base" content="${base}">
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" content="#0e101b">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:site_name" content="NicoGura / にこぐら">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="https://nicogura.github.io/assets/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="NicoGuraの夜の街並みと白くま">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@NicoGura0810">
  <link rel="icon" href="${base}assets/favicon.png" type="image/png">
  <link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">
  ${key === 'home' ? `<link rel="preload" as="image" href="${base}assets/city.webp" fetchpriority="high">` : ''}
  <script src="${base}assets/theme-init.js"></script>
  <link rel="stylesheet" href="${base}assets/style.css">
  <script src="${base}assets/app.js" defer></script>
</head>
<body data-page="${key}">
  <a class="skip-link" href="#main-content">本文へスキップ</a>
  <header id="site-header" class="site-header"></header>
  <main id="main-content" tabindex="-1"><div id="page-content" class="shell"></div>
    <noscript><div class="noscript"><h1>${escape(label)}</h1><p>${escape(description)}</p><p>最終更新 ${data.site.updatedAt}</p><nav>${Object.entries(routes).filter(([k]) => k !== 'changelog').map(([,r]) => `<a href="${base}${r[0] ? r[0] + '/' : ''}">${escape(r[1])}</a>`).join(' / ')}</nav>${fallback}<p><a href="${data.site.links.discord}">公式Discord</a> / <a href="${data.site.links.x}">公式X</a></p><p>検索・保存機能にはJavaScriptを有効にしてください。</p></div></noscript>
  </main>
  <footer id="site-footer" class="site-footer"></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <button id="back-to-top" class="icon-button" type="button" aria-label="ページの先頭へ戻る" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
</body>
</html>
`;
  await mkdir(resolve(root, path), { recursive: true });
  await writeFile(resolve(root, path, 'index.html'), source.replace(/^ +$/gm, ''));
}
await writeFile(resolve(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.values(routes).map(([p]) => `  <url><loc>https://nicogura.github.io/${p ? p + '/' : ''}</loc><lastmod>${data.site.updatedAt}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated ${Object.keys(routes).length} pages / ${data.rules.length} entries.`);
