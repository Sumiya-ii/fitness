import { applyDecorators, UseGuards } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';

/**
 * Marks a route as requiring an active Pro subscription.
 * Must be applied after authentication (AuthGuard must run first).
 *
 * @example
 * @Premium()
 * @Post('upload')
 * async upload() { ... }
 */
export function Premium() {
  return applyDecorators(UseGuards(SubscriptionGuard));
}
