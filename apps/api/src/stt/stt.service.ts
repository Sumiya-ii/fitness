import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config';

export interface TranscribeResult {
  text: string;
  locale?: string;
  confidence?: number;
}

@Injectable()
export class SttService {
  constructor(private readonly config: ConfigService) {}

  async transcribe(audioBuffer: Buffer, locale?: string): Promise<TranscribeResult> {
    const provider = this.config.get('STT_PROVIDER');
    const googleApiKey = this.config.get('GOOGLE_STT_API_KEY');

    if (provider === 'google' || googleApiKey) {
      return this.transcribeWithGoogle(audioBuffer, locale, googleApiKey);
    }

    return {
      text: 'transcription not available (no STT provider configured)',
      locale,
    };
  }

  private async transcribeWithGoogle(
    audioBuffer: Buffer,
    locale?: string,
    apiKey?: string,
  ): Promise<TranscribeResult> {
    if (!apiKey) {
      return {
        text: 'transcription not available (GOOGLE_STT_API_KEY missing)',
        locale,
      };
    }

    const googleProjectId = this.config.get('GOOGLE_CLOUD_PROJECT');
    const recognizerPath = googleProjectId
      ? `projects/${googleProjectId}/locations/global/recognizers/_`
      : 'projects/-/locations/global/recognizers/_';

    const languageCode = locale === 'en' ? 'en-US' : 'mn-MN';

    const requestBody = {
      config: {
        autoDecodingConfig: {},
        languageCodes: [languageCode],
        model: 'chirp_2',
        features: {
          enableAutomaticPunctuation: true,
        },
      },
      content: audioBuffer.toString('base64'),
    };

    const url = `https://speech.googleapis.com/v2/${recognizerPath}:recognize?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[STT] Google STT V2 error:', response.status, errorBody);
      throw new Error(`Google STT V2 failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        alternatives?: Array<{
          transcript?: string;
          confidence?: number;
        }>;
      }>;
    };

    const topResult = data.results?.[0]?.alternatives?.[0];
    if (!topResult?.transcript) {
      return { text: '', locale, confidence: 0 };
    }

    return {
      text: topResult.transcript,
      locale,
      confidence: topResult.confidence,
    };
  }
}
