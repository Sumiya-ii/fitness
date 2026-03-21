import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';

@Injectable()
export class VoiceCleanupService {
  private readonly logger = new Logger(VoiceCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async deleteExpiredDrafts(): Promise<void> {
    try {
      const result = await this.prisma.voiceDraft.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired voice draft(s)`);
      }
    } catch (err) {
      this.logger.error('Failed to clean up expired voice drafts', err);
    }
  }
}
