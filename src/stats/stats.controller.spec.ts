import { NotFoundException } from '@nestjs/common';
import { StatsController } from './stats.controller';

describe('StatsController', () => {
  it('calls assertEnabled before rendering', async () => {
    const stats = {
      assertEnabled: jest.fn(),
      renderHtml: jest.fn().mockResolvedValue('<html/>'),
    };

    const controller = new StatsController(stats as any);
    await controller.getStatsPage();

    expect(stats.assertEnabled).toHaveBeenCalledTimes(1);
    expect(stats.renderHtml).toHaveBeenCalledTimes(1);
  });

  it('propagates NotFound when disabled', async () => {
    const stats = {
      assertEnabled: jest.fn(() => {
        throw new NotFoundException();
      }),
      renderHtml: jest.fn(),
    };

    const controller = new StatsController(stats as any);
    expect(() => controller.getStatsPage()).toThrow(NotFoundException);
    expect(stats.renderHtml).not.toHaveBeenCalled();
  });
});
