import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { StatsService } from './stats.service';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { NotFoundException } from '@nestjs/common';

describe('StatsService', () => {
  it('renders HTML with basic sections', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
            STATS_CACHE_TTL_MS: '1',
            STATS_MAX_COLLECTIONS: '5',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    metrics.onRequestStart(1);
    metrics.onRequestFinish(5, 2);

    const mongo = {
      readyState: 1,
      name: 'chronos',
      db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) },
    } as any;

    const redis = { status: 'ready', ping: async () => 'PONG' } as any;

    const service = new StatsService(config, metrics, mongo, redis);
    const html = await service.renderHtml();

    expect(html).toContain('<title>Backend stats</title>');
    expect(html).toContain('MongoDB');
    expect(html).toContain('Redis');
    expect(html).toContain('Requests');
  });

  it('shows Jest coverage when summary file exists (dev only)', async () => {
    const dir = '.temp/jest';
    const path = `${dir}/coverage-summary.json`;
    await mkdir(dir, { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        total: {
          statements: { pct: 64.2 },
          branches: { pct: 53.1 },
          functions: { pct: 75.4 },
          lines: { pct: 66.2 },
        },
      }),
      'utf8',
    );

    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_SHOW_JEST_COVERAGE: 'true',
            STATS_JEST_COVERAGE_SUMMARY_PATH: path,
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 0, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('Jest coverage');
    expect(html).toContain('64.2%');

    await rm(dir, { recursive: true, force: true });
  });

  it('shows link to HTML coverage report when index.html exists', async () => {
    const dir = '.temp/lcov';
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, '<html/>', 'utf8');

    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_SERVE_JEST_COVERAGE_REPORT: 'true',
            STATS_JEST_COVERAGE_REPORT_DIR: dir,
            STATS_EMBED_JEST_COVERAGE_REPORT: 'false',
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 0, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('Coverage report (HTML)');
    expect(html).toContain('/_coverage/');

    await rm(dir, { recursive: true, force: true });
  });

  it('is disabled outside dev mode', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'production',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 0, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    expect(service.isEnabled()).toBe(false);
    expect(() => service.assertEnabled()).toThrow(NotFoundException);

    const html = await service.renderHtml();
    expect(html).toContain('Backend stats');
    expect(html).not.toContain('Jest coverage');
    expect(html).not.toContain('Coverage report (HTML)');
  });

  it('renders Mongo collections when enabled', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_ENABLE_COLLECTION_COUNTS: 'true',
            STATS_MAX_COLLECTIONS: '2',
            STATS_CACHE_TTL_MS: '60000',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);

    const listCollections = () => ({
      toArray: async () => [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    });
    const collection = (name: string) => ({
      estimatedDocumentCount: async () => (name === 'a' ? 10 : 20),
    });

    const mongo = {
      readyState: 1,
      name: 'chronos',
      db: {
        admin: () => ({ ping: async () => ({ ok: 1 }) }),
        listCollections,
        collection,
      },
    } as any;

    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('Mongo collections');
    expect(html).toContain('a');
    expect(html).toContain('b');
    expect(html).not.toContain('<td>c</td>');
    expect(html).toContain('Total estimated docs');
  });

  it('caches Mongo counts and tolerates Mongo/Redis failures', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_ENABLE_COLLECTION_COUNTS: 'true',
            STATS_MAX_COLLECTIONS: '10',
            STATS_CACHE_TTL_MS: '60000',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);

    let listCalls = 0;
    const db = {
      admin: () => ({ ping: async () => ({ ok: 1 }) }),
      listCollections: () => ({
        toArray: async () => {
          listCalls += 1;
          return [{ name: 'a' }];
        },
      }),
      collection: () => ({
        estimatedDocumentCount: async () => {
          throw new Error('count fail');
        },
      }),
    };

    const mongo = { readyState: 1, name: 'chronos', db } as any;
    const redis = { status: 'ready', ping: async () => { throw new Error('redis'); } } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html1 = await service.renderHtml();
    const html2 = await service.renderHtml();
    expect(listCalls).toBe(1);
    expect(html1).toContain('MongoDB');
    expect(html2).toContain('MongoDB');
  });

  it('renders various connection states and missing coverage files', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'dev',
            STATS_SHOW_JEST_COVERAGE: 'true',
            STATS_JEST_COVERAGE_SUMMARY_PATH: '.temp/does-not-exist.json',
            STATS_SERVE_JEST_COVERAGE_REPORT: 'true',
            STATS_JEST_COVERAGE_REPORT_DIR: '.temp/nope',
            STATS_EMBED_JEST_COVERAGE_REPORT: 'false',
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 9, name: '', db: null } as any;
    const redis = { status: 'connecting', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('connecting');
    expect(html).toContain('unknown(9)');
    expect(html).toContain('Not found.');
  });

  it('renders Mongo ping as unavailable when ping fails', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
            STATS_SHOW_JEST_COVERAGE: 'false',
            STATS_SERVE_JEST_COVERAGE_REPORT: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = {
      readyState: 1,
      name: 'chronos',
      db: {
        admin: () => ({
          ping: async () => {
            throw new Error('ping fail');
          },
        }),
      },
    } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('<h2>MongoDB</h2>');
    expect(html).toContain('<th class="k">Ping</th><td class="v">—</td>');
  });

  it('hides Jest coverage when summary is missing fields', async () => {
    const dir = '.temp/jest-invalid';
    const path = `${dir}/coverage-summary.json`;
    await mkdir(dir, { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        total: {
          statements: { pct: 64.2 },
        },
      }),
      'utf8',
    );

    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_SHOW_JEST_COVERAGE: 'true',
            STATS_JEST_COVERAGE_SUMMARY_PATH: path,
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 0, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).not.toContain('Jest coverage');
    await rm(dir, { recursive: true, force: true });
  });

  it('embeds HTML coverage report when enabled', async () => {
    const dir = '.temp/lcov-embed';
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, '<html/>', 'utf8');

    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_SERVE_JEST_COVERAGE_REPORT: 'true',
            STATS_JEST_COVERAGE_REPORT_DIR: dir,
            STATS_EMBED_JEST_COVERAGE_REPORT: 'true',
            STATS_ENABLE_COLLECTION_COUNTS: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 0, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('<iframe src="/_coverage/"');

    await rm(dir, { recursive: true, force: true });
  });

  it('supports NODE_ENV aliases and assertEnabled happy path', () => {
    const localConfig = {
      get: (k: string) => ({ NODE_ENV: 'local' } as Record<string, string>)[k],
    } as unknown as ConfigService;
    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 0, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const local = new StatsService(localConfig, metrics, mongo, redis);

    expect(local.isEnabled()).toBe(true);
    expect(() => local.assertEnabled()).not.toThrow();

    const missingConfig = {
      get: () => undefined,
    } as unknown as ConfigService;
    const missing = new StatsService(missingConfig, metrics, mongo, redis);
    expect(missing.isEnabled()).toBe(false);
  });

  it('renders more Mongo/Redis state variants and handles missing db', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_ENABLE_COLLECTION_COUNTS: 'true',
            STATS_SHOW_JEST_COVERAGE: 'false',
            STATS_SERVE_JEST_COVERAGE_REPORT: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 2, name: 'chronos', db: null } as any;
    const redis = { status: undefined, ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html1 = await service.renderHtml();
    expect(html1).toContain('connecting');
    expect(html1).toContain('<th class="k">Status</th><td class="v">unknown</td>');

    (mongo as any).readyState = 3;
    const html2 = await service.renderHtml();
    expect(html2).toContain('disconnecting');
  });

  it('treats mongo as unavailable when connected but db is missing', async () => {
    const config = {
      get: (k: string) =>
        (
          ({
            NODE_ENV: 'development',
            STATS_ENABLE_COLLECTION_COUNTS: 'true',
            STATS_SHOW_JEST_COVERAGE: 'false',
            STATS_SERVE_JEST_COVERAGE_REPORT: 'false',
          }) as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const metrics = new MetricsService({ get: () => undefined } as any);
    const mongo = { readyState: 1, name: 'chronos', db: null } as any;
    const redis = { status: 'ready', ping: async () => 'PONG' } as any;
    const service = new StatsService(config, metrics, mongo, redis);

    const html = await service.renderHtml();
    expect(html).toContain('<th class="k">Ping</th><td class="v">—</td>');
    expect(html).toContain('Disabled or not available.');
  });
});
