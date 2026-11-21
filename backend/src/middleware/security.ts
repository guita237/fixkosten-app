import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

/** Sicherheits-Header. Die API liefert nur JSON, daher die strenge Standard-CSP. */
export const securityHeaders = helmet();

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

/** Allgemeines Limit pro IP für die ganze API (Standard: 600 Anfragen / 15 min). */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envNumber('RATE_LIMIT_MAX', 600),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen' },
});

/** Strenger für Aktionen, die E-Mails verschicken oder viel Arbeit machen (Standard: 20 / Stunde). */
export const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: envNumber('RATE_LIMIT_HEAVY_MAX', 20),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen' },
});

/** Eine Zeile pro Anfrage: Zeit, Methode, Pfad (ohne Query), Status, Dauer, IP. */
export function requestLog(req: Request, res: Response, next: NextFunction): void {
  if (process.env.REQUEST_LOG === 'off' || req.path === '/api/health') {
    next();
    return;
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = {
      t: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms),
      ip: req.ip,
      user: req.user?.id,
    };
    if (res.statusCode >= 500) {
      console.error(JSON.stringify(line));
    } else {
      console.log(JSON.stringify(line));
    }
  });
  next();
}

/** Letzter Fehler-Handler: immer JSON, nie einen Stacktrace an den Client. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    let message = 'Ungültige Anfrage';
    if (status === 413) {
      message = 'Anfrage zu groß';
    }
    res.status(status).json({ error: message });
    return;
  }
  console.error(`Unerwarteter Fehler bei ${req.method} ${req.originalUrl.split('?')[0]}:`, err);
  res.status(500).json({ error: 'Interner Serverfehler' });
}
