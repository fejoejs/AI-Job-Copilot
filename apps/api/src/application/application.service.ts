import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from '../schemas/application.schema';
import { Job } from '../schemas/job.schema';
import { Resume } from '../schemas/resume.schema';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectModel(Application.name) private appModel: Model<Application>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(Resume.name) private resumeModel: Model<Resume>,
    private queueService: QueueService,
  ) {}

  async createApplication(userId: string, jobId: string): Promise<Application> {
    const job = await this.jobModel.findById(jobId).exec();
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    let app = await this.appModel.findOne({ userId, jobId }).exec();
    if (!app) {
      app = new this.appModel({
        userId,
        jobId,
        status: 'Matched',
      });
      await app.save();
    }

    return app;
  }

  async getApplications(userId: string): Promise<Application[]> {
    const apps = await this.appModel.find({ userId }).populate('jobId').sort({ updatedAt: -1 }).exec();
    return apps.map(app => {
      if (app.source === 'external-board') {
        const mockJobId = {
          _id: app.externalBoardJobId || '',
          title: app.jobTitle || '',
          company: app.company || '',
          location: app.location || '',
          workType: 'Remote',
        };
        const appObj = (app.toObject ? app.toObject() : app) as any;
        appObj.jobId = mockJobId;
        return appObj;
      }
      return app;
    });
  }

  async requestTailoring(userId: string, appId: string): Promise<any> {
    const app = await this.appModel.findOne({ _id: appId, userId }).exec();
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    if (!app.jobId) {
      throw new NotFoundException('Job ID is missing for this application');
    }

    app.status = 'Tailored';
    await app.save();

    // Push tailoring job to background queue
    await this.queueService.addResumeTailorJob(userId, app.jobId.toString(), app.id as string);

    return { message: 'AI customization (resume tailoring and cover letter) initiated.', status: app.status };
  }

  async triggerApply(userId: string, appId: string): Promise<any> {
    const app = await this.appModel.findOne({ _id: appId, userId }).exec();
    if (!app) {
      throw new NotFoundException('Application not found');
    }

    // Find user's latest uploaded resume
    const latestResume = await this.resumeModel
      .findOne({ userId, isAtsCheckOnly: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();

    if (latestResume) {
      app.resumeId = latestResume._id as any;
    }

    app.status = 'Applying';
    await app.save();

    // Simulate auto-apply success transition to 'Applied' after 1.5 seconds
    setTimeout(async () => {
      try {
        const checkApp = await this.appModel.findById(appId);
        if (checkApp && checkApp.status === 'Applying') {
          checkApp.status = 'Applied';
          checkApp.appliedDate = new Date();
          await checkApp.save();
          console.log(`[Auto Apply] Successfully completed apply simulation for Application ${appId}. Linked resume: ${latestResume?.originalFileName || 'None'}`);
        }
      } catch (err) {
        console.error('Failed to simulate apply status update:', err);
      }
    }, 1500);

    return { message: 'Auto apply process triggered.', status: app.status };
  }

  async updateStatus(userId: string, appId: string, status: string, notes?: string): Promise<Application> {
    const app = await this.appModel.findOne({ _id: appId, userId }).exec();
    if (!app) {
      throw new NotFoundException('Application not found');
    }

    app.status = status;
    if (notes !== undefined) {
      app.notes = notes;
    }
    if (status === 'Applied') {
      app.appliedDate = new Date();
    }
    return app.save();
  }

  async updateCoverLetter(userId: string, appId: string, coverLetterContent: string): Promise<Application> {
    const app = await this.appModel.findOne({ _id: appId, userId }).exec();
    if (!app) {
      throw new NotFoundException('Application not found');
    }

    app.coverLetterContent = coverLetterContent;
    return app.save();
  }

  async getTailoredResumeFile(userId: string, appId: string): Promise<{ content: string; fileName: string }> {
    const app = await this.appModel.findOne({ _id: appId, userId }).exec();
    if (!app || !app.tailoredResumeContent) {
      throw new NotFoundException('Tailored resume content not found in database');
    }
    return {
      content: app.tailoredResumeContent,
      fileName: `tailored-resume-${appId}.txt`,
    };
  }
}
