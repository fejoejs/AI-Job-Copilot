import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

@Injectable()
export class UserProfileService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getProfile(userId: string, email?: string): Promise<User> {
    let user = await this.userModel.findOne({ clerkId: userId }).exec();
    
    // Firebase Migration: If user not found by UID, check if they exist by old email
    if (!user && email) {
      user = await this.userModel.findOne({ email }).exec();
      if (user) {
        user.clerkId = userId;
        await user.save();
      }
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, body: any, email?: string): Promise<User> {
    let user = await this.userModel.findOne({ clerkId: userId }).exec();
    
    // Firebase Migration
    if (!user && email) {
      user = await this.userModel.findOne({ email }).exec();
      if (user) {
        user.clerkId = userId;
        await user.save();
      }
    }

    const setPayload: any = {
      name: body.name,
      phone: body.phone,
      location: body.location,
      avatarUrl: body.avatarUrl,
      emailNotificationsEnabled: body.emailNotificationsEnabled,
      whatsappNotificationsEnabled: body.whatsappNotificationsEnabled,
      notifyMatchThreshold: body.notifyMatchThreshold,
    };

    if (email) {
      setPayload.email = email;
    }

    return this.userModel.findOneAndUpdate(
      { clerkId: userId },
      { $set: setPayload },
      { new: true, upsert: true }
    ).exec();
  }
}
