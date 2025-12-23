import { ConfigService } from '@nestjs/config';

describe('redisClientFactory', () => {
  it('creates client and connects', async () => {
    const connect = jest.fn().mockResolvedValue(undefined);
    const RedisMock = jest.fn().mockImplementation(() => ({ connect }));

    jest.resetModules();
    jest.doMock('ioredis', () => ({
      __esModule: true,
      default: RedisMock,
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { redisClientFactory } = require('./redis.module');

    const config = {
      get: (k: string) =>
        (
          {
            REDIS_URL: 'redis://localhost:6379',
          } as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const client = await redisClientFactory(config);
    expect(client).toEqual(expect.objectContaining({ connect }));
    expect(RedisMock).toHaveBeenCalledWith('redis://localhost:6379', {
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

