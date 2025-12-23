import { of } from 'rxjs';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('RequestMetricsInterceptor', () => {
  it('records request start/finish', (done) => {
    const metrics = {
      onRequestStart: jest.fn(),
      onRequestFinish: jest.fn(),
    } as unknown as MetricsService;

    const interceptor = new RequestMetricsInterceptor(metrics);
    interceptor
      .intercept({} as any, { handle: () => of('ok') } as any)
      .subscribe({
        complete: () => {
          setImmediate(() => {
            expect(metrics.onRequestStart).toHaveBeenCalledTimes(1);
            expect(metrics.onRequestFinish).toHaveBeenCalledTimes(1);
            done();
          });
        },
        error: done,
      });
  });

  it('records finish on error', (done) => {
    const metrics = {
      onRequestStart: jest.fn(),
      onRequestFinish: jest.fn(),
    } as any;

    const interceptor = new RequestMetricsInterceptor(metrics);
    interceptor
      .intercept({} as any, {
        handle: () => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { throwError } = require('rxjs');
          return throwError(() => new Error('boom'));
        },
      } as any)
      .subscribe({
        next: () => done(new Error('Expected error')),
        error: () => {
          setImmediate(() => {
            expect(metrics.onRequestStart).toHaveBeenCalledTimes(1);
            expect(metrics.onRequestFinish).toHaveBeenCalledTimes(1);
            done();
          });
        },
      });
  });
});
