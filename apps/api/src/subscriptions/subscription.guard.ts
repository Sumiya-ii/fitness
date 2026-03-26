import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const entitlement = await this.subscriptionsService.checkEntitlement(request.user.id);
    if (entitlement !== 'pro') {
      throw new ForbiddenException('Pro subscription required');
    }
    return true;
  }
}
