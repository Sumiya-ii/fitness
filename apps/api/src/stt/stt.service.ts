import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config';

export interface TranscribeResult {
  text: string;
  locale?: string;
  confidence?: number;
}

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(audioBuffer: Buffer, locale?: string): Promise<TranscribeResult> {
    const openaiKey = this.config.get('OPENAI_API_KEY');
    if (openaiKey) {
      return this.transcribeWithWhisper(audioBuffer, locale, openaiKey);
    }

    return {
      text: 'transcription not available (no STT provider configured)',
      locale,
    };
  }

  private async transcribeWithWhisper(
    audioBuffer: Buffer,
    locale?: string,
    apiKey?: string,
  ): Promise<TranscribeResult> {
    if (!apiKey) {
      return {
        text: 'transcription not available (OPENAI_API_KEY missing)',
        locale,
      };
    }

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
    formData.append('model', 'whisper-1');
    // Only set language for English; Mongolian is not in Whisper's ISO-639-1 list,
    // but auto-detect handles it well
    if (locale === 'en') {
      formData.append('language', 'en');
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Whisper error: ${response.status} ${errorBody}`);
      throw new Error(`Whisper STT failed: ${response.status}`);
    }

    const data = (await response.json()) as { text?: string };

    if (!data.text?.trim()) {
      return { text: '', locale, confidence: 0 };
    }

    return {
      text: data.text.trim(),
      locale,
      confidence: 0.9,
    };
  }
}
