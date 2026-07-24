import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Job } from '../schemas/job.schema';
import { JobMatch } from '../schemas/job-match.schema';
import { User } from '../schemas/user.schema';
import { SystemConfig } from '../schemas/system-config.schema';
import { Resume } from '../schemas/resume.schema';
import { Application } from '../schemas/application.schema';
import { QueueService } from '../queue/queue.service';
import { SystemConfigService } from '../system-config/system-config.service';

interface CompanyConfig {
  name: string;
  ats: 'greenhouse' | 'lever' | 'ashby';
  slug: string;
  website: string;
}

@Injectable()
export class JobService implements OnModuleInit {
  private companiesConfig: CompanyConfig[] = [];

  constructor(
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(JobMatch.name) private matchModel: Model<JobMatch>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(SystemConfig.name) private configModel: Model<SystemConfig>,
    @InjectModel(Resume.name) private resumeModel: Model<Resume>,
    @InjectModel(Application.name) private applicationModel: Model<Application>,
    private queueService: QueueService,
    private configService: SystemConfigService,
  ) {
    this.loadCompaniesConfig();
  }

  onModuleInit() {
    this.queueService.registerGlobalCrawlProcessor(
      async () => this.crawlGlobalJobs(),
      async () => this.validateCompanyConfig(),
    );

    // Startup global crawl disabled in development to prevent CPU/event-loop blocking on local reboots
    // (Database already contains pre-populated jobs; crawls can be triggered manually in the Admin panel if needed)
  }

