import { Test, TestingModule } from '@nestjs/testing';
import { ProviderRewardsController } from './provider-rewards.controller';
import { ProviderRewardsService } from './services/provider-rewards.service';
import { PayoutService } from './services/payout.service';
import { PayoutAsset } from './dto/payout-request.dto';
import { PayoutStatus } from './entities/payout.entity';

const mockRewardsService = {
  getEarningsSummary: jest.fn(),
  getEarningsList: jest.fn(),
};

const mockPayoutService = {
  requestPayout: jest.fn(),
  getPayoutHistory: jest.fn(),
  getPayoutById: jest.fn(),
  retryPayout: jest.fn(),
};

// Mock JwtAuthGuard
jest.mock('../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() { return true; }
  },
}), { virtual: true });

const PROVIDER_ID = 'provider-uuid-1';

describe('ProviderRewardsController', () => {
  let controller: ProviderRewardsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProviderRewardsController],
      providers: [
        { provide: ProviderRewardsService, useValue: mockRewardsService },
        { provide: PayoutService, useValue: mockPayoutService },
      ],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ProviderRewardsController);
    jest.clearAllMocks();
  });

  describe('getEarningsSummary', () => {
    it('should call service and return summary', async () => {
      const summary = { providerId: PROVIDER_ID, totalEarned: 100 };
      mockRewardsService.getEarningsSummary.mockResolvedValue(summary);

      const result = await controller.getEarningsSummary(PROVIDER_ID);

      expect(mockRewardsService.getEarningsSummary).toHaveBeenCalledWith(PROVIDER_ID);
      expect(result).toEqual(summary);
    });
  });

  describe('getEarnings', () => {
    it('should call service with pagination params', async () => {
      const paginated = { data: [], total: 0, page: 2, limit: 5 };
      mockRewardsService.getEarningsList.mockResolvedValue(paginated);

      const result = await controller.getEarnings(PROVIDER_ID, 2, 5);

      expect(mockRewardsService.getEarningsList).toHaveBeenCalledWith(PROVIDER_ID, 2, 5);
      expect(result).toEqual(paginated);
    });
  });

  describe('requestPayout', () => {
    it('should call payout service and return payout', async () => {
      const dto = { destinationAddress: 'GABC...', asset: PayoutAsset.XLM };
      const payout = { id: 'p1', status: PayoutStatus.PENDING };
      mockPayoutService.requestPayout.mockResolvedValue(payout);

      const result = await controller.requestPayout(PROVIDER_ID, dto as any);

      expect(mockPayoutService.requestPayout).toHaveBeenCalledWith(PROVIDER_ID, dto);
      expect(result).toEqual(payout);
    });
  });

  describe('getPayoutHistory', () => {
    it('should return paginated payout history', async () => {
      const history = { data: [{ id: 'p1' }], total: 1, page: 1, limit: 20 };
      mockPayoutService.getPayoutHistory.mockResolvedValue(history);

      const result = await controller.getPayoutHistory(PROVIDER_ID, 1, 20);

      expect(mockPayoutService.getPayoutHistory).toHaveBeenCalledWith(PROVIDER_ID, 1, 20);
      expect(result).toEqual(history);
    });
  });

  describe('getPayout', () => {
    it('should return a specific payout', async () => {
      const payout = { id: 'p1', providerId: PROVIDER_ID };
      mockPayoutService.getPayoutById.mockResolvedValue(payout);

      const result = await controller.getPayout(PROVIDER_ID, 'p1');

      expect(mockPayoutService.getPayoutById).toHaveBeenCalledWith(PROVIDER_ID, 'p1');
      expect(result).toEqual(payout);
    });
  });

  describe('retryPayout', () => {
    it('should retry a failed payout', async () => {
      const payout = { id: 'p1', status: PayoutStatus.PENDING };
      mockPayoutService.retryPayout.mockResolvedValue(payout);

      const result = await controller.retryPayout(PROVIDER_ID, 'p1');

      expect(mockPayoutService.retryPayout).toHaveBeenCalledWith(PROVIDER_ID, 'p1');
      expect(result).toEqual(payout);
    });
  });
});
