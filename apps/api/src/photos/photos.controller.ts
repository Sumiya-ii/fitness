import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { SubscriptionGuard } from '../subscriptions';
import { PhotosService } from './photos.service';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

@Controller('photos')
@UseGuards(SubscriptionGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  // Tighter limit for the expensive GPT-4 Vision call: 20 requests per minute per user
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode?: 'food' | 'label',
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Photo file is required');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported image format: ${file.mimetype}`);
    }
    const validMode = mode === 'label' ? 'label' : undefined;
    const { draftId } = await this.photosService.uploadPhoto(
      user.id,
      file.buffer,
      file.originalname,
      validMode,
    );
    return { data: { draftId } };
  }

  @Get('drafts/:id')
  async getDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return {
      data: await this.photosService.getDraft(id, user.id),
    };
  }
}
