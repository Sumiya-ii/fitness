import { Job } from 'bullmq';

interface SttJobData {
  userId: string;
  audioBuffer: string; // base64
  locale?: string;
}

interface SttResult {
  text: string;
  locale?: string;
  confidence?: number;
}

export async function processSttJob(job: Job<SttJobData>): Promise<SttResult> {
  const { audioBuffer, locale } = job.data;
  const googleApiKey = process.env.GOOGLE_STT_API_KEY;

  if (!googleApiKey) {
    console.warn('[STT] GOOGLE_STT_API_KEY not set, returning empty transcription');
    return { text: '', locale };
  }

  const requestBody = {
    config: {
      encoding: 'LINEAR16' as const,
      languageCode: locale ?? 'mn-MN',
      alternativeLanguageCodes: locale ? undefined : ['en-US'],
      model: 'default',
      enableAutomaticPunctuation: true,
    },
    audio: {
      content: audioBuffer,
    },
  };

  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[STT] Google API error:', response.status, errorBody);
    throw new Error(`Google STT failed: ${response.status}`);
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

  return {
    text: topResult?.transcript ?? '',
    locale,
    confidence: topResult?.confidence,
  };
}
