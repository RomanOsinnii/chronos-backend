import { ConfigService } from '@nestjs/config';
import { mongoMongooseOptionsFactory } from './mongo.module';

describe('mongoMongooseOptionsFactory', () => {
  it('builds mongoose options with uri and timeouts', () => {
    const config = {
      get: (k: string) =>
        (
          {
            MONGO_URI: 'mongodb://x',
          } as Record<string, string>
        )[k],
    } as unknown as ConfigService;

    const opts = mongoMongooseOptionsFactory(config);
    expect(opts).toEqual(
      expect.objectContaining({
        uri: 'mongodb://x',
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        retryAttempts: 5,
        retryDelay: 1000,
      }),
    );
  });
});

