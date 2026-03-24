import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpWhitelist } from './entities/ip-whitelist.entity';
import {
  AddIpDto,
  RemoveIpDto,
  UpdateWhitelistSettingsDto,
} from '../dto/add-ip.dto';

/**
 * Checks if a given IP address falls within a CIDR block.
 * Supports both IPv4 and basic IPv6.
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  // Exact match shortcut
  if (!cidr.includes('/')) {
    return ip === cidr;
  }

  const [range, bits] = cidr.split('/');
  const prefixLen = parseInt(bits, 10);

  // IPv4 only for CIDR matching (IPv6 CIDR is treated as exact prefix match)
  if (ip.includes(':') || range.includes(':')) {
    return ip.startsWith(range.replace(/::.*/, ''));
  }

  const ipToInt = (addr: string): number =>
    addr
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

/**
 * Validates an IP address or CIDR range format.
 */
function isValidIpOrCidr(value: string): boolean {
  const ipv4Cidr = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[12][0-9]|3[0-2]))?$/;
  const ipv6 = /^([0-9a-fA-F:]+)(\/\d{1,3})?$/;

  if (!ipv4Cidr.test(value) && !ipv6.test(value)) return false;

  if (value.includes('.') && !value.includes(':')) {
    const parts = value.split('/')[0].split('.');
    return parts.every((p) => parseInt(p, 10) <= 255);
  }

  return true;
}

@Injectable()
export class IpWhitelistService {
  private readonly logger = new Logger(IpWhitelistService.name);

  constructor(
    @InjectRepository(IpWhitelist)
    private readonly whitelistRepo: Repository<IpWhitelist>,
  ) {}

  // ─── Get or create whitelist for user ────────────────────────────────────

  async getWhitelist(userId: string): Promise<IpWhitelist> {
    let whitelist = await this.whitelistRepo.findOne({ where: { userId } });
    if (!whitelist) {
      whitelist = this.whitelistRepo.create({
        userId,
        ipAddresses: [],
        labels: {},
        enabled: false,
      });
      await this.whitelistRepo.save(whitelist);
    }
    return whitelist;
  }

  // ─── Add a single IP / CIDR ───────────────────────────────────────────────

  async addIp(userId: string, dto: AddIpDto): Promise<IpWhitelist> {
    if (!isValidIpOrCidr(dto.ip)) {
      throw new BadRequestException(
        `Invalid IP address or CIDR range: ${dto.ip}`,
      );
    }

    const whitelist = await this.getWhitelist(userId);

    if (whitelist.ipAddresses.includes(dto.ip)) {
      return whitelist; // idempotent
    }

    whitelist.ipAddresses = [...whitelist.ipAddresses, dto.ip];
    if (dto.label) {
      whitelist.labels = { ...whitelist.labels, [dto.ip]: dto.label };
    }

    const saved = await this.whitelistRepo.save(whitelist);
    this.logger.log(`Added IP ${dto.ip} to whitelist for user ${userId}`);
    return saved;
  }

  // ─── Remove an IP / CIDR ──────────────────────────────────────────────────

  async removeIp(userId: string, dto: RemoveIpDto): Promise<IpWhitelist> {
    const whitelist = await this.getWhitelist(userId);
    whitelist.ipAddresses = whitelist.ipAddresses.filter((ip) => ip !== dto.ip);

    const labels = { ...whitelist.labels };
    delete labels[dto.ip];
    whitelist.labels = labels;

    const saved = await this.whitelistRepo.save(whitelist);
    this.logger.log(`Removed IP ${dto.ip} from whitelist for user ${userId}`);
    return saved;
  }

  // ─── Bulk update settings ─────────────────────────────────────────────────

  async updateSettings(
    userId: string,
    dto: UpdateWhitelistSettingsDto,
  ): Promise<IpWhitelist> {
    const whitelist = await this.getWhitelist(userId);

    if (dto.enabled !== undefined) whitelist.enabled = dto.enabled;
    if (dto.ipAddresses !== undefined) {
      for (const ip of dto.ipAddresses) {
        if (!isValidIpOrCidr(ip)) {
          throw new BadRequestException(`Invalid IP or CIDR: ${ip}`);
        }
      }
      whitelist.ipAddresses = dto.ipAddresses;
    }
    if (dto.labels !== undefined) whitelist.labels = dto.labels;

    return this.whitelistRepo.save(whitelist);
  }

  // ─── Core check: is this IP whitelisted for the user? ─────────────────────

  async isIpAllowed(userId: string, ipAddress: string): Promise<boolean> {
    const whitelist = await this.getWhitelist(userId);

    // Whitelist disabled → allow all
    if (!whitelist.enabled) return true;

    // Empty list + enabled → block all (deny-by-default)
    if (whitelist.ipAddresses.length === 0) return false;

    return whitelist.ipAddresses.some((entry) =>
      ipMatchesCidr(ipAddress, entry),
    );
  }

  // ─── Delete whitelist ─────────────────────────────────────────────────────

  async deleteWhitelist(userId: string): Promise<void> {
    await this.whitelistRepo.delete({ userId });
  }
}
