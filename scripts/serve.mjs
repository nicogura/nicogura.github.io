import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.argv[2] || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ポートは1024〜65535を指定してください。');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const allowedFiles = new Set(['index.html', '404.html', 'robots.txt', 'sitemap.xml']);
const allowedFolders = new Set(['rules', 'changelog', 'editor', 'assets', 'data']);
const inRoot = (target) => target === root || target.startsWith(`${root}${sep}`);

createServer(async (request, response) => {
  const send = (status, text) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); response.end(text); };
  const notFound = async () => {
    try {
      const content = await readFile(resolve(root, '404.html'));
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { send(404, 'Not found'); }
  };
  if (!['GET', 'HEAD'].includes(request.method)) return send(405, 'Method not allowed');
  try {
    const originalPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const pathname = originalPath;
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some((part) => part === '..' || part.startsWith('.'))) return send(403, 'Forbidden');
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length && !allowedFolders.has(parts[0]) && !allowedFiles.has(parts[0])) return notFound();
    let target = resolve(root, ...parts);
    if (!inRoot(target)) return send(403, 'Forbidden');
    const info = await stat(target);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(301, { Location: `${originalPath}/${new URL(request.url, 'http://127.0.0.1').search}` });
        return response.end();
      }
      target = resolve(target, 'index.html');
    }
    const canonical = await realpath(target);
    if (!inRoot(canonical)) return send(403, 'Forbidden');
    const content = await readFile(canonical);
    response.writeHead(200, { 'Content-Type': types[extname(canonical).toLowerCase()] || 'application/octet-stream', 'Content-Length': content.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { await notFound(); }
}).listen(port, '127.0.0.1', () => console.log(`NicoGura local preview: http://127.0.0.1:${port}/`));
