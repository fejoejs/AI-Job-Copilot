import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUserId } from '../auth/get-user.decorator';
import { ApplicationService } from './application.service';

@Controller('application')
@UseGuards(FirebaseAuthGuard)
export class ApplicationController {
  constructor(private readonly appService: ApplicationService) {}

  @Post()
  async createApplication(
    @GetUserId() userId: string,
    @Body('jobId') jobId: string,
  ) {
    return this.appService.createApplication(userId, jobId);
  }

  @Get()
  async getApplications(@GetUserId() userId: string) {
    return this.appService.getApplications(userId);
  }

  @Post(':id/tailor')
  async triggerTailoring(
    @GetUserId() userId: string,
    @Param('id') appId: string,
  ) {
    return this.appService.requestTailoring(userId, appId);
  }

  @Post(':id/apply')
  async triggerApply(
    @GetUserId() userId: string,
    @Param('id') appId: string,
  ) {
    return this.appService.triggerApply(userId, appId);
  }

  @Put(':id/status')
  async updateStatus(
    @GetUserId() userId: string,
    @Param('id') appId: string,
    @Body('status') status: string,
    @Body('notes') notes?: string,
  ) {
    return this.appService.updateStatus(userId, appId, status, notes);
  }

  @Put(':id/cover-letter')
  async updateCoverLetter(
    @GetUserId() userId: string,
    @Param('id') appId: string,
    @Body('coverLetter') coverLetter: string,
  ) {
    return this.appService.updateCoverLetter(userId, appId, coverLetter);
  }

  @Get(':id/download-tailored')
  async downloadTailored(
    @GetUserId() userId: string,
    @Param('id') appId: string,
    @Res() res: Response,
  ) {
    const { content, fileName } = await this.appService.getTailoredResumeFile(userId, appId);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(content);
  }
}
