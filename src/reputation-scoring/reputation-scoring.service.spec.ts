import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ReputationScoringService,
  ProviderMetrics,
} from '../src/providers/services/reputation-scoring.service';
import { ReputationScore } from '../src/providers/entities/reputation-score.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildMetrics = (overrides: Partial<ProviderMetrics> = {}): ProviderMetrics => ({
  providerId: 'provider-uuid-1',
  totalSignals: 50,
  winningSignals: 35,
  totalCopiers: 100,
  activeCopiers: 80,
  stakeAmount: 5000,
  avgRating: 4.2,
  ratingCount: 20,
  activeDays: 90,
  activeDaysLast30: 25,
  ...overrides,
});

const mockRepoFactory = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockDataSource = {
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReputationScoringService', () => {
  let service: ReputationScoringService;
  let repo: jest.Mocked<Repository<ReputationScore>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationScoringService,
        {
          provide: getRepositoryToken(ReputationScore),
          useFactory: mockRepoFactory,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ReputationScoringService>(ReputationScoringService);
    repo = module.get(getRepositoryToken(ReputationScore));
  });

  afterEach(() => jest.clearAllMocks());

  // ── calculateScore ──────────────────────────────────────────────────────────

  describe('calculateScore()', () => {
    it('returns a score between 0 and 100', () => {
      const result = service.calculateScore(buildMetrics());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('produces correct breakdown for a well-performing provider', () => {
      const metrics = buildMetrics({
        totalSignals: 100,
        winningSignals: 70,   // 70% win rate
        totalCopiers: 200,
        activeCopiers: 180,   // 90% retention
        activeDaysLast30: 28, // high consistency
        stakeAmount: 10_000,  // max stake
        avgRating: 5,
        ratingCount: 50,
        activeDays: 120,
      });

      const result = service.calculateScore(metrics);

      // Win rate ≈ 70 → weighted contribution: 70 * 0.4 = 28
      expect(result.winRate).toBeCloseTo(70, 0);
      // Consistency ≈ 28/30 ≈ 93
      expect(result.consistencyScore).toBeGreaterThan(80);
      // Retention ≈ 90
      expect(result.retentionRate).toBeGreaterThan(85);
      // Score should be well above 50 for a strong provider
      expect(result.score).toBeGreaterThan(60);
    });

    it('returns a low score for a poor performer', () => {
      const metrics = buildMetrics({
        totalSignals: 50,
        winningSignals: 10,  // 20% win rate
        totalCopiers: 100,
        activeCopiers: 10,   // 10% retention
        activeDaysLast30: 3,
        stakeAmount: 0,
        avgRating: 1,
        ratingCount: 5,
        activeDays: 90,
      });

      const result = service.calculateScore(metrics);
      expect(result.score).toBeLessThan(30);
    });

    it('returns score within 0-100 for a perfect provider', () => {
      const perfect = buildMetrics({
        totalSignals: 200,
        winningSignals: 200,
        totalCopiers: 500,
        activeCopiers: 500,
        activeDaysLast30: 30,
        stakeAmount: 100_000,
        avgRating: 5,
        ratingCount: 100,
        activeDays: 365,
      });
      const { score } = service.calculateScore(perfect);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThan(90);
    });

    it('returns score within 0-100 for the worst possible provider', () => {
      const worst = buildMetrics({
        totalSignals: 50,
        winningSignals: 0,
        totalCopiers: 100,
        activeCopiers: 0,
        activeDaysLast30: 0,
        stakeAmount: 0,
        avgRating: 1,
        ratingCount: 10,
        activeDays: 90,
      });
      const { score } = service.calculateScore(worst);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    // ── New provider dampening ─────────────────────────────────────────────

    it('flags new providers and dampens extreme scores', () => {
      const newProvider = buildMetrics({
        totalSignals: 3,
        winningSignals: 3, // 100% win rate but only 3 signals
        activeDays: 5,
        activeDaysLast30: 5,
      });

      const established = buildMetrics({
        totalSignals: 50,
        winningSignals: 50,
        activeDays: 120,
        activeDaysLast30: 28,
      });

      const newResult = service.calculateScore(newProvider);
      const estResult = service.calculateScore(established);

      expect(newResult.isNewProvider).toBe(true);
      expect(estResult.isNewProvider).toBe(false);
      // Dampening pulls toward 50, so the new provider's inflated score should be lower
      expect(newResult.score).toBeLessThan(estResult.score);
    });

    it('marks provider as new when activeDays < 30', () => {
      const result = service.calculateScore(
        buildMetrics({ activeDays: 10, totalSignals: 50 }),
      );
      expect(result.isNewProvider).toBe(true);
    });

    it('marks provider as new when totalSignals < 10', () => {
      const result = service.calculateScore(
        buildMetrics({ totalSignals: 5, activeDays: 90 }),
      );
      expect(result.isNewProvider).toBe(true);
    });

    // ── Edge cases ────────────────────────────────────────────────────────────

    it('returns 0 winRate when totalSignals is 0', () => {
      const result = service.calculateScore(buildMetrics({ totalSignals: 0, winningSignals: 0 }));
      expect(result.winRate).toBe(0);
    });

    it('returns 0 retentionRate when totalCopiers is 0', () => {
      const result = service.calculateScore(
        buildMetrics({ totalCopiers: 0, activeCopiers: 0 }),
      );
      expect(result.retentionRate).toBe(0);
    });

    it('applies logarithmic stake bonus to limit whale advantage', () => {
      const smallStake = service.calculateScore(buildMetrics({ stakeAmount: 100 }));
      const bigStake = service.calculateScore(buildMetrics({ stakeAmount: 10_000 }));
      const hugeStake = service.calculateScore(buildMetrics({ stakeAmount: 1_000_000 }));

      expect(bigStake.stakeBonus).toBeGreaterThan(smallStake.stakeBonus);
      // Huge stake should not dramatically exceed the full-bonus threshold
      expect(hugeStake.stakeBonus).toBeLessThanOrEqual(100);
    });

    it('blends low rating-count toward neutral (50)', () => {
      const fewRatings = service.calculateScore(
        buildMetrics({ avgRating: 5, ratingCount: 1 }),
      );
      const manyRatings = service.calculateScore(
        buildMetrics({ avgRating: 5, ratingCount: 50 }),
      );
      // With few ratings the contribution is pulled toward 50, so it's smaller
      expect(fewRatings.avgRating).toBeLessThan(manyRatings.avgRating);
    });
  });

  // ── updateProviderScore ───────────────────────────────────────────────────

  describe('updateProviderScore()', () => {
    it('creates a new score record and saves it', async () => {
      repo.findOne.mockResolvedValue(null);
      const mockSaved: Partial<ReputationScore> = {
        id: 'score-id-1',
        providerId: 'provider-uuid-1',
        score: 72.5,
      };
      repo.create.mockReturnValue(mockSaved as ReputationScore);
      repo.save.mockResolvedValue(mockSaved as ReputationScore);

      const result = await service.updateProviderScore(buildMetrics());

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { providerId: 'provider-uuid-1' } }),
      );
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(mockSaved);
      expect(result.providerId).toBe('provider-uuid-1');
    });

    it('applies EMA smoothing when a previous score exists', async () => {
      const previousRecord = {
        smoothedScore: 60,
        recordedAt: new Date(Date.now() - 86400000),
      } as ReputationScore;

      repo.findOne.mockResolvedValue(previousRecord);
      repo.create.mockImplementation((data) => data as ReputationScore);
      repo.save.mockImplementation(async (data) => data as ReputationScore);

      const result = await service.updateProviderScore(buildMetrics());

      // EMA: 0.3 * currentScore + 0.7 * 60
      const currentScore = result.score;
      const expectedSmoothed = 0.3 * currentScore + 0.7 * 60;
      expect(result.smoothedScore).toBeCloseTo(expectedSmoothed, 0);
    });

    it('uses raw score as smoothedScore when no prior record exists', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data) => data as ReputationScore);
      repo.save.mockImplementation(async (data) => data as ReputationScore);

      const result = await service.updateProviderScore(buildMetrics());
      expect(result.smoothedScore).toBeCloseTo(result.score, 1);
    });

    it('sets isNewProvider flag correctly on the saved entity', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data) => data as ReputationScore);
      repo.save.mockImplementation(async (data) => data as ReputationScore);

      const result = await service.updateProviderScore(
        buildMetrics({ totalSignals: 3, activeDays: 5 }),
      );
      expect(result.isNewProvider).toBe(true);
    });
  });

  // ── updateAllProviderScores ───────────────────────────────────────────────

  describe('updateAllProviderScores()', () => {
    it('processes all providers without throwing', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((d) => d as ReputationScore);
      repo.save.mockImplementation(async (d) => d as ReputationScore);

      await expect(
        service.updateAllProviderScores([
          buildMetrics({ providerId: 'p1' }),
          buildMetrics({ providerId: 'p2' }),
          buildMetrics({ providerId: 'p3' }),
        ]),
      ).resolves.not.toThrow();

      expect(repo.save).toHaveBeenCalledTimes(3);
    });

    it('continues processing remaining providers if one fails', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((d) => d as ReputationScore);
      repo.save
        .mockResolvedValueOnce({ id: 'ok' } as ReputationScore) // p1 ok
        .mockRejectedValueOnce(new Error('DB error'))            // p2 fails
        .mockResolvedValueOnce({ id: 'ok' } as ReputationScore); // p3 ok

      await expect(
        service.updateAllProviderScores([
          buildMetrics({ providerId: 'p1' }),
          buildMetrics({ providerId: 'p2' }),
          buildMetrics({ providerId: 'p3' }),
        ]),
      ).resolves.not.toThrow();
    });

    it('is a no-op (no saves) when the list is empty', async () => {
      await service.updateAllProviderScores([]);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ── getLatestScore ────────────────────────────────────────────────────────

  describe('getLatestScore()', () => {
    it('returns the most recent score for a provider', async () => {
      const mockScore = { id: 'score-1', score: 75 } as ReputationScore;
      repo.findOne.mockResolvedValue(mockScore);

      const result = await service.getLatestScore('provider-uuid-1');

      expect(result).toEqual(mockScore);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerId: 'provider-uuid-1' },
          order: { recordedAt: 'DESC' },
        }),
      );
    });

    it('returns null when no score exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.getLatestScore('unknown');
      expect(result).toBeNull();
    });
  });

  // ── getScoreHistory ───────────────────────────────────────────────────────

  describe('getScoreHistory()', () => {
    it('returns paginated score history', async () => {
      const history = [
        { id: '1', score: 70 },
        { id: '2', score: 68 },
      ] as ReputationScore[];
      repo.find.mockResolvedValue(history);

      const result = await service.getScoreHistory('provider-uuid-1', 30);

      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerId: 'provider-uuid-1' },
          take: 30,
        }),
      );
    });
  });

  // ── getLeaderboard ────────────────────────────────────────────────────────

  describe('getLeaderboard()', () => {
    it('calls getRawMany and returns results', async () => {
      const mockLeaderboard = [
        { providerId: 'p1', smoothedScore: 88 },
        { providerId: 'p2', smoothedScore: 75 },
      ];
      mockDataSource.createQueryBuilder().getRawMany.mockResolvedValue(
        mockLeaderboard,
      );

      const result = await service.getLeaderboard(10);
      expect(result).toEqual(mockLeaderboard);
    });
  });
});
