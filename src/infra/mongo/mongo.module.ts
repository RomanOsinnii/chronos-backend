import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { buildMongoUri } from '../../config/env';

export function mongoMongooseOptionsFactory(config: ConfigService) {
  return {
    uri: buildMongoUri(config),
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    retryAttempts: 5,
    retryDelay: 1000,
  };
}

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: mongoMongooseOptionsFactory,
    }),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
