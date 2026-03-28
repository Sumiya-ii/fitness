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

      const result = await service.transcribe(Buffer.from('fake-audio'), 'en-US');

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

    it('should call Google STT V2 with chirp_2 model and correct audio structure', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'STT_PROVIDER') return 'google';
        if (key === 'GOOGLE_STT_API_KEY') return 'test-key';
        if (key === 'GOOGLE_CLOUD_PROJECT') return 'test-project';
        return undefined;
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ alternatives: [{ transcript: 'Би бууз идлээ', confidence: 0.95 }] }],
        }),
      } as Response);

      const result = await service.transcribe(Buffer.from('fake-audio'), 'mn');

      expect(result).toEqual({
        text: 'Би бууз идлээ',
        locale: 'mn',
        confidence: 0.95,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('speech.googleapis.com/v2/'),
        expect.objectContaining({ method: 'POST' }),
      );

      // Verify the request body has correct structure with audio.content (not top-level content)
      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse((callArgs[1] as RequestInit).body as string);
      expect(body).toHaveProperty('audio.content');
      expect(body.config.model).toBe('chirp_2');
      expect(body.config.languageCodes).toEqual(['mn-MN']);

      fetchSpy.mockRestore();
    });
  });
});
