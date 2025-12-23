import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { RequestLoggingService } from './request-logging.service';

function createHttpContext({
  req,
  res,
}: {
  req: any;
  res: any;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('RequestLoggingInterceptor', () => {
  it('logs successful request metadata', (done) => {
    const config = {
      get: (k: string) =>
        ({ REQUEST_LOGGING_ENABLED: 'true', REQUEST_LOGGING_INCLUDE_QUERY: 'true' })[
          k
        ],
    } as unknown as ConfigService;

    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any as RequestLoggingService;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const ctx = createHttpContext({
      req: {
        method: 'GET',
        originalUrl: '/hello',
        query: { a: '1' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest', referer: 'https://example.com', 'x-request-id': 'r1' },
        user: { id: 123 },
      },
      res: { statusCode: 200 },
    });

    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe({
      next: () => undefined,
      error: done,
      complete: () => {
        setImmediate(() => {
          expect(logging.log).toHaveBeenCalledTimes(1);
          const arg = (logging.log as jest.Mock).mock.calls[0]?.[0];
          expect(arg).toEqual(
            expect.objectContaining({
              method: 'GET',
              path: '/hello',
              statusCode: 200,
              ip: '127.0.0.1',
              userAgent: 'jest',
              referer: 'https://example.com',
              requestId: 'r1',
              userId: '123',
              query: { a: '1' },
              errorName: null,
              errorMessage: null,
            }),
          );
          expect(typeof arg.durationMs).toBe('number');
          done();
        });
      },
    });
  });

  it('logs errors and rethrows', (done) => {
    const config = { get: (k: string) => ({ REQUEST_LOGGING_ENABLED: 'true' } as any)[k] } as any;
    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const ctx = createHttpContext({
      req: { method: 'POST', originalUrl: '/fail', headers: {} },
      res: { statusCode: 500 },
    });

    interceptor
      .intercept(ctx, { handle: () => throwError(() => new Error('boom')) } as any)
      .subscribe({
        next: () => done(new Error('Expected error')),
        error: (err) => {
          setImmediate(() => {
            expect(err).toBeInstanceOf(Error);
            expect(logging.log).toHaveBeenCalledTimes(1);
            const arg = (logging.log as jest.Mock).mock.calls[0]?.[0];
            expect(arg).toEqual(
              expect.objectContaining({
                method: 'POST',
                path: '/fail',
                statusCode: 500,
                errorName: 'Error',
                errorMessage: 'boom',
              }),
            );
            done();
          });
        },
      });
  });

  it('skips logging when disabled', (done) => {
    const config = { get: (k: string) => ({ REQUEST_LOGGING_ENABLED: 'false' } as any)[k] } as any;
    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const ctx = createHttpContext({
      req: { method: 'GET', originalUrl: '/', headers: {} },
      res: { statusCode: 200 },
    });

    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe({
      next: () => undefined,
      error: done,
      complete: () => {
        expect(logging.log).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('handles fallbacks and header variants', (done) => {
    const config = {
      get: (k: string) =>
        ({
          REQUEST_LOGGING_ENABLED: 'true',
          REQUEST_LOGGING_INCLUDE_QUERY: 'false',
        })[k],
    } as any;

    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const big = 'x'.repeat(5000);

    const ctx = createHttpContext({
      req: {
        method: 123,
        url: '/fallback',
        query: ['a', 'b'],
        ip: '10.0.0.1',
        headers: {
          'user-agent': big,
          referrer: 'https://ref.example',
          'x-correlation-id': 'c1',
        },
        user: { whatever: true },
      },
      res: { statusCode: 201 },
    });

    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe({
      complete: () => {
        setImmediate(() => {
          const arg = (logging.log as jest.Mock).mock.calls[0]?.[0];
          expect(arg).toEqual(
            expect.objectContaining({
              method: 'UNKNOWN',
              path: '/fallback',
              statusCode: 201,
              requestId: 'c1',
              referer: 'https://ref.example',
              userId: null,
              query: null,
            }),
          );
          expect(String(arg.userAgent).length).toBeLessThanOrEqual(2000);
          done();
        });
      },
      error: done,
    });
  });

  it('logs defaults for invalid request/response values', (done) => {
    const config = {
      get: (k: string) =>
        ({ REQUEST_LOGGING_ENABLED: 'true', REQUEST_LOGGING_INCLUDE_QUERY: 'true' })[
          k
        ],
    } as unknown as ConfigService;

    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any as RequestLoggingService;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const ctx = createHttpContext({
      req: {
        method: '   ',
        url: '   ',
        query: ['a'],
        ip: '',
        headers: { 'user-agent': '  ', referer: 123 },
        user: { _id: 'u1' },
      },
      res: { statusCode: '200' },
    });

    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(logging.log).toHaveBeenCalledTimes(1);
          const arg = (logging.log as jest.Mock).mock.calls[0]?.[0];
          expect(arg).toEqual(
            expect.objectContaining({
              method: 'UNKNOWN',
              path: '/',
              statusCode: 500,
              ip: null,
              userAgent: null,
              referer: null,
              requestId: null,
              userId: 'u1',
              query: { _values: ['a'] },
            }),
          );
          done();
        });
      },
      error: done,
    });
  });

  it('sets query to null when it is not an object', (done) => {
    const config = {
      get: (k: string) =>
        ({ REQUEST_LOGGING_ENABLED: 'true', REQUEST_LOGGING_INCLUDE_QUERY: 'true' })[
          k
        ],
    } as unknown as ConfigService;

    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const ctx = createHttpContext({
      req: { method: 'GET', originalUrl: '/q', query: 'a', headers: {} },
      res: { statusCode: 200 },
    });

    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe({
      complete: () => {
        setImmediate(() => {
          const arg = (logging.log as jest.Mock).mock.calls[0]?.[0];
          expect(arg.query).toBeNull();
          done();
        });
      },
      error: done,
    });
  });

  it('handles thrown non-Error objects', (done) => {
    const config = {
      get: (k: string) =>
        ({
          REQUEST_LOGGING_ENABLED: 'true',
          REQUEST_LOGGING_INCLUDE_QUERY: 'false',
        })[k],
    } as unknown as ConfigService;

    const logging = { log: jest.fn().mockResolvedValue(undefined) } as any;
    const interceptor = new RequestLoggingInterceptor(config, logging);

    const ctx = createHttpContext({
      req: { headers: {} },
      res: { statusCode: Number.POSITIVE_INFINITY },
    });

    interceptor
      .intercept(ctx, {
        handle: () => throwError(() => ({ name: 123, message: '  ' })),
      } as any)
      .subscribe({
        next: () => done(new Error('Expected error')),
        error: (err) => {
          setImmediate(() => {
            expect(err).toEqual(expect.anything());
            const arg = (logging.log as jest.Mock).mock.calls[0]?.[0];
            expect(arg).toEqual(
              expect.objectContaining({
                statusCode: 500,
                errorName: 'Error',
                errorMessage: null,
              }),
            );
            done();
          });
        },
      });
  });
});
