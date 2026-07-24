import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resume } from '../schemas/resume.schema';
import { Job } from '../schemas/job.schema';
import { ExternalBoardJob } from '../schemas/external-board-job.schema';
import { AIService } from '@ai-copilot/utils';
import { QueueService } from '../queue/queue.service';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class ResumeService {
  constructor(
    @InjectModel(Resume.name) private resumeModel: Model<Resume>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(ExternalBoardJob.name) private externalBoardJobModel: Model<ExternalBoardJob>,
    private queueService: QueueService,
    private configService: SystemConfigService,
  ) {}

  private async getAIService(): Promise<AIService> {
    const geminiKey = await this.configService.get('GEMINI_API_KEY');
    const anthropicKey = await this.configService.get('ANTHROPIC_API_KEY');
    const groqKey = await this.configService.get('GROQ_API_KEY');
    return new AIService({
      geminiApiKey: geminiKey,
      apiKey: anthropicKey,
      groqApiKey: groqKey,
      onApiCall: (service: string, model: string, status: 'success' | 'failed', errMsg?: string) => {
        this.configService.logApiCall(service, model, status, errMsg).catch(err => {
          console.error('[ResumeService] Failed to log API call:', err);
        });
      }
    });
  }

  async uploadAndParse(
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    isAtsCheckOnly = false,
  ): Promise<Resume> {
    // Save initial DB record containing the binary file buffer directly
    const resume = new this.resumeModel({
      userId,
      originalFileName: fileName,
      fileBuffer,
      mimeType,
      isAtsCheckOnly,
    });
    
    // Set a placeholder db:// URL for compatibility
    resume.r2Url = `db://${resume.id}`;
    await resume.save();

    // Enqueue parsing job (the background parser will read directly from this document)
    await this.queueService.addResumeParseJob(
      resume.id as string,
      userId,
      resume.r2Url,
    );

    return resume;
  }

  private getMostRecentMonday(): Date {
    const now = new Date();
    const day = now.getDay(); // 0: Sunday, 1: Monday, ...
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  async getLatestResume(userId: string, isAts: boolean = false): Promise<Resume> {
    const resume = await this.resumeModel
      .findOne({ userId, isAtsCheckOnly: isAts ? true : { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();

    if (!resume) {
      throw new NotFoundException('No resume found for this user');
    }

    // Auto-compute ATS score once if parsing is complete but score is not saved yet
    if (resume.parsedProfile && ((resume as any).atsScore === undefined || (resume as any).atsScore === null || (resume as any).atsScore === 0)) {
      try {
        console.log(`[ATS Auto-Check] Triggering base ATS analysis for resume: ${resume._id}`);
        const analysis = await this.analyzeAts(userId, (resume._id as any).toString());
        (resume as any).atsScore = analysis.overallScore;
        (resume as any).atsAnalysis = analysis;
      } catch (err) {
        console.error('[ATS Auto-Check] Failed to auto-compute ATS score:', err);
      }
    }

    return resume;
  }

  async getDownloadUrl(userId: string, resumeId: string): Promise<string> {
    const resume = await this.resumeModel.findOne({ _id: resumeId, userId }).exec();
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${apiBase}/resume/${resume.id}/download-file`;
  }

  async getResumeById(userId: string, resumeId: string): Promise<Resume> {
    const resume = await this.resumeModel.findOne({ _id: resumeId, userId }).exec();
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    return resume;
  }

  async getResumeFileFromDb(userId: string, resumeId: string): Promise<{ buffer: Buffer; originalFileName: string; mimeType: string }> {
    const resume = await this.resumeModel.findOne({ _id: resumeId, userId }).exec();
    if (!resume || !resume.fileBuffer) {
      throw new NotFoundException('Resume file not found in database');
    }
    return {
      buffer: resume.fileBuffer,
      originalFileName: resume.originalFileName,
      mimeType: resume.mimeType || 'application/octet-stream',
    };
  }

  /**
   * ATS Analysis — deterministic rule-based scoring + AI-generated feedback
   */
  async analyzeAts(userId: string, resumeId: string, targetJobTitle?: string): Promise<any> {
    const resume = await this.resumeModel.findOne({ _id: resumeId, userId }).exec();
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    if (!resume.parsedProfile) {
      throw new NotFoundException('Resume has not been parsed yet. Please wait for parsing to complete.');
    }

    const profile = resume.parsedProfile as any;

    // Build raw text representation from the profile data for checking word count & density
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

    // ═══════════════════════════════════════════════════════
    // DETERMINISTIC RULE-BASED SCORING ENGINE
    // ═══════════════════════════════════════════════════════

    // ── 1. Keyword & Skills Match (35 points) ──
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

    // Normalize user skills using synonym map
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

    // Acronym + Full-form cross-matching check
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
        totalKeywordWeight += 1.5; // 1.5x weight multiplier for skills section
      } else if (inRestOfText) {
        totalKeywordWeight += 1.0; // 1.0x weight for other section mention
      }
    }

    // Target 12 skills section equivalent matches (12 * 1.5 = 18 weight) for maximum points (35)
    let keywordMatch = Math.round((Math.min(totalKeywordWeight, 18) / 18) * 35);

    // Job title exact-phrase matching bonus
    let jobTitleMatched = false;
    if (targetJobTitle && targetJobTitle.trim()) {
      const targetClean = targetJobTitle.toLowerCase().trim();
      // Check summary, experience titles
      const hasTitleInSummary = summaryText.toLowerCase().includes(targetClean);
      const hasTitleInExperience = expItems.some((e: any) => String(e.title || '').toLowerCase().includes(targetClean));
      if (hasTitleInSummary || hasTitleInExperience) {
        jobTitleMatched = true;
        keywordMatch = Math.min(35, keywordMatch + 3); // add +3 bonus points, cap at 35
      }
    }

    // ── 2. Standard Section Headers (15 points) ──
    let sectionHeaders = 0;
    const expCount = expItems.length;
    const eduCount = eduItems.length;
    const skillCount = skillItems.length;
    const hasContact = !!(profile.fullName || profile.email || profile.phone);

    if (expCount > 0) sectionHeaders += 5; // Experience (5 pts)
    if (eduCount > 0) sectionHeaders += 4; // Education (4 pts)
    if (skillCount > 0) sectionHeaders += 3; // Skills (3 pts)
    if (hasContact) sectionHeaders += 3; // Contact info present (3 pts)

    // Deduct points for non-standard/creative headers in raw text (mocked based on summary keywords)
    const creativeHeaderRegex = /\b(my journey|what i bring|about me|creative summary|my mission|why hire me)\b/i;
    if (creativeHeaderRegex.test(summaryText)) {
      sectionHeaders = Math.max(0, sectionHeaders - 2);
    }

    // ── 3. Contact Information Extractability (10 points) ──
    let contactInfo = 0;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneClean = (profile.phone || '').replace(/[^0-9+]/g, '');

    if (profile.email && emailRegex.test(profile.email.trim())) {
      contactInfo += 3; // Email (3 pts)
    }
    if (phoneClean.length >= 7) {
      contactInfo += 3; // Phone (3 pts)
    }
    if (profile.fullName && profile.fullName.trim().split(/\s+/).length >= 2) {
      contactInfo += 4; // Name Detectable at Top (4 pts)
    }

    // ── 4. Formatting & Parseability (20 points) ──
    let formatting = 0;
    
    // Check if tables/columns are likely present (consecutive spaces/vertical bars in experience descriptions)
    const descriptionBlock = expItems.map((e: any) => e.description || '').join(' ');
    const hasTableIndicator = /\||\s{4,}/.test(descriptionBlock);
    if (!hasTableIndicator) {
      formatting += 7; // No tables/columns for core content (7 pts)
    }

    // Scanned image check (very low character count means empty text block)
    const isImagePdf = wordCount < 30;
    if (!isImagePdf) {
      formatting += 5; // No text embedded in images (5 pts)
    }

    // Standard fonts / special characters check (deduct 3 for unusual script fonts symbols)
    const fancyFontRegex = /[\uD835][\uDC00-\uDFFF]/; // math/serif alphanumeric unicode
    const hasFancyFonts = fancyFontRegex.test(fullProfileText);
    const hasExcessiveEmojis = /[\uD800-\uDFFF].*[\uD800-\uDFFF]/.test(fullProfileText);
    if (!hasFancyFonts && !hasExcessiveEmojis) {
      formatting += 3; // Standard fonts, no special chars (3 pts)
    }

    // File type check
    const fileExt = (resume.originalFileName || '').split('.').pop()?.toLowerCase();
    if (fileExt === 'docx' || (fileExt === 'pdf' && !isImagePdf)) {
      formatting += 5; // .docx or clean text-based .pdf (5 pts)
    } else if (fileExt === 'pdf') {
      formatting += 2; // Scanned PDF
    }

    // Bullet point symbol check: flag custom emojis bullets in experience achievements
    let hasEmojiBullets = false;
    for (const exp of expItems) {
      for (const ach of (Array.isArray(exp.achievements) ? exp.achievements : [])) {
        if (/^[\uD800-\uDFFF]/.test(ach.trim()) || /^[^\w\s•\-▪]/.test(ach.trim())) {
          hasEmojiBullets = true;
        }
      }
    }
    if (hasEmojiBullets) {
      formatting = Math.max(0, formatting - 2); // deduct 2 points for non-standard bullets
    }

    // ── 5. Date & Chronology Consistency (10 points) ──
    let chronology = 0;
    
    // Dates formatted MM/YYYY or Month YYYY (regex matches Month Name YYYY or digits format)
    const dateRegex = /^(0[1-9]|1[0-2])\/\d{4}$|^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i;
    let datesConsistent = true;
    for (const exp of expItems) {
      if (exp.startDate && !dateRegex.test(String(exp.startDate).trim())) datesConsistent = false;
      if (exp.endDate && String(exp.endDate).trim().toLowerCase() !== 'present' && !dateRegex.test(String(exp.endDate).trim())) datesConsistent = false;
    }
    if (datesConsistent && expItems.length > 0) {
      chronology += 5; // Employment dates formatted consistently (5 pts)
    } else if (expItems.length > 0) {
      chronology += 2;
    }

    // Gap analysis (unexplained gaps > 6 months)
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
      chronology += 3; // No unexplained gaps > 6 months (3 pts)
    }

    // Reverse chronological order
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
      chronology += 2; // Reverse chronological order maintained (2 pts)
    }

    // ── 6. Length & Density (10 points) ──
    let lengthDensity = 0;
    
    // Word count in range (400-800 words target for mid experience, up to 1000+ for senior)
    if (wordCount >= 400 && wordCount <= 1000) {
      lengthDensity += 5; // Word count within range (5 pts)
    } else if (wordCount >= 250 && wordCount <= 1200) {
      lengthDensity += 3;
    } else if (wordCount > 0) {
      lengthDensity += 1;
    }

    // Keyword stuffing check (any word appearing 10+ times, excluding common stop words)
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
      lengthDensity += 5; // Not keyword-stuffed (5 pts)
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

    // File naming convention pre-check (FirstName_LastName_Resume.pdf)
    const fileName = resume.originalFileName || '';
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

    // ═══════════════════════════════════════════════════════
    // AI FEEDBACK GENERATION (Gemini Flash)
    // ═══════════════════════════════════════════════════════
    let aiFeedback;
    try {
      const aiService = await this.getAIService();
      
      // We pass the structured rules breakdown to Gemini Flash so it generates contextual feedback
      aiFeedback = await aiService.generateAtsFeedback(profile, {
        overallScore,
        formatCompatibility: Math.round((formatting / 20) * 100),
        keywordDensity: Math.round((keywordMatch / 35) * 100),
        quantifiableAchievements: totalBullets > 0 ? Math.round((metricBullets / totalBullets) * 100) : 0,
        sectionStructure: Math.round((sectionHeaders / 15) * 100),
        mncCompliance: Math.round(((contactInfo + chronology) / 20) * 100),
      });
    } catch (err) {
      console.error('[ATS] AI feedback generation failed, using fallback:', err);
      aiFeedback = {
        feedback: [
          { type: 'suggestion', title: 'AI feedback unavailable', detail: 'Configure a Gemini API key in Admin panel to get personalized resume tips.' },
        ],
        strengths: skillCount > 5 ? [`${skillCount} technical skills detected`] : ['Resume successfully parsed'],
        summary: 'AI feedback is currently unavailable. Configure an API key to receive personalized optimization tips.',
      };
    }

    const analysisResult = {
      ...ruleScores,
      feedback: aiFeedback.feedback || [],
      strengths: aiFeedback.strengths || [],
      summary: aiFeedback.summary || '',
    };

    // Save score and analysis results to resume document in MongoDB
    (resume as any).atsScore = overallScore;
    (resume as any).atsAnalysis = analysisResult;
    await resume.save();

    return analysisResult;
  }

  async deleteResume(userId: string, resumeId: string): Promise<any> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      return { success: false };
    }

    const isAts = resume.isAtsCheckOnly === true;

    // Delete all resumes of this category for the user so old uploads don't resurface
    const result = await this.resumeModel.deleteMany({
      userId,
      isAtsCheckOnly: isAts ? true : { $ne: true }
    }).exec();

    return { success: result.deletedCount > 0 };
  }

  async optimizeResume(
    userId: string,
    resumeId: string,
    jobId?: string,
    customJobTitle?: string,
    customJobDescription?: string,
  ): Promise<any> {
    const resume = await this.resumeModel.findOne({ _id: resumeId, userId }).exec();
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    if (!resume.parsedProfile) {
      throw new NotFoundException('Resume parsed profile not available. Please wait for initial parsing.');
    }

    let jobTitle = customJobTitle || '';
    let jobDescription = customJobDescription || '';

    if (jobId) {
      // Check Tier 1-3 jobs first
      const job = await this.jobModel.findById(jobId).exec();
      if (!job) {
        // Try External Board (Tier 4)
        const extJob = await this.externalBoardJobModel.findById(jobId).exec();
        if (extJob) {
          jobTitle = extJob.title;
          jobDescription = extJob.shortDescription || '';
        }
      } else {
        jobTitle = job.title;
        jobDescription = job.description;
      }
    }

    if (!jobTitle.trim() || !jobDescription.trim()) {
      throw new BadRequestException('Job title and job description are required.');
    }

    const aiService = await this.getAIService();
    
    const systemPrompt = `
You are an advanced ATS Optimizer and Resume Personalization expert.
Analyze the candidate's parsed resume JSON and compare it with the job title and description.
Provide feedback in a strict JSON format.

Output format must be ONLY a valid JSON object matching this structure:
{
  "atsScore": 82,
  "keywordGaps": ["docker", "ci/cd"],
  "tailoredAchievements": [
    {
      "original": "Original bullet achievement or project text",
      "suggested": "Optimized bullet achievement using Action verbs and measurable impact",
      "reasoning": "Why this suggestion aligns better with the target job keywords"
    }
  ],
  "tailoredSummary": "A revised 3-sentence professional summary targeted directly for this role",
  "tailoredSkills": ["react", "node", "typescript"]
}

Guidelines:
1. Ensure ATS score represents actual relevance (e.g. low match = low score).
2. For tailored achievements, rewrite 3 to 5 key work achievements from the candidate's history to emphasize relevant technologies and project outcomes matching the job requirements.
`;

    const userMessage = `
JOB TITLE: ${jobTitle}
JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME PROFILE:
${JSON.stringify(resume.parsedProfile)}
`;

    const responseText = await aiService.executeTask('tailoring', systemPrompt, userMessage, true);
    
    try {
      return JSON.parse(responseText);
    } catch (err) {
      console.error('Failed to parse AI optimization response, returning raw text:', responseText);
      return {
        atsScore: 70,
        keywordGaps: [],
        tailoredAchievements: [],
        tailoredSummary: 'Failed to customize profile. Please try again.',
        tailoredSkills: [],
      };
    }
  }
}
