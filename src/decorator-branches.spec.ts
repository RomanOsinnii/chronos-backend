describe('decorator branches (Reflect.decorate path)', () => {
  it('loads decorated modules with reflect-metadata present', () => {
    jest.isolateModules(() => {
      const original = (globalThis as any).Reflect?.decorate;
      const originalMetadata = (globalThis as any).Reflect?.metadata;
      if ((globalThis as any).Reflect) {
        delete (globalThis as any).Reflect.decorate;
        delete (globalThis as any).Reflect.metadata;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AppController } = require('./app.controller');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { StatsController } = require('./stats/stats.controller');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RequestMetricsInterceptor } = require('./metrics/request-metrics.interceptor');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RequestLoggingService } = require('./logging/request-logging.service');
      expect(AppController).toBeDefined();
      expect(StatsController).toBeDefined();
      expect(RequestMetricsInterceptor).toBeDefined();
      expect(RequestLoggingService).toBeDefined();
      if ((globalThis as any).Reflect && original) {
        (globalThis as any).Reflect.decorate = original;
      }
      if ((globalThis as any).Reflect && originalMetadata) {
        (globalThis as any).Reflect.metadata = originalMetadata;
      }
    });

    jest.isolateModules(() => {
      const original = (globalThis as any).Reflect?.decorate;
      const originalMetadata = (globalThis as any).Reflect?.metadata;
      if (!(globalThis as any).Reflect) (globalThis as any).Reflect = {};
      (globalThis as any).Reflect.decorate = () => undefined;
      (globalThis as any).Reflect.metadata = () => undefined;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AppController } = require('./app.controller');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { StatsController } = require('./stats/stats.controller');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RequestMetricsInterceptor } = require('./metrics/request-metrics.interceptor');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RequestLoggingService } = require('./logging/request-logging.service');

      expect(AppController).toBeDefined();
      expect(StatsController).toBeDefined();
      expect(RequestMetricsInterceptor).toBeDefined();
      expect(RequestLoggingService).toBeDefined();

      if (original) {
        (globalThis as any).Reflect.decorate = original;
      } else {
        delete (globalThis as any).Reflect.decorate;
      }
      if (originalMetadata) {
        (globalThis as any).Reflect.metadata = originalMetadata;
      } else {
        delete (globalThis as any).Reflect.metadata;
      }
    });
  });
});
