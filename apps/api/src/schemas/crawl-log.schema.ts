import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CrawlLog extends Document {
  @Prop({ required: true })
  platform: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ required: true, enum: ['success', 'failed'] })
  status: string;

  @Prop({ required: true, default: 0 })
  jobsParsed: number;

  @Prop({ required: true, default: 0 })
  jobsSaved: number;

  @Prop()
  errorMessage?: string;
}

export const CrawlLogSchema = SchemaFactory.createForClass(CrawlLog);
