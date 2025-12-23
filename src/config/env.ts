import { ConfigService } from '@nestjs/config';

export function envString(
  config: ConfigService,
  key: string,
  fallback?: string,
): string | undefined {
  const value = config.get<string>(key);
  if (value === undefined || value === '') return fallback;
  return value;
}

export function envInt(
  config: ConfigService,
  key: string,
  fallback?: number,
): number | undefined {
  const raw = envString(config, key);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function buildMongoUri(config: ConfigService): string {
  const uri = envString(config, 'MONGO_URI');
  if (uri) return uri;

  const host = envString(config, 'MONGO_HOST', 'localhost');
  const port = envInt(config, 'MONGO_PORT', 27017);
  const dbName = envString(config, 'MONGO_DB_NAME', 'chronos');

  const user = envString(config, 'MONGO_ROOT_USER');
  const pass = envString(config, 'MONGO_ROOT_PASSWORD');

  const credentials =
    user && pass
      ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
      : '';

  const authSource = credentials ? '?authSource=admin' : '';
  return `mongodb://${credentials}${host}:${port}/${dbName}${authSource}`;
}

export function buildRedisUrl(config: ConfigService): string {
  const url = envString(config, 'REDIS_URL');
  if (url) return url;

  const host = envString(config, 'REDIS_HOST', 'localhost');
  const port = envInt(config, 'REDIS_PORT', 6379);
  return `redis://${host}:${port}`;
}

export function envBool(
  config: ConfigService,
  key: string,
  fallback = false,
): boolean {
  const raw = envString(config, key);
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(raw.toLowerCase());
}

