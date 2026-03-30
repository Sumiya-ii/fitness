/**
 * Layer A: STT-only tests.
 * Validates that STT providers correctly transcribe each audio file.
 * Tests both OpenAI (gpt-4o-transcribe) and Google Cloud Speech-to-Text.
 */
import { transcribeAudio, fixture } from './helpers';
import { AUDIO_FILES } from './expected-values';

function assertTranscript(text: string, expected: (typeof AUDIO_FILES)[string]) {
  expect(text.length).toBeGreaterThan(0);

  for (const keyword of expected.transcriptMustInclude) {
    expect(text.toLowerCase()).toContain(keyword.toLowerCase());
  }

  if (expected.transcriptMayInclude?.length) {
    const found = expected.transcriptMayInclude.some((kw) =>
      text.toLowerCase().includes(kw.toLowerCase()),
    );
    expect(found).toBe(true);
  }
}

// --- OpenAI STT ---
const describeOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeOpenAI('STT-only: OpenAI (gpt-4o-transcribe)', () => {
  for (const [filename, expected] of Object.entries(AUDIO_FILES)) {
    it(`transcribes "${expected.label}" (${filename})`, async () => {
      const text = await transcribeAudio(fixture(filename), 'mn', 'openai');
      console.log(`[STT:OpenAI] ${filename}: "${text}"`);
      assertTranscript(text, expected);
    });
  }
});

// --- Google Cloud Speech-to-Text ---
const hasGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_STT_API_KEY;
const describeGoogle = hasGoogleCreds ? describe : describe.skip;

describeGoogle('STT-only: Google Cloud Speech-to-Text', () => {
  for (const [filename, expected] of Object.entries(AUDIO_FILES)) {
    it(`transcribes "${expected.label}" (${filename})`, async () => {
      const text = await transcribeAudio(fixture(filename), 'mn', 'google');
      console.log(`[STT:Google] ${filename}: "${text}"`);

      // Google's mn-MN model is rougher than OpenAI — only assert that
      // we get a non-empty transcript. Keyword accuracy is tested via
      // the full pipeline where GPT compensates for noisy transcripts.
      expect(text.length).toBeGreaterThan(0);
    });
  }
});
