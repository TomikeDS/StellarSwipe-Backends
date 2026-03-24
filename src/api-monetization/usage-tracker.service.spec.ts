import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UsageTrackerService } from './usage-tracker.service';
import { ApiUsage } from './entities/api-usage.entity';
import { BillingCycle, BillingCycleStatus } from './entities/billing-cycle.entity';
import { PricingTier, PricingTierName } from './entities/pricing-tier.entity';

const mockRepo = () => ({
  save: jest.fn(),
  create: jest.fn((v) => v),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  count: jest.fn(),
  reload: jest.fn(),
});

describe('UsageTrackerService', () => {
  let service: UsageTrackerService;
  let usageRepo: ReturnType<typeof mockRepo>;
  let billingCycleRepo: ReturnType<typeof mockRepo>;
  let pricingTierRepo: ReturnType<typeof mockRepo>;

  const mockTier: Partial<PricingTier> = {
    id: 'tier-1',
    name: PricingTierName.STARTER,
    monthlyFlatFee: '29.00',
    includedRequests: 10000,
    overageRate: '0.001',
    maxRequestsPerMinute: 60,
    maxRequestsPerDay: 10000,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackerService,
        { provide: getRepositoryToken(ApiUsage), useFactory: mockRepo },
        { provide: getRepositoryToken(BillingCycle), useFactory: mockRepo },
        { provide: getRepositoryToken(PricingTier), useFactory: mockRepo },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsageTrackerService);
    usageRepo = module.get(getRepositoryToken(ApiUsage));
    billingCycleRepo = module.get(getRepositoryToken(BillingCycle));
    pricingTierRepo = module.get(getRepositoryToken(PricingTier));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('track', () => {
    it('saves usage record and increments billing cycle', async () => {
      usageRepo.save.mockResolvedValue({});
      billingCycleRepo.findOne.mockResolvedValue(null);
      pricingTierRepo.findOne.mockResolvedValue(mockTier);
      billingCycleRepo.save.mockResolvedValue({});

      await service.track({
        apiKeyId: 'key-1',
        userId: 'user-1',
        endpoint: '/api/v1/signals',
        method: 'GET',
        statusCode: 200,
        responseTimeMs: 45,
        timestamp: new Date(),
      });

      expect(usageRepo.save).toHaveBeenCalledTimes(1);
      expect(billingCycleRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUsageReport', () => {
    it('returns aggregated usage data', async () => {
      const records = [
        { endpoint: '/api/v1/signals', method: 'GET', statusCode: 200, responseTimeMs: 30, userId: 'user-1' },
        { endpoint: '/api/v1/signals', method: 'GET', statusCode: 200, responseTimeMs: 50, userId: 'user-1' },
        { endpoint: '/api/v1/trades', method: 'POST', statusCode: 400, responseTimeMs: 20, userId: 'user-1' },
      ];
      usageRepo.find.mockResolvedValue(records);

      const result = await service.getUsageReport('key-1', new Date('2024-01-01'), new Date('2024-01-31'));

      expect(result.totalRequests).toBe(3);
      expect(result.successfulRequests).toBe(2);
      expect(result.failedRequests).toBe(1);
      expect(result.endpointBreakdown['/api/v1/signals']).toBe(2);
    });
  });

  describe('getTopEndpoints', () => {
    it('returns endpoints sorted by count', async () => {
      usageRepo.find.mockResolvedValue([
        { endpoint: '/api/v1/signals' },
        { endpoint: '/api/v1/signals' },
        { endpoint: '/api/v1/trades' },
      ]);

      const result = await service.getTopEndpoints('key-1', new Date(), 5);

      expect(result[0].endpoint).toBe('/api/v1/signals');
      expect(result[0].count).toBe(2);
      expect(result[1].count).toBe(1);
    });
  });

  describe('aggregateUsageForCycle', () => {
    it('updates billing cycle with correct cost calculation', async () => {
      const cycle: Partial<BillingCycle> = {
        id: 'cycle-1',
        apiKeyId: 'key-1',
        pricingTierId: 'tier-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        flatFee: '29.00',
        includedRequests: 10000,
        status: BillingCycleStatus.ACTIVE,
      };

      billingCycleRepo.findOneOrFail.mockResolvedValue(cycle);
      pricingTierRepo.findOneOrFail.mockResolvedValue(mockTier);
      usageRepo.count.mockResolvedValue(12000); // 2000 overage
      billingCycleRepo.save.mockResolvedValue({});

      await service.aggregateUsageForCycle('cycle-1');

      expect(billingCycleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRequests: 12000,
          overageRequests: 2000,
        }),
      );
    });
  });
});
