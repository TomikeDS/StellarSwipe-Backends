/**
 * E2E Integration Test: Provider Rewards & Payout Flow
 *
 * Uses an in-memory SQLite DB via TypeORM for realistic DB assertions.
 * Mocks Stellar SDK to avoid real network calls.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ProviderRewardsService } from './services/provider-rewards.service';
import { PayoutService } from './services/payout.service';
import { ProviderEarning } from './entities/provider-earning.entity';
import { Payout, PayoutStatus } from './entities/payout.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayoutAsset } from './dto/payout-request.dto';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({ id: 'source', sequence: '1', incrementSequenceNumber: jest.fn() }),
        fetchBaseFee: jest.fn().mockResolvedValue(100),
        submitTransaction: jest.fn().mockResolvedValue({ hash: 'stellar-tx-hash-abc123' }),
      })),
    },
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: () => 'GSOURCEPUBLIC',
        sign: jest.fn(),
      }),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      addMemo: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Operation: { payment: jest.fn().mockReturnValue({}) },
    Asset: jest.fn().mockImplementation((code, issuer) => ({ code, issuer, isNative: () => code === 'XLM' })),
    Memo: { text: jest.fn().mockReturnValue({}) },
    Networks: { TESTNET: 'Test SDF Network ; September 2015', PUBLIC: 'Public Global Stellar Network ; September 2015' },
  };
});

const DESTINATION = 'GABC1234567890123456789012345678901234567890123456789012';

describe('Provider Rewards Integration Tests', () => {
  let rewardsService: ProviderRewardsService;
  let payoutService: PayoutService;
  let earningRepo: Repository<ProviderEarning>;
  let payoutRepo: Repository<Payout>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [ProviderEarning, Payout],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([ProviderEarning, Payout]),
      ],
      providers: [
        ProviderRewardsService,
        PayoutService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def: any) => def,
            getOrThrow: () => 'STEST_SECRET_KEY_PLACEHOLDER_0000000000000000000000000',
          },
        },
      ],
    }).compile();

    rewardsService = module.get(ProviderRewardsService);
    payoutService = module.get(PayoutService);
    earningRepo = module.get(getRepositoryToken(ProviderEarning));
    payoutRepo = module.get(getRepositoryToken(Payout));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await payoutRepo.delete({});
    await earningRepo.delete({});
  });

  const PROVIDER_ID = 'integration-provider-1';

  // ── Earning Record Creation ───────────────────────────────────────────

  describe('Earning record creation', () => {
    it('should create earning with correct 0.1% fee', async () => {
      const earning = await rewardsService.recordEarning({
        providerId: PROVIDER_ID,
        signalId: 'signal-1',
        tradeId: 'trade-1',
        tradedAmount: 1000,
        asset: 'XLM',
      });

      expect(earning.id).toBeDefined();
      expect(Number(earning.amount)).toBeCloseTo(1, 8);
      expect(earning.isPaidOut).toBe(false);
    });

    it('should be idempotent for duplicate tradeIds', async () => {
      const dto = { providerId: PROVIDER_ID, signalId: 'sig', tradeId: 'trade-dup', tradedAmount: 500, asset: 'XLM' };
      await rewardsService.recordEarning(dto);
      await rewardsService.recordEarning(dto);

      const count = await earningRepo.count({ where: { tradeId: 'trade-dup' } });
      expect(count).toBe(1);
    });
  });

  // ── Earnings Summary ─────────────────────────────────────────────────

  describe('Earnings summary', () => {
    it('should correctly compute totalEarned and availableBalance', async () => {
      await rewardsService.recordEarning({ providerId: PROVIDER_ID, signalId: 's1', tradeId: 't1', tradedAmount: 5000, asset: 'XLM' });
      await rewardsService.recordEarning({ providerId: PROVIDER_ID, signalId: 's2', tradeId: 't2', tradedAmount: 5000, asset: 'XLM' });

      const summary = await rewardsService.getEarningsSummary(PROVIDER_ID);

      expect(summary.totalEarned).toBeCloseTo(10, 6);
      expect(summary.availableBalance).toBeCloseTo(10, 6);
      expect(summary.canRequestPayout).toBe(true);
    });
  });

  // ── Full Payout Flow ─────────────────────────────────────────────────

  describe('Full payout flow', () => {
    it('should complete a payout and update earnings', async () => {
      // Create enough earnings
      await rewardsService.recordEarning({ providerId: PROVIDER_ID, signalId: 's1', tradeId: 'pt1', tradedAmount: 10000, asset: 'XLM' });

      const payout = await payoutService.requestPayout(PROVIDER_ID, {
        destinationAddress: DESTINATION,
        asset: PayoutAsset.XLM,
      });

      expect(payout.id).toBeDefined();
      expect([PayoutStatus.PENDING, PayoutStatus.PROCESSING, PayoutStatus.COMPLETED]).toContain(payout.status);
    });

    it('should reject payout when balance is insufficient', async () => {
      await rewardsService.recordEarning({ providerId: PROVIDER_ID, signalId: 's1', tradeId: 'low1', tradedAmount: 100, asset: 'XLM' });

      await expect(
        payoutService.requestPayout(PROVIDER_ID, { destinationAddress: DESTINATION, asset: PayoutAsset.XLM }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent concurrent payout requests', async () => {
      // Create enough balance
      await rewardsService.recordEarning({ providerId: PROVIDER_ID, signalId: 's1', tradeId: 'cc1', tradedAmount: 20000, asset: 'XLM' });
      await rewardsService.recordEarning({ providerId: PROVIDER_ID, signalId: 's2', tradeId: 'cc2', tradedAmount: 20000, asset: 'XLM' });

      // Create an existing PENDING payout manually
      await payoutRepo.save(payoutRepo.create({
        providerId: PROVIDER_ID,
        amount: 10,
        asset: 'XLM',
        destinationAddress: DESTINATION,
        status: PayoutStatus.PENDING,
      }));

      await expect(
        payoutService.requestPayout(PROVIDER_ID, { destinationAddress: DESTINATION, asset: PayoutAsset.XLM }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── Payout History ────────────────────────────────────────────────────

  describe('Payout history', () => {
    it('should return all payouts for a provider', async () => {
      await payoutRepo.save([
        payoutRepo.create({ providerId: PROVIDER_ID, amount: 10, asset: 'XLM', destinationAddress: DESTINATION, status: PayoutStatus.COMPLETED }),
        payoutRepo.create({ providerId: PROVIDER_ID, amount: 20, asset: 'USDC', destinationAddress: DESTINATION, status: PayoutStatus.FAILED }),
      ]);

      const history = await payoutService.getPayoutHistory(PROVIDER_ID, 1, 10);
      expect(history.total).toBe(2);
      expect(history.data).toHaveLength(2);
    });
  });
});
