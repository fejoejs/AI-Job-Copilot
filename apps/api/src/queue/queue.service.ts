import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private resumeQueue: Queue;
  private jobProcessingQueue: Queue;
  private globalCrawlQueue: Queue;
  private notificationQueue: Queue;
  private globalCrawlWorker?: Worker;
  private connection: any;

  async onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const tls = process.env.REDIS_TLS === 'true' ? {} : undefined;
    
    this.connection = { host, port, password, tls };

    this.resumeQueue = new Queue('resume-parse', {
      connection: this.connection,
    });

    this.jobProcessingQueue = new Queue('job-processing', {
      connection: this.connection,
    });

    this.globalCrawlQueue = new Queue('global-crawl', {
      connection: this.connection,
    });

    this.notificationQueue = new Queue('notification', {
      connection: this.connection,
    });

    // One global crawl at 07:00, 12:00, and 16:00 IST (which is 01:30, 06:30, 10:30 UTC)
    // It is not tied to any user request or dashboard visit.
    await this.globalCrawlQueue.upsertJobScheduler(
      'global-crawl-three-times-daily',
      { pattern: '30 1,6,10 * * *' },
      { name: 'crawl-jobs', data: {} },
    );
    await this.globalCrawlQueue.upsertJobScheduler(
      'ats-config-weekly-validation',
      { pattern: '0 9 * * 1' },
      { name: 'validate-ats-config', data: {} },
    );

    // Repeatable digest delivery scheduled for every 6 hours (12am, 6am, 12pm, 6pm)
    await this.notificationQueue.upsertJobScheduler(
      'send-digest-cron-six-hours',
      { pattern: '0 */6 * * *' },
      { name: 'send-digest-cron', data: {} }
    );
  }

  async addResumeParseJob(resumeId: string, userId: string, fileKey: string) {
    return this.resumeQueue.add('parse-resume', { resumeId, userId, fileKey });
  }

  async addJobMatchJob(userId: string, jobId: string) {
    return this.jobProcessingQueue.add('match-job', { userId, jobId });
  }

  async addResumeTailorJob(userId: string, jobId: string, applicationId: string) {
    return this.jobProcessingQueue.add('tailor-resume', { userId, jobId, applicationId });
  }

  async addGlobalCrawlJob() {
    return this.globalCrawlQueue.add('crawl-jobs', {});
  }

  async addExternalBoardNewJob(jobId: string) {
    return this.notificationQueue.add('external-board-new-job', { jobId });
  }

  async addQueueForDigest(jobId: string, userIds: string[]) {
    return this.notificationQueue.add('queue-for-digest', { jobId, userIds });
  }

  registerGlobalCrawlProcessor(
    processor: () => Promise<void>,
    validator: () => Promise<void>,
  ): void {
    if (this.globalCrawlWorker) return;
    this.globalCrawlWorker = new Worker(
      'global-crawl',
      async (job: Job) => {
        if (job.name === 'crawl-jobs') await processor();
        if (job.name === 'validate-ats-config') await validator();
      },
      { connection: this.connection },
    );
    this.globalCrawlWorker.on('failed', (job, error) => {
      console.error(`[QueueService] Global crawl job ${job?.id ?? 'unknown'} failed:`, error);
    });
  }

  async onModuleDestroy() {
    await this.globalCrawlWorker?.close();
    await this.globalCrawlQueue?.close();
    await this.resumeQueue?.close();
    await this.jobProcessingQueue?.close();
    await this.notificationQueue?.close();
  }
}
