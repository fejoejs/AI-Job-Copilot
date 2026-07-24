import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ExternalBoardJob extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop()
  location?: string;

  @Prop()
  salary?: string;

  @Prop({ maxlength: 200 })
  shortDescription?: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, enum: ['LinkedIn', 'Indeed', 'Naukri'] })
  sourcePlatform: string;

  @Prop({ required: true })
  dedupKey: string;

  @Prop()
  discoveredByUserId?: string;

  @Prop({ required: true, default: Date.now })
  firstSeenAt: Date;

  @Prop({ required: true, default: Date.now })
  lastSeenAt: Date;

  @Prop({ required: true })
  expiresAt: Date;
}

export const ExternalBoardJobSchema = SchemaFactory.createForClass(ExternalBoardJob);

ExternalBoardJobSchema.index({ dedupKey: 1 }, { unique: true });
// TTL index: automatically deletes the document once the current time passes expiresAt
ExternalBoardJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
