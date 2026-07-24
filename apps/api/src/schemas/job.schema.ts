import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Job extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  url: string;

  @Prop({
    required: true,
    enum: [
      'LinkedIn', 'Indeed', 'Naukri', 'Wellfound', 'Greenhouse', 'Lever', 'Company Career Page', 
      'JSearch', 'Adzuna', 'Ashby', 'Rippling', 'Workday', 'Jooble', 'Careerjet', 'Workable', 
      'SmartRecruiters', 'Recruitee', 'Teamtailor', 'Remote OK', 'Jobicy', 'Remotive', 
      'We Work Remotely', 'Himalayas'
    ],
  })
  source: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true, enum: ['Remote', 'Hybrid', 'Onsite'] })
  workType: string;

  @Prop()
  salaryString?: string;

  @Prop({ type: Number })
  salaryMin?: number;

  @Prop({ type: Number })
  salaryMax?: number;

  // Enriched fields from JSearch/Adzuna
  @Prop()
  companyUrl?: string;

  @Prop()
  applyUrl?: string;

  @Prop()
  companyLogoUrl?: string;

  @Prop({ type: [String], default: [] })
  requiredSkills: string[];

  @Prop({ type: [String], default: [] })
  preferredSkills: string[];

  @Prop()
  experienceLevel?: string;

  @Prop({ type: Number })
  requiredExperienceYears?: number;

  @Prop()
  employmentType?: string;

  @Prop()
  industry?: string;

  @Prop({ type: [String], default: [] })
  benefits: string[];

  @Prop({ type: Date })
  postedDate?: Date;

  @Prop()
  salaryCurrency?: string;

  @Prop()
  salaryPeriod?: string;

  // Per-user scoping (retained for user custom manually added jobs if needed, but direct/crawled jobs are global)
  @Prop()
  userId?: string;

  @Prop({ type: Boolean, default: false })
  isClosed: boolean;

  // For Atlas Vector Search support
  @Prop({ type: [Number], index: false })
  embedding?: number[];
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ url: 1 }, { unique: true });
JobSchema.index({ isClosed: 1, postedDate: -1 });
JobSchema.index({ company: 1, title: 1 });

// TTL Index: Automatically delete jobs 20 days after they are created
JobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 20 * 24 * 60 * 60 });
