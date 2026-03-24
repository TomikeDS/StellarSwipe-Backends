import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributionService } from './attribution.service';
import { Trade, TradeStatus, TradeSide } from '../../trades/entities/trade.entity';
import { Signal, SignalType, SignalStatus } from '../../signals/entities/signal.entity';
import { User } from '../../users/entities/user.entity';
import { AttributionTimeframe } from '../dto/attribution-query.dto';

describe('AttributionService', () => {
  let service: AttributionService;
  let tradeRepository: Repository<Trade>;

  const mockUser: User = {
    id: 'user-1',
    username: 'provider1',
    walletAddress: 'GTEST123',
    isActive: true,
    reputationScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockSignal: Signal = {
    id: 'signal-1',
    providerId: 'provider-1',
    provider: mockUser,
    baseAsset: 'XLM',
    counterAsset: 'USDC',
    type: SignalType.BUY,
    status: SignalStatus.CLOSED,
    entryPrice: '0.10',
    targetPrice: '0.12',
    stopLossPrice: '0.09',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  } as Signal;

  const mockTrades: Trade[] = [
    {
      id: 'trade-1',
      userId: 'user-1',
      signalId: 'signal-1',
      status: TradeStatus.SETTLED,
      side: TradeSide.BUY,
      baseAsset: 'XLM',
      counterAsset: 'USDC',
      entryPrice: '0.10',
      amount: '1000',
      totalValue: '100',
      profitLoss: '20',
      closedAt: new Date('2024-01-15'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    } as Trade,
    {
      id: 'trade-2',
      userId: 'user-1',
      signalId: 'signal-1',
      status: TradeStatus.SETTLED,
      side: TradeSide.SELL,
      baseAsset: 'XLM',
      counterAsset: 'USDC',
      entryPrice: '0.11',
      amount: '500',
      totalValue: '55',
      profitLoss: '-5',
      closedAt: new Date('2024-01-20'),
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date(),
    } as Trade,
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributionService,
        {
          provide: getRepositoryToken(Trade),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockTrades),
            })),
          },
        },
        {
          provide: getRepositoryToken(Signal),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockSignal]),
            })),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AttributionService>(AttributionService);
    tradeRepository = module.get<Repository<Trade>>(getRepositoryToken(Trade));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateAttribution', () => {
    it('should calculate attribution correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.calculateAttribution(
        'user-1',
        startDate,
        endDate,
        AttributionTimeframe.DAILY,
      );

      expect(result).toBeDefined();
      expect(result.totalPnL).toBe(15); // 20 + (-5)
      expect(result.totalTrades).toBe(2);
      expect(result.byProvider).toHaveLength(1);
      expect(result.byAsset).toHaveLength(1);
      expect(result.byTimeframe.length).toBeGreaterThan(0);
    });

    it('should calculate provider attribution with correct percentages', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.calculateAttribution(
        'user-1',
        startDate,
        endDate,
      );

      expect(result.byProvider[0].providerId).toBe('provider-1');
      expect(result.byProvider[0].pnl).toBe(15);
      expect(result.byProvider[0].percentage).toBe(100);
      expect(result.byProvider[0].tradeCount).toBe(2);
    });

    it('should calculate asset attribution correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.calculateAttribution(
        'user-1',
        startDate,
        endDate,
      );

      expect(result.byAsset[0].asset).toBe('XLM/USDC');
      expect(result.byAsset[0].pnl).toBe(15);
      expect(result.byAsset[0].percentage).toBe(100);
    });

    it('should handle negative total P&L correctly', async () => {
      const negativeTrades = [
        {
          ...mockTrades[0],
          profitLoss: '-10',
        },
        {
          ...mockTrades[1],
          profitLoss: '-5',
        },
      ];

      jest.spyOn(tradeRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(negativeTrades),
      } as any);

      const result = await service.calculateAttribution(
        'user-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.totalPnL).toBe(-15);
      expect(result.byProvider[0].percentage).toBe(100);
    });

    it('should identify top and worst signals', async () => {
      const result = await service.calculateAttribution(
        'user-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.topSignals).toBeDefined();
      expect(result.worstSignals).toBeDefined();
      expect(result.topSignals.length).toBeGreaterThan(0);
    });

    it('should generate timeframe attribution with cumulative values', async () => {
      const result = await service.calculateAttribution(
        'user-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        AttributionTimeframe.DAILY,
      );

      expect(result.byTimeframe.length).toBeGreaterThan(0);
      
      // Check cumulative calculation
      let expectedCumulative = 0;
      for (const item of result.byTimeframe) {
        expectedCumulative += item.pnl;
        expect(item.cumulative).toBe(expectedCumulative);
      }
    });

    it('should handle zero total P&L', async () => {
      const zeroTrades = [
        {
          ...mockTrades[0],
          profitLoss: '10',
        },
        {
          ...mockTrades[1],
          profitLoss: '-10',
        },
      ];

      jest.spyOn(tradeRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(zeroTrades),
      } as any);

      const result = await service.calculateAttribution(
        'user-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.totalPnL).toBe(0);
      expect(result.byProvider[0].percentage).toBe(0);
    });
  });
});
