// Minimal static file handler for the built client (production only). No dependency needed.
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

/**
 * Security headers for every file served. The app needs nothing from other origins:
 * fonts are bundled, the small ə/Ə font is inlined as data:, and the socket is same-origin
 * (plus CORS_ORIGIN's servers if the client is hosted separately).
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), autoplay=()',
};

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function staticHandler(rootDir: string) {
  const root = resolve(rootDir);
  const index = join(root, 'index.html');

  return (req: IncomingMessage, res: ServerResponse): void => {
    let urlPath: string;
    try {
      urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    } catch {
      res.writeHead(400, SECURITY_HEADERS).end(); // malformed %-encoding
      return;
    }
    let file = normalize(join(root, urlPath));
    if (!file.startsWith(root + sep) && file !== root) {
      res.writeHead(403, SECURITY_HEADERS).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = index; // SPA fallback
    if (!existsSync(file)) {
      res.writeHead(404, SECURITY_HEADERS).end('Not found');
      return;
    }
    const isAsset = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  };
}
