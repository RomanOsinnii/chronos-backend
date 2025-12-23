import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { envBool } from './config/env';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const nodeEnv = String(config.get('NODE_ENV') ?? '').toLowerCase();
  const isDev = ['development', 'dev', 'local'].includes(nodeEnv);

  if (isDev && envBool(config, 'STATS_SERVE_JEST_COVERAGE_REPORT', true)) {
    const reportDir = resolve(
      process.cwd(),
      String(config.get('STATS_JEST_COVERAGE_REPORT_DIR') ?? 'coverage/lcov-report'),
    );
    if (existsSync(reportDir)) {
      app.use('/_coverage', express.static(reportDir, { index: 'index.html' }));
    }
  }

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(Number.isFinite(port) ? port : 3000);
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
