import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request } from 'express';
import { Observable, from, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import type { AuthenticatedUser } from '../auth';

const MOBILE_OFFLINE_SYSTEM = 'mobile_offline_write';
const IDEMPOTENCY_TTL_DAYS = 30;

interface CachedIdempotencyResponse {
  found: boolean;
  body: unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const method = request.method.toUpperCase();
    const rawKey = request.header('idempotency-key') ?? request.header('x-idempotency-key');

    if (!rawKey || !request.user?.id || !['POST', 'PUT', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const path = request.path ?? request.originalUrl ?? '';
    const externalEventId = `${request.user.id}:${method}:${path}:${rawKey}`.slice(0, 255);

    return from(this.getCachedResponse(externalEventId)).pipe(
      mergeMap((cached) => {
        if (cached.found) return of(cached.body);
        return next
          .handle()
          .pipe(
            mergeMap((body) =>
              from(this.storeResponse(externalEventId, body)).pipe(map(() => body)),
            ),
          );
      }),
    );
  }

  private async getCachedResponse(externalEventId: string): Promise<CachedIdempotencyResponse> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: {
        externalSystem_externalEventId: {
          externalSystem: MOBILE_OFFLINE_SYSTEM,
          externalEventId,
        },
      },
    });

    if (!record || record.expiresAt <= new Date()) return { found: false, body: null };
    return { found: true, body: record.responseBody ?? null };
  }

  private async storeResponse(externalEventId: string, body: unknown): Promise<void> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000);
    const responseBody = body === undefined ? Prisma.JsonNull : (body as Prisma.InputJsonValue);

    await this.prisma.idempotencyKey
      .create({
        data: {
          externalSystem: MOBILE_OFFLINE_SYSTEM,
          externalEventId,
          responseStatus: 200,
          responseBody,
          expiresAt,
        },
      })
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return;
        }
        throw err;
      });
  }
}
