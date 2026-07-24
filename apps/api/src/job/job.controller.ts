import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUserId } from '../auth/get-user.decorator';
import { JobService } from './job.service';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('filters')
  @UseGuards(FirebaseAuthGuard)
  async updateFilters(
    @GetUserId() userId: string,
    @Body() body: { email: string; filters: any },
  ) {
    return this.jobService.updateFilters(userId, body.email, body.filters);
  }

  @Get('dashboard')
  @UseGuards(FirebaseAuthGuard)
  async getDashboard(@GetUserId() userId: string) {
    return this.jobService.getDashboardJobs(userId);
  }

  @Get('integrations')
  @UseGuards(FirebaseAuthGuard)
  async getJobIntegrations() {
    return this.jobService.getIntegrationStatuses();
  }

  @Post(':id/match')
  @UseGuards(FirebaseAuthGuard)
  async triggerMatch(@GetUserId() userId: string, @Param('id') jobId: string) {
    return this.jobService.requestJobMatch(userId, jobId);
  }

}
