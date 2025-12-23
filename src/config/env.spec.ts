import { ConfigService } from '@nestjs/config';
import { buildMongoUri, buildRedisUrl, envBool, envInt, envString } from './env';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('env helpers', () => {
  it('envString returns fallback for empty', () => {
    expect(envString(config({ A: '' }), 'A', 'x')).toBe('x');
    expect(envString(config({}), 'A', 'x')).toBe('x');
  });

  it('envInt returns fallback for empty/missing', () => {
    expect(envInt(config({ A: '' }), 'A', 9)).toBe(9);
    expect(envInt(config({}), 'A', 9)).toBe(9);
  });

  it('envInt parses numbers and falls back', () => {
    expect(envInt(config({ A: '123' }), 'A', 9)).toBe(123);
    expect(envInt(config({ A: 'nope' }), 'A', 9)).toBe(9);
  });

  it('envBool handles common true values', () => {
    expect(envBool(config({ A: 'true' }), 'A')).toBe(true);
    expect(envBool(config({ A: '1' }), 'A')).toBe(true);
    expect(envBool(config({ A: 'yes' }), 'A')).toBe(true);
    expect(envBool(config({ A: 'false' }), 'A', true)).toBe(false);
  });

  it('envBool returns fallback for missing', () => {
    expect(envBool(config({}), 'A', true)).toBe(true);
    expect(envBool(config({}), 'A')).toBe(false);
  });

  it('buildMongoUri prefers MONGO_URI', () => {
    expect(buildMongoUri(config({ MONGO_URI: 'mongodb://x' }))).toBe(
      'mongodb://x',
    );
  });

  it('buildMongoUri builds from parts and adds authSource when creds set', () => {
    const uri = buildMongoUri(
      config({
        MONGO_HOST: 'localhost',
        MONGO_PORT: '27017',
        MONGO_DB_NAME: 'chronos',
        MONGO_ROOT_USER: 'u',
        MONGO_ROOT_PASSWORD: 'p',
      }),
    );
    expect(uri).toBe('mongodb://u:p@localhost:27017/chronos?authSource=admin');
  });

  it('buildMongoUri builds from defaults when creds are missing', () => {
    const uri = buildMongoUri(config({}));
    expect(uri).toBe('mongodb://localhost:27017/chronos');
  });

  it('buildRedisUrl prefers REDIS_URL', () => {
    expect(buildRedisUrl(config({ REDIS_URL: 'redis://x:1' }))).toBe(
      'redis://x:1',
    );
  });

  it('buildRedisUrl builds from host/port with defaults', () => {
    expect(buildRedisUrl(config({}))).toBe('redis://localhost:6379');
    expect(buildRedisUrl(config({ REDIS_HOST: 'r', REDIS_PORT: '1111' }))).toBe(
      'redis://r:1111',
    );
  });
});
