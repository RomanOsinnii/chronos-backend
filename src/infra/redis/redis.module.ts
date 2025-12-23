import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildRedisUrl } from '../../config/env';
import { REDIS_CLIENT } from './redis.constants';

export async function redisClientFactory(config: ConfigService) {
  const client = new Redis(buildRedisUrl(config), {
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  await client.connect();
  return client;
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: redisClientFactory,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
