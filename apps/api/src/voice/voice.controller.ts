import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { VoiceService } from './voice.service';
import { S3Service } from '../storage';

const ALLOWED_MIME_TYPES = ['audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly s3: S3Service,
  ) {}

  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('locale') locale?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Audio file is required');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported audio format: ${file.mimetype}`);
    }

    const safeLocale = locale === 'en' ? 'en' : 'mn';
    const { draftId } = await this.voiceService.uploadAudio(user.id, file.buffer, safeLocale);
    return { data: { draftId } };
  }

  @Get('s3-health')
  async s3Health(@CurrentUser() _user: AuthenticatedUser) {
    return { data: await this.s3.ping() };
  }

  @Get('drafts/:id')
  async getDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return {
      data: await this.voiceService.getDraft(id, user.id),
    };
  }
}
