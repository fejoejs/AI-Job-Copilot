import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { ResumeModule } from './resume/resume.module';
import { JobModule } from './job/job.module';
import { ApplicationModule } from './application/application.module';
import { NotificationModule } from './notification/notification.module';
import { VerificationController } from './auth/verification.controller';
import { SystemConfigModule } from './system-config/system-config.module';
import { UserProfileModule } from './user/user-profile.module';
import { SupportModule } from './support/support.module';
import { ExternalBoardModule } from './external-board/external-board.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_job_copilot'),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    AuthModule,
    QueueModule,
    ResumeModule,
    JobModule,
    ApplicationModule,
    NotificationModule,
    SystemConfigModule,
    UserProfileModule,
    SupportModule,
    ExternalBoardModule,
  ],
  controllers: [AppController, VerificationController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
