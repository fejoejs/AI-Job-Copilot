import { Schema, model } from 'mongoose';

// User Schema
const UserSchema = new Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  phone: String,
  isEmailVerified: { type: Boolean, default: false },
  emailOtp: String,
  emailOtpExpires: Date,
  isPhoneVerified: { type: Boolean, default: false },
  phoneOtp: String,
  phoneOtpExpires: Date,
  whatsappNotificationsEnabled: { type: Boolean, default: true },
  notifyMatchThreshold: { type: Number, default: 85 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  filters: {
    workTypes: [String],
    minSalary: Number,
    maxSalary: Number,
    experienceLevel: String,
    targetCompanies: [String],
    countries: [String],
    targetJobRole: String,
    targetRoles: [String]
  }
}, { timestamps: true });

// SystemConfig Schema
const SystemConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
  description: String
}, { timestamps: true });

// Resume Schema
const ResumeSchema = new Schema({
  userId: { type: String, required: true },
  originalFileName: { type: String, required: true },
  r2Url: { type: String },
  fileBuffer: { type: Schema.Types.Buffer || Buffer },
  mimeType: { type: String },
  parsedProfile: {
    fullName: String,
    email: String,
    phone: String,
    links: {
      linkedin: String,
      github: String,
      portfolio: String,
      other: [String]
    },
    skills: [String],
    certifications: [String],
    experience: [{
      title: String,
      company: String,
      location: String,
      startDate: String,
      endDate: String,
      description: String,
      achievements: [String]
    }],
    education: [{
      degree: String,
      institution: String,
      location: String,
      graduationYear: String
    }],
    projects: [{
      title: String,
      description: String,
      technologies: [String],
      url: String
    }],
    summary: String
  },
  isAtsCheckOnly: { type: Boolean, default: false },
  atsScore: { type: Number },
  atsAnalysis: { type: Schema.Types.Mixed }
}, { timestamps: true });

// Job Schema
const JobSchema = new Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  description: { type: String, required: true },
  url: { type: String, required: true },
  source: { type: String, required: true },
  location: { type: String, required: true },
  workType: { type: String, required: true },
  salaryString: String,
  salaryMin: Number,
  salaryMax: Number,
  companyUrl: String,
  applyUrl: String,
  companyLogoUrl: String,
  requiredSkills: { type: [String], default: [] },
  preferredSkills: { type: [String], default: [] },
  experienceLevel: String,
  requiredExperienceYears: Number,
  employmentType: String,
  industry: String,
  benefits: { type: [String], default: [] },
  postedDate: Date,
  salaryCurrency: String,
  salaryPeriod: String,
  userId: String,
  isClosed: { type: Boolean, default: false },
  embedding: [Number]
}, { timestamps: true });

// Job Match Schema
const JobMatchSchema = new Schema({
  userId: { type: String, required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  matchScore: { type: Number, required: true },
  recommendation: { type: String, required: true },
  reasoning: { type: String, required: true },
  pros: [String],
  cons: [String],
  missingSkills: [String],
  decisionScore: { type: Number, default: 0 }
}, { timestamps: true });

// Application Schema
const ApplicationSchema = new Schema({
  userId: { type: String, required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
  status: { type: String, required: true },
  tailoredResumeUrl: String, // Legacy URL field (unused)
  tailoredResumeContent: String,
  coverLetterContent: String,
  appliedDate: Date,
  notes: String,
  externalBoardJobId: String,
  jobTitle: String,
  company: String,
  location: String,
  sourcePlatform: String,
  url: String,
  source: { type: String, enum: ['direct', 'external-board'], default: 'direct' }
}, { timestamps: true });

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

// External Board Job Schema
const ExternalBoardJobSchema = new Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: String,
  salary: String,
  shortDescription: { type: String, maxlength: 200 },
  url: { type: String, required: true },
  sourcePlatform: { type: String, required: true, enum: ['LinkedIn', 'Indeed', 'Naukri'] },
  dedupKey: { type: String, required: true },
  discoveredByUserId: String,
  firstSeenAt: { type: Date, required: true, default: Date.now },
  lastSeenAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

ExternalBoardJobSchema.index({ dedupKey: 1 }, { unique: true });
ExternalBoardJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pending Confirmation Schema
const PendingConfirmationSchema = new Schema({
  userId: { type: String, required: true },
  externalBoardJobId: { type: String, required: true },
  markedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

PendingConfirmationSchema.index({ userId: 1, externalBoardJobId: 1 }, { unique: true });

// Pending Digest Schema
const PendingDigestSchema = new Schema({
  userId: { type: String, required: true },
  externalBoardJobId: { type: String, required: true },
  sent: { type: Boolean, required: true, default: false }
}, { timestamps: true });

PendingDigestSchema.index({ userId: 1, sent: 1 });

export const UserModel = model('User', UserSchema);
export const ResumeModel = model('Resume', ResumeSchema);
export const JobModel = model('Job', JobSchema);
export const JobMatchModel = model('JobMatch', JobMatchSchema);
export const ApplicationModel = model('Application', ApplicationSchema);
export const SystemConfigModel = model('SystemConfig', SystemConfigSchema);
export const ExternalBoardJobModel = model('ExternalBoardJob', ExternalBoardJobSchema);
export const PendingConfirmationModel = model('PendingConfirmation', PendingConfirmationSchema);
export const PendingDigestModel = model('PendingDigest', PendingDigestSchema);

