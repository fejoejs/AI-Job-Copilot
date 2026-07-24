import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
class WorkExperience {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop()
  location?: string;

  @Prop()
  startDate?: string;

  @Prop()
  endDate?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  achievements: string[];
}

const WorkExperienceSchema = SchemaFactory.createForClass(WorkExperience);

@Schema({ _id: false })
class Education {
  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  institution: string;

  @Prop()
  location?: string;

  @Prop()
  graduationYear?: string;
}

const EducationSchema = SchemaFactory.createForClass(Education);

@Schema({ _id: false })
class Project {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop()
  url?: string;
}

const ProjectSchema = SchemaFactory.createForClass(Project);

@Schema({ _id: false })
class ResumeLinks {
  @Prop()
  linkedin?: string;

  @Prop()
  github?: string;

  @Prop()
  portfolio?: string;

  @Prop({ type: [String], default: [] })
  other: string[];
}

const ResumeLinksSchema = SchemaFactory.createForClass(ResumeLinks);

@Schema({ _id: false })
class ParsedResumeProfile {
  @Prop()
  fullName?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ type: ResumeLinksSchema })
  links?: ResumeLinks;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: [String], default: [] })
  certifications: string[];

  @Prop({ type: [WorkExperienceSchema], default: [] })
  experience: WorkExperience[];

  @Prop({ type: [EducationSchema], default: [] })
  education: Education[];

  @Prop({ type: [ProjectSchema], default: [] })
  projects: Project[];

  @Prop()
  summary?: string;
}

const ParsedResumeProfileSchema = SchemaFactory.createForClass(ParsedResumeProfile);

@Schema({ timestamps: true })
export class Resume extends Document {
  @Prop({ required: true })
  userId: string; // ClerkId

  @Prop({ required: true })
  originalFileName: string;

  @Prop()
  r2Url?: string; // Legacy URL field (unused, kept for backwards compat)

  @Prop({ type: Buffer })
  fileBuffer?: Buffer;

  @Prop()
  mimeType?: string;

  @Prop({ type: ParsedResumeProfileSchema })
  parsedProfile?: ParsedResumeProfile;

  @Prop({ type: Boolean, default: false })
  isAtsCheckOnly?: boolean;

  @Prop({ type: Number })
  atsScore?: number;

  @Prop({ type: MongooseSchema.Types.Mixed })
  atsAnalysis?: any;
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
