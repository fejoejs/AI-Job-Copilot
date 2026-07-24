import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupportTicket } from '../schemas/support-ticket.schema';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name) private ticketModel: Model<SupportTicket>,
    private notificationService: NotificationService,
  ) {}

  async createTicket(userId: string, email: string, body: any): Promise<SupportTicket> {
    const ticket = new this.ticketModel({
      userId,
      email,
      subject: body.subject,
      message: body.message,
      category: body.category,
      status: 'Open',
    });
    const saved = await ticket.save();

    // Send auto-reply confirmation email
    this.notificationService.sendSupportTicketConfirmation(email, saved.id as string, saved.subject).catch(err => {
      console.error('[SupportService] Failed to send ticket confirmation email:', err);
    });

    return saved;
  }

  async getMyTickets(userId: string): Promise<SupportTicket[]> {
    return this.ticketModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async getUnreadRepliesCount(userId: string): Promise<number> {
    return this.ticketModel.countDocuments({
      userId,
      status: 'Resolved',
      isReadByUser: false,
    }).exec();
  }

  async markRepliesAsRead(userId: string): Promise<void> {
    await this.ticketModel.updateMany(
      { userId, status: 'Resolved', isReadByUser: false },
      { $set: { isReadByUser: true } }
    ).exec();
  }

  // --- Admin Methods ---

  async getAllTickets(): Promise<SupportTicket[]> {
    return this.ticketModel.find().sort({ createdAt: -1 }).exec();
  }

  async replyToTicket(ticketId: string, reply: string): Promise<SupportTicket> {
    const ticket = await this.ticketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    ticket.adminReply = reply;
    ticket.status = 'Resolved';
    ticket.repliedAt = new Date();
    ticket.isReadByUser = false;

    const saved = await ticket.save();

    // Send notification email for admin reply
    this.notificationService.sendSupportTicketReply(saved.email, saved.id as string, saved.subject, reply).catch(err => {
      console.error('[SupportService] Failed to send ticket reply email:', err);
    });

    return saved;
  }
}
