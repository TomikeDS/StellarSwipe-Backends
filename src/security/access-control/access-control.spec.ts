import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IpWhitelistService } from './ip-whitelist.service';
import { GeofencingService, GeoLocation } from './geofencing.service';
import { AccessControlService } from './access-control.service';
import { IpWhitelist } from './entities/ip-whitelist.entity';
import { GeoRestriction } from './entities/geo-restriction.entity';
import {
  AccessAttemptLog,
  AccessAttemptOutcome,
} from './entities/access-attempt-log.entity';
import { TemporaryAccessCode } from './entities/temporary-access-code.entity';

const mockRepo = <T>(): jest.Mocked<Partial<Repository<T>>> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
});

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

// ─── IpWhitelistService ────────────────────────────────────────────────────

describe('IpWhitelistService', () => {
  let service: IpWhitelistService;
  let repo: jest.Mocked<Partial<Repository<IpWhitelist>>>;

  const baseWhitelist: IpWhitelist = {
    id: 'wl-1',
    userId: 'user-1',
    ipAddresses: [],
    enabled: false,
    labels: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repo = mockRepo<IpWhitelist>();
    repo.findOne!.mockResolvedValue(baseWhitelist);
    repo.create!.mockImplementation((data: any) => ({
      ...baseWhitelist,
      ...data,
    }));
    repo.save!.mockImplementation(async (entity: any) => entity);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpWhitelistService,
        { provide: getRepositoryToken(IpWhitelist), useValue: repo },
      ],
    }).compile();

    service = module.get(IpWhitelistService);
  });

  describe('addIp', () => {
    it('should add a valid IPv4 address', async () => {
      repo.findOne!.mockResolvedValue({ ...baseWhitelist, ipAddresses: [] });
      const result = await service.addIp('user-1', {
        ip: '192.168.1.100',
        label: 'Home',
      });
      expect(result.ipAddresses).toContain('192.168.1.100');
      expect(repo.save).toHaveBeenCalled();
    });

    it('should add a valid CIDR range', async () => {
      repo.findOne!.mockResolvedValue({ ...baseWhitelist, ipAddresses: [] });
      const result = await service.addIp('user-1', { ip: '10.0.0.0/8' });
      expect(result.ipAddresses).toContain('10.0.0.0/8');
    });

    it('should throw on invalid IP format', async () => {
      await expect(
        service.addIp('user-1', { ip: 'not-an-ip' }),
      ).rejects.toThrow('Invalid IP address or CIDR range');
    });

    it('should be idempotent - no duplicate entries', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        ipAddresses: ['1.2.3.4'],
      });
      const result = await service.addIp('user-1', { ip: '1.2.3.4' });
      expect(result.ipAddresses.filter((ip) => ip === '1.2.3.4')).toHaveLength(
        1,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('isIpAllowed', () => {
    it('should allow all IPs when whitelist is disabled', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        enabled: false,
        ipAddresses: [],
      });
      expect(await service.isIpAllowed('user-1', '1.2.3.4')).toBe(true);
    });

    it('should block all IPs when enabled with empty list', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        enabled: true,
        ipAddresses: [],
      });
      expect(await service.isIpAllowed('user-1', '1.2.3.4')).toBe(false);
    });

    it('should allow a whitelisted exact IP', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        enabled: true,
        ipAddresses: ['1.2.3.4'],
      });
      expect(await service.isIpAllowed('user-1', '1.2.3.4')).toBe(true);
    });

    it('should block a non-whitelisted IP', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        enabled: true,
        ipAddresses: ['1.2.3.4'],
      });
      expect(await service.isIpAllowed('user-1', '5.6.7.8')).toBe(false);
    });

    it('should allow an IP that falls within a whitelisted CIDR', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        enabled: true,
        ipAddresses: ['10.0.0.0/8'],
      });
      expect(await service.isIpAllowed('user-1', '10.200.1.5')).toBe(true);
    });

    it('should block an IP outside a CIDR range', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseWhitelist,
        enabled: true,
        ipAddresses: ['192.168.1.0/24'],
      });
      expect(await service.isIpAllowed('user-1', '192.168.2.1')).toBe(false);
    });
  });
});

