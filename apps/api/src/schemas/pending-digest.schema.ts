import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PendingDigest extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  externalBoardJobId: string;

  @Prop({ required: true, default: false })
  sent: boolean;
}

export const PendingDigestSchema = SchemaFactory.createForClass(PendingDigest);

PendingDigestSchema.index({ userId: 1, sent: 1 });
