import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Body,
  Delete,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUserId } from '../auth/get-user.decorator';
import { ResumeService } from './resume.service';

@Controller('resume')
@UseGuards(FirebaseAuthGuard)
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResume(
    @GetUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Server-side type and size validation
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF and Word documents are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the 5MB limit.');
    }

    const resume = await this.resumeService.uploadAndParse(
      userId,
      file.originalname,
      file.buffer,
      file.mimetype,
      false, // isAtsCheckOnly = false
    );

    return {
      message: 'Resume uploaded successfully. Parsing started.',
      resumeId: resume.id,
      originalFileName: resume.originalFileName,
    };
  }

  @Post('upload-ats')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResumeAts(
    @GetUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Server-side type and size validation
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF and Word documents are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the 5MB limit.');
    }

    const resume = await this.resumeService.uploadAndParse(
      userId,
      file.originalname,
      file.buffer,
      file.mimetype,
      true, // isAtsCheckOnly = true
    );

    return {
      message: 'Resume uploaded for ATS checking. Parsing started.',
      resumeId: resume.id,
      originalFileName: resume.originalFileName,
    };
  }

  @Get('latest')
  async getLatestResume(
    @GetUserId() userId: string,
    @Query('scanner') scanner?: string,
  ) {
    const isAts = scanner === 'true';
    return this.resumeService.getLatestResume(userId, isAts);
  }

  @Get(':id/download')
  async getDownloadUrl(@GetUserId() userId: string, @Param('id') resumeId: string) {
    const downloadUrl = await this.resumeService.getDownloadUrl(userId, resumeId);
    return { downloadUrl };
  }

  @Get(':id')
  async getResumeById(@GetUserId() userId: string, @Param('id') resumeId: string) {
    return this.resumeService.getResumeById(userId, resumeId);
  }

  @Get(':id/download-file')
  async downloadResumeFile(
    @GetUserId() userId: string,
    @Param('id') resumeId: string,
    @Res() res: Response,
  ) {
    const { buffer, originalFileName, mimeType } = await this.resumeService.getResumeFileFromDb(userId, resumeId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
    res.send(buffer);
  }

  @Post(':id/ats-analyze')
  async analyzeAts(
    @GetUserId() userId: string,
    @Param('id') resumeId: string,
    @Body('targetJobTitle') targetJobTitle?: string,
  ) {
    return this.resumeService.analyzeAts(userId, resumeId, targetJobTitle);
  }

  @Delete(':id')
  async deleteResume(
    @GetUserId() userId: string,
    @Param('id') resumeId: string,
  ) {
    return this.resumeService.deleteResume(userId, resumeId);
  }

  @Post(':id/optimize')
  async optimizeResume(
    @GetUserId() userId: string,
    @Param('id') resumeId: string,
    @Body('jobId') jobId?: string,
    @Body('customJobTitle') customJobTitle?: string,
    @Body('customJobDescription') customJobDescription?: string,
  ) {
    return this.resumeService.optimizeResume(userId, resumeId, jobId, customJobTitle, customJobDescription);
  }
}