// ─── GeofencingService ─────────────────────────────────────────────────────

describe('GeofencingService', () => {
  let service: GeofencingService;
  let repo: jest.Mocked<Partial<Repository<GeoRestriction>>>;

  const baseRestriction: GeoRestriction = {
    id: 'geo-1',
    userId: 'user-1',
    allowedCountries: [],
    blockedCountries: [],
    enabled: false,
    blockVpnProxy: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const usLocation: GeoLocation = {
    countryCode: 'US',
    countryName: 'United States',
    city: 'New York',
    latitude: 40.7,
    longitude: -74.0,
    isVpnProxy: false,
    isTor: false,
  };

  beforeEach(async () => {
    repo = mockRepo<GeoRestriction>();
    repo.findOne!.mockResolvedValue(baseRestriction);
    repo.create!.mockImplementation((data: any) => ({
      ...baseRestriction,
      ...data,
    }));
    repo.save!.mockImplementation(async (entity: any) => entity);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeofencingService,
        { provide: getRepositoryToken(GeoRestriction), useValue: repo },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('stub') },
        },
      ],
    }).compile();

    service = module.get(GeofencingService);
  });

  describe('isLocationAllowed', () => {
    it('should allow all locations when restrictions are disabled', async () => {
      repo.findOne!.mockResolvedValue({ ...baseRestriction, enabled: false });
      const result = await service.isLocationAllowed('user-1', usLocation);
      expect(result.allowed).toBe(true);
    });

    it('should allow access from a country in allowedCountries', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseRestriction,
        enabled: true,
        allowedCountries: ['US', 'GB'],
      });
      const result = await service.isLocationAllowed('user-1', usLocation);
      expect(result.allowed).toBe(true);
    });

    it('should block access from a country NOT in allowedCountries', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseRestriction,
        enabled: true,
        allowedCountries: ['GB', 'DE'],
      });
      const result = await service.isLocationAllowed('user-1', usLocation);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('GB');
    });

    it('should block a country in blockedCountries even if not in allowedCountries', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseRestriction,
        enabled: true,
        blockedCountries: ['US'],
      });
      const result = await service.isLocationAllowed('user-1', usLocation);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('US');
    });

    it('should block VPN/proxy when blockVpnProxy is true', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseRestriction,
        enabled: true,
        blockVpnProxy: true,
      });
      const result = await service.isLocationAllowed('user-1', {
        ...usLocation,
        isVpnProxy: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('VPN');
    });

    it('should allow unknown country (null) through geo checks', async () => {
      repo.findOne!.mockResolvedValue({
        ...baseRestriction,
        enabled: true,
        allowedCountries: ['US'],
      });
      const result = await service.isLocationAllowed('user-1', {
        ...usLocation,
        countryCode: null,
      });
      expect(result.allowed).toBe(true);
    });
  });
});

// ─── AccessControlService ──────────────────────────────────────────────────

