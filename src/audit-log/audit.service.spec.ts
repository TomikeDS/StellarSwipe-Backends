import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between, DeleteQueryBuilder } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction, AuditStatus } from './entities/audit-log.entity';
import { AuditQueryDto, CreateAuditLogDto } from './dto/audit-query.dto';

const mockQueryBuilder = {
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 5 }),
};

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
});

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLog>>;

  const makeLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
    id: 'log-uuid',
    userId: 'user-uuid',
    action: AuditAction.LOGIN,
    resource: 'auth',
    resourceId: undefined,
    metadata: {},
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    status: AuditStatus.SUCCESS,
    errorMessage: undefined,
    sessionId: undefined,
    requestId: undefined,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as AuditLog);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── log() ──────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('should create and save an audit log entry', async () => {
      const dto: CreateAuditLogDto = {
        userId: 'user-uuid',
        action: AuditAction.LOGIN,
        ipAddress: '127.0.0.1',
      };
      const log = makeLog();
      repo.create.mockReturnValue(log);
      repo.save.mockResolvedValue(log);

      const result = await service.log(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-uuid', action: AuditAction.LOGIN }),
      );
      expect(repo.save).toHaveBeenCalledWith(log);
      expect(result).toEqual(log);
    });

    it('should default status to SUCCESS when not provided', async () => {
      const dto: CreateAuditLogDto = { action: AuditAction.LOGIN };
      const log = makeLog();
      repo.create.mockReturnValue(log);
      repo.save.mockResolvedValue(log);

      await service.log(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuditStatus.SUCCESS }),
      );
    });

    it('should use provided status when specified', async () => {
      const dto: CreateAuditLogDto = { action: AuditAction.LOGIN_FAILED, status: AuditStatus.FAILURE };
      const log = makeLog({ status: AuditStatus.FAILURE });
      repo.create.mockReturnValue(log);
      repo.save.mockResolvedValue(log);

      await service.log(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuditStatus.FAILURE }),
      );
    });

    it('should NOT throw when save fails — returns partial object', async () => {
      repo.create.mockReturnValue(makeLog());
      repo.save.mockRejectedValue(new Error('DB down'));

      const result = await service.log({ action: AuditAction.LOGIN });

      expect(result.id).toBe('error');
    });

    it('should sanitize sensitive metadata fields', async () => {
      const dto: CreateAuditLogDto = {
        action: AuditAction.SETTINGS_UPDATED,
        metadata: {
          username: 'alice',
          password: 'secret123',
          settings: { theme: 'dark', privateKey: 'abc123' },
        },
      };
      const log = makeLog();
      repo.create.mockReturnValue(log);
      repo.save.mockResolvedValue(log);

      await service.log(dto);

      const createdWith = repo.create.mock.calls[0][0] as CreateAuditLogDto;
      expect(createdWith.metadata!.password).toBe('[REDACTED]');
      expect(createdWith.metadata!.settings.privateKey).toBe('[REDACTED]');
      expect(createdWith.metadata!.username).toBe('alice');
      expect(createdWith.metadata!.settings.theme).toBe('dark');
    });

    it('should handle null metadata gracefully', async () => {
      const dto: CreateAuditLogDto = { action: AuditAction.LOGIN };
      repo.create.mockReturnValue(makeLog());
      repo.save.mockResolvedValue(makeLog());

      await expect(service.log(dto)).resolves.not.toThrow();
      const createdWith = repo.create.mock.calls[0][0] as CreateAuditLogDto;
      expect(createdWith.metadata).toBeUndefined();
    });
  });

  // ─── query() ────────────────────────────────────────────────────────────

  describe('query()', () => {
    it('should return paginated results', async () => {
      const logs = [makeLog(), makeLog({ id: 'log-2' })];
      repo.findAndCount.mockResolvedValue([logs, 2]);

      const result = await service.query({ page: 1, limit: 10 });

      expect(result).toEqual({
        data: logs,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by userId', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.query({ userId: 'user-123' });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-123' }) }),
      );
    });

    it('should filter by action', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.query({ action: AuditAction.TRADE_EXECUTED });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ action: AuditAction.TRADE_EXECUTED }) }),
      );
    });

    it('should apply date range filter', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      const call = repo.findAndCount.mock.calls[0][0];
      expect((call as any).where.createdAt).toBeDefined();
    });

    it('should calculate totalPages correctly', async () => {
      repo.findAndCount.mockResolvedValue([[], 95]);

      const result = await service.query({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(10);
    });

    it('should use default pagination when not provided', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.query({});

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });
  });

  // ─── findById() ──────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('should return the log when found', async () => {
      const log = makeLog();
      repo.findOne.mockResolvedValue(log);

      const result = await service.findById('log-uuid');
      expect(result).toEqual(log);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'log-uuid' } });
    });

    it('should return null when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.findById('non-existent')).toBeNull();
    });
  });

  // ─── getUserAuditTrail() ─────────────────────────────────────────────────

  describe('getUserAuditTrail()', () => {
    it('should return logs for a specific user ordered by createdAt DESC', async () => {
      const logs = [makeLog()];
      repo.find.mockResolvedValue(logs);

      const result = await service.getUserAuditTrail('user-uuid');

      expect(result).toEqual(logs);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid' },
          order: { createdAt: 'DESC' },
          take: 100,
        }),
      );
    });

    it('should respect custom limit', async () => {
      repo.find.mockResolvedValue([]);
      await service.getUserAuditTrail('user-uuid', 25);
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
    });
  });

  // ─── getResourceAuditTrail() ─────────────────────────────────────────────

  describe('getResourceAuditTrail()', () => {
    it('should return logs for a specific resource', async () => {
      const logs = [makeLog({ resource: 'trade', resourceId: 'trade-1' })];
      repo.find.mockResolvedValue(logs);

      const result = await service.getResourceAuditTrail('trade', 'trade-1');

      expect(result).toEqual(logs);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { resource: 'trade', resourceId: 'trade-1' } }),
      );
    });
  });

  // ─── countByAction() ─────────────────────────────────────────────────────

  describe('countByAction()', () => {
    it('should return count of a specific action in date range', async () => {
      repo.count.mockResolvedValue(42);
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      const result = await service.countByAction(AuditAction.LOGIN, start, end);

      expect(result).toBe(42);
      expect(repo.count).toHaveBeenCalledWith({
        where: { action: AuditAction.LOGIN, createdAt: Between(start, end) },
      });
    });
  });

  // ─── detectSuspiciousActivity() ──────────────────────────────────────────

  describe('detectSuspiciousActivity()', () => {
    it('should return true when failed login count exceeds threshold', async () => {
      repo.count.mockResolvedValue(6);
      expect(await service.detectSuspiciousActivity('1.2.3.4')).toBe(true);
    });

    it('should return false when failed login count is below threshold', async () => {
      repo.count.mockResolvedValue(3);
      expect(await service.detectSuspiciousActivity('1.2.3.4')).toBe(false);
    });

    it('should return false at exactly threshold - 1', async () => {
      repo.count.mockResolvedValue(4);
      expect(await service.detectSuspiciousActivity('1.2.3.4')).toBe(false);
    });

    it('should return true at exactly threshold', async () => {
      repo.count.mockResolvedValue(5);
      expect(await service.detectSuspiciousActivity('1.2.3.4')).toBe(true);
    });
  });

  // ─── enforceRetentionPolicy() ────────────────────────────────────────────

  describe('enforceRetentionPolicy()', () => {
    it('should delete logs older than retention period using query builder', async () => {
      await service.enforceRetentionPolicy();

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should not throw when deletion fails', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.enforceRetentionPolicy()).resolves.not.toThrow();
    });
  });

  // ─── exportForCompliance() ───────────────────────────────────────────────

  describe('exportForCompliance()', () => {
    it('should return logs ordered chronologically for a user and date range', async () => {
      const logs = [makeLog(), makeLog({ id: 'log-2' })];
      repo.find.mockResolvedValue(logs);
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      const result = await service.exportForCompliance('user-uuid', start, end);

      expect(result).toEqual(logs);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', createdAt: Between(start, end) },
          order: { createdAt: 'ASC' },
        }),
      );
    });
  });
});
