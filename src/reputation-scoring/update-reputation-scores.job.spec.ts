import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { UpdateReputationScoresJob } from '../src/providers/jobs/update-reputation-scores.job';
import { ReputationScoringService } from '../src/providers/services/reputation-scoring.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRows = [
  {
    provider_id: 'p1',
    total_signals: '50',
    winning_signals: '35',
    total_copiers: '100',
    active_copiers: '80',
    stake_amount: '5000',
    avg_rating: '4.2',
    rating_count: '20',
    active_days: '90',
    active_days_last_30: '25',
  },
  {
    provider_id: 'p2',
    total_signals: '20',
    winning_signals: '10',
    total_copiers: '30',
    active_copiers: '15',
    stake_amount: '200',
    avg_rating: '3.0',
    rating_count: '5',
    active_days: '45',
    active_days_last_30: '10',
  },
];

const mockDataSource = {
  query: jest.fn().mockResolvedValue(mockRows),
};

const mockReputationScoringService = {
  updateAllProviderScores: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UpdateReputationScoresJob', () => {
  let job: UpdateReputationScoresJob;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateReputationScoresJob,
        { provide: ReputationScoringService, useValue: mockReputationScoringService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    job = module.get<UpdateReputationScoresJob>(UpdateReputationScoresJob);
  });

  afterEach(() => jest.clearAllMocks());

  // ── handleCron ─────────────────────────────────────────────────────────────

  describe('handleCron()', () => {
    it('fetches provider metrics and delegates to the scoring service', async () => {
      await job.handleCron();

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(mockReputationScoringService.updateAllProviderScores).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ providerId: 'p1', totalSignals: 50 }),
          expect.objectContaining({ providerId: 'p2', totalSignals: 20 }),
        ]),
      );
    });

    it('correctly maps raw DB rows to ProviderMetrics objects', async () => {
      await job.handleCron();

      const [calledWith] =
        mockReputationScoringService.updateAllProviderScores.mock.calls[0];

      const p1 = calledWith.find((m: any) => m.providerId === 'p1');
      expect(p1).toMatchObject({
        providerId: 'p1',
        totalSignals: 50,
        winningSignals: 35,
        totalCopiers: 100,
        activeCopiers: 80,
        stakeAmount: 5000,
        avgRating: 4.2,
        ratingCount: 20,
        activeDays: 90,
        activeDaysLast30: 25,
      });
    });

    it('skips the update when no providers are found', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);

      await job.handleCron();

      expect(mockReputationScoringService.updateAllProviderScores).not.toHaveBeenCalled();
    });

    it('rethrows errors so the scheduler can handle failures', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(job.handleCron()).rejects.toThrow('DB connection lost');
    });

    it('handles null/undefined numeric fields gracefully (defaults to 0)', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          provider_id: 'p3',
          total_signals: null,
          winning_signals: null,
          total_copiers: '0',
          active_copiers: null,
          stake_amount: null,
          avg_rating: null,
          rating_count: '0',
          active_days: null,
          active_days_last_30: null,
        },
      ]);

      await job.handleCron();

      const [calledWith] =
        mockReputationScoringService.updateAllProviderScores.mock.calls[0];
      const p3 = calledWith[0];

      expect(p3.totalSignals).toBe(0);
      expect(p3.winningSignals).toBe(0);
      expect(p3.stakeAmount).toBe(0);
      expect(p3.avgRating).toBe(0);
      expect(p3.activeDays).toBe(0);
    });
  });

  // ── runManually ────────────────────────────────────────────────────────────

  describe('runManually()', () => {
    it('returns updated count and elapsed time', async () => {
      const result = await job.runManually();

      expect(result.updated).toBe(mockRows.length);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('delegates to updateAllProviderScores', async () => {
      await job.runManually();
      expect(mockReputationScoringService.updateAllProviderScores).toHaveBeenCalledTimes(1);
    });

    it('propagates errors thrown by the scoring service', async () => {
      mockReputationScoringService.updateAllProviderScores.mockRejectedValueOnce(
        new Error('Scoring failed'),
      );

      await expect(job.runManually()).rejects.toThrow('Scoring failed');
    });
  });
});
