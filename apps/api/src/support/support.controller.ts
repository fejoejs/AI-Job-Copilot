import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GetUserId } from '../auth/get-user.decorator';
import { SupportService } from './support.service';

@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('support')
  @UseGuards(FirebaseAuthGuard)
  async createTicket(
    @GetUserId() userId: string,
    @Body() body: { subject: string; message: string; category: any; email: string },
  ) {
    const userEmail = body.email || 'jobcopilot.ai@gmail.com';
    return this.supportService.createTicket(userId, userEmail, body);
  }

  @Get('support/my-tickets')
  @UseGuards(FirebaseAuthGuard)
  async getMyTickets(@GetUserId() userId: string) {
    return this.supportService.getMyTickets(userId);
  }

  @Get('support/notifications')
  @UseGuards(FirebaseAuthGuard)
  async getNotifications(@GetUserId() userId: string) {
    const count = await this.supportService.getUnreadRepliesCount(userId);
    return { count };
  }

  @Put('support/notifications/read')
  @UseGuards(FirebaseAuthGuard)
  async markAsRead(@GetUserId() userId: string) {
    await this.supportService.markRepliesAsRead(userId);
    return { success: true };
  }

  // --- Admin Methods ---

  @Get('admin/tickets')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async getAllTickets() {
    return this.supportService.getAllTickets();
  }

  @Post('admin/tickets/:id/reply')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async replyToTicket(
    @Param('id') id: string,
    @Body('reply') reply: string,
  ) {
    return this.supportService.replyToTicket(id, reply);
  }
}
