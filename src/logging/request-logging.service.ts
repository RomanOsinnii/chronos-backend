import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RequestLog } from './request-log.schema';

export type RequestLogCreate = Omit<
  RequestLog,
  'createdAt' | 'updatedAt'
> & {
  createdAt?: Date;
};

@Injectable()
export class RequestLoggingService {
  constructor(
    @InjectModel(RequestLog.name)
    private readonly requestLogModel: Model<RequestLog>,
  ) {}

  async log(entry: RequestLogCreate): Promise<void> {
    try {
      await this.requestLogModel.create(entry);
    } catch {
      // best-effort logging; never break the request flow
    }
  }
}

