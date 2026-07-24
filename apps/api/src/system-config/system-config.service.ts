import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemConfig } from '../schemas/system-config.schema';
import { User } from '../schemas/user.schema';
import { ApiLog } from '../schemas/api-log.schema';
import { CrawlLog } from '../schemas/crawl-log.schema';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectModel(SystemConfig.name) private configModel: Model<SystemConfig>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(ApiLog.name) private apiLogModel: Model<ApiLog>,
    @InjectModel(CrawlLog.name) private crawlLogModel: Model<CrawlLog>,
  ) {}

  async logApiCall(service: string, model: string, status: string, errorMessage?: string): Promise<void> {
    try {
      await this.apiLogModel.create({
        service,
        modelName: model,
        status,
        errorMessage,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('[SystemConfigService] Failed to create ApiLog entry:', err);
    }
  }

  async logCrawlRun(
    platform: string,
    startTime: Date,
    endTime: Date,
    status: string,
    jobsParsed: number,
    jobsSaved: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.crawlLogModel.create({
        platform,
        startTime,
        endTime,
        status,
        jobsParsed,
        jobsSaved,
        errorMessage,
      });
    } catch (err) {
      console.error('[SystemConfigService] Failed to create CrawlLog entry:', err);
    }
  }

  async get(key: string): Promise<string> {
    const config = await this.configModel.findOne({ key }).exec();
    if (config && config.value) {
      return config.value;
    }
    // Fallback to process.env
    return process.env[key] || '';
  }

  async getAllConfigs(): Promise<any[]> {
    return this.configModel.find().exec();
  }

  async set(key: string, value: string, description?: string): Promise<SystemConfig> {
    return this.configModel.findOneAndUpdate(
      { key },
      { value, description },
      { upsert: true, new: true },
    ).exec();
  }

  // --- User Management Methods ---
  async getAllUsers(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(userId, { role }, { new: true }).exec();
  }

  async deleteUser(userId: string): Promise<User | null> {
    return this.userModel.findByIdAndDelete(userId).exec();
  }
}
