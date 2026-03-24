import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';
import { ApiKey } from '../entities/api-key.entity';
import * as bcrypt from 'bcrypt';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let mockRepo: any;
  let mockCache: any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  describe('create', () => {
    it('should generate secure API key with correct format', async () => {
      const userId = 'user-123';
      const dto = {
        name: 'Test Key',
        scopes: ['read:signals'],
        rateLimit: 1000,
      };

      const savedKey = {
        id: 'key-123',
        userId,
        name: dto.name,
        keyHash: 'hashed',
        scopes: dto.scopes,
        rateLimit: dto.rateLimit,
        createdAt: new Date(),
      };

      mockRepo.create.mockReturnValue(savedKey);
      mockRepo.save.mockResolvedValue(savedKey);

      const result = await service.create(userId, dto);

      expect(result.key).toMatch(/^sk_live_[a-f0-9]{64}$/);
      expect(result.name).toBe(dto.name);
      expect(result.scopes).toEqual(dto.scopes);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should hash key before storage', async () => {
      const userId = 'user-123';
      const dto = {
        name: 'Test Key',
        scopes: ['read:signals'],
      };

      mockRepo.create.mockImplementation((data) => data);
      mockRepo.save.mockImplementation((data) => data);

      await service.create(userId, dto);

      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.keyHash).toBeDefined();
      expect(createCall.keyHash).not.toMatch(/^sk_live_/);
    });
  });

  describe('verify', () => {
    it('should verify valid API key', async () => {
      const rawKey = 'sk_live_abc123';
      const keyHash = await bcrypt.hash(rawKey, 10);

      const apiKey = {
        id: 'key-123',
        userId: 'user-123',
        keyHash,
        scopes: ['read:signals'],
        expiresAt: null,
      };

      mockRepo.find.mockResolvedValue([apiKey]);
      mockRepo.update.mockResolvedValue({});

      const result = await service.verify(rawKey);

      expect(result.id).toBe(apiKey.id);
      expect(mockRepo.update).toHaveBeenCalledWith(
        apiKey.id,
        expect.objectContaining({ lastUsed: expect.any(Date) }),
      );
    });

    it('should reject expired API key', async () => {
      const rawKey = 'sk_live_abc123';
      const keyHash = await bcrypt.hash(rawKey, 10);

      const apiKey = {
        id: 'key-123',
        keyHash,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      };

      mockRepo.find.mockResolvedValue([apiKey]);

      await expect(service.verify(rawKey)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject invalid API key', async () => {
      mockRepo.find.mockResolvedValue([]);

      await expect(service.verify('invalid-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      mockCache.get.mockResolvedValue(500);

      const result = await service.checkRateLimit('key-123', 1000);

      expect(result).toBe(true);
    });

    it('should block requests exceeding limit', async () => {
      mockCache.get.mockResolvedValue(1000);

      const result = await service.checkRateLimit('key-123', 1000);

      expect(result).toBe(false);
    });
  });

  describe('rotate', () => {
    it('should generate new key for existing API key', async () => {
      const userId = 'user-123';
      const keyId = 'key-123';

      const existing = {
        id: keyId,
        userId,
        name: 'Test Key',
        scopes: ['read:signals'],
        rateLimit: 1000,
        createdAt: new Date(),
      };

      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({});

      const result = await service.rotate(userId, keyId);

      expect(result.key).toMatch(/^sk_live_[a-f0-9]{64}$/);
      expect(result.id).toBe(keyId);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should reject rotation for non-existent key', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.rotate('user-123', 'key-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('trackUsage', () => {
    it('should track requests and errors', async () => {
      mockCache.get.mockResolvedValue(10);

      await service.trackUsage('key-123', 'GET:/signals', false);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('requests'),
        11,
        604800000,
      );
    });

    it('should track errors separately', async () => {
      mockCache.get.mockResolvedValue(5);

      await service.trackUsage('key-123', 'GET:/signals', true);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('errors'),
        6,
        604800000,
      );
    });
  });
});
