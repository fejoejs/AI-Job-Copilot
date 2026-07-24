import mongoose from 'mongoose';
import { Worker, Job as BullJob } from 'bullmq';
import dotenv from 'dotenv';
import express from 'express';
import { AIService, EmailService, WhatsAppService } from '@ai-copilot/utils';
import { 
  ResumeModel, 
  JobModel, 
  JobMatchModel, 
  ApplicationModel, 
  UserModel, 
  SystemConfigModel,
  ExternalBoardJobModel,
  PendingConfirmationModel,
  PendingDigestModel
} from './schemas';
import { extractTextFromFile } from './parser';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisTls = process.env.REDIS_TLS === 'true' ? {} : undefined;
const connection = { host: redisHost, port: redisPort, password: redisPassword, tls: redisTls };

async function getDynamicEmailService(): Promise<EmailService> {
  try {
    const configs = await SystemConfigModel.find().exec();
    const configMap: { [key: string]: string } = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    return new EmailService({
      smtpHost: configMap['SMTP_HOST'],
      smtpPort: configMap['SMTP_PORT'] ? parseInt(configMap['SMTP_PORT'], 10) : undefined,
      smtpUser: configMap['SMTP_USER'],
      smtpPass: configMap['SMTP_PASS'],
      fromName: configMap['EMAIL_FROM_NAME'],
      fromEmail: configMap['EMAIL_FROM_ADDRESS'],
    });
  } catch (error) {
    console.error('[Worker] Failed to load SMTP config, using fallback:', error);
    return new EmailService();
  }
}

async function getDynamicWhatsAppService(): Promise<WhatsAppService> {
  try {
    const configs = await SystemConfigModel.find().exec();
    const configMap: { [key: string]: string } = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    return new WhatsAppService({
      accessToken: configMap['WHATSAPP_ACCESS_TOKEN'],
      phoneNumberId: configMap['WHATSAPP_PHONE_NUMBER_ID'],
      apiVersion: configMap['WHATSAPP_API_VERSION'],
    });
  } catch (error) {
    console.error('[Worker] Failed to load WhatsApp config, using fallback:', error);
    return new WhatsAppService();
  }
}

async function getDynamicAIService(): Promise<AIService> {
  try {
    const configs = await SystemConfigModel.find().exec();
    const configMap: { [key: string]: string } = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    return new AIService({
      apiKey: configMap['ANTHROPIC_API_KEY'],
      geminiApiKey: configMap['GEMINI_API_KEY'],
      groqApiKey: configMap['GROQ_API_KEY'],
      onApiCall: (service: string, model: string, status: 'success' | 'failed', errorMessage?: string) => {
        mongoose.connection.db?.collection('apilogs').insertOne({
          service,
          modelName: model,
          status,
          errorMessage,
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }).catch((err: any) => {
          console.error('[Worker AI] Failed to write ApiLog:', err);
        });
      }
    });
  } catch (error) {
    console.error('[Worker] Failed to load config from database, using env fallback:', error);
    return new AIService();
  }
}

/**
 * Initialize connection to MongoDB
 */
async function connectDb() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_job_copilot';
  const maxRetries = 8;
  const retryDelayMs = 5000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
      console.log('Worker successfully connected to MongoDB');
      return;
    } catch (err) {
      console.error(`Worker database connection attempt ${attempt}/${maxRetries} failed:`, (err as Error).message);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
      } else {
        console.error('Worker: all MongoDB connection attempts exhausted, exiting.');
        process.exit(1);
      }
    }
  }
}

/**
 * 1. Resume Parser Queue Processor
 */
