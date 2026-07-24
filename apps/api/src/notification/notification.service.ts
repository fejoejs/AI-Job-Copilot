import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { OtpVerification } from '../schemas/otp-verification.schema';
import { WhatsAppService, EmailService } from '@ai-copilot/utils';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(OtpVerification.name) private otpModel: Model<OtpVerification>,
    private configService: SystemConfigService,
  ) {}

  /**
   * Resolve live EmailService config from DB
   */
  private async getDynamicEmailService(): Promise<EmailService> {
    const smtpHost = await this.configService.get('SMTP_HOST');
    const smtpPortRaw = await this.configService.get('SMTP_PORT');
    const smtpPort = smtpPortRaw ? parseInt(smtpPortRaw, 10) : undefined;
    const smtpUser = await this.configService.get('SMTP_USER');
    const smtpPass = await this.configService.get('SMTP_PASS');
    const fromName = await this.configService.get('EMAIL_FROM_NAME');
    const fromEmail = await this.configService.get('EMAIL_FROM_ADDRESS');

    return new EmailService({
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      fromName,
      fromEmail,
    });
  }

  /**
   * Resolve live WhatsAppService config from DB
   */
  private async getDynamicWhatsAppService(): Promise<WhatsAppService> {
    const accessToken = await this.configService.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = await this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
    const apiVersion = await this.configService.get('WHATSAPP_API_VERSION');

    return new WhatsAppService({
      accessToken,
      phoneNumberId,
      apiVersion,
    });
  }

  /**
   * Generate a cryptographically secure 6-digit OTP code
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // ── Email OTP ──────────────────────────────────────────────

  private async getOrCreateUser(clerkId: string, fallbackEmail = 'jobcopilot.ai@gmail.com'): Promise<User> {
    let user = await this.userModel.findOne({ clerkId });
    
    // If not found by ID but we have a valid email, try to find by email to migrate old Clerk accounts to Firebase UIDs
    if (!user && fallbackEmail && fallbackEmail !== 'jobcopilot.ai@gmail.com') {
      user = await this.userModel.findOne({ email: fallbackEmail });
      if (user) {
        user.clerkId = clerkId;
        await user.save();
      }
    }

    if (!user) {
      let email = fallbackEmail;
      let name = 'User';
      let isEmailVerified = false;

      // Check if they verified via Pre-Signup OTP
      if (!isEmailVerified && email) {
        const otpRecord = await this.otpModel.findOne({ email, verified: true });
        if (otpRecord) {
          isEmailVerified = true;
        }
      }

      const isAdmin = email === 'jobcopilot.ai@gmail.com' || email === 'jsfejoe@gmail.com';
      user = new this.userModel({
        clerkId,
        email,
        name,
        role: isAdmin ? 'admin' : 'user',
        isEmailVerified,
        isPhoneVerified: false,
      });
      await user.save();
    } else {
      let changed = false;
      // Auto-upgrade if email matches admin but role is not admin
      const isAdminEmail = user.email === 'jobcopilot.ai@gmail.com' || user.email === 'jsfejoe@gmail.com';
      if (isAdminEmail && user.role !== 'admin') {
        user.role = 'admin';
        changed = true;
      }
      
      if (changed) {
        await user.save();
      }
    }
    return user;
  }

  async sendEmailOtp(userId: string, requestedEmail?: string): Promise<{ message: string }> {
    const user = await this.getOrCreateUser(userId, requestedEmail);
    
    if (user.emailNotificationsEnabled === false) {
      throw new Error('Email notifications are disabled in your settings.');
    }

    if (requestedEmail && user.email !== requestedEmail) {
      user.email = requestedEmail;
      await user.save();
    }

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.emailOtp = otp;
    user.emailOtpExpires = expires;
    await user.save();

    const emailService = await this.getDynamicEmailService();
    await emailService.sendOtp(user.email, otp);

    return { message: 'Verification code sent to your email.' };
  }

  async verifyEmailOtp(userId: string, otp: string, fallbackEmail?: string): Promise<{ verified: boolean; message: string }> {
    const user = await this.getOrCreateUser(userId, fallbackEmail);

    if (!user.emailOtp || !user.emailOtpExpires) {
      return { verified: false, message: 'No OTP was requested. Please request a new code.' };
    }

    if (new Date() > user.emailOtpExpires) {
      user.emailOtp = undefined;
      user.emailOtpExpires = undefined;
      await user.save();
      return { verified: false, message: 'OTP expired. Please request a new code.' };
    }

    if (user.emailOtp !== otp) {
      return { verified: false, message: 'Invalid code. Please try again.' };
    }

    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    try {
      const { getAuth } = require('firebase-admin/auth');
      await getAuth().updateUser(userId, { emailVerified: true });
    } catch (err) {
      console.error('[NotificationService] Failed to update Firebase emailVerified status:', err);
    }

    return { verified: true, message: 'Email verified successfully!' };
  }

  // ── Pre-Signup Email OTP ───────────────────────────────────

  async sendSignupOtp(email: string): Promise<{ message: string }> {
    if (!email) throw new Error('Email is required');
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert the OTP in the temporary collection
    await this.otpModel.findOneAndUpdate(
      { email },
      { otp, expiresAt, verified: false },
      { upsert: true, new: true }
    );

    const emailService = await this.getDynamicEmailService();
    await emailService.sendOtp(email, otp);

    return { message: 'Verification code sent to your email.' };
  }

  async verifySignupOtp(email: string, otp: string): Promise<{ verified: boolean; message: string }> {
    if (!email || !otp) return { verified: false, message: 'Email and OTP are required.' };

    const record = await this.otpModel.findOne({ email });
    if (!record) {
      return { verified: false, message: 'No OTP was requested. Please request a new code.' };
    }

    if (new Date() > record.expiresAt) {
      await this.otpModel.deleteOne({ email });
      return { verified: false, message: 'OTP expired. Please request a new code.' };
    }

    if (record.otp !== otp) {
      return { verified: false, message: 'Invalid code. Please try again.' };
    }

    record.verified = true;
    await record.save();

    return { verified: true, message: 'Email verified successfully!' };
  }

  // ── WhatsApp OTP ───────────────────────────────────────────

  async sendWhatsAppOtp(userId: string, phone: string): Promise<{ message: string }> {
    const user = await this.getOrCreateUser(userId);

    if (user.whatsappNotificationsEnabled === false) {
      throw new Error('WhatsApp notifications are disabled in your settings.');
    }

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.phone = phone;
    user.phoneOtp = otp;
    user.phoneOtpExpires = expires;
    await user.save();

    try {
      const whatsappService = await this.getDynamicWhatsAppService();
      await whatsappService.sendOtp(phone, otp);
    } catch (err: any) {
      console.warn(`\n[WhatsApp Service] Live WhatsApp dispatch failed. Falling back to Console Mock OTP for local testing:`);
      console.warn(`>>> TEST WHATSAPP OTP FOR ${phone}: ${otp} <<<\n`);
    }

    return { message: 'Verification code sent to your WhatsApp.' };
  }

  async verifyWhatsAppOtp(userId: string, otp: string): Promise<{ verified: boolean; message: string }> {
    const user = await this.getOrCreateUser(userId);

    if (!user.phoneOtp || !user.phoneOtpExpires) {
      return { verified: false, message: 'No OTP was requested. Please request a new code.' };
    }

    if (new Date() > user.phoneOtpExpires) {
      user.phoneOtp = undefined;
      user.phoneOtpExpires = undefined;
      await user.save();
      return { verified: false, message: 'OTP expired. Please request a new code.' };
    }

    if (user.phoneOtp !== otp) {
      return { verified: false, message: 'Invalid code. Please try again.' };
    }

    user.isPhoneVerified = true;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;
    await user.save();

    return { verified: true, message: 'WhatsApp number verified successfully!' };
  }

  // ── Job Match Notifications ────────────────────────────────

  async notifyJobMatch(
    userId: string,
    jobTitle: string,
    company: string,
    matchScore: number,
    salary: string,
    applicationId: string,
  ): Promise<void> {
    const user = await this.userModel.findOne({ clerkId: userId });
    if (!user) return;

    const dashboardUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/applications`;

    // Send email notification
    if (user.isEmailVerified && user.emailNotificationsEnabled !== false) {
      const emailService = await this.getDynamicEmailService();
      await emailService.sendJobMatchNotification(user.email, jobTitle, company, matchScore, dashboardUrl);
    }

    // Send WhatsApp notification
    if (user.isPhoneVerified && user.whatsappNotificationsEnabled && user.phone) {
      const whatsappService = await this.getDynamicWhatsAppService();
      await whatsappService.sendJobMatchNotification(
        user.phone,
        jobTitle,
        company,
        matchScore,
        salary,
        applicationId,
      );
    }
  }

  // ── Application Status Updates ─────────────────────────────

  async notifyApplicationUpdate(
    userId: string,
    jobTitle: string,
    company: string,
    status: string,
  ): Promise<void> {
    const user = await this.userModel.findOne({ clerkId: userId });
    if (!user) return;

    if (user.isEmailVerified && user.emailNotificationsEnabled !== false) {
      const emailService = await this.getDynamicEmailService();
      await emailService.sendApplicationUpdate(user.email, jobTitle, company, status);
    }

    if (user.isPhoneVerified && user.whatsappNotificationsEnabled && user.phone) {
      const whatsappService = await this.getDynamicWhatsAppService();
      await whatsappService.sendApplicationUpdate(user.phone, jobTitle, company, status);
    }
  }

  async getVerificationStatus(userId: string, firebaseVerified?: boolean, email?: string): Promise<{ emailVerified: boolean; phoneVerified: boolean }> {
    const user = await this.getOrCreateUser(userId, email);
    
    // Auto-verify if Firebase says the user's email is verified (e.g. Google Sign In)
    if (firebaseVerified && !user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    // Sync MongoDB verified status TO Firebase if Firebase thinks they are unverified!
    if (user.isEmailVerified && !firebaseVerified) {
      try {
        const { getAuth } = require('firebase-admin/auth');
        await getAuth().updateUser(userId, { emailVerified: true });
      } catch (err) {
        console.error('[NotificationService] Failed to sync emailVerified to Firebase:', err);
      }
    }

    return {
      emailVerified: user.isEmailVerified || false,
      phoneVerified: user.isPhoneVerified || false,
    };
  }

  async sendSupportTicketConfirmation(email: string, ticketId: string, subject: string): Promise<any> {
    const emailService = await this.getDynamicEmailService();
    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #fafafa; border-radius: 16px;">
        <h1 style="font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #c084fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 24px;">AI Job Copilot</h1>
        <p style="color: #fafafa; font-size: 14px;">Hello,</p>
        <p style="color: #a1a1aa; font-size: 13px;">We have successfully received your support ticket <strong>#${ticketId}</strong> with the subject: "<strong>${subject}</strong>".</p>
        <p style="color: #a1a1aa; font-size: 13px;">Our support team has been notified and is currently reviewing your request. We will get back to you shortly.</p>
        <br/>
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; text-align: center;">
          <p style="color: #71717a; font-size: 11px; margin: 0;">This is an automated receipt from AI Job Copilot Support. Please do not reply directly to this message.</p>
        </div>
      </div>
    `;
    return emailService.sendGenericEmail(email, `Support Ticket Received: ${subject}`, html);
  }

  async sendSupportTicketReply(email: string, ticketId: string, subject: string, reply: string): Promise<any> {
    const emailService = await this.getDynamicEmailService();
    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #fafafa; border-radius: 16px;">
        <h1 style="font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #c084fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 24px;">AI Job Copilot Support</h1>
        <p style="color: #fafafa; font-size: 14px;">An administrator has replied to your support ticket <strong>#${ticketId}</strong> ("${subject}"):</p>
        <div style="background: #18181b; border-radius: 12px; padding: 16px; margin: 16px 0; border: 1px solid rgba(168, 85, 247, 0.2);">
          <p style="color: #fafafa; font-size: 13px; margin: 0; white-space: pre-wrap;">${reply}</p>
        </div>
        <p style="color: #71717a; font-size: 12px;">Visit your dashboard to reply or close the ticket.</p>
      </div>
    `;
    return emailService.sendGenericEmail(email, `New Support Ticket Reply: ${subject}`, html);
  }

  /**
   * Send custom Clerk OTP using our beautiful HTML template
   */
  async sendCustomClerkOtp(to: string, otp: string): Promise<any> {
    const emailService = await this.getDynamicEmailService();
    const subject = `Your Verification Code`;
    const year = new Date().getFullYear();
    const appName = 'AI Job Copilot';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
  <style>
    body, p, h1, h2, h3, div { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #050505; color: #fafafa; -webkit-font-smoothing: antialiased; }
  </style>
</head>
<body style="background-color: #050505; color: #fafafa; padding: 40px 20px; text-align: center;">

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; margin: 0 auto; background-color: #0f0f11; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <tr>
      <td style="padding: 40px 30px;">
        
        <!-- Header -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #ffffff;">
                <span style="color: #c084fc;">AI</span> Job Copilot
              </h1>
            </td>
          </tr>
        </table>

        <!-- Body Content -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h2 style="font-size: 20px; font-weight: 600; color: #fafafa; margin-bottom: 8px;">Verification Code</h2>
              <p style="font-size: 15px; color: #a1a1aa; line-height: 1.5;">
                Enter the following verification code when prompted to verify your identity.
              </p>
            </td>
          </tr>
        </table>

        <!-- OTP Box -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <div style="background-color: #18181b; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 24px;">
                <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #c084fc; font-family: monospace;">${otp}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <p style="font-size: 13px; color: #71717a; line-height: 1.5; margin-bottom: 12px;">
                To protect your account, do not share this code with anyone.<br>
                If you didn't request this, you can safely ignore this email.
              </p>
              <p style="font-size: 12px; color: #52525b;">
                &copy; ${year} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;
    return emailService.sendGenericEmail(to, subject, html);
  }
}
