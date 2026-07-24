import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemConfig, SystemConfigSchema } from '../schemas/system-config.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Job, JobSchema } from '../schemas/job.schema';
import { ExternalBoardJob, ExternalBoardJobSchema } from '../schemas/external-board-job.schema';
import { PendingConfirmation, PendingConfirmationSchema } from '../schemas/pending-confirmation.schema';
import { PendingDigest, PendingDigestSchema } from '../schemas/pending-digest.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { CrawlLog, CrawlLogSchema } from '../schemas/crawl-log.schema';
import { ApiLog, ApiLogSchema } from '../schemas/api-log.schema';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController, PublicConfigController } from './system-config.controller';
import { AdminDbService } from './admin-db.service';
import { AdminDbController } from './admin-db.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemConfig.name, schema: SystemConfigSchema },
      { name: User.name, schema: UserSchema },
      { name: Job.name, schema: JobSchema },
      { name: ExternalBoardJob.name, schema: ExternalBoardJobSchema },
      { name: PendingConfirmation.name, schema: PendingConfirmationSchema },
      { name: PendingDigest.name, schema: PendingDigestSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: CrawlLog.name, schema: CrawlLogSchema },
      { name: ApiLog.name, schema: ApiLogSchema },
    ]),
    QueueModule,
  ],
  controllers: [SystemConfigController, PublicConfigController, AdminDbController],
  providers: [SystemConfigService, AdminDbService],
  exports: [SystemConfigService, AdminDbService],
})
export class SystemConfigModule {}
