import { Test, TestingModule } from '@nestjs/testing';
import { TelegramFoodParserService } from './telegram-food-parser.service';
import { ConfigService } from '../config';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    disconnect: jest.fn(),
  }));
});

// Mock openai
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') return 'test-key';
    if (key === 'REDIS_URL') return 'redis://localhost:6379';
    return undefined;
  }),
};

describe('TelegramFoodParserService', () => {
  let service: TelegramFoodParserService;
  let openaiCreateMock: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramFoodParserService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TelegramFoodParserService>(TelegramFoodParserService);

    // Access the openai mock through the service instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openaiCreateMock = (service as any).openai?.chat?.completions?.create;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parse()', () => {
    it('returns isFoodLog=true with items for a food logging message', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFoodLog: true,
                mealType: null,
                items: [
                  {
                    name: 'буузт',
                    quantity: 3,
                    unit: 'piece',
                    calories: 270,
                    protein: 21,
                    carbs: 18,
                    fat: 12,
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await service.parse('3 буузт идлээ');

      expect(result.isFoodLog).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('буузт');
      expect(result.items[0].quantity).toBe(3);
      expect(result.items[0].calories).toBe(270);
      expect(result.totalCalories).toBe(270);
      expect(result.totalProtein).toBe(21);
      expect(result.totalCarbs).toBe(18);
      expect(result.totalFat).toBe(12);
    });

    it('returns isFoodLog=false for a coaching question', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFoodLog: false,
                mealType: null,
                items: [],
              }),
            },
          },
        ],
      });

      const result = await service.parse('маргааш юу идэх вэ?');

      expect(result.isFoodLog).toBe(false);
      expect(result.items).toHaveLength(0);
      expect(result.totalCalories).toBe(0);
    });

    it('detects mealType when mentioned in message', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFoodLog: true,
                mealType: 'breakfast',
                items: [
                  {
                    name: 'өндөг',
                    quantity: 2,
                    unit: 'piece',
                    calories: 140,
                    protein: 12,
                    carbs: 1,
                    fat: 10,
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await service.parse('өглөөний хоолоор 2 өндөг идлээ');

      expect(result.isFoodLog).toBe(true);
      expect(result.mealType).toBe('breakfast');
    });

    it('aggregates totals across multiple items', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFoodLog: true,
                mealType: 'lunch',
                items: [
                  {
                    name: 'цуйван',
                    quantity: 1,
                    unit: 'bowl',
                    calories: 550,
                    protein: 28,
                    carbs: 60,
                    fat: 20,
                    confidence: 0.9,
                  },
                  {
                    name: 'сүүтэй цай',
                    quantity: 1,
                    unit: 'cup',
                    calories: 35,
                    protein: 2,
                    carbs: 2,
                    fat: 2,
                    confidence: 0.95,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await service.parse('цуйван, сүүтэй цай уулаа');

      expect(result.totalCalories).toBe(585);
      expect(result.items).toHaveLength(2);
    });

    it('returns isFoodLog=false when OpenAI fails (graceful fallback)', async () => {
      openaiCreateMock.mockRejectedValueOnce(new Error('OpenAI rate limit'));

      const result = await service.parse('3 буузт идлээ');

      expect(result.isFoodLog).toBe(false);
      expect(result.items).toHaveLength(0);
    });

    it('returns isFoodLog=false when OpenAI returns invalid JSON', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: 'not json at all' } }],
      });

      const result = await service.parse('3 буузт идлээ');

      expect(result.isFoodLog).toBe(false);
    });

    it('clamps confidence values to 0.0–1.0 range', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFoodLog: true,
                mealType: null,
                items: [
                  {
                    name: 'food',
                    quantity: 1,
                    unit: 'serving',
                    calories: 100,
                    protein: 5,
                    carbs: 10,
                    fat: 3,
                    confidence: 1.5, // out of range
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await service.parse('some food');

      expect(result.items[0].confidence).toBe(1.0);
    });

    it('ignores invalid mealType values from GPT', async () => {
      openaiCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFoodLog: true,
                mealType: 'midnight_snack', // invalid
                items: [
                  {
                    name: 'буузт',
                    quantity: 1,
                    unit: 'piece',
                    calories: 90,
                    protein: 7,
                    carbs: 6,
                    fat: 4,
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await service.parse('нэг буузт идлээ');

      expect(result.mealType).toBeNull();
    });
  });

  describe('draft management', () => {
    it('saveDraft stores draft in Redis with TTL', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const redisMock = (service as any).redis;
      const draft = {
        isFoodLog: true as const,
        items: [],
        mealType: null,
        totalCalories: 270,
        totalProtein: 21,
        totalCarbs: 18,
        totalFat: 12,
        originalText: '3 буузт идлээ',
      };

      await service.saveDraft(123456, draft);

      expect(redisMock.set).toHaveBeenCalledWith(
        'tg:draft:123456',
        JSON.stringify(draft),
        'EX',
        600,
      );
    });

    it('getDraft returns null when draft does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).redis.get.mockResolvedValueOnce(null);

      const result = await service.getDraft(123456);

      expect(result).toBeNull();
    });

    it('getDraft returns parsed draft when it exists', async () => {
      const draft = {
        isFoodLog: true,
        items: [
          {
            name: 'буузт',
            quantity: 3,
            unit: 'piece',
            calories: 270,
            protein: 21,
            carbs: 18,
            fat: 12,
            confidence: 0.9,
          },
        ],
        mealType: null,
        totalCalories: 270,
        totalProtein: 21,
        totalCarbs: 18,
        totalFat: 12,
        originalText: '3 буузт идлээ',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).redis.get.mockResolvedValueOnce(JSON.stringify(draft));

      const result = await service.getDraft(123456);

      expect(result).toEqual(draft);
    });

    it('deleteDraft removes key from Redis', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const redisMock = (service as any).redis;

      await service.deleteDraft(123456);

      expect(redisMock.del).toHaveBeenCalledWith('tg:draft:123456');
    });
  });
});
