import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import { performance } from 'node:perf_hooks';
import { envBool } from '../config/env';
import { RequestLoggingService } from './request-logging.service';

type HttpRequestLike = {
  method?: unknown;
  originalUrl?: unknown;
  url?: unknown;
  query?: unknown;
  ip?: unknown;
  headers?: Record<string, unknown>;
  user?: unknown;
};

type HttpResponseLike = {
  statusCode?: unknown;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly config: ConfigService,
    private readonly logging: RequestLoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!envBool(this.config, 'REQUEST_LOGGING_ENABLED', true)) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<HttpRequestLike>();
    const res = http.getResponse<HttpResponseLike>();

    const startedAt = new Date();
    const start = performance.now();

    let errorName: string | null = null;
    let errorMessage: string | null = null;

    return next.handle().pipe(
      catchError((err) => {
        errorName = safeString((err as any)?.name) ?? 'Error';
        errorMessage = safeString((err as any)?.message) ?? null;
        return throwError(() => err);
      }),
      finalize(() => {
        const durationMs = performance.now() - start;
        const statusCode = safeInt((res as any)?.statusCode) ?? 500;

        const method = safeString((req as any)?.method) ?? 'UNKNOWN';
        const path =
          safeString((req as any)?.originalUrl) ??
          safeString((req as any)?.url) ??
          '/';

        const ip = safeString((req as any)?.ip) ?? null;
        const userAgent = safeString((req as any)?.headers?.['user-agent']) ?? null;
        const referer =
          safeString((req as any)?.headers?.['referer']) ??
          safeString((req as any)?.headers?.['referrer']) ??
          null;

        const requestId =
          safeString((req as any)?.headers?.['x-request-id']) ??
          safeString((req as any)?.headers?.['x-correlation-id']) ??
          null;

        const userId = extractUserId((req as any)?.user);

        const query = envBool(this.config, 'REQUEST_LOGGING_INCLUDE_QUERY', true)
          ? safeObject((req as any)?.query)
          : null;

        void this.logging.log({
          createdAt: startedAt,
          method,
          path,
          query,
          statusCode,
          durationMs,
          ip,
          userAgent,
          referer,
          requestId,
          userId,
          errorName,
          errorMessage,
        });
      }),
    );
  }
}

function safeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  return v.length > 2000 ? v.slice(0, 2000) : v;
}

function safeInt(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function safeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return { _values: value as unknown[] };
  return value as Record<string, unknown>;
}

function extractUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null;
  const candidate =
    (user as any).id ??
    (user as any)._id ??
    (user as any).userId ??
    (user as any).sub;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate === 'number') return String(candidate);
  return null;
}
