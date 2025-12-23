import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envInt } from '../config/env';

type LatencySnapshot = {
  samples: number;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
};

@Injectable()
export class MetricsService {
  private totalRequests = 0;
  private inFlight = 0;
  private lastRequestAt: number | null = null;

  private latencySamples: number[] = [];
  private latencyWriteIndex = 0;
  private latencySizeLimit = 500;

  private readonly recentRequestTimestampsMs: number[] = [];

  constructor(private readonly config: ConfigService) {
    const samples = envInt(this.config, 'STATS_LATENCY_SAMPLES', 500);
    if (samples) this.configureLatencySamples(samples);
  }

  configureLatencySamples(sizeLimit: number) {
    if (Number.isFinite(sizeLimit) && sizeLimit > 0) {
      this.latencySizeLimit = Math.floor(sizeLimit);
      this.latencySamples = [];
      this.latencyWriteIndex = 0;
    }
  }

  onRequestStart(nowMs = Date.now()) {
    this.inFlight += 1;
    this.lastRequestAt = nowMs;
  }

  onRequestFinish(durationMs: number, nowMs = Date.now()) {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.totalRequests += 1;

    if (Number.isFinite(durationMs) && durationMs >= 0) {
      if (this.latencySamples.length < this.latencySizeLimit) {
        this.latencySamples.push(durationMs);
      } else {
        this.latencySamples[this.latencyWriteIndex] = durationMs;
        this.latencyWriteIndex =
          (this.latencyWriteIndex + 1) % this.latencySizeLimit;
      }
    }

    this.recentRequestTimestampsMs.push(nowMs);
    const cutoff = nowMs - 60_000;
    while (this.recentRequestTimestampsMs[0] !== undefined) {
      if (this.recentRequestTimestampsMs[0] >= cutoff) break;
      this.recentRequestTimestampsMs.shift();
    }
  }

  getSnapshot() {
    const now = Date.now();
    const cutoff = now - 60_000;
    const rps1m =
      this.recentRequestTimestampsMs.filter((t) => t >= cutoff).length / 60;

    return {
      now,
      totalRequests: this.totalRequests,
      inFlight: this.inFlight,
      lastRequestAt: this.lastRequestAt,
      rps1m,
      latency: this.getLatencySnapshot(),
    };
  }

  private getLatencySnapshot(): LatencySnapshot {
    if (this.latencySamples.length === 0) {
      return {
        samples: 0,
        avgMs: null,
        minMs: null,
        maxMs: null,
        p50Ms: null,
        p95Ms: null,
      };
    }

    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const v of this.latencySamples) {
      sum += v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const p = (q: number) => {
      const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(q)));
      return sorted[idx] ?? null;
    };

    return {
      samples: this.latencySamples.length,
      avgMs: sum / this.latencySamples.length,
      minMs: Number.isFinite(min) ? min : null,
      maxMs: Number.isFinite(max) ? max : null,
      p50Ms: p(0.5 * (sorted.length - 1)),
      p95Ms: p(0.95 * (sorted.length - 1)),
    };
  }
}
