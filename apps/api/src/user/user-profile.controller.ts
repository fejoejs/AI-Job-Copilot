import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUserId } from '../auth/get-user.decorator';
import { UserProfileService } from './user-profile.service';

@Controller('user/profile')
@UseGuards(FirebaseAuthGuard)
export class UserProfileController {
  constructor(private readonly profileService: UserProfileService) {}

  @Get()
  async getProfile(@GetUserId() userId: string, @Req() req: any) {
    return this.profileService.getProfile(userId, req.user?.email);
  }

  @Post()
  async updateProfile(@GetUserId() userId: string, @Body() body: any, @Req() req: any) {
    return this.profileService.updateProfile(userId, body, req.user?.email);
  }
}
