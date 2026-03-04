import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config';

export interface TranscribeResult {
  text: string;
  locale?: string;
}

@Injectable()
export class SttService {
  constructor(private readonly config: ConfigService) {}

  async transcribe(
    _audioBuffer: Buffer,
    locale?: string,
  ): Promise<TranscribeResult> {
    const provider = this.config.get('STT_PROVIDER');
    if (!provider) {
      return { text: 'transcription not available', locale };
    }
    // Placeholder: provider-specific implementations would go here
    // (e.g. Google STT, Chimege, etc.)
    return { text: 'transcription not available', locale };
  }
}
