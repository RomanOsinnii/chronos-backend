import { RequestLoggingService } from './request-logging.service';

describe('RequestLoggingService', () => {
  it('does not throw if Mongo write fails', async () => {
    const model = { create: jest.fn().mockRejectedValue(new Error('fail')) };
    const service = new RequestLoggingService(model as any);

    await expect(
      service.log({
        method: 'GET',
        path: '/',
        query: null,
        statusCode: 200,
        durationMs: 1,
        ip: null,
        userAgent: null,
        referer: null,
        requestId: null,
        userId: null,
        errorName: null,
        errorMessage: null,
      }),
    ).resolves.toBeUndefined();

    expect(model.create).toHaveBeenCalledTimes(1);
  });

  it('writes log when Mongo is available', async () => {
    const model = { create: jest.fn().mockResolvedValue({ _id: '1' }) };
    const service = new RequestLoggingService(model as any);

    await service.log({
      method: 'GET',
      path: '/',
      query: null,
      statusCode: 200,
      durationMs: 1,
      ip: null,
      userAgent: null,
      referer: null,
      requestId: null,
      userId: null,
      errorName: null,
      errorMessage: null,
    });

    expect(model.create).toHaveBeenCalledTimes(1);
  });
});
