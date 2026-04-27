/**
 * Layer A: STT-only tests.
 * Validates OpenAI gpt-4o-transcribe correctly transcribes each audio file.
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

const describeOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeOpenAI('STT-only: OpenAI (gpt-4o-transcribe)', () => {
  for (const [filename, expected] of Object.entries(AUDIO_FILES)) {
    it(`transcribes "${expected.label}" (${filename})`, async () => {
      const text = await transcribeAudio(fixture(filename), 'mn');
      console.log(`[STT:OpenAI] ${filename}: "${text}"`);
      assertTranscript(text, expected);
    });
  }
});
