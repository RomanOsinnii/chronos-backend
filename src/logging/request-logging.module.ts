import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLog, RequestLogSchema } from './request-log.schema';
import { RequestLoggingService } from './request-logging.service';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RequestLog.name,
        schema: RequestLogSchema,
      },
    ]),
  ],
  providers: [
    RequestLoggingService,
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class RequestLoggingModule {}

