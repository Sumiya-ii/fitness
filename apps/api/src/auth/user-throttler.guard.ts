import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: { user?: { id?: string }; ip: string }): Promise<string> {
    return req.user?.id ?? req.ip;
  }
}
