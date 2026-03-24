import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { Signal } from './entities/signal.entity';
import { SignalType, SignalStatus } from './entities/signal.entity';
import { createMockRepository } from '../../test/utils/test-helpers';
import { signalFactory, createSignalDtoFactory } from '../../test/utils/mock-factories';

describe('SignalsService', () => {
  let service: SignalsService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalsService,
        {
          provide: getRepositoryToken(Signal),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SignalsService>(SignalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a signal with valid data', async () => {
      const dto = createSignalDtoFactory({
        providerId: 'user-123',
        baseAsset: 'USDC',
        counterAsset: 'XLM',
        entryPrice: '0.095',
      });
      const expectedSignal = signalFactory(dto);

      mockRepository.create.mockReturnValue(expectedSignal);
      mockRepository.save.mockResolvedValue(expectedSignal);

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error when providerId is missing', async () => {
      const dto = createSignalDtoFactory({ providerId: undefined });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error when baseAsset is missing', async () => {
      const dto = createSignalDtoFactory({
        providerId: 'user-123',
        baseAsset: undefined,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when counterAsset is missing', async () => {
      const dto = createSignalDtoFactory({
        providerId: 'user-123',
        counterAsset: undefined,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should set default values for optional fields', async () => {
      const dto = {
        providerId: 'user-123',
        baseAsset: 'USDC',
        counterAsset: 'XLM',
      };
      const signal = signalFactory();

      mockRepository.create.mockReturnValue(signal);
      mockRepository.save.mockResolvedValue(signal);

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SignalStatus.ACTIVE,
          copiersCount: 0,
          totalCopiedVolume: '0',
        }),
      );
    });

    it('should handle database errors', async () => {
      const dto = createSignalDtoFactory({ providerId: 'user-123' });

      mockRepository.create.mockReturnValue(signalFactory());
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(dto)).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return a signal by id', async () => {
      const signal = signalFactory();
      mockRepository.findOneBy.mockResolvedValue(signal);

      const result = await service.findOne('signal-123');

      expect(result).toEqual(signal);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 'signal-123' });
    });

    it('should return null when signal not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockRepository.findOneBy.mockRejectedValue(new Error('Database error'));

      await expect(service.findOne('signal-123')).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    it('should return all signals ordered by createdAt DESC', async () => {
      const signals = [signalFactory(), signalFactory({ id: 'signal-456' })];
      mockRepository.find.mockResolvedValue(signals);

      const result = await service.findAll();

      expect(result).toEqual(signals);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 100,
      });
    });

    it('should return empty array when no signals exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should limit results to 100', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('updateSignalStatus', () => {
    it('should update signal status', async () => {
      const signal = signalFactory({ status: SignalStatus.CLOSED });
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOneBy.mockResolvedValue(signal);

      const result = await service.updateSignalStatus('signal-123', SignalStatus.CLOSED);

      expect(result).toEqual(signal);
      expect(mockRepository.update).toHaveBeenCalledWith('signal-123', {
        status: SignalStatus.CLOSED,
      });
    });

    it('should return null when signal not found', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await service.updateSignalStatus('non-existent', SignalStatus.CLOSED);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateSignalStatus('signal-123', SignalStatus.CLOSED),
      ).rejects.toThrow('Database error');
    });
  });
});
