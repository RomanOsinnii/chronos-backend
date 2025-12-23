import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type Redis from 'ioredis';
import { performance } from 'node:perf_hooks';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { envBool, envInt } from '../config/env';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../infra/redis/redis.constants';

type Cached<T> = { atMs: number; value: T };

@Injectable()
export class StatsService {
  private mongoCountsCache: Cached<{
    collections: { name: string; estimatedDocs: number | null }[];
    totalEstimatedDocs: number | null;
  }> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  isEnabled(): boolean {
    const nodeEnv = String(this.config.get('NODE_ENV') ?? '').toLowerCase();
    return nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === 'local';
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new NotFoundException();
    }
  }

  async renderHtml(): Promise<string> {
    const startedAtMs = Date.now() - Math.round(process.uptime() * 1000);
    const metrics = this.metrics.getSnapshot();

    const mongoState = this.describeMongoState();
    const mongoPingMs = await this.tryMongoPingMs();
    const mongoCounts = await this.tryMongoCounts();

    const redisState = this.describeRedisState();
    const redisPingMs = await this.tryRedisPingMs();

    const coverage = await this.tryReadJestCoverageSummary();
    const coverageReport = await this.tryDetectCoverageReport();

    const connectedDbs = [mongoState.connected, redisState.connected].filter(
      Boolean,
    ).length;

    const fmt = {
      ms: (v: number | null) => (v === null ? '—' : `${v.toFixed(1)} ms`),
      int: (v: number | null) => (v === null ? '—' : `${v}`),
      dt: (ms: number | null) =>
        ms === null ? '—' : new Date(ms).toISOString(),
      num: (v: number) => new Intl.NumberFormat('en-US').format(v),
    };

    const rows = (items: { k: string; v: string }[]) =>
      items
        .map(
          ({ k, v }) =>
            `<tr><th class="k">${escapeHtml(k)}</th><td class="v">${escapeHtml(v)}</td></tr>`,
        )
        .join('');

    const mongoCollectionsHtml = mongoCounts?.collections.length
      ? `<table class="table">
            <thead><tr><th>Collection</th><th>Estimated docs</th></tr></thead>
            <tbody>
              ${mongoCounts.collections
                .map(
                  (c) =>
                    `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(
                      c.estimatedDocs === null ? '—' : fmt.num(c.estimatedDocs),
                    )}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>`
      : '<div class="muted">Disabled or not available.</div>';

    const coverageHtml = coverage
      ? `<div class="card" style="grid-column: 1 / -1;">
          <h2>Jest coverage</h2>
          <table class="table">
            <tbody>
              ${rows([
                { k: 'Statements', v: `${coverage.statements}%` },
                { k: 'Branches', v: `${coverage.branches}%` },
                { k: 'Functions', v: `${coverage.functions}%` },
                { k: 'Lines', v: `${coverage.lines}%` },
              ])}
            </tbody>
          </table>
          <div class="muted">source: <code>${escapeHtml(coverage.source)}</code></div>
        </div>`
      : '';

    const coverageReportHtml = coverageReport
      ? `<div class="card" style="grid-column: 1 / -1;">
          <h2>Coverage report (HTML)</h2>
          ${
            coverageReport.available
              ? `<div><a href="${escapeHtml(coverageReport.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                  coverageReport.url,
                )}</a></div>`
              : `<div class="muted">Not found. Run <code>npm run test:cov</code> to generate <code>${escapeHtml(
                  coverageReport.dir,
                )}</code>.</div>`
          }
          ${
            coverageReport.available && coverageReport.embed
              ? `<iframe src="${escapeHtml(
                  coverageReport.url,
                )}" style="width:100%;height:820px;margin-top:10px;border:1px solid rgba(127,127,127,.3);border-radius:10px;"></iframe>`
              : ''
          }
        </div>`
      : '';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Backend stats</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; line-height: 1.4; }
      h1 { margin: 0 0 4px 0; font-size: 20px; }
      .muted { opacity: .75; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 16px; }
      .card { border: 1px solid rgba(127,127,127,.3); border-radius: 12px; padding: 14px 14px 10px; }
      .card h2 { margin: 0 0 10px 0; font-size: 14px; letter-spacing: .02em; text-transform: uppercase; opacity: .8; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid rgba(127,127,127,.2); vertical-align: top; }
      .table th.k { width: 45%; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    </style>
  </head>
  <body>
    <h1>Backend stats</h1>
    <div class="muted">
      now: <code>${escapeHtml(new Date(metrics.now).toISOString())}</code> •
      started: <code>${escapeHtml(new Date(startedAtMs).toISOString())}</code> •
      connected DBs: <code>${connectedDbs}</code>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Requests</h2>
        <table class="table">
          <tbody>
            ${rows([
              { k: 'Total', v: fmt.num(metrics.totalRequests) },
              { k: 'In-flight', v: fmt.num(metrics.inFlight) },
              { k: 'RPS (last 1m)', v: metrics.rps1m.toFixed(2) },
              { k: 'Last request at', v: fmt.dt(metrics.lastRequestAt) },
              { k: 'Avg latency', v: fmt.ms(metrics.latency.avgMs) },
              { k: 'P50 latency', v: fmt.ms(metrics.latency.p50Ms) },
              { k: 'P95 latency', v: fmt.ms(metrics.latency.p95Ms) },
              { k: 'Min latency', v: fmt.ms(metrics.latency.minMs) },
              { k: 'Max latency', v: fmt.ms(metrics.latency.maxMs) },
              { k: 'Latency samples', v: fmt.num(metrics.latency.samples) },
            ])}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>MongoDB</h2>
        <table class="table">
          <tbody>
            ${rows([
              { k: 'Connected', v: mongoState.connected ? 'yes' : 'no' },
              { k: 'State', v: mongoState.state },
              { k: 'DB name', v: mongoState.dbName ?? '—' },
              { k: 'Ping', v: fmt.ms(mongoPingMs) },
              {
                k: 'Total estimated docs',
                v: fmt.int(mongoCounts?.totalEstimatedDocs ?? null),
              },
            ])}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Redis</h2>
        <table class="table">
          <tbody>
            ${rows([
              { k: 'Connected', v: redisState.connected ? 'yes' : 'no' },
              { k: 'Status', v: redisState.status },
              { k: 'Ping', v: fmt.ms(redisPingMs) },
            ])}
          </tbody>
        </table>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>Mongo collections</h2>
        ${mongoCollectionsHtml}
      </div>
      ${coverageHtml}
      ${coverageReportHtml}
    </div>
  </body>
</html>`;
  }

  private describeMongoState(): {
    connected: boolean;
    state: string;
    dbName: string | null;
  } {
    const readyState = this.mongo.readyState;
    const state =
      readyState === 0
        ? 'disconnected'
        : readyState === 1
          ? 'connected'
          : readyState === 2
            ? 'connecting'
            : readyState === 3
              ? 'disconnecting'
              : `unknown(${readyState})`;

    return {
      connected: readyState === 1,
      state,
      dbName: this.mongo.name || null,
    };
  }

  private describeRedisState(): { connected: boolean; status: string } {
    const status = this.redis.status ?? 'unknown';
    return { connected: status === 'ready', status };
  }

  private async tryMongoPingMs(): Promise<number | null> {
    if (this.mongo.readyState !== 1) return null;
    const db = this.mongo.db;
    if (!db) return null;

    const start = performance.now();
    try {
      await db.admin().ping();
      return performance.now() - start;
    } catch {
      return null;
    }
  }

  private async tryRedisPingMs(): Promise<number | null> {
    const start = performance.now();
    try {
      await this.redis.ping();
      return performance.now() - start;
    } catch {
      return null;
    }
  }

  private async tryMongoCounts(): Promise<{
    collections: { name: string; estimatedDocs: number | null }[];
    totalEstimatedDocs: number | null;
  } | null> {
    const enabled = envBool(
      this.config,
      'STATS_ENABLE_COLLECTION_COUNTS',
      true,
    );
    if (!enabled) return null;

    if (this.mongo.readyState !== 1) return null;
    const db = this.mongo.db;
    if (!db) return null;

    const ttlMs = envInt(this.config, 'STATS_CACHE_TTL_MS', 10_000) ?? 10_000;
    const now = Date.now();
    if (this.mongoCountsCache && now - this.mongoCountsCache.atMs < ttlMs) {
      return this.mongoCountsCache.value;
    }

    const maxCollections =
      envInt(this.config, 'STATS_MAX_COLLECTIONS', 25) ?? 25;

    const list = await db.listCollections({}, { nameOnly: true }).toArray();

    const collections = await Promise.all(
      list.slice(0, maxCollections).map(async ({ name }) => {
        try {
          const estimatedDocs = await db
            .collection(name)
            .estimatedDocumentCount();
          return { name, estimatedDocs };
        } catch {
          return { name, estimatedDocs: null };
        }
      }),
    );

    const totalEstimatedDocs = collections.reduce<number | null>((acc, c) => {
      if (c.estimatedDocs === null) return acc;
      return (acc ?? 0) + c.estimatedDocs;
    }, 0);

    const value = { collections, totalEstimatedDocs };
    this.mongoCountsCache = { atMs: now, value };
    return value;
  }

  private async tryReadJestCoverageSummary(): Promise<{
    source: string;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  } | null> {
    if (!this.isEnabled()) return null;
    const enabled = envBool(this.config, 'STATS_SHOW_JEST_COVERAGE', true);
    if (!enabled) return null;

    const path = String(
      this.config.get('STATS_JEST_COVERAGE_SUMMARY_PATH') ??
        'coverage/coverage-summary.json',
    );

    try {
      const raw = await readFile(path, 'utf8');
      const json = JSON.parse(raw) as any;
      const total = json?.total;
      const pct = (v: any) =>
        typeof v?.pct === 'number' && Number.isFinite(v.pct) ? v.pct : null;

      const statements = pct(total?.statements);
      const branches = pct(total?.branches);
      const functions = pct(total?.functions);
      const lines = pct(total?.lines);
      if (
        statements === null ||
        branches === null ||
        functions === null ||
        lines === null
      ) {
        return null;
      }

      return { source: path, statements, branches, functions, lines };
    } catch {
      return null;
    }
  }

  private async tryDetectCoverageReport(): Promise<{
    url: string;
    dir: string;
    available: boolean;
    embed: boolean;
  } | null> {
    if (!this.isEnabled()) return null;

    const enabled = envBool(
      this.config,
      'STATS_SERVE_JEST_COVERAGE_REPORT',
      true,
    );
    if (!enabled) return null;

    const dir = resolve(
      process.cwd(),
      String(this.config.get('STATS_JEST_COVERAGE_REPORT_DIR') ?? 'coverage/lcov-report'),
    );

    const embed = envBool(this.config, 'STATS_EMBED_JEST_COVERAGE_REPORT', false);
    try {
      await access(resolve(dir, 'index.html'));
      return { url: '/_coverage/', dir, available: true, embed };
    } catch {
      return { url: '/_coverage/', dir, available: false, embed };
    }
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
