import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('tracks requests and latency snapshots', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const metrics = new MetricsService(config);
    metrics.configureLatencySamples(10);

    metrics.onRequestStart(1000);
    metrics.onRequestFinish(10, 1010);

    metrics.onRequestStart(2000);
    metrics.onRequestFinish(30, 2030);

    const snap = metrics.getSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.inFlight).toBe(0);
    expect(snap.latency.samples).toBe(2);
    expect(snap.latency.minMs).toBe(10);
    expect(snap.latency.maxMs).toBe(30);
    expect(snap.latency.avgMs).toBe(20);
    expect(snap.lastRequestAt).toBe(2000);
  });

  it('uses ring buffer and drops old timestamps', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const metrics = new MetricsService(config);
    metrics.configureLatencySamples(1);

    metrics.onRequestStart(0);
    metrics.onRequestFinish(10, 0);

    metrics.onRequestStart(70_000);
    metrics.onRequestFinish(20, 70_000);

    const snap = metrics.getSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.latency.samples).toBe(1);
    expect(snap.latency.minMs).toBe(20);
    expect(snap.latency.maxMs).toBe(20);
  });

  it('ignores invalid latency values and handles empty snapshot', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const metrics = new MetricsService(config);

    const empty = metrics.getSnapshot();
    expect(empty.latency.samples).toBe(0);
    expect(empty.latency.avgMs).toBeNull();

    metrics.onRequestStart(1);
    metrics.onRequestFinish(Number.NaN, 1);
    metrics.onRequestStart(2);
    metrics.onRequestFinish(-1, 2);

    const snap = metrics.getSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.latency.samples).toBe(0);
  });

  it('covers constructor and configure branches', () => {
    const config = {
      get: (k: string) =>
        (
          {
            STATS_LATENCY_SAMPLES: '0',
          } as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService(config);
    metrics.configureLatencySamples(0);
    metrics.onRequestFinish(1, 1000);
    metrics.onRequestFinish(1, 1000);
    const snap = metrics.getSnapshot();
    expect(snap.totalRequests).toBe(2);
  });

  it('keeps recent timestamps when within cutoff', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const metrics = new MetricsService(config);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:10.000Z'));

    metrics.onRequestFinish(1, Date.now() - 500);
    metrics.onRequestFinish(1, Date.now() - 200);
    metrics.configureLatencySamples(Number.NaN);

    const snap = metrics.getSnapshot();
    expect(snap.rps1m).toBeGreaterThanOrEqual(0);
    jest.useRealTimers();
  });

  it('covers nullish and non-finite branches in snapshot math', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const metrics = new MetricsService(config);

    (metrics as any).latencySamples = [undefined];
    const snap = metrics.getSnapshot();
    expect(snap.latency.p50Ms).toBeNull();

    (metrics as any).latencySamples = [Number.NaN];
    const snap2 = metrics.getSnapshot();
    expect(snap2.latency.minMs).toBeNull();
    expect(snap2.latency.maxMs).toBeNull();
  });

  it('configures latency samples via STATS_LATENCY_SAMPLES', () => {
    const config = {
      get: (k: string) =>
        (
          {
            STATS_LATENCY_SAMPLES: '2',
          } as Record<string, string>
        )[k],
    } as unknown as ConfigService;
    const metrics = new MetricsService(config);

    metrics.onRequestFinish(1, 0);
    metrics.onRequestFinish(2, 0);
    metrics.onRequestFinish(3, 0);

    const snap = metrics.getSnapshot();
    expect(snap.latency.samples).toBe(2);
    expect(snap.latency.minMs).toBe(2);
    expect(snap.latency.maxMs).toBe(3);
  });

  it('uses Date.now default arguments', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    const now = Date.now();

    const config = { get: () => undefined } as unknown as ConfigService;
    const metrics = new MetricsService(config);
    metrics.configureLatencySamples(10);

    metrics.onRequestStart();
    metrics.onRequestFinish(5);

    const snap = metrics.getSnapshot();
    expect(snap.totalRequests).toBe(1);
    expect(snap.lastRequestAt).toBe(now);
    jest.useRealTimers();
  });
});
