import { Controller, Get, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { BarcodesService } from './barcodes.service';
import { submitBarcodeSchema } from './barcodes.dto';

@Controller('barcodes')
export class BarcodesController {
  constructor(private readonly barcodesService: BarcodesService) {}

  @Get(':code')
  async lookup(@Param('code') code: string) {
    return { data: await this.barcodesService.lookup(code) };
  }

  @Post('submit')
  async submitUnknown(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = submitBarcodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return { data: await this.barcodesService.submitUnknown(user.id, parsed.data) };
  }
}
