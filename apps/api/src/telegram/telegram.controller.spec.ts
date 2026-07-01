import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { ConfigService } from '../config';

describe('TelegramController – webhook signature validation', () => {
  let controller: TelegramController;
  let mockTelegramService: { confirmLink: jest.Mock };
  const mockBotService = { handleUpdate: jest.fn().mockResolvedValue(undefined) };
  let mockConfig: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { get: jest.fn() };
    mockTelegramService = { confirmLink: jest.fn().mockResolvedValue({ success: true }) };
    controller = new TelegramController(
      mockTelegramService as unknown as TelegramService,
      mockBotService as unknown as TelegramBotService,
      mockConfig as unknown as ConfigService,
    );
  });

  describe('when TELEGRAM_WEBHOOK_SECRET is set', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue('my-secret');
    });

    it('throws 401 when header is missing', async () => {
      await expect(controller.webhook({ update_id: 1 }, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 when header does not match', async () => {
      await expect(controller.webhook({ update_id: 1 }, 'wrong-secret')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('accepts request when header matches', async () => {
      await expect(controller.webhook({ update_id: 1 }, 'my-secret')).resolves.toBeUndefined();
      expect(mockBotService.handleUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('when TELEGRAM_WEBHOOK_SECRET is not set', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue(undefined);
    });

    it('denies request without any header (deny-when-unconfigured)', async () => {
      await expect(controller.webhook({ update_id: 1 }, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockBotService.handleUpdate).not.toHaveBeenCalled();
    });

    it('denies request even if a header is supplied', async () => {
      await expect(controller.webhook({ update_id: 1 }, 'any-value')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockBotService.handleUpdate).not.toHaveBeenCalled();
    });
  });

  it('throws BadRequestException for non-object body when secret is configured', async () => {
    mockConfig.get.mockReturnValue('my-secret');
    await expect(controller.webhook(null, 'my-secret')).rejects.toThrow(BadRequestException);
  });

  // ── POST /telegram/confirm ────────────────────────────────────────────────
  describe('confirmLink', () => {
    const validBody = { telegramUserId: 'tg-123', chatId: 'chat-456', code: 'ABC123' };

    it('delegates to service with valid payload', async () => {
      const result = await controller.confirmLink(validBody);
      expect(mockTelegramService.confirmLink).toHaveBeenCalledWith(
        'tg-123',
        'chat-456',
        'ABC123',
        undefined,
      );
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException when code is not 6 characters', async () => {
      await expect(
        controller.confirmLink({ telegramUserId: 'tg-123', chatId: 'chat-456', code: 'short' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when required fields are missing', async () => {
      await expect(controller.confirmLink({ code: 'ABC123' })).rejects.toThrow(BadRequestException);
    });
  });
});
