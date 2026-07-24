import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class OtpVerification extends Document {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  otp: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  verified: boolean;
}

export const OtpVerificationSchema = SchemaFactory.createForClass(OtpVerification);

// Automatically delete expired documents (TTL index)
OtpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
