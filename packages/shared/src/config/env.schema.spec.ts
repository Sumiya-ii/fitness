import { validateEnv } from './env.schema';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://localhost:5432/coach',
  REDIS_URL: 'redis://localhost:6379',
  FIREBASE_PROJECT_ID: 'test-project',
};

describe('validateEnv', () => {
  it('should accept valid minimal env', () => {
    const config = validateEnv(validEnv);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/coach');
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.FIREBASE_PROJECT_ID).toBe('test-project');
  });

  it('should apply default values', () => {
    const env = { ...validEnv };
    delete (env as Record<string, string | undefined>).NODE_ENV;
    delete (env as Record<string, string | undefined>).PORT;
    const config = validateEnv(env);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
  });

  it('should throw on missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...env } = validEnv;
    expect(() => validateEnv(env)).toThrow('Environment validation failed');
    expect(() => validateEnv(env)).toThrow('DATABASE_URL');
  });

  it('should throw on missing REDIS_URL', () => {
    const { REDIS_URL: _, ...env } = validEnv;
    expect(() => validateEnv(env)).toThrow('Environment validation failed');
    expect(() => validateEnv(env)).toThrow('REDIS_URL');
  });

  it('should throw on missing FIREBASE_PROJECT_ID', () => {
    const { FIREBASE_PROJECT_ID: _, ...env } = validEnv;
    expect(() => validateEnv(env)).toThrow('Environment validation failed');
    expect(() => validateEnv(env)).toThrow('FIREBASE_PROJECT_ID');
  });

  it('should throw on invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      'Environment validation failed',
    );
  });

  it('should coerce PORT from string to number', () => {
    const config = validateEnv({ ...validEnv, PORT: '8080' });
    expect(config.PORT).toBe(8080);
  });

  it('should accept all optional fields', () => {
    const config = validateEnv({
      ...validEnv,
      TELEGRAM_BOT_TOKEN: 'bot-token',
      S3_BUCKET: 'my-bucket',
      SENTRY_DSN: 'https://sentry.io/123',
    });
    expect(config.TELEGRAM_BOT_TOKEN).toBe('bot-token');
    expect(config.S3_BUCKET).toBe('my-bucket');
    expect(config.SENTRY_DSN).toBe('https://sentry.io/123');
  });
});
