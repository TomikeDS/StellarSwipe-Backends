import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { ProviderRewardsService } from './provider-rewards.service';
import { Payout, PayoutStatus } from '../entities/payout.entity';
import { PayoutRequestDto } from '../dto/payout-request.dto';
import { PayoutAsset } from '../dto/payout-request.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPayoutRepo = () => ({
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockRewardsService = () => ({
  getAvailableBalance: jest.fn(),
});

const mockDataSource = () => ({});

const dto: PayoutRequestDto = {
  destinationAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGH',
  asset: PayoutAsset.USDC,
};

const makePayout = (overrides: Partial<Payout> = {}): Payout =>
  ({
    id: 'payout-1',
    providerId: 'provider-1',
    amount: 50 as any,
    asset: 'USDC',
    status: PayoutStatus.PENDING,
    destinationAddress: dto.destinationAddress,
    stellarTransactionId: null,
    failureReason: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Payout);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PayoutService', () => {
  let service: PayoutService;
  let payoutRepo: jest.Mocked<Repository<Payout>>;
  let rewardsService: jest.Mocked<ProviderRewardsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        { provide: getRepositoryToken(Payout), useFactory: mockPayoutRepo },
        { provide: ProviderRewardsService, useFactory: mockRewardsService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(PayoutService);
    payoutRepo = module.get(getRepositoryToken(Payout));
    rewardsService = module.get(ProviderRewardsService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // requestPayout — insufficient balance
  // -------------------------------------------------------------------------

  describe('requestPayout', () => {
    it('throws BadRequestException when balance < minimum threshold', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(5);

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when balance is exactly 0', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(0);

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when a PENDING payout already exists', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(100);
      payoutRepo.findOne.mockResolvedValue(makePayout({ status: PayoutStatus.PENDING }));

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when a PROCESSING payout already exists', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(100);
      payoutRepo.findOne.mockResolvedValue(
        makePayout({ status: PayoutStatus.PROCESSING }),
      );

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a PENDING payout record before submitting to Stellar', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(50);
      payoutRepo.findOne.mockResolvedValue(null);
      const created = makePayout();
      payoutRepo.create.mockReturnValue(created);
      payoutRepo.save.mockResolvedValue(created);
      payoutRepo.update.mockResolvedValue(undefined as any);
      // submitStellarPayment will throw because gateway is not configured
      // We expect InternalServerErrorException from the service
      payoutRepo.findOneOrFail.mockResolvedValue(
        makePayout({ status: PayoutStatus.FAILED }),
      );

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(payoutRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'provider-1',
          amount: 50,
          asset: dto.asset,
          status: PayoutStatus.PENDING,
          destinationAddress: dto.destinationAddress,
        }),
      );
      expect(payoutRepo.save).toHaveBeenCalled();
    });

    it('marks payout as FAILED and throws when Stellar submission fails', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(50);
      payoutRepo.findOne.mockResolvedValue(null);
      const created = makePayout();
      payoutRepo.create.mockReturnValue(created);
      payoutRepo.save.mockResolvedValue(created);
      payoutRepo.update.mockResolvedValue(undefined as any);

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      // Update should have been called twice: once to PROCESSING, once to FAILED
      expect(payoutRepo.update).toHaveBeenCalledTimes(2);
      expect(payoutRepo.update).toHaveBeenLastCalledWith(
        created.id,
        expect.objectContaining({
          status: PayoutStatus.FAILED,
          failureReason: expect.any(String),
          processedAt: expect.any(Date),
        }),
      );
    });

    it('does not allow payout amount to exceed available balance', async () => {
      const availableBalance = 75;
      rewardsService.getAvailableBalance.mockResolvedValue(availableBalance);
      payoutRepo.findOne.mockResolvedValue(null);
      const created = makePayout({ amount: availableBalance as any });
      payoutRepo.create.mockReturnValue(created);
      payoutRepo.save.mockResolvedValue(created);
      payoutRepo.update.mockResolvedValue(undefined as any);

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        InternalServerErrorException, // Stellar not configured
      );

      // Verify that the payout amount equals the available balance exactly
      expect(payoutRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: availableBalance }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // retryPayout
  // -------------------------------------------------------------------------

  describe('retryPayout', () => {
    it('throws BadRequestException when payout not found for provider', async () => {
      payoutRepo.findOne.mockResolvedValue(null);

      await expect(service.retryPayout('payout-999', 'provider-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when payout is not in FAILED status', async () => {
      payoutRepo.findOne.mockResolvedValue(makePayout({ status: PayoutStatus.COMPLETED }));

      await expect(service.retryPayout('payout-1', 'provider-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when payout is PENDING', async () => {
      payoutRepo.findOne.mockResolvedValue(makePayout({ status: PayoutStatus.PENDING }));

      await expect(service.retryPayout('payout-1', 'provider-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resets FAILED payout to PENDING before retrying', async () => {
      const failedPayout = makePayout({
        status: PayoutStatus.FAILED,
        failureReason: 'Network timeout',
      });
      payoutRepo.findOne
        .mockResolvedValueOnce(failedPayout) // first call in retryPayout
        .mockResolvedValueOnce(null); // second call in requestPayout (concurrent guard)
      payoutRepo.update.mockResolvedValue(undefined as any);

      // getAvailableBalance will be called by requestPayout inside retryPayout
      rewardsService.getAvailableBalance.mockResolvedValue(50);

      const created = makePayout();
      payoutRepo.create.mockReturnValue(created);
      payoutRepo.save.mockResolvedValue(created);

      await expect(service.retryPayout('payout-1', 'provider-1')).rejects.toThrow(
        InternalServerErrorException, // Stellar not configured
      );

      // First update call should reset the payout to PENDING
      expect(payoutRepo.update).toHaveBeenCalledWith('payout-1', {
        status: PayoutStatus.PENDING,
        failureReason: null,
        stellarTransactionId: null,
        processedAt: null,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles exactly minimum threshold balance (boundary value)', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(10); // exactly $10
      payoutRepo.findOne.mockResolvedValue(null);
      const created = makePayout({ amount: 10 as any });
      payoutRepo.create.mockReturnValue(created);
      payoutRepo.save.mockResolvedValue(created);
      payoutRepo.update.mockResolvedValue(undefined as any);

      // Should not throw BadRequestException (balance is sufficient)
      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        InternalServerErrorException, // fails at Stellar, not balance check
      );
    });

    it('rejects balance just below minimum (9.99)', async () => {
      rewardsService.getAvailableBalance.mockResolvedValue(9.99);

      await expect(service.requestPayout('provider-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
