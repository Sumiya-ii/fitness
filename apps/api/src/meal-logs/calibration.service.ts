import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { applySample, computeRatio } from '@coach/shared';
import { PrismaService } from '../prisma';

/**
 * Records corrections between AI-estimated and user-saved calories for a
 * canonical food, per user. The worker reads the resulting `medianRatio` to
 * scale future estimates (see apps/worker/src/calibration.ts).
 *
 * All writes are best-effort: a failure here must not break meal logging,
 * which is why the public methods catch and log instead of rethrowing.
 */
@Injectable()
export class CalibrationService {
  private readonly logger = new Logger(CalibrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compare an estimate vs the saved value for a single canonical food and
   * append the ratio to that user's calibration row. No-op when the canonical
   * id is null, the ratio is unusable, or the deltas are too small to learn
   * from (within ±5%).
   */
  async recordCorrection(
    userId: string,
    canonicalFoodId: string | null,
    originalKcal: number,
    correctedKcal: number,
  ): Promise<void> {
    if (!canonicalFoodId) return;
    const ratio = computeRatio(originalKcal, correctedKcal);
    if (ratio == null) return;
    // Within ±5% — not enough signal, treat as "user accepted estimate".
    if (Math.abs(ratio - 1) < 0.05) return;

    try {
      const existing = await this.prisma.userFoodCalibration.findUnique({
        where: { userId_canonicalFoodId: { userId, canonicalFoodId } },
      });

      const prevSamples = Array.isArray(existing?.recentSamples)
        ? (existing!.recentSamples as number[]).filter((n) => typeof n === 'number')
        : [];

      const next = applySample(
        existing
          ? {
              recentSamples: prevSamples,
              medianRatio: Number(existing.medianRatio),
              sampleCount: existing.sampleCount,
            }
          : null,
        ratio,
      );

      await this.prisma.userFoodCalibration.upsert({
        where: { userId_canonicalFoodId: { userId, canonicalFoodId } },
        create: {
          userId,
          canonicalFoodId,
          medianRatio: new Prisma.Decimal(next.medianRatio.toFixed(3)),
          recentSamples: next.recentSamples,
          sampleCount: next.sampleCount,
        },
        update: {
          medianRatio: new Prisma.Decimal(next.medianRatio.toFixed(3)),
          recentSamples: next.recentSamples,
          sampleCount: next.sampleCount,
        },
      });
    } catch (err) {
      this.logger.warn(
        `recordCorrection failed (non-fatal) for user=${userId} food=${canonicalFoodId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Bulk-record corrections from a voice draft save. Each entry is
   * (canonicalFoodId, estimatedKcal, savedKcal). Runs all upserts in parallel
   * and never throws.
   */
  async recordCorrections(
    userId: string,
    entries: Array<{
      canonicalFoodId: string | null;
      originalKcal: number;
      correctedKcal: number;
    }>,
  ): Promise<void> {
    await Promise.all(
      entries.map((e) =>
        this.recordCorrection(userId, e.canonicalFoodId, e.originalKcal, e.correctedKcal),
      ),
    );
  }
}
