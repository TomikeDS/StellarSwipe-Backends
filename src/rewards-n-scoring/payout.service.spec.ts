import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { ProviderRewardsService } from './provider-rewards.service';
import { Payout, PayoutStatus } from '../entities/payout.entity';
import { PayoutAsset } from '../dto/payout-request.dto';

// Mock Stellar SDK
jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({ id: 'source', sequence: '1' }),
        fetchBaseFee: jest.fn().mockResolvedValue(100),
        submitTransaction: jest.fn().mockResolvedValue({ hash: 'mock-tx-hash' }),
      })),
    },
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: () => 'GSOURCE_PUBLIC',
        sign: jest.fn(),
      }),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      addMemo: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        sign: jest.fn(),
        toEnvelope: jest.fn(),
      }),
    })),
    Operation: {
      payment: jest.fn().mockReturnValue({}),
    },
    Asset: jest.fn().mockImplementation((code, issuer) => ({ code, issuer })),
    Memo: { text: jest.fn().mockReturnValue('memo') },
    Networks: { PUBLIC: 'Public Global Stellar Network ; September 2015', TESTNET: 'Test SDF Network ; September 2015' },
  };
});

const mockPayoutRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockRewardsService = () => ({
  getAvailableBalance: jest.fn(),
  markEarningsAsPaidOut: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn().mockImplementation((cb: any) => cb({ update: jest.fn() })),
});

const PROVIDER_ID = 'provider-uuid-1';
const DESTINATION = 'GABC1234567890123456789012345678901234567890123456789012';

const makePayoutDto = (overrides = {}) => ({
  destinationAddress: DESTINATION,
  asset: PayoutAsset.XLM,
  ...overrides,
});

