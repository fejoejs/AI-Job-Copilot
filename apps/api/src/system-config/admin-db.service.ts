import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { ExternalBoardJob } from '../schemas/external-board-job.schema';
import { PendingConfirmation } from '../schemas/pending-confirmation.schema';
import { PendingDigest } from '../schemas/pending-digest.schema';
import { Job } from '../schemas/job.schema';
import { Application } from '../schemas/application.schema';
import { CrawlLog } from '../schemas/crawl-log.schema';
import { ApiLog } from '../schemas/api-log.schema';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class AdminDbService {
  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(ExternalBoardJob.name) private externalBoardJobModel: Model<ExternalBoardJob>,
    @InjectModel(PendingConfirmation.name) private pendingConfirmationModel: Model<PendingConfirmation>,
    @InjectModel(PendingDigest.name) private pendingDigestModel: Model<PendingDigest>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(Application.name) private applicationModel: Model<Application>,
    @InjectModel(CrawlLog.name) private crawlLogModel: Model<CrawlLog>,
    @InjectModel(ApiLog.name) private apiLogModel: Model<ApiLog>,
    private queueService: QueueService,
  ) {}

  // --- Document counts ---
  async getCollectionCounts() {
    const [
      externalBoardJobs,
      pendingConfirmations,
      pendingDigests,
      jobs,
      applications,
      closedJobs,
      expiredExternalJobs
    ] = await Promise.all([
      this.externalBoardJobModel.countDocuments(),
      this.pendingConfirmationModel.countDocuments(),
      this.pendingDigestModel.countDocuments(),
      this.jobModel.countDocuments(),
      this.applicationModel.countDocuments(),
      this.jobModel.countDocuments({ isClosed: true }),
      this.externalBoardJobModel.countDocuments({ expiresAt: { $lt: new Date() } }),
    ]);

    return {
      externalBoardJobs,
      pendingConfirmations,
      pendingDigests,
      tier1to3Jobs: jobs,
      applications, // shown as read-only info, never exposed with a delete action
      closedTier1to3Jobs: closedJobs,
      alreadyExpiredExternalJobs: expiredExternalJobs,
    };
  }

  // --- Real storage size per collection ---
  async getStorageStats() {
    const db = this.connection.db!;

    const collectionNames = [
      { key: 'externalBoardJobs', name: 'externalboardjobs' },
      { key: 'pendingConfirmations', name: 'pendingconfirmations' },
      { key: 'pendingDigests', name: 'pendingdigests' },
      { key: 'tier1to3Jobs', name: 'jobs' },
      { key: 'applications', name: 'applications' },
    ];

    const perCollection = await Promise.all(
      collectionNames.map(async ({ key, name }) => {
        try {
          const stat = await db.command({ collStats: name });
          return {
            key,
            collection: name,
            documentCount: stat.count,
            storageSizeMB: +(stat.storageSize / (1024 * 1024)).toFixed(2),
            dataSizeMB: +(stat.size / (1024 * 1024)).toFixed(2),
            avgDocSizeKB: +(stat.avgObjSize / 1024).toFixed(2),
            indexSizeMB: +(stat.totalIndexSize / (1024 * 1024)).toFixed(2),
          };
        } catch {
          // Collection may not exist yet - skip gracefully
          return { key, collection: name, documentCount: 0, storageSizeMB: 0, dataSizeMB: 0, avgDocSizeKB: 0, indexSizeMB: 0 };
        }
      })
    );

    const dbStats = await db.command({ dbStats: 1 });

    return {
      collections: perCollection,
      totalDataSizeMB: +(dbStats.dataSize / (1024 * 1024)).toFixed(2),
      totalStorageSizeMB: +(dbStats.storageSize / (1024 * 1024)).toFixed(2),
      totalIndexSizeMB: +(dbStats.indexSize / (1024 * 1024)).toFixed(2),
    };
  }

  // --- Bulk cleanup ---
  async forceExpireExternalBoardJobs() {
    const result = await this.externalBoardJobModel.deleteMany({ expiresAt: { $lt: new Date() } });
    return { deletedCount: result.deletedCount };
  }

  async clearStalePendingConfirmations(olderThanHours: number) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await this.pendingConfirmationModel.deleteMany({ createdAt: { $lt: cutoff } });
    return { deletedCount: result.deletedCount };
  }

  async clearSentDigests() {
    const result = await this.pendingDigestModel.deleteMany({ sent: true });
    return { deletedCount: result.deletedCount };
  }

  async clearClosedJobs(olderThanDays: number) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.jobModel.deleteMany({ isClosed: true, updatedAt: { $lt: cutoff } });
    return { deletedCount: result.deletedCount };
  }

  async purgeCompanyJobs(companySlug: string) {
    const result = await this.jobModel.deleteMany({ companySlug });
    return { deletedCount: result.deletedCount };
  }

  // --- Purge Tier 4 by platform ---
  async purgeBySourcePlatform(platform: 'LinkedIn' | 'Indeed' | 'Naukri') {
    const result = await this.externalBoardJobModel.deleteMany({ sourcePlatform: platform });
    return { deletedCount: result.deletedCount };
  }

  // --- Wipe all jobs across both tables ---
  async purgeAllJobs(source?: string) {
    if (source === 'tier1-3') {
      const result = await this.jobModel.deleteMany({});
      return { deletedCount: result.deletedCount || 0 };
    } else if (source === 'external-board') {
      const result = await this.externalBoardJobModel.deleteMany({});
      return { deletedCount: result.deletedCount || 0 };
    } else {
      const [result, extResult] = await Promise.all([
        this.jobModel.deleteMany({}),
        this.externalBoardJobModel.deleteMany({})
      ]);
      return { deletedCount: (result.deletedCount || 0) + (extResult.deletedCount || 0) };
    }
  }

  // --- Browse & individual delete ---
  async browseJobs(search: string, source: 'tier1-3' | 'external-board', page: number) {
    const model = (source === 'external-board' ? this.externalBoardJobModel : this.jobModel) as Model<any>;
    const query = search
      ? { $or: [{ title: { $regex: search, $options: 'i' } }, { company: { $regex: search, $options: 'i' } }] }
      : {};

    const pageSize = 25;
    const [results, total] = await Promise.all([
      model.find(query).skip((page - 1) * pageSize).limit(pageSize).sort({ createdAt: -1 }).exec(),
      model.countDocuments(query),
    ]);

    return { results, total, page, pageSize };
  }

  async deleteOneJob(id: string, source: 'tier1-3' | 'external-board') {
    const model = (source === 'external-board' ? this.externalBoardJobModel : this.jobModel) as Model<any>;
    await model.findByIdAndDelete(id);
    return { success: true };
  }

  async getScraperStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [logs, apiCalls, totalSavedJobs] = await Promise.all([
      this.crawlLogModel.find().sort({ startTime: -1 }).limit(30).exec(),
      this.apiLogModel.find({ timestamp: { $gte: todayStart } }).exec(),
      this.jobModel.countDocuments(),
    ]);

    const apiStatsMap: { [service: string]: { success: number; failed: number } } = {
      JSEARCH: { success: 0, failed: 0 },
      ADZUNA: { success: 0, failed: 0 },
      Gemini: { success: 0, failed: 0 },
      Anthropic: { success: 0, failed: 0 },
      Groq: { success: 0, failed: 0 },
    };

    for (const log of apiCalls) {
      const srv = log.service.toUpperCase();
      let targetKey = log.service;
      if (srv === 'JSEARCH') targetKey = 'JSEARCH';
      else if (srv === 'ADZUNA') targetKey = 'ADZUNA';
      else if (srv.includes('GEMINI')) targetKey = 'Gemini';
      else if (srv.includes('CLAUDE') || srv.includes('ANTHROPIC')) targetKey = 'Anthropic';
      else if (srv.includes('GROQ')) targetKey = 'Groq';

      if (!apiStatsMap[targetKey]) {
        apiStatsMap[targetKey] = { success: 0, failed: 0 };
      }
      if (log.status === 'success') {
        apiStatsMap[targetKey].success++;
      } else {
        apiStatsMap[targetKey].failed++;
      }
    }

    return {
      crawlLogs: logs,
      apiStats: apiStatsMap,
      totalSavedJobs,
    };
  }

  async triggerScraper() {
    await this.queueService.addGlobalCrawlJob();
    return { success: true, message: 'Scraper background run triggered successfully.' };
  }
}
