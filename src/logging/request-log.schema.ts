import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'request_logs' })
export class RequestLog {
  @Prop({ required: true })
  method!: string;

  @Prop({ required: true })
  path!: string;

  @Prop({ type: Object, default: null })
  query!: Record<string, unknown> | null;

  @Prop({ required: true })
  statusCode!: number;

  @Prop({ required: true })
  durationMs!: number;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  referer!: string | null;

  @Prop({ type: String, default: null })
  requestId!: string | null;

  @Prop({ type: String, default: null })
  userId!: string | null;

  @Prop({ type: String, default: null })
  errorName!: string | null;

  @Prop({ type: String, default: null })
  errorMessage!: string | null;
}

export type RequestLogDocument = HydratedDocument<RequestLog>;
export const RequestLogSchema = SchemaFactory.createForClass(RequestLog);
