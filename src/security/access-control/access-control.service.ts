import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IpWhitelistService } from './ip-whitelist.service';
import { GeofencingService } from './geofencing.service';
import {
  AccessAttemptLog,
  AccessAttemptOutcome,
} from './entities/access-attempt-log.entity';
import { TemporaryAccessCode } from './entities/temporary-access-code.entity';
import {
  CreateTempAccessCodeDto,
  TempAccessCodeResponseDto,
  AccessCheckResponseDto,
} from '../dto/set-geo-restriction.dto';

export const ACCESS_CONTROL_EVENTS = {
  ACCESS_BLOCKED: 'access_control.blocked',
  TEMP_CODE_USED: 'access_control.temp_code_used',
  TEMP_CODE_EXPIRED: 'access_control.temp_code_expired',
};

export interface AccessContext {
  userId: string;
  ipAddress: string;
  userAgent?: string;
  requestPath?: string;
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    private readonly ipWhitelistService: IpWhitelistService,
    private readonly geofencingService: GeofencingService,
    @InjectRepository(AccessAttemptLog)
    private readonly logRepo: Repository<AccessAttemptLog>,
    @InjectRepository(TemporaryAccessCode)
    private readonly tempCodeRepo: Repository<TemporaryAccessCode>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Main Access Check ────────────────────────────────────────────────────

  /**
   * Central access control gate.
   * Call this from your auth guard on every authenticated request.
   * Throws UnauthorizedException if access is denied.
   */
  async checkAccess(ctx: AccessContext): Promise<AccessCheckResponseDto> {
    const { userId, ipAddress } = ctx;

    // 1. Resolve geo location (cached)
    const location = await this.geofencingService.getLocation(ipAddress);

    // 2. Check if a valid temporary access code bypasses normal restrictions
    const hasTempBypass = await this.hasActiveTempBypass(
      userId,
      ipAddress,
      location.countryCode,
    );
    if (hasTempBypass) {
      await this.logAttempt({
        ...ctx,
        outcome: AccessAttemptOutcome.TEMP_CODE_USED,
        location,
      });
      return {
        allowed: true,
        reason: 'Temporary access code active',
        countryCode: location.countryCode ?? undefined,
        city: location.city ?? undefined,
        isVpnProxy: location.isVpnProxy,
      };
    }

    // 3. IP whitelist check
    const ipAllowed = await this.ipWhitelistService.isIpAllowed(
      userId,
      ipAddress,
    );
    if (!ipAllowed) {
      await this.logAttempt({
        ...ctx,
        outcome: AccessAttemptOutcome.BLOCKED_IP,
        location,
      });
      this.eventEmitter.emit(ACCESS_CONTROL_EVENTS.ACCESS_BLOCKED, {
        userId,
        ipAddress,
        reason: 'IP not whitelisted',
        location,
      });
      throw new UnauthorizedException(
        'Access denied: IP address not whitelisted',
      );
    }

    // 4. VPN/proxy check + geo-restriction check
    const geoResult = await this.geofencingService.isLocationAllowed(
      userId,
      location,
    );
    if (!geoResult.allowed) {
      const outcome = location.isVpnProxy
        ? AccessAttemptOutcome.BLOCKED_VPN
        : AccessAttemptOutcome.BLOCKED_GEO;

      await this.logAttempt({ ...ctx, outcome, location });
      this.eventEmitter.emit(ACCESS_CONTROL_EVENTS.ACCESS_BLOCKED, {
        userId,
        ipAddress,
        reason: geoResult.reason,
        location,
      });
      throw new UnauthorizedException(`Access denied: ${geoResult.reason}`);
    }

    // Access allowed — log for audit trail
    await this.logAttempt({
      ...ctx,
      outcome: AccessAttemptOutcome.ALLOWED,
      location,
    });

    return {
      allowed: true,
      countryCode: location.countryCode ?? undefined,
      city: location.city ?? undefined,
      isVpnProxy: location.isVpnProxy,
    };
  }

  // ─── Temporary Access Codes ───────────────────────────────────────────────

  async createTempAccessCode(
    userId: string,
    dto: CreateTempAccessCodeDto,
    createdBy?: string,
  ): Promise<TempAccessCodeResponseDto> {
    const rawCode = this.generateSecureCode();
    const codeHash = await bcrypt.hash(rawCode, this.BCRYPT_ROUNDS);

    const entity = this.tempCodeRepo.create({
      userId,
      codeHash,
      allowedIps: dto.allowedIps ?? [],
      allowedCountries: dto.allowedCountries?.map((c) => c.toUpperCase()) ?? [],
      expiresAt: new Date(dto.expiresAt),
      maxUses: dto.maxUses ?? null,
      label: dto.label ?? null,
      createdBy: createdBy ?? null,
    });

    const saved = await this.tempCodeRepo.save(entity);
    this.logger.log(
      `Temporary access code created for user ${userId} (id: ${saved.id})`,
    );

    return {
      id: saved.id,
      code: rawCode, // shown only once
      expiresAt: saved.expiresAt,
      label: saved.label ?? undefined,
      maxUses: saved.maxUses,
    };
  }

