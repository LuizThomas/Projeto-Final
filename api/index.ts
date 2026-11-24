import type { IncomingMessage, ServerResponse } from 'http';
import { createServerlessApiApp } from '../src/server/apiApp.js';

const app = createServerlessApiApp();

/**
 * Normalizes Vercel rewrite URLs so Express always receives the original /api/* route
 * regardless of whether Vercel preserves the incoming URL or rewrites to /api/index?__path=...
 */
function normalizeVercelApiUrl(rawUrl: string | undefined): string {
  const urlStr = rawUrl || '/api';
  try {
    const parsed = new URL(urlStr, 'http://localhost');
    const rewritePath = parsed.searchParams.get('__path');

    if (rewritePath !== null) {
      parsed.searchParams.delete('__path');
      const cleanSubpath = rewritePath.replace(/^\/+/, '');
      const isRewrittenDestination =
        parsed.pathname === '/api/index' ||
        parsed.pathname === '/api/index.ts' ||
        parsed.pathname === '/' ||
        parsed.pathname === '/api' ||
        parsed.pathname === '/api/';

      const targetPath = isRewrittenDestination
        ? cleanSubpath
          ? `/api/${cleanSubpath}`
          : '/api'
        : parsed.pathname;

      const qs = parsed.searchParams.toString();
      return qs ? `${targetPath}?${qs}` : targetPath;
    }

    if (parsed.pathname === '/api/index' || parsed.pathname === '/api/index.ts') {
      const qs = parsed.searchParams.toString();
      return qs ? `/api?${qs}` : '/api';
    }

    return urlStr;
  } catch {
    return urlStr;
  }
}

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    req.url = normalizeVercelApiUrl(req.url);
    return (app as any)(req, res);
  } catch (err: any) {
    console.error('[VERCEL HANDLER ERROR]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          errorCode: 'SERVERLESS_HANDLER_ERROR',
          message: 'Falha interna ao inicializar o serviço da API.',
        })
      );
    }
  }
}
