import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongoModule } from './infra/mongo/mongo.module';
import { RedisModule } from './infra/redis/redis.module';
import { RequestLoggingModule } from './logging/request-logging.module';
import { MetricsModule } from './metrics/metrics.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongoModule,
    RedisModule,
    MetricsModule,
    RequestLoggingModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
