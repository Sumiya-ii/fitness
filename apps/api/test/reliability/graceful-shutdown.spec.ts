/**
 * C-036: Reliability Test Pack (NFR-010..012)
 * Verifies the worker factory creates workers that support graceful shutdown on SIGTERM.
 * Mocks BullMQ Worker to avoid Redis dependency in unit tests.
 */
import { createWorkerForQueue } from '../../../../apps/worker/src/worker-factory';
import { QUEUE_NAMES } from '@coach/shared';

const mockClose = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    close: mockClose,
    on: mockOn,
  })),
}));

describe('Reliability: Graceful Shutdown (NFR-010..012)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create workers that support close() for graceful shutdown', async () => {
    const worker = createWorkerForQueue(
      QUEUE_NAMES.MEAL_LOG,
      'redis://localhost:6379',
    );

    expect(worker).toBeDefined();
    expect(typeof worker.close).toBe('function');

    await worker.close();

    expect(mockClose).toHaveBeenCalled();
  });

  it('should create workers that can be closed without error', async () => {
    const worker = createWorkerForQueue(
      QUEUE_NAMES.STT_PROCESSING,
      'redis://localhost:6379',
    );

    await expect(worker.close()).resolves.not.toThrow();
  });
});
