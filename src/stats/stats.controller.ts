import { Controller, Get, Header } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller()
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('stats')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getStatsPage(): Promise<string> {
    this.stats.assertEnabled();
    return this.stats.renderHtml();
  }
}
