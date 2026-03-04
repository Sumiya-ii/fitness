import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incomingId = req.headers[REQUEST_ID_HEADER.toLowerCase()] as
      | string
      | undefined;
    const requestId =
      typeof incomingId === 'string' && incomingId.trim()
        ? incomingId.trim()
        : randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
