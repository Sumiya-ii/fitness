import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../config';

@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Coach Admin"');
      res.status(401).send('Authentication required');
      return;
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    if (username !== this.config.bullBoardUser || password !== this.config.bullBoardPassword) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Coach Admin"');
      res.status(401).send('Invalid credentials');
      return;
    }

    next();
  }
}