  /**
   * Load companies.json config file
   */
  private loadCompaniesConfig() {
    try {
      let configPath = path.resolve(__dirname, 'config/companies.json');
      // If not in dist/job/config, check src/job/config
      if (!fs.existsSync(configPath)) {
        configPath = path.resolve(__dirname, '../../src/job/config/companies.json');
      }
      
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        this.companiesConfig = JSON.parse(fileContent);
        console.log(`[JobService] Loaded ${this.companiesConfig.length} direct ATS companies from config.`);
      } else {
        console.warn('[JobService] companies.json config file not found at:', configPath);
      }
    } catch (err) {
      console.error('[JobService] Failed to load companies config:', err);
    }
  }

  /**
   * Update or create a user profile with filters
   */
  async updateFilters(userId: string, email: string, filters: any): Promise<User> {
    let user = await this.userModel.findOne({ clerkId: userId }).exec();
    if (!user) {
      user = new this.userModel({ clerkId: userId, email });
    }
    user.filters = filters;
    const saved = await user.save();

    return saved;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.userModel.findOne({ clerkId: userId }).exec();
  }

  /**
   * Find jobs matching user filters and attach their AI matches if existing.
   * Jobs are scoped globally; filters are applied at query time.
   */
  async getDashboardJobs(userId: string): Promise<any[]> {
    const user = await this.userModel.findOne({ clerkId: userId }).exec();
    
    // If the user hasn't set up any job preferences, do not return random global jobs
    if (!user || !user.filters || (!user.filters.targetJobRole && (!user.filters.targetRoles || user.filters.targetRoles.length === 0))) {
      return [];
    }

    // Build query against the global jobs pool (only active / not closed jobs)
    const query: any = { isClosed: { $ne: true } };

    // Freshness: Only show jobs created or posted in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (user && user.filters) {
      const { workTypes, minSalary, countries, experienceLevel, targetRoles, targetCompanies } = user.filters;
      const andConditions: any[] = [];

      // Exclude jobs the user has already accepted/applied to
      const appliedApps = await this.applicationModel.find({ userId }).select('jobId').exec();
      const appliedJobIds = appliedApps.map(app => app.jobId);
      if (appliedJobIds.length > 0) {
        andConditions.push({ _id: { $nin: appliedJobIds } });
      }

      if (workTypes && workTypes.length > 0) {
        andConditions.push({ workType: { $in: workTypes } });
      }
      
      if (minSalary) {
        andConditions.push({
          $or: [
            { salaryMax: { $gte: minSalary } },
            { salaryMin: { $gte: minSalary } },
            { salaryMin: { $exists: false } },
            { salaryMin: null }
          ]
        });
      }

      if (countries && countries.length > 0) {
        const locationConditions: any[] = countries.map(c => ({
          location: { $regex: new RegExp(this.normalizeQueryLocation(c), 'i') }
        }));

        // Allow Remote jobs to bypass city constraints if Remote preference is active
        if (workTypes && workTypes.includes('Remote')) {
          locationConditions.push({ workType: 'Remote' });
          locationConditions.push({ location: { $regex: /remote/i } });
        }

        andConditions.push({ $or: locationConditions });
      }

      if (targetCompanies && targetCompanies.length > 0) {
        const companyConditions = targetCompanies.filter(Boolean).map(company => ({
          company: { $regex: new RegExp(this.escapeRegex(company.trim()), 'i') }
        }));
        if (companyConditions.length > 0) andConditions.push({ $or: companyConditions });
      }

      if (experienceLevel) {
        let allowedLevels = [experienceLevel];
        let maxAllowedYears = 99;

        if (experienceLevel === 'Fresher') {
          allowedLevels = ['Fresher', 'Junior', 'Intern'];
          maxAllowedYears = 1;
        } else if (experienceLevel === 'Junior') {
          allowedLevels = ['Fresher', 'Junior', 'Intern'];
          maxAllowedYears = 3;
        } else if (experienceLevel === 'Mid') {
          allowedLevels = ['Fresher', 'Junior', 'Intern', 'Mid'];
          maxAllowedYears = 5;
        } else if (experienceLevel === 'Senior') {
          allowedLevels = ['Senior', 'Mid'];
          maxAllowedYears = 99;
        }

        andConditions.push({
          $and: [
            {
              $or: [
                { experienceLevel: { $in: allowedLevels } },
                { experienceLevel: { $exists: false } },
                { experienceLevel: null }
              ]
            },
            {
              $or: [
                { requiredExperienceYears: { $lte: maxAllowedYears } },
                { requiredExperienceYears: { $exists: false } },
                { requiredExperienceYears: null }
              ]
            }
          ]
        });
      }

      // --- Priority 4: Resume skills always contribute alongside target roles ---
      // Collect base roles from preferences
      let rolesFilter: string[] = targetRoles && targetRoles.length > 0
        ? [...targetRoles]
        : (user.filters.targetJobRole ? user.filters.targetJobRole.split(',').map((r: string) => r.trim()).filter(Boolean) : []);

      // Rely solely on explicit user preferences (target roles). 
      // Do not silently pollute search with resume skills, which causes irrelevant jobs to appear.

      // --- Priority 5: Expand each role through a synonym/alias dictionary ---
      const roleAliasMap: Record<string, string[]> = {
        'software engineer': ['swe', 'software developer', 'sde', 'backend engineer', 'backend developer'],
        'frontend developer': ['react developer', 'ui developer', 'front-end engineer', 'frontend engineer', 'ui engineer', 'web developer'],
        'fullstack developer': ['fullstack engineer', 'full stack developer', 'full-stack developer', 'node developer', 'full stack engineer'],
        'backend developer': ['backend engineer', 'server-side developer', 'api developer', 'node developer', 'python developer'],
        'data scientist': ['ml engineer', 'machine learning engineer', 'ai engineer', 'data analyst', 'data engineer'],
        'devops engineer': ['site reliability engineer', 'sre', 'platform engineer', 'infrastructure engineer', 'cloud engineer'],
        'product manager': ['pm', 'product owner', 'program manager'],
        'ui ux designer': ['ux designer', 'ui designer', 'product designer', 'interaction designer', 'visual designer'],
        'mobile developer': ['ios developer', 'android developer', 'react native developer', 'flutter developer'],
      };

      const expandedRoles = new Set<string>(rolesFilter);
      for (const role of rolesFilter) {
        const roleLower = role.toLowerCase().trim();
        for (const [canonical, aliases] of Object.entries(roleAliasMap)) {
          if (roleLower.includes(canonical) || aliases.some(a => roleLower.includes(a))) {
            aliases.forEach(a => expandedRoles.add(a));
            expandedRoles.add(canonical);
          }
        }
      }

      const finalRoles = [...expandedRoles].filter(Boolean);
      if (finalRoles.length > 0) {
        const roleConditions = finalRoles.map(r => ({
          title: { $regex: new RegExp(this.escapeRegex(r.trim()), 'i') }
        }));
        andConditions.push({ $or: roleConditions });
      }

      // Freshness: Only show jobs created or posted in the last 30 days
      andConditions.push({
        $or: [
          { postedDate: { $gte: thirtyDaysAgo } },
          { postedDate: { $exists: false } },
          { postedDate: null },
          { createdAt: { $gte: thirtyDaysAgo } }
        ]
      });

      query.$and = andConditions;
    } else {
      // General freshness filter when no preferences set
      query.$or = [
        { postedDate: { $gte: thirtyDaysAgo } },
        { postedDate: { $exists: false } },
        { postedDate: null },
        { createdAt: { $gte: thirtyDaysAgo } }
      ];
    }

    let jobs = await this.jobModel.find(query).sort({ postedDate: -1, createdAt: -1 }).limit(50).exec();
    
    // Find all match score records for this user
    const matches = await this.matchModel.find({ userId }).exec();
    const matchMap = new Map<string, JobMatch>();
    for (const match of matches) {
      matchMap.set(match.jobId.toString(), match);
    }

    return jobs.map(job => {
      const match = matchMap.get((job.id as string));
      return {
        job,
        match: match ? {
          matchScore: match.matchScore,
          recommendation: match.recommendation,
          reasoning: match.reasoning,
          pros: match.pros,
          cons: match.cons,
          missingSkills: match.missingSkills,
          decisionScore: match.decisionScore
        } : null
      };
    });
  }

  /**
   * Request manual AI matching evaluation for a specific job
   */
  async requestJobMatch(userId: string, jobId: string): Promise<any> {
    const job = await this.jobModel.findById(jobId).exec();
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Trigger AI Match background job
    await this.queueService.addJobMatchJob(userId, jobId);

    return { message: 'AI Job Match evaluation triggered.' };
  }

  /**
   * Create a job (used for manual insertion)
   */
  async createJob(jobData: any): Promise<Job> {
    const job = new this.jobModel(jobData);
    return job.save();
  }

  async getIntegrationStatuses(): Promise<any[]> {
    const adzunaId = await this.configModel.findOne({ key: 'ADZUNA_API_ID' }).exec();
    const adzunaKey = await this.configModel.findOne({ key: 'ADZUNA_API_KEY' }).exec();
    const jsearchKey = await this.configModel.findOne({ key: 'JSEARCH_API_KEY' }).exec();
    const joobleKey = await this.configModel.findOne({ key: 'JOOBLE_API_KEY' }).exec();
    const careerjetKey = await this.configModel.findOne({ key: 'CAREERJET_API_KEY' }).exec();

    return [
      { name: 'Greenhouse', type: 'Direct ATS', active: true, desc: 'Polls Greenhouse public company job boards' },
      { name: 'Lever', type: 'Direct ATS', active: true, desc: 'Polls Lever public company job boards' },
      { name: 'Ashby', type: 'Direct ATS', active: true, desc: 'Polls Ashby public company job boards' },
      { name: 'Workable', type: 'Direct ATS', active: true, desc: 'Polls Workable public company job boards' },
      { name: 'SmartRecruiters', type: 'Direct ATS', active: true, desc: 'Polls SmartRecruiters enterprise job boards' },
      { name: 'Recruitee', type: 'Direct ATS', active: true, desc: 'Polls Recruitee public company job boards' },
      { name: 'Teamtailor', type: 'Direct ATS', active: true, desc: 'Polls Teamtailor public company job boards' },
      { name: 'Rippling', type: 'Direct ATS', active: true, desc: 'Polls Rippling public company job boards' },
      { name: 'Workday', type: 'Direct ATS', active: true, desc: 'Polls Workday public company job boards' },
      { name: 'Adzuna', type: 'Aggregator API', active: !!(adzunaId?.value && adzunaKey?.value), desc: 'API search aggregator matching user cities' },
      { name: 'JSearch', type: 'Aggregator API', active: !!jsearchKey?.value, desc: 'RapidAPI job search engine for keyword search' },
      { name: 'Jooble', type: 'Aggregator API', active: !!joobleKey?.value, desc: 'Jooble job aggregator API search' },
      { name: 'Careerjet', type: 'Aggregator API', active: !!careerjetKey?.value, desc: 'Careerjet global job search aggregator' },
      { name: 'Remote OK', type: 'Remote Feed', active: true, desc: 'Fetches Remote OK public JSON job feeds' },
      { name: 'Jobicy', type: 'Remote Feed', active: true, desc: 'Fetches Jobicy public remote jobs RSS/JSON feeds' },
      { name: 'Remotive', type: 'Remote Feed', active: true, desc: 'Fetches Remotive public API job postings' },
      { name: 'We Work Remotely', type: 'Remote Feed', active: true, desc: 'Fetches WWR public remote job listing feeds' },
      { name: 'Himalayas', type: 'Remote Feed', active: true, desc: 'Fetches Himalayas remote developer jobs feed' }
    ];
  }

  /**
   * Build combinations of target roles and target locations dynamically from user preferences and resume data.
   */
  private async getGlobalCrawlQueries(): Promise<{ role: string; location: string }[]> {
    const users = await this.userModel.find({}, { filters: 1 }).lean().exec();
    const queryPairs = new Map<string, { role: string; location: string }>();

    for (const user of users) {
      const filters = user.filters as any;
      
      const userRoles: string[] = [];
      const filterRoles = filters?.targetRoles || (filters?.targetJobRole ? filters.targetJobRole.split(',') : []);
      for (const r of filterRoles) {
        if (typeof r === 'string' && r.trim()) userRoles.push(r.trim());
      }
      if (userRoles.length === 0) {
        userRoles.push('Software Developer');
      }

      const userLocations: string[] = [];
      for (const l of filters?.countries || []) {
        if (typeof l === 'string' && l.trim()) userLocations.push(l.trim());
      }
      if (userLocations.length === 0) {
        userLocations.push('India');
      }

      for (const role of userRoles) {
        for (const location of userLocations) {
          const key = `${role.toLowerCase()}|${location.toLowerCase()}`;
          queryPairs.set(key, { role, location });
        }
      }
    }

    const list = [...queryPairs.values()];
    if (list.length === 0) {
      list.push({ role: 'Software Developer', location: 'India' });
    }
    return list.slice(0, 30);
  }

  /**
   * Helper to strip HTML tags from string to protect LLM context & index matching
   */
  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private detectSource(url: string, publisherName?: string): string {
    const lowerUrl = (url || '').toLowerCase();
    const lowerPub = (publisherName || '').toLowerCase();

    if (lowerUrl.includes('greenhouse.io') || lowerUrl.includes('boards.greenhouse')) return 'Greenhouse';
    if (lowerUrl.includes('lever.co') || lowerUrl.includes('jobs.lever')) return 'Lever';
    if (lowerUrl.includes('ashbyhq.com')) return 'Ashby';
    if (lowerUrl.includes('rippling.com')) return 'Rippling';
    if (lowerUrl.includes('workday.com') || lowerUrl.includes('myworkday')) return 'Workday';
    if (lowerUrl.includes('linkedin.com')) return 'LinkedIn';
    if (lowerUrl.includes('indeed.com')) return 'Indeed';
    if (lowerUrl.includes('naukri.com')) return 'Naukri';
    if (lowerPub.includes('greenhouse')) return 'Greenhouse';
    if (lowerPub.includes('lever')) return 'Lever';
    if (lowerPub.includes('ashby')) return 'Ashby';
    if (lowerPub.includes('workday')) return 'Workday';
    
    return 'JSearch';
  }

  private detectExperienceLevel(title: string, description: string, seniorityHint?: string, yearsRequired?: number): string {
    // 1. If years required is explicitly set, use it first
    if (yearsRequired !== undefined && yearsRequired !== null) {
      if (yearsRequired <= 1) {
        return title.toLowerCase().includes('intern') ? 'Intern' : 'Junior';
      }
      if (yearsRequired >= 5) {
        return 'Senior';
      }
      return 'Mid';
    }

    // 2. Direct seniority hint
    if (seniorityHint) {
      const hint = seniorityHint.toLowerCase();
      if (hint.includes('intern')) return 'Intern';
      if (hint.includes('entry') || hint.includes('junior') || hint.includes('fresher')) return 'Junior';
      if (hint.includes('mid') || hint.includes('intermediate')) return 'Mid';
      if (hint.includes('senior') || hint.includes('lead') || hint.includes('principal') || hint.includes('staff') || hint.includes('architect') || hint.includes('director')) return 'Senior';
    }

    // 3. Match title keywords strictly
    const titleLower = title.toLowerCase();
    if (titleLower.includes('intern') || titleLower.includes('internship')) return 'Intern';
    if (titleLower.includes('junior') || titleLower.includes('entry level') || titleLower.includes('fresher') || titleLower.includes('associate') || titleLower.includes('trainee')) return 'Junior';
    if (titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff') || titleLower.includes('sr.') || titleLower.includes('director') || titleLower.includes('architect') || titleLower.includes('manager')) return 'Senior';
    if (titleLower.includes('mid') || titleLower.includes('intermediate')) return 'Mid';

    // 4. Description fallback matching using strict patterns to avoid general mentions
    const descLower = description.toLowerCase();
    if (descLower.includes('fresher') || descLower.includes('entry level')) return 'Junior';
    
    // Check if description has "X years of experience" patterns
    const expRegex = /(\d+)\+?\s*(?:-\s*\d+)?\s*years?\s+(?:of\s+)?experience/i;
    const match = descLower.match(expRegex);
    if (match) {
      const years = parseInt(match[1], 10);
      if (years >= 5) return 'Senior';
      if (years >= 2) return 'Mid';
      return 'Junior';
    }

    return 'Mid';
  }

  private detectWorkType(isRemote: boolean | null, workArrangement?: string): 'Remote' | 'Hybrid' | 'Onsite' {
    if (isRemote === true) return 'Remote';
    const wa = (workArrangement || '').toLowerCase();
    if (wa.includes('remote')) return 'Remote';
    if (wa.includes('hybrid')) return 'Hybrid';
    return 'Onsite';
  }

  /**
   * Main search and crawl pipeline:
   * 1. Pull jobs directly from Greenhouse, Lever, and Ashby configs.
   * 2. Search aggregator APIs (JSearch, Adzuna).
   * 3. Normalize all jobs and store in the global pool.
   * 4. Auto-detect closed/expired roles.
   */
  private getCountryForCrawl(location: string): { countryCode: string; countryName: string } {
    const lower = (location || '').toLowerCase();
    if (lower.includes('united states') || lower.includes('us') || lower.includes('usa') || lower.includes('america') || lower.includes('ny') || lower.includes('ca')) {
      return { countryCode: 'us', countryName: 'United States' };
    }
    if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('gb') || lower.includes('london')) {
      return { countryCode: 'gb', countryName: 'United Kingdom' };
    }
    if (lower.includes('canada') || lower.includes('ca')) {
      return { countryCode: 'ca', countryName: 'Canada' };
    }
    if (lower.includes('germany') || lower.includes('de')) {
      return { countryCode: 'de', countryName: 'Germany' };
    }
    return { countryCode: 'in', countryName: 'India' };
  }

  private async checkQuotaAndIncrement(apiName: string, limit: number): Promise<boolean> {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const dbKey = `${apiName}_CALL_COUNT_${todayStr}`;
      let config = await this.configModel.findOne({ key: dbKey }).exec();
      if (!config) {
        config = new this.configModel({ key: dbKey, value: '0', description: `API count check for ${apiName} on ${todayStr}` });
      }
      const current = parseInt(config.value || '0', 10);
      if (current >= limit) {
        console.warn(`[JobService] Persistent quota limit reached for ${apiName}: ${current}/${limit}`);
        await this.configService.logApiCall(apiName, 'REST-API', 'failed', `Quota limit reached: ${current}/${limit}`);
        return false;
      }
      config.value = (current + 1).toString();
      await config.save();
      await this.configService.logApiCall(apiName, 'REST-API', 'success');
      return true;
    } catch (err: any) {
      console.error('[JobService] Failed checking persistent API quota:', err);
      await this.configService.logApiCall(apiName, 'REST-API', 'failed', err.message || String(err));
      return true; // fail open to not crash crawl completely
    }
  }

  async crawlGlobalJobs(): Promise<void> {
    console.log('[JobService] Starting scheduled global crawl.');
    
    // 1. Direct ATS company board polling
    await this.pollAllAts();

    // 2. Aggregator crawl uses the combined preference coverage of all users,
    // while the dashboard remains a read-only personalized database query.
    const combinations = await this.getGlobalCrawlQueries();
    const jsearchKey = await this.configModel.findOne({ key: 'JSEARCH_API_KEY' }).exec();
    const adzunaId = await this.configModel.findOne({ key: 'ADZUNA_API_ID' }).exec();
    const adzunaKey = await this.configModel.findOne({ key: 'ADZUNA_API_KEY' }).exec();

    for (const combo of combinations) {
      await this.crawlSingleRoleLocation(combo.role, combo.location, jsearchKey, adzunaId, adzunaKey);
      await new Promise(r => setTimeout(r, 1000));
    }
  }



  private async crawlSingleRoleLocation(
    role: string,
    location: string,
    jsearchKey: any,
    adzunaId: any,
    adzunaKey: any,
  ): Promise<void> {
    const targetCountry = this.getCountryForCrawl(location);

    // JSearch Aggregator Crawl (paginated, max 2 pages, limit 15 calls/day)
    if (jsearchKey?.value) {
      const crawlStart = new Date();
      let jsearchJobs: any[] = [];
      let crawlStatus = 'success';
      let errorMsg = '';

      try {
        // Step 1: Try exact city query
        for (let page = 1; page <= 2; page++) {
          const quotaOk = await this.checkQuotaAndIncrement('JSEARCH', 15);
          if (!quotaOk) break;

          const query = `${role} in ${location}`;
          const url = `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(query)}&num_pages=1&page=${page}`;
          console.log(`[JobService] Querying JSearch-v2 page ${page} (city: ${location}): "${query}"`);
          try {
            const response = await this.fetchWithTimeout(url, {
              headers: {
                'X-RapidAPI-Key': jsearchKey.value,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
              }
            });
            if (response.ok) {
              const result = await response.json();
              const pageJobs = result.data?.jobs || [];
              if (pageJobs.length === 0) break;
              jsearchJobs = jsearchJobs.concat(pageJobs);
            } else {
              break;
            }
          } catch (err) {
            console.error('[JobService] JSearch city fetch failed:', err);
            break;
          }
        }

        // Step 2: Fall back to country-wide search if exact city returned 0 jobs
        if (jsearchJobs.length === 0) {
          console.log(`[JobService] No JSearch results for "${role}" in city "${location}". Falling back to country "${targetCountry.countryName}"`);
          for (let page = 1; page <= 2; page++) {
            const quotaOk = await this.checkQuotaAndIncrement('JSEARCH', 15);
            if (!quotaOk) break;

            const query = `${role} in ${targetCountry.countryName}`;
            const url = `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(query)}&num_pages=1&page=${page}`;
            console.log(`[JobService] Querying JSearch-v2 page ${page} (country fallback): "${query}"`);
            try {
              const response = await this.fetchWithTimeout(url, {
                headers: {
                  'X-RapidAPI-Key': jsearchKey.value,
                  'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                }
              });
              if (response.ok) {
                const result = await response.json();
                const pageJobs = result.data?.jobs || [];
                if (pageJobs.length === 0) break;
                jsearchJobs = jsearchJobs.concat(pageJobs);
              } else {
                break;
              }
            } catch (err) {
              console.error('[JobService] JSearch country fallback fetch failed:', err);
              break;
            }
          }
        }
      } catch (err: any) {
        crawlStatus = 'failed';
        errorMsg = err.message || String(err);
      } finally {
        const crawlEnd = new Date();
        await this.configService.logCrawlRun(
          'JSearch',
          crawlStart,
          crawlEnd,
          crawlStatus,
          jsearchJobs.length,
          jsearchJobs.length,
          errorMsg || undefined
        );
      }

      // Process all gathered JSearch jobs
      for (const aj of jsearchJobs) {
        const applyUrl = aj.job_apply_link || aj.job_google_link || '';
        const detectedSource = this.detectSource(applyUrl, aj.job_publisher);
        const workType = this.detectWorkType(aj.job_is_remote, aj.work_arrangement);
        const expLevel = this.detectExperienceLevel(aj.job_title || '', aj.job_description || '', aj.seniority_level, aj.required_experience_years);

        let salaryString: string | undefined;
        if (aj.job_min_salary && aj.job_max_salary) {
          const currency = aj.job_salary_period === 'YEAR' ? '$' : '$';
          const period = aj.job_salary_period === 'YEAR' ? '/yr' : `/${(aj.job_salary_period || 'year').toLowerCase()}`;
          salaryString = `${currency}${aj.job_min_salary.toLocaleString()} - ${currency}${aj.job_max_salary.toLocaleString()} ${period}`;
        }

        await this.ingestGlobalJob({
          title: aj.job_title || 'Untitled',
          company: aj.employer_name || 'Company',
          description: aj.job_description || '',
          url: applyUrl,
          source: detectedSource,
          location: aj.job_city && aj.job_country 
            ? `${aj.job_city}, ${aj.job_country}` 
            : (aj.job_location || location),
          workType,
          salaryMin: aj.job_min_salary || undefined,
          salaryMax: aj.job_max_salary || undefined,
          salaryString,
          salaryCurrency: aj.job_salary_period ? 'USD' : undefined,
          salaryPeriod: aj.job_salary_period || undefined,
          companyUrl: aj.employer_website || undefined,
          applyUrl: aj.job_apply_link || undefined,
          companyLogoUrl: aj.employer_logo || undefined,
          requiredSkills: aj.required_technologies || [],
          preferredSkills: aj.preferred_technologies || [],
          experienceLevel: expLevel,
          requiredExperienceYears: aj.required_experience_years || undefined,
          employmentType: aj.job_employment_type || undefined,
          benefits: aj.benefits_extended || aj.job_benefits || [],
          postedDate: aj.job_posted_at_datetime_utc ? new Date(aj.job_posted_at_datetime_utc) : undefined,
        });
      }
    }

    // Adzuna Aggregator Crawl (paginated, max 2 pages, limit 50 calls/day)
    if (adzunaId?.value && adzunaKey?.value) {
      const crawlStart = new Date();
      const countryCode = targetCountry.countryCode;
      let adzunaJobs: any[] = [];
      let crawlStatus = 'success';
      let errorMsg = '';

      try {
        // Step 1: Try exact city query
        for (let page = 1; page <= 2; page++) {
          const quotaOk = await this.checkQuotaAndIncrement('ADZUNA', 50);
          if (!quotaOk) break;

          const queryRoleAndLoc = `${role} ${location}`;
          const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}?app_id=${adzunaId.value}&app_key=${adzunaKey.value}&what=${encodeURIComponent(queryRoleAndLoc)}&results_per_page=20&content-type=application/json`;
          console.log(`[JobService] Querying Adzuna page ${page} (city: ${location}): "${queryRoleAndLoc}" in ${countryCode}`);
          try {
            const response = await this.fetchWithTimeout(url);
            if (response.ok) {
              const result = await response.json();
              const pageJobs = result.results || [];
              if (pageJobs.length === 0) break;
              adzunaJobs = adzunaJobs.concat(pageJobs);
            } else {
              break;
            }
          } catch (err) {
            console.error('[JobService] Adzuna city fetch failed:', err);
            break;
          }
        }

        // Step 2: Fall back to country-wide query if exact city returned 0 jobs
        if (adzunaJobs.length === 0) {
          console.log(`[JobService] No Adzuna results for "${role}" in city "${location}". Falling back to country-wide: "${role}"`);
          for (let page = 1; page <= 2; page++) {
            const quotaOk = await this.checkQuotaAndIncrement('ADZUNA', 50);
            if (!quotaOk) break;

            const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}?app_id=${adzunaId.value}&app_key=${adzunaKey.value}&what=${encodeURIComponent(role)}&results_per_page=20&content-type=application/json`;
            console.log(`[JobService] Querying Adzuna page ${page} (country fallback): "${role}" in ${countryCode}`);
            try {
              const response = await this.fetchWithTimeout(url);
              if (response.ok) {
                const result = await response.json();
                const pageJobs = result.results || [];
                if (pageJobs.length === 0) break;
                adzunaJobs = adzunaJobs.concat(pageJobs);
              } else {
                break;
              }
            } catch (err) {
              console.error('[JobService] Adzuna country fallback fetch failed:', err);
              break;
            }
          }
        }
      } catch (err: any) {
        crawlStatus = 'failed';
        errorMsg = err.message || String(err);
      } finally {
        const crawlEnd = new Date();
        await this.configService.logCrawlRun(
          'Adzuna',
          crawlStart,
          crawlEnd,
          crawlStatus,
          adzunaJobs.length,
          adzunaJobs.length,
          errorMsg || undefined
        );
      }

      // Process all gathered Adzuna jobs
      for (const aj of adzunaJobs) {
        const jobUrl = aj.redirect_url || '';
        const detectedSource = this.detectSource(jobUrl, aj.company?.display_name);
        const isRemote = aj.description?.toLowerCase().includes('remote') || aj.title?.toLowerCase().includes('remote');
        const expLevel = this.detectExperienceLevel(aj.title || '', aj.description || '');

        let salaryString: string | undefined;
        if (aj.salary_min && aj.salary_max) {
          salaryString = `₹${Math.round(aj.salary_min).toLocaleString()} - ₹${Math.round(aj.salary_max).toLocaleString()} /yr`;
        }

        await this.ingestGlobalJob({
          title: aj.title || 'Untitled',
          company: aj.company?.display_name || 'Company',
          description: aj.description || '',
          url: jobUrl,
          source: detectedSource,
          location: aj.location?.display_name || location,
          workType: isRemote ? 'Remote' : 'Onsite',
          salaryMin: aj.salary_min ? Math.round(aj.salary_min) : undefined,
          salaryMax: aj.salary_max ? Math.round(aj.salary_max) : undefined,
          salaryString,
          salaryCurrency: countryCode === 'in' ? 'INR' : 'USD',
          salaryPeriod: 'YEAR',
          companyUrl: undefined,
          applyUrl: jobUrl,
          requiredSkills: this.extractSkillsFromDescription(aj.description || ''),
          experienceLevel: expLevel,
          postedDate: aj.created ? new Date(aj.created) : undefined,
        });
      }
    }
  }

  /**
   * Poll direct Greenhouse, Lever, and Ashby APIs with error isolation & throttling
   */
  async pollAllAts(): Promise<void> {
    console.log('[JobService] Starting direct ATS poll for configured companies.');
    const results = await Promise.allSettled(
      this.companiesConfig.map(company => this.pollCompanyAts(company)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[JobService] Unhandled ATS poll failure for ${this.companiesConfig[index].name}:`, result.reason);
      }
    });
  }

  async validateCompanyConfig(): Promise<void> {
    const failures: Array<{ company: string; ats: string; slug: string; error: string }> = [];
    for (const company of this.companiesConfig) {
      try {
        const jobs = company.ats === 'greenhouse'
          ? await this.fetchGreenhouseJobs(company.slug)
          : company.ats === 'lever'
            ? await this.fetchLeverJobs(company.slug)
            : await this.fetchAshbyJobs(company.slug);
        console.log(`[JobService] ATS validation passed: ${company.name} (${jobs.length} jobs).`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ company: company.name, ats: company.ats, slug: company.slug, error: message });
        console.error(`[JobService] ATS validation failed: ${company.name} (${company.ats}/${company.slug}): ${message}`);
      }
    }
    if (failures.length) {
      console.warn(`[JobService] Weekly ATS validation completed with ${failures.length} failing board(s).`, failures);
    }
  }

  private async pollCompanyAts(company: CompanyConfig): Promise<void> {
    const startTime = new Date();
    const platform = company.ats.charAt(0).toUpperCase() + company.ats.slice(1);
    console.log(`[JobService] Polling ${company.name} (${company.ats})...`);
    const activeUrls: string[] = [];
    let jobsCount = 0;

    try {
      let rawJobs: any[] = [];
      if (company.ats === 'greenhouse') {
        rawJobs = await this.fetchGreenhouseJobs(company.slug);
        for (const rj of rawJobs) {
          const applyUrl = rj.absolute_url || '';
          if (applyUrl) activeUrls.push(applyUrl);

          const isRemote = rj.title?.toLowerCase().includes('remote') || rj.content?.toLowerCase().includes('remote');
          const desc = this.stripHtml(rj.content || '');

          await this.ingestGlobalJob({
            title: rj.title,
            company: company.name,
            description: desc,
            url: applyUrl,
            source: 'Greenhouse',
            location: rj.location?.name || 'Remote',
            workType: isRemote ? 'Remote' : 'Onsite',
            companyUrl: company.website,
            applyUrl: applyUrl,
            experienceLevel: this.detectExperienceLevel(rj.title, desc),
            postedDate: rj.updated_at ? new Date(rj.updated_at) : undefined,
          });
        }
      } else if (company.ats === 'lever') {
        rawJobs = await this.fetchLeverJobs(company.slug);
        for (const rj of rawJobs) {
          const applyUrl = rj.hostedUrl || '';
          if (applyUrl) activeUrls.push(applyUrl);

          const commitment = rj.categories?.commitment?.toLowerCase() || '';
          const isRemote = commitment.includes('remote') || rj.title?.toLowerCase().includes('remote') || rj.description?.toLowerCase().includes('remote');
          const desc = this.stripHtml(rj.description || '') + ' ' + this.stripHtml(rj.lists?.map((l: any) => l.content).join(' ') || '');

          await this.ingestGlobalJob({
            title: rj.title,
            company: company.name,
            description: desc,
            url: applyUrl,
            source: 'Lever',
            location: rj.categories?.location || 'Remote',
            workType: isRemote ? 'Remote' : 'Onsite',
            companyUrl: company.website,
            applyUrl: applyUrl,
            experienceLevel: this.detectExperienceLevel(rj.title, desc),
            postedDate: rj.createdAt ? new Date(rj.createdAt) : undefined,
          });
        }
      } else if (company.ats === 'ashby') {
        rawJobs = await this.fetchAshbyJobs(company.slug);
        for (const rj of rawJobs) {
          const applyUrl = rj.jobUrl || '';
          if (applyUrl) activeUrls.push(applyUrl);

          const isRemote = rj.title?.toLowerCase().includes('remote') || rj.description?.toLowerCase().includes('remote');
          const desc = this.stripHtml(rj.description || '');

          await this.ingestGlobalJob({
            title: rj.title,
            company: company.name,
            description: desc,
            url: applyUrl,
            source: 'Ashby',
            location: rj.location || 'Remote',
            workType: isRemote ? 'Remote' : 'Onsite',
            companyUrl: company.website,
            applyUrl: applyUrl,
            experienceLevel: this.detectExperienceLevel(rj.title, desc),
            postedDate: rj.publishedAt ? new Date(rj.publishedAt) : undefined,
          });
        }
      }

      jobsCount = rawJobs.length;

      // Close out any jobs from this specific company that were NOT in the latest pull
      if (activeUrls.length > 0) {
        const closeRes = await this.jobModel.deleteMany({
          company: company.name,
          source: company.ats.charAt(0).toUpperCase() + company.ats.slice(1),
          url: { $nin: activeUrls }
        }).exec();
        if (closeRes.deletedCount > 0) {
          console.log(`[JobService] Deleted ${closeRes.deletedCount} closed/expired jobs for ${company.name}`);
        }
      }

      await this.configService.logCrawlRun(
        `${platform} - ${company.name}`,
        startTime,
        new Date(),
        'success',
        jobsCount,
        jobsCount
      );
    } catch (err: any) {
      console.error(`[JobService] Direct API poll failed for company "${company.name}":`, err);
      await this.configService.logCrawlRun(
        `${platform} - ${company.name}`,
        startTime,
        new Date(),
        'failed',
        0,
        0,
        err.message || String(err)
      );
    }
  }

  private async fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 15_000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchGreenhouseJobs(slug: string): Promise<any[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();
    return data.jobs || [];
  }

  private async fetchLeverJobs(slug: string, offset = 0, limit = 100): Promise<any[]> {
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json&limit=${limit}&offset=${offset}`;
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();
    let jobs = data || [];
    
    // Lever pagination offset check
    if (jobs.length === limit) {
      const nextJobs = await this.fetchLeverJobs(slug, offset + limit, limit);
      jobs = jobs.concat(nextJobs);
    }
    return jobs;
  }

  private async fetchAshbyJobs(slug: string): Promise<any[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();
    return data.jobs || [];
  }

  private extractSkillsFromDescription(description: string): string[] {
    const skillKeywords = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
      'React', 'Angular', 'Vue', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'FastAPI',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'CI/CD',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQL', 'NoSQL', 'GraphQL',
      'REST', 'API', 'Microservices', 'Agile', 'Scrum', 'DevOps', 'Git',
      'HTML', 'CSS', 'Sass', 'Tailwind', 'Bootstrap',
    ];
    const found: string[] = [];
    const lowerDesc = description.toLowerCase();
    for (const skill of skillKeywords) {
      if (lowerDesc.includes(skill.toLowerCase())) {
        found.push(skill);
      }
    }
    return found.slice(0, 12);
  }

  /**
   * Ingest a normalized job globally.
   * Deduplicates primarily on URL. Uses title + company + location as a secondary fallback.
   */
  async ingestGlobalJob(jobData: any) {
    if (jobData.description) {
      jobData.description = this.stripHtml(jobData.description);
    }
    jobData.location = this.normalizeLocation(jobData.location, jobData.workType);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (jobData.postedDate && jobData.postedDate < thirtyDaysAgo) {
      return; // Skip stale jobs
    }

    // 1. Determine deduplication query (deduplicate strictly on URL to prevent false merges of distinct postings)
    const query = { url: jobData.url };

    // 2. Perform atomic update/upsert to prevent duplicate plain inserts
    await this.jobModel.findOneAndUpdate(
      query,
      { $set: { ...jobData, isClosed: false } },
      { upsert: true, new: true }
    ).exec();
  }

  private normalizeLocation(location: unknown, workType?: string): string {
    if (typeof location === 'string' && location.trim()) return location.trim();
    if (Array.isArray(location)) {
      const values = location.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
      if (values.length) return values.join(', ');
    }
    if (location && typeof location === 'object') {
      const value = location as { name?: unknown; display_name?: unknown; city?: unknown; country?: unknown };
      const named = value.name || value.display_name;
      if (typeof named === 'string' && named.trim()) return named.trim();
      const parts = [value.city, value.country].filter((part): part is string => typeof part === 'string' && Boolean(part.trim()));
      if (parts.length) return parts.join(', ');
    }
    return workType === 'Remote' ? 'Remote' : 'Location not specified';
  }

  private normalizeQueryLocation(loc: string): string {
    const clean = (loc || '').toLowerCase().trim();
    if (!clean) return '';
    
    // Spelling variations / common abbreviations mappings
    if (clean.includes('thiruvananthapuram') || clean.includes('thiruvanthapuram') || clean === 'tvm' || clean === 'trivandrum') {
      return 'Trivandrum|Thiruvananthapuram|Thiruvanthapuram|TVM';
    }
    if (clean === 'kochi' || clean === 'cochin' || clean === 'ernakulam') {
      return 'Kochi|Cochin|Ernakulam';
    }
    if (clean === 'bengaluru' || clean === 'bangalore' || clean === 'blr') {
      return 'Bengaluru|Bangalore';
    }
    return this.escapeRegex(loc.trim());
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
