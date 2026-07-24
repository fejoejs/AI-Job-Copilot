import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Application extends Document {
  @Prop({ required: true })
  userId: string; // ClerkId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Job' })
  jobId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Resume' })
  resumeId?: MongooseSchema.Types.ObjectId;

  @Prop({
    required: true,
    enum: ['Matched', 'Tailored', 'Applying', 'Applied', 'Interviewing', 'Offered', 'Rejected'],
    default: 'Matched',
  })
  status: string;

  @Prop()
  tailoredResumeUrl?: string; // DB path/reference to custom resume text

  @Prop()
  tailoredResumeContent?: string;

  @Prop()
  coverLetterContent?: string;

  @Prop({ type: Date })
  appliedDate?: Date;

  @Prop()
  notes?: string;

  // External Boards Snapshot Fields
  @Prop()
  externalBoardJobId?: string;

  @Prop()
  jobTitle?: string;

  @Prop()
  company?: string;

  @Prop()
  location?: string;

  @Prop()
  sourcePlatform?: string;

  @Prop()
  url?: string;

  @Prop({ default: 'direct', enum: ['direct', 'external-board'] })
  source?: string;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);

// Partial unique indexes to prevent duplication while allowing null fields
ApplicationSchema.index(
  { userId: 1, jobId: 1 },
  {
    unique: true,
    partialFilterExpression: { jobId: { $exists: true } }
  }
);

ApplicationSchema.index(
  { userId: 1, externalBoardJobId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalBoardJobId: { $exists: true } }
  }
);

