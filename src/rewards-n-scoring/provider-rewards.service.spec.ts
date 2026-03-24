import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProviderRewardsService, PROVIDER_FEE_RATE, MINIMUM_PAYOUT_THRESHOLD } from './provider-rewards.service';
import { ProviderEarning } from '../entities/provider-earning.entity';
import { Payout, PayoutStatus } from '../entities/payout.entity';

const mockEarningRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockPayoutRepo = () => ({
  createQueryBuilder: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
});

const PROVIDER_ID = 'provider-uuid-1';
const SIGNAL_ID = 'signal-uuid-1';
const TRADE_ID = 'trade-uuid-1';

describe('ProviderRewardsService', () => {
  let service: ProviderRewardsService;
  let earningRepo: ReturnType<typeof mockEarningRepo>;
  let payoutRepo: ReturnType<typeof mockPayoutRepo>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRewardsService,
        { provide: getRepositoryToken(ProviderEarning), useFactory: mockEarningRepo },
        { provide: getRepositoryToken(Payout), useFactory: mockPayoutRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(ProviderRewardsService);
    earningRepo = module.get(getRepositoryToken(ProviderEarning));
    payoutRepo = module.get(getRepositoryToken(Payout));
    dataSource = module.get(DataSource);
  });

  // ── Fee Calculation ────────────────────────────────────────────────────

  describe('calculateProviderFee', () => {
    it('should calculate 0.1% fee correctly', () => {
      expect(service.calculateProviderFee(1000)).toBeCloseTo(1, 8);
      expect(service.calculateProviderFee(500)).toBeCloseTo(0.5, 8);
      expect(service.calculateProviderFee(10000)).toBeCloseTo(10, 8);
    });

    it('should handle small amounts', () => {
      expect(service.calculateProviderFee(0.1)).toBeCloseTo(0.0001, 8);
    });

    it('should return 0 for zero input', () => {
      expect(service.calculateProviderFee(0)).toBe(0);
    });

    it('should respect PROVIDER_FEE_RATE constant', () => {
      const traded = 5000;
      expect(service.calculateProviderFee(traded)).toBe(
        Number((traded * PROVIDER_FEE_RATE).toFixed(8)),
      );
    });
  });

  // ── Record Earning ─────────────────────────────────────────────────────

  describe('recordEarning', () => {
    const dto = {
      providerId: PROVIDER_ID,
      signalId: SIGNAL_ID,
      tradeId: TRADE_ID,
      tradedAmount: 1000,
      asset: 'XLM',
    };

    it('should create and save a new earning', async () => {
      earningRepo.findOne.mockResolvedValue(null);
      const earning: Partial<ProviderEarning> = {
        id: 'earn-1',
        providerId: PROVIDER_ID,
        amount: 1,
        asset: 'XLM',
      };
      earningRepo.create.mockReturnValue(earning);
      earningRepo.save.mockResolvedValue(earning);

      const result = await service.recordEarning(dto);

      expect(earningRepo.findOne).toHaveBeenCalledWith({ where: { tradeId: TRADE_ID } });
      expect(earningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: PROVIDER_ID,
          tradeId: TRADE_ID,
          amount: service.calculateProviderFee(1000),
          asset: 'XLM',
          isPaidOut: false,
        }),
      );
      expect(result).toEqual(earning);
    });

    it('should return existing earning if tradeId already recorded (idempotent)', async () => {
      const existing = { id: 'exist-1', tradeId: TRADE_ID };
      earningRepo.findOne.mockResolvedValue(existing);

      const result = await service.recordEarning(dto);

      expect(earningRepo.create).not.toHaveBeenCalled();
      expect(earningRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });
  });

  // ── Earnings Summary ────────────────────────────────────────────────────

  describe('getEarningsSummary', () => {
    it('should aggregate earnings correctly', async () => {
      const earnings: Partial<ProviderEarning>[] = [
        { amount: 5 as any, isPaidOut: false },
        { amount: 3 as any, isPaidOut: true },
        { amount: 2 as any, isPaidOut: false },
      ];
      const recentEarnings = earnings.map((e, i) => ({
        ...e,
        id: `e${i}`,
        providerId: PROVIDER_ID,
        signalId: SIGNAL_ID,
        tradeId: `t${i}`,
        tradedAmount: 1000,
        asset: 'XLM',
        createdAt: new Date(),
        payoutId: null,
      }));

      earningRepo.find
        .mockResolvedValueOnce(recentEarnings) // allEarnings
        .mockResolvedValueOnce(recentEarnings.slice(0, 10)); // recentEarnings

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      payoutRepo.createQueryBuilder.mockReturnValue(qb);

      const summary = await service.getEarningsSummary(PROVIDER_ID);

      expect(summary.totalEarned).toBeCloseTo(10, 8);
      expect(summary.paidOut).toBeCloseTo(3, 8);
      expect(summary.availableBalance).toBeCloseTo(7, 8);
      expect(summary.pendingPayouts).toBe(0);
      expect(summary.canRequestPayout).toBe(false); // 7 < 10
      expect(summary.minimumPayoutThreshold).toBe(MINIMUM_PAYOUT_THRESHOLD);
    });

    it('should set canRequestPayout=true when balance >= threshold', async () => {
      const earnings = [{ amount: 50 as any, isPaidOut: false }];
      const full = [{ ...earnings[0], id: 'e1', providerId: PROVIDER_ID, signalId: SIGNAL_ID, tradeId: 't1', tradedAmount: 50000, asset: 'XLM', createdAt: new Date(), payoutId: null }];
      earningRepo.find.mockResolvedValue(full);

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      payoutRepo.createQueryBuilder.mockReturnValue(qb);

      const summary = await service.getEarningsSummary(PROVIDER_ID);
      expect(summary.canRequestPayout).toBe(true);
    });

    it('should subtract pending payouts from available balance', async () => {
      const earnings = [{ amount: 20 as any, isPaidOut: false }];
      const full = [{ ...earnings[0], id: 'e1', providerId: PROVIDER_ID, signalId: SIGNAL_ID, tradeId: 't1', tradedAmount: 20000, asset: 'XLM', createdAt: new Date(), payoutId: null }];
      earningRepo.find.mockResolvedValue(full);

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '15' }),
      };
      payoutRepo.createQueryBuilder.mockReturnValue(qb);

      const summary = await service.getEarningsSummary(PROVIDER_ID);
      expect(summary.availableBalance).toBeCloseTo(5, 8);
      expect(summary.canRequestPayout).toBe(false);
    });
  });

  // ── Mark Earnings As Paid Out ───────────────────────────────────────────

  describe('markEarningsAsPaidOut', () => {
    it('should mark sufficient earnings as paid out', async () => {
      const earnings: Partial<ProviderEarning>[] = [
        { id: 'e1', amount: 5 as any, isPaidOut: false, payoutId: null },
        { id: 'e2', amount: 5 as any, isPaidOut: false, payoutId: null },
        { id: 'e3', amount: 5 as any, isPaidOut: false, payoutId: null },
      ];

      const managerMock = {
        find: jest.fn().mockResolvedValue(earnings),
        save: jest.fn().mockResolvedValue(earnings),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await service.markEarningsAsPaidOut(PROVIDER_ID, 'payout-1', 10);

      const saved = managerMock.save.mock.calls[0][1] as ProviderEarning[];
      expect(saved.every((e) => e.isPaidOut === true)).toBe(true);
      expect(saved.every((e) => e.payoutId === 'payout-1')).toBe(true);
    });
  });

  // ── Earnings List ────────────────────────────────────────────────────────

  describe('getEarningsList', () => {
    it('should return paginated earnings', async () => {
      const earnings = [{ id: 'e1' }];
      earningRepo.findAndCount.mockResolvedValue([earnings, 1]);

      const result = await service.getEarningsList(PROVIDER_ID, 1, 10);

      expect(result.data).toEqual(earnings);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