const resumeParseWorker = new Worker('resume-parse', async (job: BullJob) => {
  const { resumeId, userId, fileKey } = job.data;
  console.log(`[Resume Worker] Parsing resume: ${resumeId} for user: ${userId}`);

  try {
    // 1. Fetch resume meta from Mongo
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw new Error(`Resume metadata not found in database: ${resumeId}`);
    }

    // 2. Load resume buffer directly from the MongoDB document
    let buffer = resume.fileBuffer;
    if (!buffer) {
      throw new Error(`File buffer not found in resume document for ID: ${resumeId}`);
    }
    
    // Ensure it is a standard Node.js Buffer (Mongoose sometimes returns Binary objects)
    if (!Buffer.isBuffer(buffer) && (buffer as any).buffer) {
      buffer = (buffer as any).buffer;
    }
    if (!Buffer.isBuffer(buffer) && (buffer as any).read) {
       buffer = Buffer.from((buffer as any).read(0, (buffer as any).length()));
    }
    
    // 3. Parse resume text
    console.log('[Resume Worker] Extracting text...');
    const rawText = await extractTextFromFile(buffer as Buffer, resume.originalFileName);
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No readable text could be extracted from this document.');
    }

    // 4. Structure resume using Claude
    console.log('[Resume Worker] Calling Claude AI for structured parsing...');
    const aiService = await getDynamicAIService();
    const parsedProfile = await aiService.parseResume(rawText);

    // Fetch user target job title preference from filters
    let targetJobTitle = '';
    try {
      const user = await UserModel.findOne({ clerkId: userId }).exec();
      if (user && user.filters) {
        targetJobTitle = user.filters.targetJobRole || (user.filters.targetRoles && user.filters.targetRoles[0]) || '';
      }
    } catch (userErr) {
      console.warn('[Resume Worker] Failed to fetch user filters for target job title:', userErr);
    }

    // Calculate accurate ATS score with AI feedback
    console.log('[Resume Worker] Calculating accurate ATS score...');
    const atsResult = await calculateAccurateAtsScore(parsedProfile, resume.originalFileName, targetJobTitle, aiService);

    // 5. Update DB record
    resume.parsedProfile = parsedProfile;
    (resume as any).atsScore = atsResult.overallScore;
    (resume as any).atsAnalysis = atsResult;
    await resume.save();
    console.log(`[Resume Worker] Resume ${resumeId} successfully parsed and scored.`);
  } catch (error: any) {
    console.error(`[Resume Worker] Failed to process resume job ${job.id}:`, error);
    try {
      await ResumeModel.findByIdAndUpdate(resumeId, {
        parsedProfile: { error: true, message: error.message || 'Unknown parsing error' }
      });
    } catch (dbErr) {
      console.error(`[Resume Worker] Failed to save error state to DB for ${resumeId}:`, dbErr);
    }
    throw error;
  }
}, { connection });

