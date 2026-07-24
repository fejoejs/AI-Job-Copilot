export interface UserProfile {
  id: string; // Clerk ID or mongo ID
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  filters: UserFilters;
}

export interface UserFilters {
  workTypes: ('Remote' | 'Hybrid' | 'Onsite')[];
  minSalary: number;
  maxSalary?: number;
  experienceLevel: string; // e.g. "Junior", "Mid", "Senior"
  targetCompanies: string[]; // specific company names
  countries: string[];
}

export interface ResumeData {
  id: string;
  userId: string;
  originalFileName: string;
  r2Url?: string;
  parsedProfile?: ParsedResumeProfile;
  createdAt: Date;
}

export interface ParsedResumeProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
  summary?: string;
}

export interface WorkExperience {
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description: string;
  achievements: string[];
}

export interface Education {
  degree: string;
  institution: string;
  location?: string;
  graduationYear?: string;
}

export interface Project {
  title: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: 'LinkedIn' | 'Indeed' | 'Naukri' | 'Wellfound' | 'Greenhouse' | 'Lever' | 'Company Career Page';
  location: string;
  workType: 'Remote' | 'Hybrid' | 'Onsite';
  salaryString?: string;
  salaryMin?: number;
  salaryMax?: number;
  createdAt: Date;
}

export interface JobMatchResult {
  id: string;
  userId: string;
  jobId: string;
  matchScore: number; // 0 to 100
  recommendation: 'Apply' | 'Skip';
  reasoning: string;
  pros: string[];
  cons: string[];
  missingSkills: string[];
  decisionScore: number; // overall decision weight
  createdAt: Date;
}

export interface TailoredResume {
  id: string;
  userId: string;
  jobId: string;
  tailoredProfile: ParsedResumeProfile;
  pdfUrl?: string; // stored tailored PDF URL
  createdAt: Date;
}

export interface CoverLetter {
  id: string;
  userId: string;
  jobId: string;
  content: string;
  createdAt: Date;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  status: 'Matched' | 'Tailored' | 'Applying' | 'Applied' | 'Interviewing' | 'Offered' | 'Rejected';
  tailoredResumeId?: string;
  coverLetterId?: string;
  appliedDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
