import { Controller, Post, Req, Res, Headers } from '@nestjs/common';
import type { Request, Response } from 'express';
import { NotificationService } from './notification.service';

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  async handleClerkWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    try {
      const payload = req.body;
      const type = payload?.type;

      if (type === 'email.created') {
        const data = payload.data;
        // If it's not delivered by Clerk, it means we must handle it
        if (data && data.delivered_by_clerk === false && data.to_email_address) {
          
          // Try to extract 6 digit OTP from the subject or body
          const subject = data.subject || '';
          const bodyText = data.body || '';
          
          // Regex to find exactly 6 consecutive digits
          const otpMatch = subject.match(/\b\d{6}\b/) || bodyText.match(/\b\d{6}\b/);
          
          if (otpMatch) {
            const otp = otpMatch[0];
            console.log(`[Clerk Webhook] Intercepted email OTP for ${data.to_email_address}. Sending custom email...`);
            
            // Fire off our custom EmailService with the attractive HTML!
            await this.notificationService.sendCustomClerkOtp(data.to_email_address, otp);
            
            return res.status(200).json({ success: true, message: 'Custom OTP sent successfully' });
          } else {
            console.warn('[Clerk Webhook] email.created received but no 6-digit OTP could be extracted.');
          }
        }
      }

      // Return 200 for other webhooks so Clerk knows we received them
      return res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error) {
      console.error('[Clerk Webhook Error]', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error processing webhook' });
    }
  }
}