async function calculateAccurateAtsScore(
  profile: any,
  fileName: string,
  targetJobTitle: string,
  aiService: AIService,
): Promise<any> {
  if (!profile) return { overallScore: 0 };

  const expItems = Array.isArray(profile.experience) ? profile.experience.filter(Boolean) : [];
  const eduItems = Array.isArray(profile.education) ? profile.education.filter(Boolean) : [];
  const projItems = Array.isArray(profile.projects) ? profile.projects.filter(Boolean) : [];
  const skillItems = Array.isArray(profile.skills) ? profile.skills.filter((s: any) => typeof s === 'string') : [];

  const summaryText = profile.summary || '';
  const expText = expItems
    .map((e: any) => `${e.title || ''} ${e.company || ''} ${e.description || ''} ${(Array.isArray(e.achievements) ? e.achievements : []).join(' ')}`)
    .join(' ');
  const eduText = eduItems
    .map((ed: any) => `${ed.degree || ''} ${ed.institution || ''}`)
    .join(' ');
  const projectsText = projItems
    .map((p: any) => `${p.title || ''} ${p.description || ''} ${(Array.isArray(p.technologies) ? p.technologies : []).join(' ')}`)
    .join(' ');
  const skillsText = skillItems.join(' ');

  const fullProfileText = `${profile.fullName || ''} ${profile.email || ''} ${profile.phone || ''} ${summaryText} ${expText} ${eduText} ${projectsText} ${skillsText}`;
  const wordCount = fullProfileText.split(/\s+/).filter(Boolean).length;

  // 1. Keyword & Skills Match (35 points)
  const targetKeywords = [
    'javascript', 'typescript', 'react', 'node', 'python', 'java', 'sql', 'mongodb', 
    'docker', 'aws', 'kubernetes', 'git', 'ci/cd', 'agile', 'scrum', 'html', 'css', 
    'rest api', 'graphql', 'devops', 'testing', 'security', 'linux', 'cloud', 'system design',
    'communication', 'leadership', 'problem solving', 'collaboration', 'analytics', 
    'ui/ux', 'project management', 'software engineering', 'ai', 'machine learning'
  ];

  const synonymMap: { [key: string]: string[] } = {
    'js': ['javascript', 'js', 'ecmascript'],
    'javascript': ['javascript', 'js', 'ecmascript'],
    'ts': ['typescript', 'ts'],
    'typescript': ['typescript', 'ts'],
    'ml': ['machine learning', 'ml', 'deep learning'],
    'machine learning': ['machine learning', 'ml', 'deep learning'],
    'ai': ['artificial intelligence', 'ai'],
    'artificial intelligence': ['artificial intelligence', 'ai'],
    'aws': ['amazon web services', 'aws'],
    'gcp': ['google cloud', 'gcp', 'google cloud platform'],
    'react': ['reactjs', 'react.js', 'react'],
    'mongodb': ['mongo', 'mongodb'],
    'sql': ['postgresql', 'mysql', 'sql', 'sqlite'],
    'python': ['py', 'python'],
    'kubernetes': ['k8s', 'kubernetes'],
    'dev': ['developer', 'dev', 'engineer'],
    'developer': ['developer', 'dev', 'engineer'],
    'pm': ['product manager', 'pm'],
    'product manager': ['product manager', 'pm'],
  };

  const userSkillsNormalized = new Set<string>();
  for (const skill of skillItems) {
    if (!skill || typeof skill !== 'string') continue;
    const lowerSkill = skill.toLowerCase().trim();
    if (synonymMap[lowerSkill]) {
      synonymMap[lowerSkill].forEach(syn => userSkillsNormalized.add(syn));
    } else {
      userSkillsNormalized.add(lowerSkill);
    }
  }

  const synonymsLookup = new Set<string>();
  userSkillsNormalized.forEach(s => {
    synonymsLookup.add(s);
    if (synonymMap[s]) {
      synonymMap[s].forEach(alias => synonymsLookup.add(alias));
    }
  });

  let totalKeywordWeight = 0;
  for (const target of targetKeywords) {
    const inSkillsSection = synonymsLookup.has(target) || skillItems.some((s: string) => String(s).toLowerCase().includes(target));
    const inRestOfText = fullProfileText.toLowerCase().includes(target);
    
    if (inSkillsSection) {
      totalKeywordWeight += 1.5;
    } else if (inRestOfText) {
      totalKeywordWeight += 1.0;
    }
  }

  let keywordMatch = Math.round((Math.min(totalKeywordWeight, 18) / 18) * 35);

  // Job title exact-phrase matching bonus
  let jobTitleMatched = false;
  if (targetJobTitle && targetJobTitle.trim()) {
    const targetClean = targetJobTitle.toLowerCase().trim();
    const hasTitleInSummary = summaryText.toLowerCase().includes(targetClean);
    const hasTitleInExperience = expItems.some((e: any) => String(e.title || '').toLowerCase().includes(targetClean));
    if (hasTitleInSummary || hasTitleInExperience) {
      jobTitleMatched = true;
      keywordMatch = Math.min(35, keywordMatch + 3); // add +3 bonus points, cap at 35
    }
  }

  // 2. Standard Section Headers (15 points)
  let sectionHeaders = 0;
  const expCount = profile.experience?.length || 0;
  const eduCount = profile.education?.length || 0;
  const skillCount = profile.skills?.length || 0;
  const hasContact = !!(profile.fullName || profile.email || profile.phone);

  if (expCount > 0) sectionHeaders += 5;
  if (eduCount > 0) sectionHeaders += 4;
  if (skillCount > 0) sectionHeaders += 3;
  if (hasContact) sectionHeaders += 3;

  const creativeHeaderRegex = /\b(my journey|what i bring|about me|creative summary|my mission|why hire me)\b/i;
  if (creativeHeaderRegex.test(summaryText)) {
    sectionHeaders = Math.max(0, sectionHeaders - 2);
  }

  // 3. Contact Information Extractability (10 points)
  let contactInfo = 0;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneClean = (profile.phone || '').replace(/[^0-9+]/g, '');

  if (profile.email && emailRegex.test(profile.email.trim())) {
    contactInfo += 3;
  }
  if (phoneClean.length >= 7) {
    contactInfo += 3;
  }
  if (profile.fullName && profile.fullName.trim().split(/\s+/).length >= 2) {
    contactInfo += 4;
  }

  // 4. Formatting & Parseability (20 points)
  let formatting = 0;
  const descriptionBlock = expItems.map((e: any) => e.description || '').join(' ');
  const hasTableIndicator = /\||\s{4,}/.test(descriptionBlock);
  if (!hasTableIndicator) {
    formatting += 7;
  }

  const isImagePdf = wordCount < 30;
  if (!isImagePdf) {
    formatting += 5;
  }

  const fancyFontRegex = /[\uD835][\uDC00-\uDFFF]/;
  const hasFancyFonts = fancyFontRegex.test(fullProfileText);
  const hasExcessiveEmojis = /[\uD83C-\uDBFF\uDC00-\uDFFF].*[\uD83C-\uDBFF\uDC00-\uDFFF]/.test(fullProfileText);
  if (!hasFancyFonts && !hasExcessiveEmojis) {
    formatting += 3;
  }

  const fileExt = (fileName || '').split('.').pop()?.toLowerCase();
  if (fileExt === 'docx' || (fileExt === 'pdf' && !isImagePdf)) {
    formatting += 5;
  } else if (fileExt === 'pdf') {
    formatting += 2;
  }

  let hasEmojiBullets = false;
  for (const exp of expItems) {
    for (const ach of (Array.isArray(exp.achievements) ? exp.achievements : [])) {
      if (/^[\uD800-\uDFFF]/.test(ach.trim()) || /^[^\w\s•\-▪]/.test(ach.trim())) {
        hasEmojiBullets = true;
      }
    }
  }
  if (hasEmojiBullets) {
    formatting = Math.max(0, formatting - 2);
  }

  // 5. Date & Chronology Consistency (10 points)
  let chronology = 0;
  const dateRegex = /^(0[1-9]|1[0-2])\/\d{4}$|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i;
  let datesConsistent = true;
  for (const exp of expItems) {
    if (exp.startDate && !dateRegex.test(String(exp.startDate).trim())) datesConsistent = false;
    if (exp.endDate && String(exp.endDate).trim().toLowerCase() !== 'present' && !dateRegex.test(String(exp.endDate).trim())) datesConsistent = false;
  }
  if (datesConsistent && expItems.length > 0) {
    chronology += 5;
  } else if (expItems.length > 0) {
    chronology += 2;
  }

  let hasHugeGaps = false;
  if (expItems.length > 1) {
    const years = expItems.map((e: any) => {
      const match = String(e.startDate || '').match(/\d{4}/);
      return match ? parseInt(match[0], 10) : null;
    }).filter(Boolean);
    for (let i = 0; i < years.length - 1; i++) {
      if (Math.abs(years[i] - years[i+1]) > 2) hasHugeGaps = true;
    }
  }
  if (!hasHugeGaps) {
    chronology += 3;
  }

  let isReverseChronological = true;
  if (expItems.length > 1) {
    const getYear = (dateStr: any) => {
      const m = String(dateStr || '').match(/\d{4}/);
      return m ? parseInt(m[0], 10) : 0;
    };
    for (let i = 0; i < expItems.length - 1; i++) {
      const yearCur = getYear(expItems[i].startDate || '');
      const yearNext = getYear(expItems[i+1].startDate || '');
      if (yearCur < yearNext && yearCur > 0 && yearNext > 0) {
        isReverseChronological = false;
      }
    }
  }
  if (isReverseChronological) {
    chronology += 2;
  }

  // 6. Length & Density (10 points)
  let lengthDensity = 0;
  if (wordCount >= 400 && wordCount <= 1000) {
    lengthDensity += 5;
  } else if (wordCount >= 250 && wordCount <= 1200) {
    lengthDensity += 3;
  } else if (wordCount > 0) {
    lengthDensity += 1;
  }

  const stopWords = new Set(['the', 'and', 'a', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'an', 'is', 'was', 'were', 'that', 'as', 'it']);
  const words = fullProfileText.toLowerCase().split(/[^a-zA-Z]+/).filter(w => w.length > 2 && !stopWords.has(w));
  const freqs: { [word: string]: number } = {};
  let isStuffed = false;
  for (const w of words) {
    freqs[w] = (freqs[w] || 0) + 1;
    if (freqs[w] >= 10) {
      isStuffed = true;
    }
  }
  if (!isStuffed) {
    lengthDensity += 5;
  } else {
    lengthDensity += 2;
  }

  // Compute metrics presence
  const metricsPattern = /\d+%|\$\d|#?\d+\s*(users|customers|clients|projects|team|members|people|million|k\b|revenue|growth|increase|decrease|reduction|improvement|savings)/i;
  let totalBullets = 0;
  let metricBullets = 0;
  for (const exp of expItems) {
    for (const achievement of (Array.isArray(exp.achievements) ? exp.achievements : [])) {
      totalBullets++;
      if (metricsPattern.test(achievement)) {
        metricBullets++;
      }
    }
    if (exp.description) {
      totalBullets++;
      if (metricsPattern.test(exp.description)) {
        metricBullets++;
      }
    }
  }

  const isStandardFileName = /^[a-zA-Z]+_[a-zA-Z]+_Resume\.(pdf|docx)$/i.test(fileName);
  const overallScore = Math.round(keywordMatch + sectionHeaders + contactInfo + formatting + chronology + lengthDensity);

  const ruleScores = {
    overallScore,
    keywordMatch,
    sectionHeaders,
    contactInfo,
    formatting,
    chronology,
    lengthDensity,
    skillCount,
    wordCount,
    metricBullets,
    totalBullets,
    isStandardFileName,
    jobTitleMatched,
  };

  // Generate AI-powered feedback, strengths, and summary
  let aiFeedback;
  try {
    aiFeedback = await aiService.generateAtsFeedback(profile, {
      overallScore,
      formatCompatibility: Math.round((formatting / 20) * 100),
      keywordDensity: Math.round((keywordMatch / 35) * 100),
      quantifiableAchievements: totalBullets > 0 ? Math.round((metricBullets / totalBullets) * 100) : 0,
      sectionStructure: Math.round((sectionHeaders / 15) * 100),
      mncCompliance: Math.round(((contactInfo + chronology) / 20) * 100),
    });
  } catch (err) {
    console.error('[Worker ATS] AI feedback generation failed, using fallback:', err);
    aiFeedback = {
      feedback: [
        { type: 'suggestion', title: 'AI feedback unavailable', detail: 'Configure a Gemini API key in Admin panel to get personalized resume tips.' },
      ],
      strengths: skillCount > 5 ? [`${skillCount} technical skills detected`] : ['Resume successfully parsed'],
      summary: 'AI feedback is currently unavailable. Configure an API key to receive personalized optimization tips.',
    };
  }

  return {
    ...ruleScores,
    feedback: aiFeedback.feedback || [],
    strengths: aiFeedback.strengths || [],
    summary: aiFeedback.summary || '',
  };
}

