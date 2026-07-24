import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExternalBoardJob } from '../schemas/external-board-job.schema';
import { PendingConfirmation } from '../schemas/pending-confirmation.schema';
import { Application } from '../schemas/application.schema';
import { User } from '../schemas/user.schema';
import { QueueService } from '../queue/queue.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

@Injectable()
export class ExternalBoardService {
  private readonly EXPIRY_WINDOW_DAYS = 20;

  constructor(
    @InjectModel(ExternalBoardJob.name) private externalBoardJobModel: Model<ExternalBoardJob>,
    @InjectModel(PendingConfirmation.name) private pendingConfirmationModel: Model<PendingConfirmation>,
    @InjectModel(Application.name) private applicationModel: Model<Application>,
    @InjectModel(User.name) private userModel: Model<User>,
    private queueService: QueueService,
  ) {}

  async getExtensionToken(userId: string): Promise<string> {
    const jwtSecret = process.env.EXTENSION_JWT_SECRET || process.env.CLERK_SECRET_KEY || 'default-insecure-extension-secret-key-12345';
    return jwt.sign({ userId }, jwtSecret, { expiresIn: '180d' });
  }

  async saveOrRefresh(discoveredByUserId: string, dto: any): Promise<ExternalBoardJob | null> {
    const dedupKey = this.extractDedupKey(dto.url);
    const now = new Date();
    
    // Validate explicit expiry date if provided by the extension
    if (dto.expiresAt) {
      const explicitExpiry = new Date(dto.expiresAt);
      if (explicitExpiry < now) {
        console.log(`[ExternalBoardService] Skipping expired job from extension: ${dto.title}`);
        return null;
      }
    }

    const newExpiry = dto.expiresAt ? new Date(dto.expiresAt) : new Date(now.getTime() + this.EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const existing = await this.externalBoardJobModel.findOne({ dedupKey });

    if (existing) {
      existing.lastSeenAt = now;
      existing.expiresAt = newExpiry;
      return existing.save();
    }

    const job = await this.externalBoardJobModel.create({
      title: dto.title,
      company: dto.company,
      location: dto.location,
      salary: dto.salary,
      shortDescription: this.formatShortDescription(dto.description || dto.shortDescription),
      url: dto.url,
      sourcePlatform: dto.sourcePlatform,
      dedupKey,
      discoveredByUserId,
      firstSeenAt: now,
      lastSeenAt: now,
      expiresAt: newExpiry,
    });

    // Notify users about the new external board job matching their criteria asynchronously
    // Check if we can push to QueueService. Note: we will add notificationQueue support to QueueService.
    if ((this.queueService as any).addExternalBoardNewJob) {
      await (this.queueService as any).addExternalBoardNewJob(job._id.toString());
    } else {
      console.warn('[ExternalBoardService] QueueService.addExternalBoardNewJob is not registered yet.');
    }

    return job;
  }

  async getFilteredJobs(userId: string): Promise<ExternalBoardJob[]> {
    const user = await this.userModel.findOne({ clerkId: userId }).exec();
    
    // If the user hasn't set up any job preferences, do not return random global jobs
    if (!user || !user.filters || (!user.filters.targetJobRole && (!user.filters.targetRoles || user.filters.targetRoles.length === 0))) {
      return [];
    }

    const andConditions = this.buildPersonalizationConditions(user);

    // Exclude jobs this specific user has already confirmed as applied
    const appliedJobIds = await this.applicationModel
      .find({ userId, source: 'external-board' })
      .distinct('externalBoardJobId')
      .exec();

    const query: any = {};
    const conditions: any[] = [];

    // Filter out expired jobs so they don't show up on the frontend
    conditions.push({
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (appliedJobIds.length > 0) {
      conditions.push({ _id: { $nin: appliedJobIds } });
    }

    if (andConditions.length > 0) {
      conditions.push(...andConditions);
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    return this.externalBoardJobModel
      .find(query)
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .exec();
  }

  async markPending(userId: string, jobId: string): Promise<{ success: boolean }> {
    await this.pendingConfirmationModel.findOneAndUpdate(
      { userId, externalBoardJobId: jobId },
      { userId, externalBoardJobId: jobId, markedAt: new Date() },
      { upsert: true }
    ).exec();
    return { success: true };
  }

  async confirmApplied(userId: string, jobId: string): Promise<{ success: boolean; note?: string }> {
    const job = await this.externalBoardJobModel.findById(jobId).exec();
    if (!job) {
      await this.pendingConfirmationModel.deleteOne({ userId, externalBoardJobId: jobId }).exec();
      return { success: true, note: 'Job no longer in pool, application not linked to a listing.' };
    }

    const alreadyApplied = await this.applicationModel.findOne({
      userId,
      externalBoardJobId: job._id.toString(),
      source: 'external-board',
    }).exec();

    if (!alreadyApplied) {
      // Snapshot details into Application record to remain independent of TTL expiry deletion
      await this.applicationModel.create({
        userId,
        externalBoardJobId: job._id.toString(),
        jobTitle: job.title,
        company: job.company,
        location: job.location || '',
        sourcePlatform: job.sourcePlatform,
        url: job.url,
        source: 'external-board',
        status: 'Applied',
        appliedDate: new Date(),
      });
    }

    await this.pendingConfirmationModel.deleteOne({ userId, externalBoardJobId: jobId }).exec();
    return { success: true };
  }

  async clearPending(userId: string, jobId: string): Promise<{ success: boolean }> {
    await this.pendingConfirmationModel.deleteOne({ userId, externalBoardJobId: jobId }).exec();
    return { success: true };
  }

  extractDedupKey(url: string): string {
    const linkedinMatch = url.match(/jobs\/view\/(\d+)/);
    if (linkedinMatch) return `linkedin-${linkedinMatch[1]}`;

    const naukriMatch = url.match(/job-listings-[\w-]+-(\d+)/);
    if (naukriMatch) return `naukri-${naukriMatch[1]}`;

    const indeedMatch = url.match(/jk=([a-f0-9]+)/);
    if (indeedMatch) return `indeed-${indeedMatch[1]}`;

    return crypto.createHash('md5').update(url).digest('hex');
  }

  formatShortDescription(rawText: string | undefined): string {
    if (!rawText) return '';
    const clean = rawText.replace(/\s+/g, ' ').trim();
    return clean.length > 180 ? clean.slice(0, 180) + '...' : clean;
  }

  private buildPersonalizationConditions(user: any): any[] {
    if (!user || !user.filters) return [];
    const { workTypes, minSalary, countries, targetRoles, targetCompanies } = user.filters;
    const andConditions: any[] = [];

    // Work type matching (simulated matching against location/description)
    if (workTypes && workTypes.length > 0 && workTypes.length < 3) {
      const hasRemote = workTypes.includes('Remote');
      const hasHybrid = workTypes.includes('Hybrid');
      const hasOnsite = workTypes.includes('Onsite');

      if (hasRemote && !hasHybrid && !hasOnsite) {
        andConditions.push({
          $or: [
            { location: { $regex: /remote/i } },
            { shortDescription: { $regex: /remote/i } }
          ]
        });
      } else if (!hasRemote && hasHybrid && !hasOnsite) {
        andConditions.push({ location: { $regex: /hybrid/i } });
      } else if (!hasRemote && !hasHybrid && hasOnsite) {
        andConditions.push({ location: { $not: /remote|hybrid/i } });
      } else if (hasRemote && hasHybrid && !hasOnsite) {
        andConditions.push({
          $or: [
            { location: { $regex: /remote|hybrid/i } },
            { shortDescription: { $regex: /remote/i } }
          ]
        });
      } else if (hasRemote && !hasHybrid && hasOnsite) {
        andConditions.push({
          $or: [
            { location: { $not: /hybrid/i } },
            { shortDescription: { $regex: /remote/i } }
          ]
        });
      } else if (!hasRemote && hasHybrid && hasOnsite) {
        andConditions.push({ location: { $not: /remote/i } });
      }
    }

    // Country/Location constraints
    if (countries && countries.length > 0) {
      const locationConditions = countries.map((c: string) => ({
        location: { $regex: new RegExp(this.normalizeQueryLocation(c), 'i') }
      }));
      if (workTypes && workTypes.includes('Remote')) {
        locationConditions.push({ location: { $regex: /remote/i } });
      }
      andConditions.push({ $or: locationConditions });
    }

    // Target Companies constraints
    if (targetCompanies && targetCompanies.length > 0) {
      const companyConditions = targetCompanies.filter(Boolean).map((company: string) => ({
        company: { $regex: new RegExp(this.escapeRegex(company.trim()), 'i') }
      }));
      if (companyConditions.length > 0) {
        andConditions.push({ $or: companyConditions });
      }
    }

    // Target Roles/Job Titles matching
    let rolesFilter: string[] = targetRoles && targetRoles.length > 0
      ? [...targetRoles]
      : (user.filters.targetJobRole ? user.filters.targetJobRole.split(',').map((r: string) => r.trim()).filter(Boolean) : []);

    const finalRoles = [...new Set(rolesFilter)].filter(Boolean);
    if (finalRoles.length > 0) {
      const roleConditions = finalRoles.map((r: string) => ({
        $or: [
          { title: { $regex: new RegExp(this.escapeRegex(r.trim()), 'i') } },
          { shortDescription: { $regex: new RegExp(this.escapeRegex(r.trim()), 'i') } }
        ]
      }));
      andConditions.push({ $or: roleConditions });
    }

    return andConditions;
  }

  private normalizeQueryLocation(loc: string): string {
    const l = loc.toLowerCase().trim();
    if (l === 'tvm') return 'thiruvananthapuram|tvm';
    return this.escapeRegex(loc);
  }

  private escapeRegex(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }
}
