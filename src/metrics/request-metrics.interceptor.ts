import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { performance } from 'node:perf_hooks';
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = performance.now();
    this.metrics.onRequestStart();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = performance.now() - start;
        this.metrics.onRequestFinish(durationMs);
      }),
    );
  }
}
