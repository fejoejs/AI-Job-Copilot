import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class JobMatch extends Document {
  @Prop({ required: true })
  userId: string; // ClerkId

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Job' })
  jobId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  matchScore: number;

  @Prop({ required: true, enum: ['Apply', 'Skip'] })
  recommendation: string;

  @Prop({ required: true })
  reasoning: string;

  @Prop({ type: [String], default: [] })
  pros: string[];

  @Prop({ type: [String], default: [] })
  cons: string[];

  @Prop({ type: [String], default: [] })
  missingSkills: string[];

  @Prop({ type: Number, default: 0 })
  decisionScore: number;
}

export const JobMatchSchema = SchemaFactory.createForClass(JobMatch);
// Add index for fast querying per user
JobMatchSchema.index({ userId: 1, jobId: 1 }, { unique: true });