  async validateAndConsumeTempCode(
    userId: string,
    rawCode: string,
    ipAddress: string,
  ): Promise<boolean> {
    const activeCodes = await this.tempCodeRepo.find({
      where: { userId, revoked: false },
    });

    for (const code of activeCodes) {
      if (new Date() > code.expiresAt) continue;
      if (code.maxUses !== null && code.useCount >= code.maxUses) continue;

      const match = await bcrypt.compare(rawCode, code.codeHash);
      if (match) {
        await this.tempCodeRepo.update(code.id, {
          useCount: code.useCount + 1,
        });
        this.eventEmitter.emit(ACCESS_CONTROL_EVENTS.TEMP_CODE_USED, {
          userId,
          codeId: code.id,
          ipAddress,
        });
        return true;
      }
    }

    return false;
  }

  async revokeTempCode(codeId: string, userId: string): Promise<void> {
    await this.tempCodeRepo.update({ id: codeId, userId }, { revoked: true });
    this.logger.log(
      `Temporary access code ${codeId} revoked for user ${userId}`,
    );
  }

  async listTempCodes(
    userId: string,
  ): Promise<Omit<TemporaryAccessCode, 'codeHash'>[]> {
    const codes = await this.tempCodeRepo.find({
      where: { userId, revoked: false },
      order: { createdAt: 'DESC' },
    });
    // Strip the hash before returning
    return codes.map(({ codeHash: _, ...rest }) => rest);
  }

  // ─── Access Attempt Logging ───────────────────────────────────────────────

  private async logAttempt(params: {
    userId: string;
    ipAddress: string;
    userAgent?: string;
    requestPath?: string;
    outcome: AccessAttemptOutcome;
    location: Awaited<ReturnType<GeofencingService['getLocation']>>;
  }): Promise<void> {
    try {
      const log = this.logRepo.create({
        userId: params.userId,
        ipAddress: params.ipAddress,
        countryCode: params.location.countryCode,
        city: params.location.city,
        outcome: params.outcome,
        userAgent: params.userAgent ?? null,
        requestPath: params.requestPath ?? null,
        isVpnProxy: params.location.isVpnProxy,
        metadata: {
          countryName: params.location.countryName,
          isTor: params.location.isTor,
        },
      });
      await this.logRepo.save(log);
    } catch (err) {
      // Non-critical — never let logging failures break access checks
      this.logger.error(
        `Failed to log access attempt: ${(err as Error).message}`,
      );
    }
  }

  // ─── Query Logs ───────────────────────────────────────────────────────────

  async getAccessLogs(
    userId: string,
    options: { limit?: number; blockedOnly?: boolean } = {},
  ): Promise<AccessAttemptLog[]> {
    const qb = this.logRepo
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId })
      .orderBy('log.createdAt', 'DESC')
      .take(options.limit ?? 50);

    if (options.blockedOnly) {
      qb.andWhere('log.outcome != :allowed', {
        allowed: AccessAttemptOutcome.ALLOWED,
      });
    }

    return qb.getMany();
  }

  async getBlockedAttemptsSummary(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.logRepo
      .createQueryBuilder('log')
      .select('log.outcome', 'outcome')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(log.createdAt)', 'lastSeen')
      .where('log.userId = :userId', { userId })
      .andWhere('log.createdAt >= :since', { since })
      .andWhere('log.outcome != :allowed', {
        allowed: AccessAttemptOutcome.ALLOWED,
      })
      .groupBy('log.outcome')
      .getRawMany();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private generateSecureCode(): string {
    // Format: AC-XXXX-XXXX-XXXX (uppercase alphanumeric, easy to communicate)
    const bytes = crypto.randomBytes(9);
    const hex = bytes.toString('hex').toUpperCase();
    return `AC-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  }

  private async hasActiveTempBypass(
    userId: string,
    ipAddress: string,
    countryCode: string | null,
  ): Promise<boolean> {
    const activeCodes = await this.tempCodeRepo.find({
      where: { userId, revoked: false },
    });

    for (const code of activeCodes) {
      if (new Date() > code.expiresAt) continue;
      if (code.maxUses !== null && code.useCount >= code.maxUses) continue;

      // IP scope check (empty = any IP)
      if (
        code.allowedIps.length > 0 &&
        !code.allowedIps.some(
          (cidr) =>
            require('./ip-whitelist.service').ipMatchesCidr?.(
              ipAddress,
              cidr,
            ) ?? ipAddress === cidr,
        )
      ) {
        continue;
      }

      // Country scope check (empty = any country)
      if (
        code.allowedCountries.length > 0 &&
        countryCode &&
        !code.allowedCountries.includes(countryCode)
      ) {
        continue;
      }

      return true;
    }

    return false;
  }
}