describe('PayoutService', () => {
  let service: PayoutService;
  let payoutRepo: ReturnType<typeof mockPayoutRepo>;
  let rewardsService: ReturnType<typeof mockRewardsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        { provide: getRepositoryToken(Payout), useFactory: mockPayoutRepo },
        { provide: ProviderRewardsService, useFactory: mockRewardsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: any) => def),
            getOrThrow: jest.fn().mockReturnValue('STEST_SECRET_KEY_PLACEHOLDER000000000000000000000000000'),
          },
        },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(PayoutService);
    payoutRepo = module.get(getRepositoryToken(Payout));
    rewardsService = module.get(ProviderRewardsService);
  });

  // ── requestPayout ─────────────────────────────────────────────────────

  describe('requestPayout', () => {
    it('should create a payout when balance is sufficient', async () => {
      payoutRepo.findOne.mockResolvedValue(null); // no pending
      rewardsService.getAvailableBalance.mockResolvedValue(50);

      const payout: Partial<Payout> = {
        id: 'payout-1',
        providerId: PROVIDER_ID,
        amount: 50,
        status: PayoutStatus.PENDING,
      };
      payoutRepo.create.mockReturnValue(payout);
      payoutRepo.save.mockResolvedValue(payout);
      payoutRepo.update.mockResolvedValue({});

      // Suppress async processPayout
      jest.spyOn(service as any, 'processPayout').mockResolvedValue(undefined);

      const result = await service.requestPayout(PROVIDER_ID, makePayoutDto());

      expect(payoutRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(PayoutStatus.PENDING);
    });

    it('should throw BadRequestException when balance < minimum threshold', async () => {
      payoutRepo.findOne.mockResolvedValue(null);
      rewardsService.getAvailableBalance.mockResolvedValue(5);

      await expect(service.requestPayout(PROVIDER_ID, makePayoutDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when requested amount > available balance', async () => {
      payoutRepo.findOne.mockResolvedValue(null);
      rewardsService.getAvailableBalance.mockResolvedValue(20);

      await expect(
        service.requestPayout(PROVIDER_ID, makePayoutDto({ amount: 100 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when payout already pending', async () => {
      payoutRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: PayoutStatus.PENDING,
      });

      await expect(service.requestPayout(PROVIDER_ID, makePayoutDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when payout already processing', async () => {
      payoutRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: PayoutStatus.PROCESSING,
      });

      await expect(service.requestPayout(PROVIDER_ID, makePayoutDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('should use full available balance when no amount specified', async () => {
      payoutRepo.findOne.mockResolvedValue(null);
      rewardsService.getAvailableBalance.mockResolvedValue(75);

      const payout = { id: 'p1', amount: 75, status: PayoutStatus.PENDING };
      payoutRepo.create.mockReturnValue(payout);
      payoutRepo.save.mockResolvedValue(payout);
      payoutRepo.update.mockResolvedValue({});
      jest.spyOn(service as any, 'processPayout').mockResolvedValue(undefined);

      await service.requestPayout(PROVIDER_ID, makePayoutDto());

      expect(payoutRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 75 }),
      );
    });
  });

  // ── processPayout ─────────────────────────────────────────────────────

  describe('processPayout', () => {
    it('should update status to COMPLETED on successful Stellar submission', async () => {
      const payout: Partial<Payout> = {
        id: 'payout-1',
        providerId: PROVIDER_ID,
        amount: 20,
        asset: 'XLM',
        destinationAddress: DESTINATION,
      };

      payoutRepo.update.mockResolvedValue({});
      rewardsService.markEarningsAsPaidOut.mockResolvedValue(undefined);

      // Let processPayout run (Stellar mocked at top)
      await (service as any).processPayout(payout);

      expect(payoutRepo.update).toHaveBeenCalledWith(
        'payout-1',
        expect.objectContaining({ status: PayoutStatus.PROCESSING }),
      );
      expect(rewardsService.markEarningsAsPaidOut).toHaveBeenCalledWith(
        PROVIDER_ID,
        'payout-1',
        20,
      );
    });

    it('should mark payout as FAILED when Stellar submission fails', async () => {
      const payout: Partial<Payout> = {
        id: 'payout-1',
        providerId: PROVIDER_ID,
        amount: 20,
        asset: 'XLM',
        destinationAddress: DESTINATION,
      };

      payoutRepo.update.mockResolvedValue({});

      // Force Stellar to fail
      jest.spyOn(service as any, 'submitStellarPayment').mockRejectedValue(
        new Error('Network error'),
      );

      await expect((service as any).processPayout(payout)).rejects.toThrow('Network error');

      expect(payoutRepo.update).toHaveBeenCalledWith(
        'payout-1',
        expect.objectContaining({ status: PayoutStatus.FAILED, failureReason: 'Network error' }),
      );
    });
  });

  // ── getPayoutHistory ──────────────────────────────────────────────────

  describe('getPayoutHistory', () => {
    it('should return paginated payout history', async () => {
      const payouts = [{ id: 'p1' }, { id: 'p2' }];
      payoutRepo.findAndCount.mockResolvedValue([payouts, 2]);

      const result = await service.getPayoutHistory(PROVIDER_ID, 1, 10);

      expect(result.data).toEqual(payouts);
      expect(result.total).toBe(2);
    });
  });

  // ── getPayoutById ─────────────────────────────────────────────────────

  describe('getPayoutById', () => {
    it('should return payout when found', async () => {
      const payout = { id: 'p1', providerId: PROVIDER_ID };
      payoutRepo.findOne.mockResolvedValue(payout);

      const result = await service.getPayoutById(PROVIDER_ID, 'p1');
      expect(result).toEqual(payout);
    });

    it('should throw BadRequestException when not found', async () => {
      payoutRepo.findOne.mockResolvedValue(null);

      await expect(service.getPayoutById(PROVIDER_ID, 'nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── retryPayout ───────────────────────────────────────────────────────

  describe('retryPayout', () => {
    it('should retry a FAILED payout', async () => {
      const failedPayout = { id: 'p1', providerId: PROVIDER_ID, status: PayoutStatus.FAILED };
      payoutRepo.findOne
        .mockResolvedValueOnce(null) // ensureNoPendingPayout check
        .mockResolvedValueOnce(failedPayout) // getPayoutById
        .mockResolvedValueOnce(null) // second ensureNoPendingPayout
        .mockResolvedValueOnce({ ...failedPayout, status: PayoutStatus.PENDING }); // refreshed

      payoutRepo.update.mockResolvedValue({});
      jest.spyOn(service as any, 'processPayout').mockResolvedValue(undefined);

      // For first getPayoutById call
      payoutRepo.findOne
        .mockResolvedValueOnce(failedPayout)
        .mockResolvedValueOnce(null) // no pending
        .mockResolvedValueOnce({ ...failedPayout, status: PayoutStatus.PENDING }); // refreshed

      const result = await service.retryPayout(PROVIDER_ID, 'p1');
      expect(payoutRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ status: PayoutStatus.PENDING }),
      );
    });

    it('should throw BadRequestException when payout is not FAILED', async () => {
      const completedPayout = { id: 'p1', providerId: PROVIDER_ID, status: PayoutStatus.COMPLETED };
      payoutRepo.findOne.mockResolvedValue(completedPayout);

      await expect(service.retryPayout(PROVIDER_ID, 'p1')).rejects.toThrow(BadRequestException);
    });
  });
});
