import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { SystemConfigService } from './system-config/system-config.service';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: SystemConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('system/features')
  @UseGuards(FirebaseAuthGuard)
  async getFeatures() {
    return {
      ats: true,
      optimizer: true,
    };
  }
}
