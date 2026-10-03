import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

// Local static preview matching the GitHub Pages repository subpath.
const root = resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') {
      response.writeHead(302, { Location: '/potracheno/' });
      response.end();
      return;
    }
    if (!pathname.startsWith('/potracheno/')) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = resolve(root, pathname.slice('/potracheno/'.length) || 'index.html');
    if (!file.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(4175, '127.0.0.1', () => console.log('PWA preview: http://127.0.0.1:4175/potracheno/'));
