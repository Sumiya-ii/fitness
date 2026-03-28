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
    it('should return fallback when no provider configured', async () => {
      configGet.mockImplementation(() => undefined);

      const result = await service.transcribe(Buffer.from('fake-audio'));

      expect(result).toEqual({
        text: 'transcription not available (no STT provider configured)',
        locale: undefined,
      });
    });

    it('should return fallback when OPENAI_API_KEY is missing', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return undefined;
        return undefined;
      });

      const result = await service.transcribe(Buffer.from('fake-audio'), 'mn');

      expect(result).toEqual({
        text: 'transcription not available (no STT provider configured)',
        locale: 'mn',
      });
    });

    it('should call Whisper API with correct parameters for Mongolian', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test-key';
        return undefined;
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Би бууз идлээ' }),
      } as Response);

      const result = await service.transcribe(Buffer.from('fake-audio'), 'mn');

      expect(result).toEqual({
        text: 'Би бууз идлээ',
        locale: 'mn',
        confidence: 0.9,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/transcriptions',
        expect.objectContaining({ method: 'POST' }),
      );

      // Verify auth header
      const callArgs = fetchSpy.mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-key');

      fetchSpy.mockRestore();
    });

    it('should use English language code when locale is en', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test-key';
        return undefined;
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'I ate two buuz' }),
      } as Response);

      const result = await service.transcribe(Buffer.from('fake-audio'), 'en');

      expect(result.text).toBe('I ate two buuz');
      expect(result.locale).toBe('en');

      fetchSpy.mockRestore();
    });
  });
});
