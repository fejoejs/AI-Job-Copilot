import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
class UserFilters {
  @Prop({ type: [String], enum: ['Remote', 'Hybrid', 'Onsite'], default: [] })
  workTypes: ('Remote' | 'Hybrid' | 'Onsite')[];

  @Prop({ type: Number, default: 0 })
  minSalary: number;

  @Prop({ type: Number })
  maxSalary?: number;

  @Prop({ type: String, default: 'Mid' })
  experienceLevel: string;

  @Prop({ type: [String], default: [] })
  targetCompanies: string[];

  @Prop({ type: [String], default: [] })
  countries: string[];

  @Prop({ type: String })
  targetJobRole?: string;

  @Prop({ type: [String], default: [] })
  targetRoles: string[];
}

const UserFiltersSchema = SchemaFactory.createForClass(UserFilters);

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  clerkId: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  name?: string;

  // Phone number (with country code, e.g. +919876543210)
  @Prop()
  phone?: string;

  // Email verification
  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  emailOtp?: string;

  @Prop({ type: Date })
  emailOtpExpires?: Date;

  // Phone / WhatsApp verification
  @Prop({ default: false })
  isPhoneVerified: boolean;

  @Prop()
  phoneOtp?: string;

  @Prop({ type: Date })
  phoneOtpExpires?: Date;

  // WhatsApp Business notification preferences
  @Prop({ default: true })
  whatsappNotificationsEnabled: boolean;

  // Email notification preferences
  @Prop({ default: true })
  emailNotificationsEnabled: boolean;

  // Location / City
  @Prop()
  location?: string;

  // Avatar Image URL
  @Prop()
  avatarUrl?: string;

  // Minimum match score threshold to trigger WhatsApp alerts (default 85%)
  @Prop({ type: Number, default: 85 })
  notifyMatchThreshold: number;

  @Prop({ type: UserFiltersSchema, default: () => ({}) })
  filters: UserFilters;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role: 'user' | 'admin';
}

export const UserSchema = SchemaFactory.createForClass(User);

