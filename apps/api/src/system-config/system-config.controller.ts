import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SystemConfigService } from './system-config.service';

@Controller('public/config')
export class PublicConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get('features')
  async getFeatures() {
    const ats = await this.configService.get('feature_ats_enabled');
    const optimizer = await this.configService.get('feature_optimizer_enabled');
    return {
      feature_ats_enabled: ats !== 'false',
      feature_optimizer_enabled: optimizer !== 'false',
    };
  }
}

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  // Configuration settings management
  @Get('config')
  async getConfigs() {
    return this.configService.getAllConfigs();
  }

  @Post('config')
  async updateConfig(@Body() body: { key: string; value: string; description?: string }) {
    return this.configService.set(body.key, body.value, body.description);
  }

  // User directory management
  @Get('users')
  async getUsers() {
    return this.configService.getAllUsers();
  }

  @Put('users/:id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: 'user' | 'admin') {
    return this.configService.updateUserRole(id, role);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.configService.deleteUser(id);
  }
}
