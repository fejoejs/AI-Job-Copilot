import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUserId } from '../auth/get-user.decorator';
import { NotificationService } from '../notification/notification.service';

@Controller('auth')
export class VerificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('status')
  @UseGuards(FirebaseAuthGuard)
  async getVerificationStatus(@GetUserId() userId: string, @Req() req: any) {
    return this.notificationService.getVerificationStatus(userId, req.user?.email_verified, req.user?.email);
  }

  // ── Pre-Signup Email OTP (Public) ──────────────────────────

  @Post('signup-send-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signupSendOtp(@Body('email') email: string) {
    return this.notificationService.sendSignupOtp(email);
  }

  @Post('signup-verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signupVerifyOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
  ) {
    return this.notificationService.verifySignupOtp(email, otp);
  }

  // ── Email OTP ──────────────────────────────────────────────

  @Post('send-email-otp')
  @UseGuards(FirebaseAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendEmailOtp(
    @GetUserId() userId: string,
    @Body('email') email?: string,
  ) {
    return this.notificationService.sendEmailOtp(userId, email);
  }

  @Post('verify-email-otp')
  @UseGuards(FirebaseAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyEmailOtp(
    @GetUserId() userId: string,
    @Req() req: any,
    @Body('otp') otp: string,
  ) {
    return this.notificationService.verifyEmailOtp(userId, otp, req.user?.email);
  }

  // ── WhatsApp OTP ───────────────────────────────────────────

  @Post('send-whatsapp-otp')
  @UseGuards(FirebaseAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendWhatsAppOtp(
    @GetUserId() userId: string,
    @Body('phone') phone: string,
  ) {
    return this.notificationService.sendWhatsAppOtp(userId, phone);
  }

  @Post('verify-whatsapp-otp')
  @UseGuards(FirebaseAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyWhatsAppOtp(
    @GetUserId() userId: string,
    @Body('otp') otp: string,
  ) {
    return this.notificationService.verifyWhatsAppOtp(userId, otp);
  }
}
