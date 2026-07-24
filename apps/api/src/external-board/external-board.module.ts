import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExternalBoardService } from './external-board.service';
import { ExternalBoardController } from './external-board.controller';
import { ExternalBoardJob, ExternalBoardJobSchema } from '../schemas/external-board-job.schema';
import { PendingConfirmation, PendingConfirmationSchema } from '../schemas/pending-confirmation.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExternalBoardJob.name, schema: ExternalBoardJobSchema },
      { name: PendingConfirmation.name, schema: PendingConfirmationSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    QueueModule,
    AuthModule,
  ],
  providers: [ExternalBoardService],
  controllers: [ExternalBoardController],
  exports: [ExternalBoardService],
})
export class ExternalBoardModule {}