/**
 * Helper to calculate Decision Score out of 100 based on Match Score and Filters
 */
function calculateDecisionScore(matchScore: number, job: any, userFilters: any): number {
  let score = matchScore; // base weight is match score
  
  if (!userFilters) return score;

  // 1. Work type preference check
  if (userFilters.workTypes && userFilters.workTypes.length > 0) {
    if (userFilters.workTypes.includes(job.workType)) {
      score += 5; // matching work preference bonus
    } else {
      score -= 10; // mismatch penalty
    }
  }

  // 2. Minimum salary preference check
  if (userFilters.minSalary && job.salaryMin) {
    if (job.salaryMin >= userFilters.minSalary) {
      score += 5;
    } else {
      score -= 15;
    }
  }

  // Bound score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * 2. Main Job Processing Worker (Job Matches, Tailoring, Cover Letters)
 */
const jobProcessingWorker = new Worker('job-processing', async (job: BullJob) => {
  const { name, data } = job;
  console.log(`[Processing Worker] Executing task "${name}" for job ID: ${data.jobId}`);

  try {
    if (name === 'match-job') {
      const { userId, jobId } = data;

      // 1. Fetch user's latest parsed resume
      const resume = await ResumeModel.findOne({ userId, isAtsCheckOnly: { $ne: true } }).sort({ createdAt: -1 });
      if (!resume || !resume.parsedProfile) {
        throw new Error(`Candidate has no parsed resume profile: ${userId}`);
      }

      // 2. Fetch job details
      const jobDetails = await JobModel.findById(jobId);
      if (!jobDetails) {
        throw new Error(`Job post not found: ${jobId}`);
      }

      // 3. Request Claude Match assessment
      console.log('[Processing Worker] Computing semantic match via Claude...');
      const aiService = await getDynamicAIService();
      const matchResult = await aiService.matchJob(
        resume.parsedProfile,
        jobDetails.title,
        jobDetails.description
      );

      // 4. Load user filters to compute overall Decision Score
      const user = await UserModel.findOne({ clerkId: userId });
      const decisionScore = calculateDecisionScore(
        matchResult.matchScore,
        jobDetails,
        user?.filters
      );

      // 5. Update or save matching record
      await JobMatchModel.findOneAndUpdate(
        { userId, jobId },
        {
          matchScore: matchResult.matchScore,
          recommendation: matchResult.recommendation,
          reasoning: matchResult.reasoning,
          pros: matchResult.pros,
          cons: matchResult.cons,
          missingSkills: matchResult.missingSkills,
          decisionScore,
        },
        { upsert: true, new: true }
      );
      console.log(`[Processing Worker] Match completed for user: ${userId}, Job: ${jobId}. Score: ${matchResult.matchScore}%`);
    }

    else if (name === 'tailor-resume') {
      const { userId, jobId, applicationId } = data;

      // 1. Fetch user resume and job
      const resume = await ResumeModel.findOne({ userId, isAtsCheckOnly: { $ne: true } }).sort({ createdAt: -1 });
      if (!resume || !resume.parsedProfile) {
        throw new Error('Parsed profile not found');
      }

      const jobDetails = await JobModel.findById(jobId);
      if (!jobDetails) {
        throw new Error('Job not found');
      }

      const application = await ApplicationModel.findById(applicationId);
      if (!application) {
        throw new Error('Application record not found');
      }

      console.log('[Processing Worker] Writing specialized cover letter with Claude...');
      const aiService = await getDynamicAIService();
      const coverLetter = await aiService.generateCoverLetter(
        resume.parsedProfile,
        jobDetails.title,
        jobDetails.company,
        jobDetails.description
      );

      // We skip tailoring the resume as per user preference, but we still generate the cover letter
      // 2. Save tailored text content directly inside the Application document in MongoDB
      application.tailoredResumeContent = "Tailored resume generation disabled by user preference.";
      application.tailoredResumeUrl = `db://${applicationId}`;
      application.coverLetterContent = coverLetter;
      application.status = 'Tailored';
      await application.save();

      console.log(`[Processing Worker] Tailoring complete. Application ${applicationId} updated.`);
    }
  } catch (error) {
    console.error(`[Processing Worker] Error executing task "${name}":`, error);
    throw error;
  }
}, { connection });

/**
 * Helper to check if an ExternalBoardJob matches user preferences
 */
function matchesUserPreferences(job: any, user: any): boolean {
  if (!user || !user.filters) return true; // match all if no preferences set
  const { workTypes, countries, targetRoles, targetJobRole } = user.filters;

  // 1. Work type check
  if (workTypes && workTypes.length > 0) {
    let match = false;
    const locLower = (job.location || '').toLowerCase();
    const descLower = (job.shortDescription || '').toLowerCase();
    if (workTypes.includes('Remote') && (locLower.includes('remote') || descLower.includes('remote'))) {
      match = true;
    }
    if (workTypes.includes('Hybrid') && locLower.includes('hybrid')) {
      match = true;
    }
    if (workTypes.includes('Onsite') && !locLower.includes('remote') && !locLower.includes('hybrid')) {
      match = true;
    }
    if (!match) return false;
  }

  // 2. Countries / Locations check
  if (countries && countries.length > 0) {
    const locLower = (job.location || '').toLowerCase();
    const descLower = (job.shortDescription || '').toLowerCase();
    let match = false;
    for (const c of countries) {
      const cLower = c.toLowerCase().trim();
      if (cLower === 'tvm') {
        if (locLower.includes('tvm') || locLower.includes('thiruvananthapuram')) {
          match = true;
          break;
        }
      } else if (locLower.includes(cLower)) {
        match = true;
        break;
      }
    }
    // Remote bypass
    if (workTypes && workTypes.includes('Remote') && (locLower.includes('remote') || descLower.includes('remote'))) {
      match = true;
    }
    if (!match) return false;
  }

  // 3. Roles check
  let rolesFilter: string[] = targetRoles && targetRoles.length > 0
    ? [...targetRoles]
    : (user.filters.targetJobRole ? user.filters.targetJobRole.split(',').map((r: string) => r.trim()).filter(Boolean) : []);

  if (rolesFilter.length > 0) {
    const titleLower = (job.title || '').toLowerCase();
    const descLower = (job.shortDescription || '').toLowerCase();
    let match = false;
    for (const r of rolesFilter) {
      const rLower = r.toLowerCase().trim();
      if (titleLower.includes(rLower) || descLower.includes(rLower)) {
        match = true;
        break;
      }
    }
    if (!match) return false;
  }

  return true;
}

/**
 * 3. Notification Queue Worker (External Board job matches & consolidated digest scheduling)
 */
const notificationWorker = new Worker('notification', async (job: BullJob) => {
  const { name, data } = job;
  console.log(`[Notification Worker] Executing task "${name}"`);

  try {
    if (name === 'external-board-new-job') {
      const { jobId } = data;
      const boardJob = await ExternalBoardJobModel.findById(jobId).exec();
      if (!boardJob) return;

      const users = await UserModel.find({}).exec();
      const matchedUserIds: string[] = [];

      for (const user of users) {
        if (matchesUserPreferences(boardJob, user)) {
          matchedUserIds.push(user.clerkId);
        }
      }

      if (matchedUserIds.length === 0) return;

      // Group into digest via BullMQ
      const { Queue } = require('bullmq');
      const tempQueue = new Queue('notification', { connection });
      await tempQueue.add('queue-for-digest', { jobId: boardJob._id.toString(), userIds: matchedUserIds });
      await tempQueue.close();
      console.log(`[Notification Worker] Discovered match for job ${boardJob.title}. Enqueued digest queue for ${matchedUserIds.length} users.`);
    }

    else if (name === 'queue-for-digest') {
      const { jobId, userIds } = data;
      const digestItems = userIds.map((userId: string) => ({
        userId,
        externalBoardJobId: jobId,
        sent: false,
      }));
      await PendingDigestModel.insertMany(digestItems);
      console.log(`[Notification Worker] Saved ${userIds.length} pending digest items for job ID: ${jobId}`);
    }

    else if (name === 'send-digest-cron') {
      console.log('[Notification Worker] Running 6-hour digest cron...');
      const pendingItems = await PendingDigestModel.find({ sent: false }).exec();
      if (pendingItems.length === 0) {
        console.log('[Notification Worker] No pending digest items. Skipping digest email.');
        return;
      }

      // Group by userId
      const grouped: { [userId: string]: typeof pendingItems } = {};
      for (const item of pendingItems) {
        if (!grouped[item.userId]) grouped[item.userId] = [];
        grouped[item.userId].push(item);
      }

      const emailService = await getDynamicEmailService();
      const whatsappService = await getDynamicWhatsAppService();

      for (const [userId, items] of Object.entries(grouped)) {
        const userObj = await UserModel.findOne({ clerkId: userId }).exec();
        if (!userObj) {
          await PendingDigestModel.updateMany(
            { _id: { $in: items.map((i: any) => i._id) } },
            { sent: true }
          ).exec();
          continue;
        }

        const jobs = await ExternalBoardJobModel.find({
          _id: { $in: items.map((i: any) => i.externalBoardJobId) }
        }).exec();

        if (jobs.length === 0) {
          await PendingDigestModel.updateMany(
            { _id: { $in: items.map((i: any) => i._id) } },
            { sent: true }
          ).exec();
          continue;
        }

        // Send Email Digest
        if (userObj.isEmailVerified && userObj.email) {
          const subject = `${jobs.length} new matching job(s) on External Boards`;
          const emailHtml = `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #fafafa; border-radius: 16px; border: 1px solid #1f1f23;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #c084fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">AI Job Copilot</h1>
                <p style="color: #71717a; font-size: 14px; margin-top: 4px;">Consolidated Matching Digest — External Boards</p>
              </div>
              
              <p style="color: #fafafa; font-size: 15px; font-weight: 500; margin-bottom: 20px;">Hello ${userObj.name || 'Candidate'},</p>
              <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                We found <strong>${jobs.length}</strong> new job match(es) from your passive browsing shared pool matching your career preferences:
              </p>
              
              <div style="margin-bottom: 24px;">
                ${jobs.map((j: any) => `
                  <div style="background: #18181b; border: 1px solid rgba(168, 85, 247, 0.15); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="margin-bottom: 8px;">
                      <span style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; float: right;">${j.sourcePlatform}</span>
                      <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: #ffffff;">${j.title}</h3>
                    </div>
                    <p style="color: #d4d4d8; font-size: 13px; margin: 0 0 4px; font-weight: 500;">${j.company}</p>
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 12px;">📍 ${j.location || 'Location not specified'}</p>
                    ${j.shortDescription ? `<p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin: 0 0 16px; font-style: italic;">"${j.shortDescription}"</p>` : ''}
                    <a href="${j.url}" style="display: inline-block; background: #9333ea; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 16px; border-radius: 8px;">Apply on Official Site →</a>
                  </div>
                `).join('')}
              </div>

              <div style="text-align: center; margin-top: 32px; border-top: 1px solid #1f1f23; padding-top: 24px;">
                <p style="color: #71717a; font-size: 11px;">
                  Open your <a href="${process.env.WEB_URL || 'http://localhost:3000'}/external-boards" style="color: #c084fc; text-decoration: none;">External Boards dashboard</a> to track and confirm applications.
                </p>
              </div>
            </div>
          `;
          await emailService.sendGenericEmail(userObj.email, subject, emailHtml);
        }

        // Send WhatsApp Digest
        if (userObj.isPhoneVerified && userObj.whatsappNotificationsEnabled && userObj.phone) {
          const listText = jobs.map((j: any) => `• ${j.title} at ${j.company} (${j.sourcePlatform})`).join('\n');
          const whatsappMsg = [
            `📋 *AI Job Copilot — Consolidated Digest*`,
            ``,
            `We found ${jobs.length} new job matches in your External Boards shared pool:`,
            ``,
            listText,
            ``,
            `👉 Open your dashboard to view, apply, and confirm applications:`,
            `${process.env.WEB_URL || 'http://localhost:3000'}/external-boards`
          ].join('\n');
          try {
            await whatsappService.sendTextMessage(userObj.phone, whatsappMsg);
          } catch (err) {
            console.error('[Notification Worker] WhatsApp digest failed:', err);
          }
        }

        // Mark items as sent
        await PendingDigestModel.updateMany(
          { _id: { $in: items.map((i: any) => i._id) } },
          { sent: true }
        ).exec();
      }

      console.log('[Notification Worker] Consolidated digests processed and sent.');
    }
  } catch (err) {
    console.error(`[Notification Worker] Job failed:`, err);
    throw err;
  }
}, { connection });

// Startup
async function start() {
  await connectDb();
  console.log('Worker background services are listening for queues...');
}

// --- DUMMY SERVER FOR RENDER FREE TIER ---
// Render Web Services must bind to a PORT within 60 seconds or they fail deployment.
// This allows the worker to be hosted for FREE as a "Web Service".
const app = express();
const port = process.env.PORT || 4000;

app.get('/', (req: any, res: any) => {
  res.send('AI Job Copilot Worker is running!');
});

app.get('/health', (req: any, res: any) => {
  res.status(200).json({ status: 'ok', worker: true });
});

app.listen(port, () => {
  console.log(`[Worker] Dummy web server listening on port ${port} to satisfy Render health checks.`);
});

start();

