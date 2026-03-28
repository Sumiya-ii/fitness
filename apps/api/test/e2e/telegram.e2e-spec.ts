import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { TelegramController } from '../../src/telegram/telegram.controller';
import { TelegramService } from '../../src/telegram/telegram.service';
import { TelegramBotService } from '../../src/telegram/telegram-bot.service';
import { FakeAuthGuard, createTestApp, url, TEST_USER } from './setup';

describe('Telegram (e2e)', () => {
  let app: INestApplication;

  const mockService = {
    generateLinkCode: jest.fn().mockResolvedValue('123456'),
    confirmLink: jest.fn().mockResolvedValue({ success: true, userId: TEST_USER.id }),
    getLink: jest.fn().mockResolvedValue({ linked: false }),
    unlinkAccount: jest.fn().mockResolvedValue(undefined),
  };

  // TelegramBotService is injected by the controller but only used for webhook
  const mockBotService = {
    handleUpdate: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        { provide: TelegramService, useValue: mockService },
        { provide: TelegramBotService, useValue: mockBotService },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = await createTestApp(module);
  });

  afterAll(() => app?.close());
  afterEach(() => jest.clearAllMocks());

  describe('POST /telegram/link-code', () => {
    it('generates a 6-digit link code', () =>
      request(app.getHttpServer())
        .post(url('telegram/link-code'))
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe('123456');
          expect(mockService.generateLinkCode).toHaveBeenCalledWith(TEST_USER.id);
        }));
  });

  describe('POST /telegram/confirm (public)', () => {
    it('confirms a valid link', () =>
      request(app.getHttpServer())
        .post(url('telegram/confirm'))
        .send({
          telegramUserId: 'tg-123',
          chatId: 'chat-456',
          code: '123456',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        }));

    it('rejects code not exactly 6 chars', () =>
      request(app.getHttpServer())
        .post(url('telegram/confirm'))
        .send({ telegramUserId: 'tg-123', chatId: 'chat-456', code: '12345' })
        .expect(400));

    it('rejects missing telegramUserId', () =>
      request(app.getHttpServer())
        .post(url('telegram/confirm'))
        .send({ chatId: 'chat-456', code: '123456' })
        .expect(400));

    it('rejects missing chatId', () =>
      request(app.getHttpServer())
        .post(url('telegram/confirm'))
        .send({ telegramUserId: 'tg-123', code: '123456' })
        .expect(400));
  });

  describe('GET /telegram/status', () => {
    it('returns link status', () =>
      request(app.getHttpServer())
        .get(url('telegram/status'))
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('linked');
        }));
  });

  describe('POST /telegram/unlink', () => {
    it('unlinks telegram account', () =>
      request(app.getHttpServer())
        .post(url('telegram/unlink'))
        .expect(204)
        .expect(() => {
          expect(mockService.unlinkAccount).toHaveBeenCalledWith(TEST_USER.id);
        }));
  });

  describe('POST /telegram/webhook (public)', () => {
    it('handles valid webhook payload', () =>
      request(app.getHttpServer())
        .post(url('telegram/webhook'))
        .send({ update_id: 1, message: { text: '/start', chat: { id: 123 } } })
        .expect(200));
  });
});
