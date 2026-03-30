/**
 * Shared e2e test setup — creates a NestJS test app with mocked auth + services.
 *
 * Every controller is tested through real HTTP calls (supertest).
 * External boundaries (Prisma, Firebase, Redis, queues) are mocked.
 */
import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@coach/shared';
import { AuthenticatedUser } from '../../src/auth/auth.service';

/* ------------------------------------------------------------------ */
/*  Fake user that the AuthGuard will inject on every request          */
/* ------------------------------------------------------------------ */
export const TEST_USER: AuthenticatedUser = {
  id: '00000000-0000-4000-a000-000000000001',
  firebaseUid: 'firebase-uid-test',
  email: 'test@coach.mn',
  phone: '+97699999999',
};

export const ADMIN_USER: AuthenticatedUser = {
  id: 'admin-0000-0000-0000-000000000001',
  firebaseUid: 'firebase-uid-admin',
  email: 'admin@coach.mn',
  phone: '+97611111111',
};

/* ------------------------------------------------------------------ */
/*  Fake AuthGuard that always passes and attaches TEST_USER           */
/* ------------------------------------------------------------------ */
export class FakeAuthGuard {
  private static currentUser: AuthenticatedUser = TEST_USER;

  static setUser(user: AuthenticatedUser) {
    FakeAuthGuard.currentUser = user;
  }

  static reset() {
    FakeAuthGuard.currentUser = TEST_USER;
  }

  canActivate(context: import('@nestjs/common').ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // If route is public (checked by real guard via Reflector), just let it through
    // We still attach user for convenience but won't fail without it
    req.user = FakeAuthGuard.currentUser;
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: prefix a path with the API prefix                         */
/* ------------------------------------------------------------------ */
export function url(path: string): string {
  const prefix = API_PREFIX.startsWith('/') ? API_PREFIX : `/${API_PREFIX}`;
  return `${prefix}/${path.replace(/^\//, '')}`;
}

/* ------------------------------------------------------------------ */
/*  Bootstrap helpers                                                  */
/* ------------------------------------------------------------------ */
export async function createTestApp(moduleFixture: TestingModule): Promise<INestApplication> {
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix(API_PREFIX);
  await app.init();
  return app;
}
