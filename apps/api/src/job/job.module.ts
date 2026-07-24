import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../schemas/job.schema';
import { JobMatch, JobMatchSchema } from '../schemas/job-match.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { SystemConfig, SystemConfigSchema } from '../schemas/system-config.schema';
import { Resume, ResumeSchema } from '../schemas/resume.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: JobMatch.name, schema: JobMatchSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
      { name: Resume.name, schema: ResumeSchema },
      { name: Application.name, schema: ApplicationSchema },
    ]),
    QueueModule,
    AuthModule,
    SystemConfigModule,
  ],
  providers: [JobService],
  controllers: [JobController],
})
export class JobModule {}
