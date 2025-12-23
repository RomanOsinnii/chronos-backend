import { ConfigService } from '@nestjs/config';

describe('bootstrap', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates app and listens on PORT', async () => {
    process.env.NODE_ENV = 'test';

    const enableShutdownHooks = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn((_token: any) => ({ get: () => '1234' }));
    const use = jest.fn();

    jest.resetModules();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue({
          enableShutdownHooks,
          get,
          listen,
          use,
        }),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(enableShutdownHooks).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(1234);
  });

  it('serves coverage report in dev when dir exists', async () => {
    process.env.NODE_ENV = 'test';

    const enableShutdownHooks = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const use = jest.fn();

    const configGet = (k: string) =>
      (
        {
          NODE_ENV: 'development',
          PORT: '3000',
          STATS_SERVE_JEST_COVERAGE_REPORT: 'true',
          STATS_JEST_COVERAGE_REPORT_DIR: 'coverage/lcov-report',
        } as Record<string, string>
      )[k];

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('node:fs');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    jest.doMock('express', () => ({
      __esModule: true,
      default: { static: jest.fn(() => 'mw') },
    }));
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue({
          enableShutdownHooks,
          get: jest.fn(() => ({ get: configGet })),
          listen,
          use,
        }),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(use).toHaveBeenCalledWith('/_coverage', 'mw');
  });

  it('does not serve coverage report in dev when disabled', async () => {
    process.env.NODE_ENV = 'test';

    const enableShutdownHooks = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const use = jest.fn();

    const configGet = (k: string) =>
      (
        {
          NODE_ENV: 'development',
          PORT: '3000',
          STATS_SERVE_JEST_COVERAGE_REPORT: 'false',
        } as Record<string, string>
      )[k];

    jest.resetModules();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue({
          enableShutdownHooks,
          get: jest.fn(() => ({ get: configGet })),
          listen,
          use,
        }),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(use).not.toHaveBeenCalled();
  });

  it('does not serve coverage report when default dir is missing', async () => {
    process.env.NODE_ENV = 'test';

    const enableShutdownHooks = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const use = jest.fn();

    const configGet = (k: string) =>
      (
        {
          NODE_ENV: 'development',
          PORT: '3000',
          STATS_SERVE_JEST_COVERAGE_REPORT: 'true',
        } as Record<string, string>
      )[k];

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('node:fs');
    const existsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const expressStatic = jest.fn(() => 'mw');
    jest.doMock('express', () => ({
      __esModule: true,
      default: { static: expressStatic },
    }));

    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue({
          enableShutdownHooks,
          get: jest.fn(() => ({ get: configGet })),
          listen,
          use,
        }),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bootstrap } = require('./main');
    await bootstrap();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolve } = require('node:path');
    expect(existsSync).toHaveBeenCalledWith(
      resolve(process.cwd(), 'coverage/lcov-report'),
    );
    expect(expressStatic).not.toHaveBeenCalled();
    expect(use).not.toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(3000);
  });

  it('does not serve coverage report outside dev', async () => {
    process.env.NODE_ENV = 'test';

    const enableShutdownHooks = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const use = jest.fn();

    const configGet = (k: string) =>
      (
        {
          NODE_ENV: 'production',
          PORT: 'NaN',
        } as Record<string, string>
      )[k];

    jest.resetModules();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue({
          enableShutdownHooks,
          get: jest.fn(() => ({ get: configGet })),
          listen,
          use,
        }),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(use).not.toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(3000);
  });

  it('auto-runs bootstrap when NODE_ENV is not test', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    jest.resetModules();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create: jest.fn().mockResolvedValue({ enableShutdownHooks: jest.fn(), get: jest.fn(() => ({ get: () => undefined })), listen: jest.fn().mockResolvedValue(undefined), use: jest.fn() }) },
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./main');
    });

    process.env.NODE_ENV = prev;
  });
});
