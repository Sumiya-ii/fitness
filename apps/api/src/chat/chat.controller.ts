import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { ChatService } from './chat.service';
import { sendMessageSchema } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history')
  async getHistory(@CurrentUser() user: AuthenticatedUser) {
    const messages = await this.chatService.getHistory(user.id);
    return { messages };
  }

  @Post('message')
  async sendMessage(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.chatService.sendMessage(user.id, parsed.data.message);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(@CurrentUser() user: AuthenticatedUser) {
    await this.chatService.clearHistory(user.id);
  }
}
