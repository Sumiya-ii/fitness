import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { ConfigService } from '../config';

describe('TelegramController – webhook signature validation', () => {
  let controller: TelegramController;
  const mockTelegramService = {} as TelegramService;
  const mockBotService = { handleUpdate: jest.fn().mockResolvedValue(undefined) };
  let mockConfig: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { get: jest.fn() };
    controller = new TelegramController(
      mockTelegramService,
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
});
