import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { VoiceService } from './voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('audio'))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Audio file is required');
    }
    const { draftId } = await this.voiceService.uploadAudio(
      user.id,
      file.buffer,
    );
    return { data: { draftId } };
  }

  @Get('drafts/:id')
  async getDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      data: await this.voiceService.getDraft(id, user.id),
    };
  }
}
