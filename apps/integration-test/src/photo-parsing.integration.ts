/**
 * Photo-to-nutrition parsing integration tests.
 *
 * Tests both Gemini 2.0 Flash and GPT-4o vision providers.
 * Validates food recognition and nutrition estimation from real photos.
 *
 * To add test photos:
 * 1. Place .jpg files in apps/integration-test/fixtures/photos/
 * 2. Add entries in photo-expected.ts with expected nutrition ranges
 * 3. Run: npm run test:integration
 *
 * Photo tests are automatically skipped when no photo fixtures exist.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parsePhoto, readPhotoFixture, VisionProvider } from './photo-helpers';
import { PHOTO_FILES } from './photo-expected';

const photoEntries = Object.entries(PHOTO_FILES);
const photosDir = path.resolve(__dirname, '..', 'fixtures', 'photos');

/** Check which fixture photos actually exist on disk */
function getAvailablePhotos(): [string, (typeof PHOTO_FILES)[string]][] {
  return photoEntries.filter(([filename]) => {
    try {
      fs.accessSync(path.join(photosDir, filename));
      return true;
    } catch {
      return false;
    }
  });
}

function assertPhotoResult(
  result: Awaited<ReturnType<typeof parsePhoto>>,
  expected: (typeof PHOTO_FILES)[string],
) {
  // Should have items
  expect(result.items.length).toBeGreaterThanOrEqual(expected.expectedItemCount[0]);
  expect(result.items.length).toBeLessThanOrEqual(expected.expectedItemCount[1]);

  // Meal name
  if (expected.mealNameMayInclude?.length) {
    const nameMatch = expected.mealNameMayInclude.some((kw) =>
      result.mealName.toLowerCase().includes(kw.toLowerCase()),
    );
    // Soft check — log but don't fail on meal name
    if (!nameMatch) {
      console.warn(
        `[Photo] mealName "${result.mealName}" doesn't match expected keywords: ${expected.mealNameMayInclude.join(', ')}`,
      );
    }
  }

  // Macro ranges
  expect(result.totalCalories).toBeGreaterThanOrEqual(expected.totalCalories[0]);
  expect(result.totalCalories).toBeLessThanOrEqual(expected.totalCalories[1]);
  expect(result.totalProtein).toBeGreaterThanOrEqual(expected.totalProtein[0]);
  expect(result.totalProtein).toBeLessThanOrEqual(expected.totalProtein[1]);
  expect(result.totalCarbs).toBeGreaterThanOrEqual(expected.totalCarbs[0]);
  expect(result.totalCarbs).toBeLessThanOrEqual(expected.totalCarbs[1]);
  expect(result.totalFat).toBeGreaterThanOrEqual(expected.totalFat[0]);
  expect(result.totalFat).toBeLessThanOrEqual(expected.totalFat[1]);

  // Every item should have valid fields
  for (const item of result.items) {
    expect(item.calories).toBeGreaterThan(0);
    expect(item.confidence).toBeGreaterThanOrEqual(0);
    expect(item.confidence).toBeLessThanOrEqual(1);
    expect(item.servingGrams).toBeGreaterThan(0);
    expect(item.name.length).toBeGreaterThan(0);
  }
}

// --- Gemini Vision ---
const hasGemini = !!process.env.GEMINI_API_KEY;

function describeProvider(provider: VisionProvider, hasKey: boolean) {
  const available = getAvailablePhotos();
  const shouldRun = hasKey && available.length > 0;
  const describeFn = shouldRun ? describe : describe.skip;
  const skipReason = !hasKey
    ? `(${provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'} not set)`
    : '(no photo fixtures found)';

  describeFn(`Photo parsing: ${provider}${!shouldRun ? ' ' + skipReason : ''}`, () => {
    for (const [filename, expected] of available) {
      it(`parses "${expected.label}" (${filename})`, async () => {
        const base64 = readPhotoFixture(filename);
        const result = await parsePhoto(base64, provider);
        console.log(
          `[Photo:${provider}] ${filename}: mealName="${result.mealName}"`,
          JSON.stringify(result, null, 2),
        );
        assertPhotoResult(result, expected);
      });
    }
  });
}

describeProvider('gemini', hasGemini);
describeProvider('openai', !!process.env.OPENAI_API_KEY);

// Placeholder test so Jest doesn't fail when no photo fixtures exist
describe('Photo parsing setup', () => {
  it('fixture directory exists', () => {
    expect(fs.existsSync(photosDir)).toBe(true);
  });
});
