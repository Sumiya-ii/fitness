import {
  Controller,
  Post,
  Get,
  Param,
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
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Photo file is required');
    }
    const { draftId } = await this.photosService.uploadPhoto(
      user.id,
      file.buffer,
      file.originalname,
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
