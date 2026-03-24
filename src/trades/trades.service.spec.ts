import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TradesService } from './trades.service';
import { Trade, TradeStatus, TradeSide } from './entities/trade.entity';
import { RiskManagerService } from './services/risk-manager.service';
import { TradeExecutorService } from './services/trade-executor.service';
import { createMockRepository } from '../../test/utils/test-helpers';
import { tradeFactory } from '../../test/utils/mock-factories';

describe('TradesService', () => {
  let service: TradesService;
  let mockRepository: any;
  let mockRiskManager: jest.Mocked<Partial<RiskManagerService>>;
  let mockTradeExecutor: jest.Mocked<Partial<TradeExecutorService>>;
  let mockVelocityRiskManager: any;

  beforeEach(async () => {
    mockRepository = createMockRepository();
    mockRiskManager = {
      checkDuplicateTrade: jest.fn(),
      validateTrade: jest.fn(),
      calculateProfitLoss: jest.fn(),
    };
    mockTradeExecutor = {
      executeTrade: jest.fn(),
      closeTrade: jest.fn(),
    };
    mockVelocityRiskManager = {
      validateTrade: jest.fn(),
      recordTradeExecution: jest.fn(),
      handleTradeLoss: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradesService,
        { provide: getRepositoryToken(Trade), useValue: mockRepository },
        { provide: RiskManagerService, useValue: mockRiskManager },
        { provide: TradeExecutorService, useValue: mockTradeExecutor },
        { provide: 'VelocityRiskManager', useValue: mockVelocityRiskManager },
      ],
    }).compile();

    service = module.get<TradesService>(TradesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeTrade', () => {
    const dto = {
      userId: 'user-123',
      signalId: 'signal-123',
      side: TradeSide.BUY,
      amount: 100,
      walletAddress: 'GABC...',
    };

    it('should execute trade successfully', async () => {
      mockRiskManager.checkDuplicateTrade.mockResolvedValue(false);
      mockRiskManager.validateTrade.mockResolvedValue({ isValid: true, errors: [], warnings: [] });
      mockVelocityRiskManager.validateTrade.mockResolvedValue(undefined);
      mockRepository.create.mockReturnValue(tradeFactory());
      mockRepository.save.mockResolvedValue(tradeFactory({ status: TradeStatus.COMPLETED }));
      mockTradeExecutor.executeTrade.mockResolvedValue({
        success: true,
        transactionHash: 'hash123',
        contractId: 'contract123',
      });
      mockVelocityRiskManager.recordTradeExecution.mockResolvedValue(undefined);

      const result = await service.executeTrade(dto);

      expect(result.status).toBe(TradeStatus.COMPLETED);
      expect(mockRiskManager.checkDuplicateTrade).toHaveBeenCalled();
      expect(mockTradeExecutor.executeTrade).toHaveBeenCalled();
    });

    it('should throw error for duplicate trade', async () => {
      mockRiskManager.checkDuplicateTrade.mockResolvedValue(true);

      await expect(service.executeTrade(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid trade', async () => {
      mockRiskManager.checkDuplicateTrade.mockResolvedValue(false);
      mockRiskManager.validateTrade.mockResolvedValue({
        isValid: false,
        errors: ['Insufficient balance'],
        warnings: [],
      });

      await expect(service.executeTrade(dto)).rejects.toThrow(BadRequestException);
    });

    it('should handle execution failure', async () => {
      mockRiskManager.checkDuplicateTrade.mockResolvedValue(false);
      mockRiskManager.validateTrade.mockResolvedValue({ isValid: true, errors: [], warnings: [] });
      mockVelocityRiskManager.validateTrade.mockResolvedValue(undefined);
      mockRepository.create.mockReturnValue(tradeFactory());
      mockRepository.save.mockResolvedValue(tradeFactory());
      mockTradeExecutor.executeTrade.mockResolvedValue({
        success: false,
        error: 'Execution failed',
      });

      await expect(service.executeTrade(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeTrade', () => {
    const dto = { tradeId: 'trade-123', userId: 'user-123' };

    it('should close trade successfully', async () => {
      const trade = tradeFactory({ status: TradeStatus.COMPLETED, closedAt: null });
      mockRepository.findOne.mockResolvedValue(trade);
      mockTradeExecutor.closeTrade.mockResolvedValue({
        success: true,
        transactionHash: 'hash123',
      });
      mockRiskManager.calculateProfitLoss.mockReturnValue({
        profitLoss: '10.00',
        profitLossPercentage: '10.53',
      });
      mockRepository.save.mockResolvedValue(trade);

      const result = await service.closeTrade(dto);

      expect(result.profitLoss).toBe('10.00');
      expect(mockTradeExecutor.closeTrade).toHaveBeenCalled();
    });

    it('should throw error if trade not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.closeTrade(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw error if trade already closed', async () => {
      mockRepository.findOne.mockResolvedValue(
        tradeFactory({ closedAt: new Date() }),
      );

      await expect(service.closeTrade(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTradeById', () => {
    it('should return trade details', async () => {
      mockRepository.findOne.mockResolvedValue(tradeFactory());

      const result = await service.getTradeById('trade-123', 'user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('trade-123');
    });

    it('should throw error if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getTradeById('trade-123', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserTrades', () => {
    it('should return user trades', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([tradeFactory()]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQuery as any);

      const result = await service.getUserTrades({ userId: 'user-123' });

      expect(result).toHaveLength(1);
    });
  });

  describe('getUserTradesSummary', () => {
    it('should calculate summary correctly', async () => {
      mockRepository.find.mockResolvedValue([
        tradeFactory({ status: TradeStatus.COMPLETED, closedAt: new Date(), profitLoss: '10' }),
        tradeFactory({ status: TradeStatus.COMPLETED, closedAt: new Date(), profitLoss: '-5' }),
      ]);

      const result = await service.getUserTradesSummary('user-123');

      expect(result.totalTrades).toBe(2);
      expect(parseFloat(result.totalProfitLoss)).toBe(5);
    });
  });
});
