import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction, AuditStatus } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';

const mockAuditService = () => ({
  query: jest.fn(),
  findById: jest.fn(),
  getUserAuditTrail: jest.fn(),
  getResourceAuditTrail: jest.fn(),
  exportForCompliance: jest.fn(),
});

describe('AuditController', () => {
  let controller: AuditController;
  let service: ReturnType<typeof mockAuditService>;

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

  const mockPage = {
    data: [],
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useFactory: mockAuditService }],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── query() ──────────────────────────────────────────────────────────

  describe('query()', () => {
    it('should call service.query with the provided DTO', async () => {
      service.query.mockResolvedValue(mockPage);
      const dto: AuditQueryDto = { page: 1, limit: 10 };

      const result = await controller.query(dto);

      expect(service.query).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPage);
    });

    it('should pass action filter to service', async () => {
      service.query.mockResolvedValue(mockPage);
      const dto: AuditQueryDto = { action: AuditAction.TRADE_EXECUTED };

      await controller.query(dto);

      expect(service.query).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.TRADE_EXECUTED }));
    });
  });

  // ─── findOne() ────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return the log when found', async () => {
      const log = makeLog();
      service.findById.mockResolvedValue(log);

      const result = await controller.findOne('log-uuid');

      expect(service.findById).toHaveBeenCalledWith('log-uuid');
      expect(result).toEqual(log);
    });

    it('should throw NotFoundException when log not found', async () => {
      service.findById.mockResolvedValue(null);

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getUserTrail() ───────────────────────────────────────────────────

  describe('getUserTrail()', () => {
    it('should return user audit trail with default limit', async () => {
      const logs = [makeLog()];
      service.getUserAuditTrail.mockResolvedValue(logs);

      const result = await controller.getUserTrail('user-uuid');

      expect(service.getUserAuditTrail).toHaveBeenCalledWith('user-uuid', 100);
      expect(result).toEqual(logs);
    });

    it('should respect custom limit', async () => {
      service.getUserAuditTrail.mockResolvedValue([]);

      await controller.getUserTrail('user-uuid', 25);

      expect(service.getUserAuditTrail).toHaveBeenCalledWith('user-uuid', 25);
    });
  });

  // ─── getResourceTrail() ───────────────────────────────────────────────

  describe('getResourceTrail()', () => {
    it('should return resource audit trail', async () => {
      const logs = [makeLog({ resource: 'trade', resourceId: 'trade-1' })];
      service.getResourceAuditTrail.mockResolvedValue(logs);

      const result = await controller.getResourceTrail('trade', 'trade-1');

      expect(service.getResourceAuditTrail).toHaveBeenCalledWith('trade', 'trade-1', 100);
      expect(result).toEqual(logs);
    });
  });

  // ─── complianceExport() ───────────────────────────────────────────────

  describe('complianceExport()', () => {
    it('should call exportForCompliance with parsed dates', async () => {
      const logs = [makeLog()];
      service.exportForCompliance.mockResolvedValue(logs);

      const result = await controller.complianceExport('user-uuid', '2024-01-01', '2024-12-31');

      expect(service.exportForCompliance).toHaveBeenCalledWith(
        'user-uuid',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
      expect(result).toEqual(logs);
    });

    it('should use default dates when not provided', async () => {
      service.exportForCompliance.mockResolvedValue([]);

      await controller.complianceExport('user-uuid', undefined, undefined);

      const [, startDate, endDate] = service.exportForCompliance.mock.calls[0];
      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);
    });
  });
});
