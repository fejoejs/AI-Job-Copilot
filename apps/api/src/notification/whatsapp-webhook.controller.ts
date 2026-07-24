import { Controller, Post, Get, Body, Query, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { Application } from '../schemas/application.schema';
import { Job } from '../schemas/job.schema';
import { QueueService } from '../queue/queue.service';
import { WhatsAppService } from '@ai-copilot/utils';

/**
 * WhatsApp Business Webhook Controller
 *
 * Receives incoming messages from Meta's WhatsApp Cloud API.
 * When a user replies "APPLY <appId>" to a job match notification,
 * this controller triggers the auto-apply pipeline.
 *
 * Messages appear from your business name "AI Job Copilot".
 */
@Controller('whatsapp')
export class WhatsAppWebhookController {
  private whatsapp: WhatsAppService;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Application.name) private appModel: Model<Application>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    private queueService: QueueService,
  ) {
    this.whatsapp = new WhatsAppService();
  }

  /**
   * GET /whatsapp/webhook — Meta webhook verification challenge
   * Meta sends a GET request to verify the webhook URL during setup.
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'ai_job_copilot_verify';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    }

    console.warn('[WhatsApp Webhook] Verification failed — token mismatch');
    return res.status(403).send('Forbidden');
  }

  /**
   * POST /whatsapp/webhook — Receive incoming WhatsApp messages
   * Parses user replies and triggers auto-apply for "APPLY <id>" commands.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleIncomingMessage(@Body() body: any) {
    const parsed = WhatsAppService.parseIncomingMessage(body);

    if (!parsed) {
      // Not a text message or not parseable — acknowledge silently
      return { status: 'ok' };
    }

    const { from, text } = parsed;
    console.log(`[WhatsApp Webhook] Received from ${from}: "${text}"`);

    // Find the user by their verified phone number
    const user = await this.userModel.findOne({
      phone: { $regex: from.replace(/^\+/, '') },
      isPhoneVerified: true,
    });

    if (!user) {
      console.warn(`[WhatsApp Webhook] No verified user found for phone: ${from}`);
      await this.whatsapp.sendTextMessage(
        from,
        '❌ *AI Job Copilot*\n\nYour phone number is not registered. Please verify your number in the dashboard first.',
      );
      return { status: 'ok' };
    }

    // Parse commands
    const upperText = text.toUpperCase().trim();

    // ── APPLY <applicationId> ────────────────────────────────
    if (upperText.startsWith('APPLY')) {
      const parts = upperText.split(/\s+/);
      let applicationId = parts[1]; // e.g. "APPLY abc123"

      let application: any = null;

      if (applicationId) {
        // Find the specific application
        application = await this.appModel.findOne({
          _id: applicationId,
          userId: user.clerkId,
        }).populate('jobId');
      } else {
        // No ID specified — find the latest "Tailored" application
        application = await this.appModel.findOne({
          userId: user.clerkId,
          status: 'Tailored',
        })
          .sort({ updatedAt: -1 })
          .populate('jobId');
      }

      if (!application) {
        await this.whatsapp.sendTextMessage(
          from,
          '❌ *AI Job Copilot*\n\nNo application found ready for submission. Please check your dashboard.',
        );
        return { status: 'ok' };
      }

      const job = application.jobId as any;

      // Update status to Applying
      application.status = 'Applying';
      await application.save();

      // Trigger the tailoring + auto-apply background job
      await this.queueService.addResumeTailorJob(
        user.clerkId,
        job._id.toString(),
        application._id.toString(),
      );

      await this.whatsapp.sendTextMessage(
        from,
        `✅ *AI Job Copilot*\n\n🚀 Auto-apply started for:\n📋 *${job.title}*\n🏢 ${job.company}\n\nYour tailored resume and cover letter are being submitted. We'll notify you when it's done!`,
      );

      console.log(`[WhatsApp Webhook] Auto-apply triggered for user ${user.clerkId}, application ${application._id}`);
      return { status: 'ok' };
    }

    // ── SKIP ──────────────────────────────────────────────────
    if (upperText === 'SKIP') {
      await this.whatsapp.sendTextMessage(
        from,
        '👌 *AI Job Copilot*\n\nJob dismissed. We\'ll keep looking for better matches!',
      );
      return { status: 'ok' };
    }

    // ── STATUS ────────────────────────────────────────────────
    if (upperText === 'STATUS') {
      const activeApps = await this.appModel
        .find({ userId: user.clerkId, status: { $in: ['Matched', 'Tailored', 'Applying'] } })
        .populate('jobId')
        .limit(5);

      if (activeApps.length === 0) {
        await this.whatsapp.sendTextMessage(
          from,
          '📊 *AI Job Copilot*\n\nNo active applications. We\'ll notify you when new matches arrive!',
        );
      } else {
        const lines = activeApps.map((app: any, i: number) => {
          const job = app.jobId;
          return `${i + 1}. *${job.title}* at ${job.company} — ${app.status}`;
        });
        await this.whatsapp.sendTextMessage(
          from,
          `📊 *AI Job Copilot - Active Applications*\n\n${lines.join('\n')}\n\nReply *APPLY* to submit the latest tailored application.`,
        );
      }
      return { status: 'ok' };
    }

    // ── Unknown command ───────────────────────────────────────
    await this.whatsapp.sendTextMessage(
      from,
      `🤖 *AI Job Copilot*\n\nAvailable commands:\n\n• *APPLY* — Submit your latest tailored application\n• *APPLY <id>* — Submit a specific application\n• *STATUS* — View active applications\n• *SKIP* — Dismiss the last suggestion`,
    );

    return { status: 'ok' };
  }
}
