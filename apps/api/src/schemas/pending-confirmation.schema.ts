import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PendingConfirmation extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  externalBoardJobId: string;

  @Prop({ required: true, default: Date.now })
  markedAt: Date;
}

export const PendingConfirmationSchema = SchemaFactory.createForClass(PendingConfirmation);

PendingConfirmationSchema.index({ userId: 1, externalBoardJobId: 1 }, { unique: true });
