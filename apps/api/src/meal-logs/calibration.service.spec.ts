import { CalibrationService } from './calibration.service';
import { PrismaService } from '../prisma';

describe('CalibrationService', () => {
  let service: CalibrationService;
  let prisma: { userFoodCalibration: Record<string, jest.Mock> };

  beforeEach(() => {
    prisma = {
      userFoodCalibration: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };
    service = new CalibrationService(prisma as unknown as PrismaService);
  });

  it('creates a new calibration row on first sample', async () => {
    prisma.userFoodCalibration.findUnique.mockResolvedValue(null);
    await service.recordCorrection('u1', 'mn_buuz', 360, 280);

    const args = prisma.userFoodCalibration.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      userId_canonicalFoodId: { userId: 'u1', canonicalFoodId: 'mn_buuz' },
    });
    expect(args.create.sampleCount).toBe(1);
    expect(args.create.recentSamples).toHaveLength(1);
    expect(Number(args.create.medianRatio)).toBeCloseTo(0.778, 2);
  });

  it('appends to existing calibration and recomputes median', async () => {
    prisma.userFoodCalibration.findUnique.mockResolvedValue({
      medianRatio: '0.800',
      recentSamples: [0.8, 0.9],
      sampleCount: 2,
    });
    await service.recordCorrection('u1', 'mn_buuz', 100, 100); // ratio=1, but skipped <5%
    expect(prisma.userFoodCalibration.upsert).not.toHaveBeenCalled();

    await service.recordCorrection('u1', 'mn_buuz', 100, 70); // ratio=0.7
    const args = prisma.userFoodCalibration.upsert.mock.calls[0][0];
    expect(args.update.sampleCount).toBe(3);
    expect(args.update.recentSamples).toEqual([0.8, 0.9, 0.7]);
    expect(Number(args.update.medianRatio)).toBe(0.8);
  });

  it('no-ops when canonicalFoodId is null', async () => {
    await service.recordCorrection('u1', null, 360, 280);
    expect(prisma.userFoodCalibration.findUnique).not.toHaveBeenCalled();
    expect(prisma.userFoodCalibration.upsert).not.toHaveBeenCalled();
  });

  it('no-ops when correction is within ±5% of estimate (treat as accepted)', async () => {
    await service.recordCorrection('u1', 'mn_buuz', 300, 310);
    expect(prisma.userFoodCalibration.upsert).not.toHaveBeenCalled();
  });

  it('no-ops when either kcal value is non-positive', async () => {
    await service.recordCorrection('u1', 'mn_buuz', 0, 280);
    await service.recordCorrection('u1', 'mn_buuz', 360, 0);
    expect(prisma.userFoodCalibration.upsert).not.toHaveBeenCalled();
  });

  it('swallows DB errors so meal logging never fails', async () => {
    prisma.userFoodCalibration.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.recordCorrection('u1', 'mn_buuz', 360, 280)).resolves.toBeUndefined();
  });

  it('recordCorrections processes a batch', async () => {
    prisma.userFoodCalibration.findUnique.mockResolvedValue(null);
    await service.recordCorrections('u1', [
      { canonicalFoodId: 'mn_buuz', originalKcal: 360, correctedKcal: 280 },
      { canonicalFoodId: null, originalKcal: 100, correctedKcal: 100 },
      { canonicalFoodId: 'mn_khuushuur', originalKcal: 240, correctedKcal: 200 },
    ]);
    // Two valid + one null-skipped.
    expect(prisma.userFoodCalibration.upsert).toHaveBeenCalledTimes(2);
  });
});
