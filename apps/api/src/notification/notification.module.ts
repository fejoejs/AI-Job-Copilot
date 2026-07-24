import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Job, JobSchema } from '../schemas/job.schema';
import { OtpVerification, OtpVerificationSchema } from '../schemas/otp-verification.schema';
import { NotificationService } from './notification.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: Job.name, schema: JobSchema },
      { name: OtpVerification.name, schema: OtpVerificationSchema },
    ]),
    QueueModule,
    AuthModule,
    SystemConfigModule,
  ],
  providers: [NotificationService],
  controllers: [WhatsAppWebhookController, ClerkWebhookController],
  exports: [NotificationService],
})
export class NotificationModule {}
