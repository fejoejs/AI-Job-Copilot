import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SupportTicket extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, enum: ['Bug', 'Feature Request', 'Query', 'Suggestion'] })
  category: 'Bug' | 'Feature Request' | 'Query' | 'Suggestion';

  @Prop({ default: 'Open', enum: ['Open', 'Resolved'] })
  status: 'Open' | 'Resolved';

  @Prop()
  adminReply?: string;

  @Prop()
  repliedAt?: Date;

  @Prop({ default: false })
  isReadByUser: boolean;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
