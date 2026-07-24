import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ApiLog extends Document {
  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  modelName: string;

  @Prop({ required: true, enum: ['success', 'failed'] })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;
}

export const ApiLogSchema = SchemaFactory.createForClass(ApiLog);
