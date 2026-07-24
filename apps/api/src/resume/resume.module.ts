import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Resume, ResumeSchema } from '../schemas/resume.schema';
import { Job, JobSchema } from '../schemas/job.schema';
import { ExternalBoardJob, ExternalBoardJobSchema } from '../schemas/external-board-job.schema';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Resume.name, schema: ResumeSchema },
      { name: Job.name, schema: JobSchema },
      { name: ExternalBoardJob.name, schema: ExternalBoardJobSchema },
    ]),
    QueueModule,
    AuthModule,
    SystemConfigModule,
  ],
  providers: [ResumeService],
  controllers: [ResumeController],
})
export class ResumeModule {}
