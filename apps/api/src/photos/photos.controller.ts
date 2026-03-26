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
import { CurrentUser, AuthenticatedUser } from '../auth';
import { SubscriptionGuard } from '../subscriptions';
import { PhotosService } from './photos.service';

@Controller('photos')
@UseGuards(SubscriptionGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('photo'))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode?: 'food' | 'label',
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Photo file is required');
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