describe('AccessControlService', () => {
  let service: AccessControlService;
  let ipWhitelistService: jest.Mocked<IpWhitelistService>;
  let geofencingService: jest.Mocked<GeofencingService>;
  let logRepo: jest.Mocked<Partial<Repository<AccessAttemptLog>>>;
  let tempCodeRepo: jest.Mocked<Partial<Repository<TemporaryAccessCode>>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockLocation: GeoLocation = {
    countryCode: 'US',
    countryName: 'United States',
    city: 'SF',
    latitude: 37.77,
    longitude: -122.42,
    isVpnProxy: false,
    isTor: false,
  };

  beforeEach(async () => {
    logRepo = mockRepo<AccessAttemptLog>();
    logRepo.create!.mockImplementation((d: any) => d);
    logRepo.save!.mockImplementation(async (e: any) => e);

    tempCodeRepo = mockRepo<TemporaryAccessCode>();
    tempCodeRepo.find!.mockResolvedValue([]);

    const mockIpWhitelist: Partial<jest.Mocked<IpWhitelistService>> = {
      isIpAllowed: jest.fn().mockResolvedValue(true),
      getWhitelist: jest.fn(),
      addIp: jest.fn(),
      removeIp: jest.fn(),
      updateSettings: jest.fn(),
      deleteWhitelist: jest.fn(),
    };

    const mockGeofencing: Partial<jest.Mocked<GeofencingService>> = {
      getLocation: jest.fn().mockResolvedValue(mockLocation),
      isLocationAllowed: jest.fn().mockResolvedValue({ allowed: true }),
      getRestriction: jest.fn(),
      setRestriction: jest.fn(),
      invalidateGeoCache: jest.fn(),
    };

    const mockEmitter: Partial<jest.Mocked<EventEmitter2>> = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: IpWhitelistService, useValue: mockIpWhitelist },
        { provide: GeofencingService, useValue: mockGeofencing },
        { provide: getRepositoryToken(AccessAttemptLog), useValue: logRepo },
        {
          provide: getRepositoryToken(TemporaryAccessCode),
          useValue: tempCodeRepo,
        },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get(AccessControlService);
    ipWhitelistService = module.get(
      IpWhitelistService,
    ) as jest.Mocked<IpWhitelistService>;
    geofencingService = module.get(
      GeofencingService,
    ) as jest.Mocked<GeofencingService>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('checkAccess', () => {
    const ctx = { userId: 'user-1', ipAddress: '1.2.3.4' };

    it('should allow access when IP is whitelisted and geo is OK', async () => {
      const result = await service.checkAccess(ctx);
      expect(result.allowed).toBe(true);
      expect(logRepo.save).toHaveBeenCalled();
    });

    it('should block and log when IP is not whitelisted', async () => {
      ipWhitelistService.isIpAllowed.mockResolvedValueOnce(false);
      await expect(service.checkAccess(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'access_control.blocked',
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(logRepo.save).toHaveBeenCalled();
    });

    it('should block and log when geo-restriction denies access', async () => {
      geofencingService.isLocationAllowed.mockResolvedValueOnce({
        allowed: false,
        reason: 'Access from US is blocked',
      });
      await expect(service.checkAccess(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(logRepo.save).toHaveBeenCalled();
    });

    it('should use correct BLOCKED_VPN outcome for VPN-detected IPs', async () => {
      geofencingService.getLocation.mockResolvedValueOnce({
        ...mockLocation,
        isVpnProxy: true,
      });
      geofencingService.isLocationAllowed.mockResolvedValueOnce({
        allowed: false,
        reason: 'VPN/proxy blocked',
      });

      const savedLogs: any[] = [];
      logRepo.save!.mockImplementation(async (e: any) => {
        savedLogs.push(e);
        return e;
      });

      await expect(service.checkAccess(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(savedLogs[0].outcome).toBe(AccessAttemptOutcome.BLOCKED_VPN);
    });
  });

  describe('createTempAccessCode', () => {
    it('should create a temp code and return the raw code once', async () => {
      tempCodeRepo.create!.mockImplementation((d: any) => d);
      tempCodeRepo.save!.mockImplementation(async (e: any) => ({
        ...e,
        id: 'code-1',
        expiresAt: new Date('2025-12-31'),
      }));

      const result = await service.createTempAccessCode('user-1', {
        expiresAt: '2025-12-31T00:00:00Z',
        label: 'Tokyo trip',
        maxUses: 10,
      });

      expect(result.code).toMatch(/^AC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(result.label).toBe('Tokyo trip');
    });
  });
});
