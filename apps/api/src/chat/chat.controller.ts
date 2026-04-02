import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { SubscriptionGuard } from '../subscriptions';
import { ChatService } from './chat.service';
import { sendMessageSchema } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // GET /chat/history is accessible to all authenticated users (free + pro)
  // so free users can read coach messages injected by background workers.
  @Get('history')
  async getHistory(@CurrentUser() user: AuthenticatedUser) {
    const messages = await this.chatService.getHistory(user.id);
    return { messages };
  }

  // Only Pro users can send new messages to the coach.
  @Post('message')
  @UseGuards(SubscriptionGuard)
  async sendMessage(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.chatService.sendMessage(user.id, parsed.data.message);
  }

  // Free users can clear their own history.
  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(@CurrentUser() user: AuthenticatedUser) {
    await this.chatService.clearHistory(user.id);
  }
}
