import { ConfigService } from './config.service';

describe('ConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://localhost:5432/coach_test',
      REDIS_URL: 'redis://localhost:6379',
      FIREBASE_PROJECT_ID: 'test-project',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create service with valid env', () => {
    const service = new ConfigService();
    expect(service.port).toBe(4000);
    expect(service.isTest).toBe(true);
    expect(service.isDevelopment).toBe(false);
    expect(service.isProduction).toBe(false);
    expect(service.databaseUrl).toBe('postgresql://localhost:5432/coach_test');
    expect(service.redisUrl).toBe('redis://localhost:6379');
  });

  it('should get config by key', () => {
    const service = new ConfigService();
    expect(service.get('FIREBASE_PROJECT_ID')).toBe('test-project');
  });

  it('should throw on invalid env', () => {
    delete process.env.DATABASE_URL;
    expect(() => new ConfigService()).toThrow('Environment validation failed');
  });
});
