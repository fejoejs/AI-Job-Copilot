import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminDbService } from './admin-db.service';

@Controller('admin/db')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminDbController {
  constructor(private readonly adminDbService: AdminDbService) {}

  @Get('stats')
  async getStats() {
    return this.adminDbService.getCollectionCounts();
  }

  @Get('storage-stats')
  async getStorageStats() {
    return this.adminDbService.getStorageStats();
  }

  @Post('cleanup/expired-external-jobs')
  async cleanupExpiredExternalJobs() {
    return this.adminDbService.forceExpireExternalBoardJobs();
  }

  @Post('cleanup/stale-confirmations')
  async cleanupStaleConfirmations(@Body('olderThanHours') hours: number = 24) {
    return this.adminDbService.clearStalePendingConfirmations(hours);
  }

  @Post('cleanup/sent-digests')
  async cleanupSentDigests() {
    return this.adminDbService.clearSentDigests();
  }

  @Post('cleanup/closed-jobs')
  async cleanupClosedJobs(@Body('olderThanDays') days: number = 30) {
    return this.adminDbService.clearClosedJobs(days);
  }

  @Post('cleanup/company/:companySlug')
  async purgeCompanyJobs(@Param('companySlug') slug: string) {
    return this.adminDbService.purgeCompanyJobs(slug);
  }

  @Post('cleanup/external-platform/:platform')
  async purgeExternalPlatformJobs(@Param('platform') platform: 'LinkedIn' | 'Indeed' | 'Naukri') {
    return this.adminDbService.purgeBySourcePlatform(platform);
  }

  @Post('cleanup/all-jobs')
  async purgeAllJobs(@Query('source') source: string) {
    return this.adminDbService.purgeAllJobs(source);
  }

  @Get('jobs')
  async browseJobs(
    @Query('search') search: string,
    @Query('source') source: 'tier1-3' | 'external-board',
    @Query('page') page = 1,
  ) {
    return this.adminDbService.browseJobs(search, source, Number(page));
  }

  @Delete('job/:id')
  async deleteOneJob(
    @Param('id') id: string,
    @Query('source') source: 'tier1-3' | 'external-board'
  ) {
    return this.adminDbService.deleteOneJob(id, source);
  }

  @Get('scraper-stats')
  async getScraperStats() {
    return this.adminDbService.getScraperStats();
  }

  @Post('scraper-trigger')
  async triggerScraper() {
    return this.adminDbService.triggerScraper();
  }
}
