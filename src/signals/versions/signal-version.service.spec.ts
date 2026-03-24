import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SignalVersionService } from './signal-version.service';
import {
  SignalVersion,
  SignalVersionApproval,
  UpdateApprovalStatus,
} from './entities/signal-version.entity';
import { Signal, SignalStatus } from '../entities/signal.entity';
import { CopiedPosition } from '../entities/copied-position.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('SignalVersionService', () => {
  let service: SignalVersionService;
  let versionRepo: Repository<SignalVersion>;
  let approvalRepo: Repository<SignalVersionApproval>;
  let signalRepo: Repository<Signal>;
  let copiedPositionRepo: Repository<CopiedPosition>;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalVersionService,
        {
          provide: getRepositoryToken(SignalVersion),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SignalVersionApproval),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Signal),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CopiedPosition),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<SignalVersionService>(SignalVersionService);
    versionRepo = module.get(getRepositoryToken(SignalVersion));
    approvalRepo = module.get(getRepositoryToken(SignalVersionApproval));
    signalRepo = module.get(getRepositoryToken(Signal));
    copiedPositionRepo = module.get(getRepositoryToken(CopiedPosition));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSignal', () => {
    it('should create new version and update signal', async () => {
      const signalId = 'signal-123';
      const providerId = 'provider-123';
      const signal = {
        id: signalId,
        providerId,
        status: SignalStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 86400000),
        entryPrice: '100',
        targetPrice: '120',
        stopLossPrice: '90',
        rationale: 'Old rationale',
      };

      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(signal as any);
      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(versionRepo, 'create').mockReturnValue({ id: 'version-1' } as any);
      jest.spyOn(copiedPositionRepo, 'find').mockResolvedValue([]);

      const result = await service.updateSignal(signalId, providerId, {
        targetPrice: '130',
      });

      expect(result.newVersion).toBe(1);
      expect(result.signalId).toBe(signalId);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if signal not found', async () => {
      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateSignal('signal-123', 'provider-123', { targetPrice: '130' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not signal owner', async () => {
      const signal = {
        id: 'signal-123',
        providerId: 'provider-123',
        status: SignalStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 86400000),
      };

      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(signal as any);

      await expect(
        service.updateSignal('signal-123', 'different-provider', { targetPrice: '130' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if signal is not active', async () => {
      const signal = {
        id: 'signal-123',
        providerId: 'provider-123',
        status: SignalStatus.CLOSED,
        expiresAt: new Date(Date.now() + 86400000),
      };

      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(signal as any);

      await expect(
        service.updateSignal('signal-123', 'provider-123', { targetPrice: '130' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce maximum updates limit', async () => {
      const signal = {
        id: 'signal-123',
        providerId: 'provider-123',
        status: SignalStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 86400000),
      };

      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(signal as any);
      jest.spyOn(versionRepo, 'findOne').mockResolvedValue({
        versionNumber: 5,
        createdAt: new Date(Date.now() - 7200000),
      } as any);

      await expect(
        service.updateSignal('signal-123', 'provider-123', { targetPrice: '130' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce cooldown period', async () => {
      const signal = {
        id: 'signal-123',
        providerId: 'provider-123',
        status: SignalStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 86400000),
      };

      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(signal as any);
      jest.spyOn(versionRepo, 'findOne').mockResolvedValue({
        versionNumber: 2,
        createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
      } as any);

      await expect(
        service.updateSignal('signal-123', 'provider-123', { targetPrice: '130' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      const signalId = 'signal-123';
      const signal = { id: signalId };
      const versions = [
        {
          versionNumber: 2,
          entryPrice: '100',
          targetPrice: '130',
          stopLossPrice: '90',
          rationale: 'Updated',
          changeSummary: 'Target: 120 → 130',
          requiresApproval: false,
          approvedCount: 0,
          rejectedCount: 0,
          autoAppliedCount: 5,
          createdAt: new Date(),
        },
        {
          versionNumber: 1,
          entryPrice: '100',
          targetPrice: '120',
          stopLossPrice: '90',
          rationale: 'Initial',
          changeSummary: 'Initial version',
          requiresApproval: false,
          approvedCount: 0,
          rejectedCount: 0,
          autoAppliedCount: 0,
          createdAt: new Date(),
        },
      ];

      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(signal as any);
      jest.spyOn(versionRepo, 'find').mockResolvedValue(versions as any);

      const result = await service.getVersionHistory(signalId);

      expect(result.signalId).toBe(signalId);
      expect(result.totalVersions).toBe(2);
      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].versionNumber).toBe(2);
    });

    it('should throw NotFoundException if signal not found', async () => {
      jest.spyOn(signalRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getVersionHistory('signal-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('respondToUpdate', () => {
    it('should approve update', async () => {
      const version = {
        id: 'version-123',
        signalId: 'signal-123',
        requiresApproval: true,
      };
      const copierPosition = { signalId: 'signal-123', userId: 'copier-123' };

      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(version as any);
      jest.spyOn(approvalRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(copiedPositionRepo, 'findOne').mockResolvedValue(copierPosition as any);
      jest.spyOn(approvalRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(approvalRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(versionRepo, 'increment').mockResolvedValue({} as any);

      const result = await service.respondToUpdate('version-123', 'copier-123', {
        approved: true,
        autoAdjust: true,
      });

      expect(result.status).toBe(UpdateApprovalStatus.APPROVED);
      expect(result.autoAdjust).toBe(true);
      expect(versionRepo.increment).toHaveBeenCalledWith({ id: 'version-123' }, 'approvedCount', 1);
    });

    it('should reject update', async () => {
      const version = {
        id: 'version-123',
        signalId: 'signal-123',
        requiresApproval: true,
      };
      const copierPosition = { signalId: 'signal-123', userId: 'copier-123' };

      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(version as any);
      jest.spyOn(approvalRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(copiedPositionRepo, 'findOne').mockResolvedValue(copierPosition as any);
      jest.spyOn(approvalRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(approvalRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(versionRepo, 'increment').mockResolvedValue({} as any);

      const result = await service.respondToUpdate('version-123', 'copier-123', {
        approved: false,
      });

      expect(result.status).toBe(UpdateApprovalStatus.REJECTED);
      expect(versionRepo.increment).toHaveBeenCalledWith({ id: 'version-123' }, 'rejectedCount', 1);
    });

    it('should throw if already responded', async () => {
      const version = { id: 'version-123', requiresApproval: true };
      const existingApproval = { id: 'approval-123' };

      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(version as any);
      jest.spyOn(approvalRepo, 'findOne').mockResolvedValue(existingApproval as any);

      await expect(
        service.respondToUpdate('version-123', 'copier-123', { approved: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if not copying signal', async () => {
      const version = { id: 'version-123', signalId: 'signal-123', requiresApproval: true };

      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(version as any);
      jest.spyOn(approvalRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(copiedPositionRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.respondToUpdate('version-123', 'copier-123', { approved: true }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals for copier', async () => {
      const copierId = 'copier-123';
      const copierPositions = [{ signalId: 'signal-1' }, { signalId: 'signal-2' }];
      const pendingVersions = [
        {
          id: 'version-1',
          signalId: 'signal-1',
          changeSummary: 'Target updated',
          targetPrice: '150',
          stopLossPrice: '90',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(copiedPositionRepo, 'find').mockResolvedValue(copierPositions as any);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(pendingVersions),
      };

      jest.spyOn(versionRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPendingApprovals(copierId);

      expect(result).toHaveLength(1);
      expect(result[0].versionId).toBe('version-1');
    });

    it('should return empty array if no copied positions', async () => {
      jest.spyOn(copiedPositionRepo, 'find').mockResolvedValue([]);

      const result = await service.getPendingApprovals('copier-123');

      expect(result).toEqual([]);
    });
  });
});
