import { Test, TestingModule } from '@nestjs/testing';
import { SttService } from './stt.service';
import { ConfigService } from '../config';

describe('SttService', () => {
  let service: SttService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SttService,
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    service = module.get<SttService>(SttService);
  });

  describe('transcribe', () => {
    it('should return transcription result when provider is configured', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'STT_PROVIDER') return 'google';
        return undefined;
      });

      const result = await service.transcribe(
        Buffer.from('fake-audio'),
        'en-US',
      );

      expect(result).toEqual({
        text: 'transcription not available (GOOGLE_STT_API_KEY missing)',
        locale: 'en-US',
      });
    });

    it('should return fallback when no provider configured', async () => {
      configGet.mockImplementation(() => undefined);

      const result = await service.transcribe(Buffer.from('fake-audio'));

      expect(result).toEqual({
        text: 'transcription not available (no STT provider configured)',
        locale: undefined,
      });
    });
  });
});
