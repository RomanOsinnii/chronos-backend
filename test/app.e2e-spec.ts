import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { REDIS_CLIENT } from './../src/infra/redis/redis.constants';
import { RequestLog } from './../src/logging/request-log.schema';
import { AppController } from './../src/app.controller';
import { StatsController } from './../src/stats/stats.controller';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';

    const mockRequestLogModel = { create: jest.fn().mockResolvedValue(undefined) };
    const mockMongoConnection = {
      readyState: 0,
      name: 'chronos',
      db: null,
      model: jest.fn(() => mockRequestLogModel),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockRedis = {
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(mockMongoConnection)
      .overrideProvider(getModelToken(RequestLog.name))
      .useValue(mockRequestLogModel)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AppController.getHello()', () => {
    const controller = app.get(AppController);
    expect(controller.getHello()).toBe('Hello World!');
  });

  it('StatsController.getStatsPage()', async () => {
    const controller = app.get(StatsController);
    const html = await controller.getStatsPage();
    expect(html).toContain('Backend stats');
  });
});
