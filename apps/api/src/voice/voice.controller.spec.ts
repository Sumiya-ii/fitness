import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { S3Service } from '../storage';
import { AuthenticatedUser } from '../auth';

describe('VoiceController', () => {
  let controller: VoiceController;
  let mockVoiceService: { uploadAudio: jest.Mock; getDraft: jest.Mock };
  let mockS3: { ping: jest.Mock; isConfigured: boolean };

  const fakeUser: AuthenticatedUser = {
    id: 'user-1',
    firebaseUid: 'uid-1',
    email: 'test@test.com',
    phone: null,
  };

  beforeEach(async () => {
    mockVoiceService = {
      uploadAudio: jest.fn().mockResolvedValue({ draftId: 'draft-abc' }),
      getDraft: jest.fn(),
    };
    mockS3 = { ping: jest.fn().mockResolvedValue({ ok: true }), isConfigured: false };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoiceController],
      providers: [
        { provide: VoiceService, useValue: mockVoiceService },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();

    controller = module.get<VoiceController>(VoiceController);
  });

  describe('upload', () => {
    it('throws 400 when no file provided', async () => {
      await expect(controller.upload(fakeUser, undefined, 'mn')).rejects.toThrow(
        new BadRequestException('Audio file is required'),
      );
    });

    it('throws 400 for unsupported MIME type', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/png' } as Express.Multer.File;
      await expect(controller.upload(fakeUser, file, 'mn')).rejects.toThrow(BadRequestException);
    });

    it('passes locale "en" to service as "en"', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/m4a' } as Express.Multer.File;
      await controller.upload(fakeUser, file, 'en');
      expect(mockVoiceService.uploadAudio).toHaveBeenCalledWith('user-1', file.buffer, 'en');
    });

    it('passes locale "mn" to service as "mn"', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/m4a' } as Express.Multer.File;
      await controller.upload(fakeUser, file, 'mn');
      expect(mockVoiceService.uploadAudio).toHaveBeenCalledWith('user-1', file.buffer, 'mn');
    });

    it('narrows unknown locale "fr" to "mn"', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/m4a' } as Express.Multer.File;
      await controller.upload(fakeUser, file, 'fr');
      expect(mockVoiceService.uploadAudio).toHaveBeenCalledWith('user-1', file.buffer, 'mn');
    });

    it('propagates BadRequestException from service verbatim when daily cap is reached', async () => {
      mockVoiceService.uploadAudio.mockRejectedValue(
        new BadRequestException('voice_daily_cap_reached'),
      );
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/m4a' } as Express.Multer.File;
      await expect(controller.upload(fakeUser, file, 'mn')).rejects.toThrow(
        new BadRequestException('voice_daily_cap_reached'),
      );
    });

    it('returns { data: { draftId } } on success', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/m4a' } as Express.Multer.File;
      const result = await controller.upload(fakeUser, file, 'mn');
      expect(result).toEqual({ data: { draftId: 'draft-abc' } });
    });
  });
});
