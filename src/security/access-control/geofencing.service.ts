import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { GeoRestriction } from './entities/geo-restriction.entity';
import { SetGeoRestrictionDto } from '../dto/set-geo-restriction.dto';

export interface GeoLocation {
  countryCode: string | null; // ISO 3166-1 alpha-2
  countryName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isVpnProxy: boolean;
  isTor: boolean;
}

// Private IPs and loopback → treat as allowed (no geo block)
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((r) => r.test(ip));
}

@Injectable()
export class GeofencingService {
  private readonly logger = new Logger(GeofencingService.name);
  private readonly geoCacheTtl = 24 * 60 * 60; // 24h in seconds

  constructor(
    @InjectRepository(GeoRestriction)
    private readonly geoRepo: Repository<GeoRestriction>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  // ─── MaxMind / Geo Lookup ─────────────────────────────────────────────────

  /**
   * Resolves the geographic location for an IP address.
   * Results are cached in Redis for 24 hours to reduce API calls.
   *
   * Production integration: replace the stub with @maxmind/geoip2-node
   * or the MaxMind GeoIP2 Precision Web Services API.
   *
   * Example MaxMind setup:
   *   import { WebServiceClient } from '@maxmind/geoip2-node';
   *   const client = new WebServiceClient(accountId, licenseKey, { host: 'geolite.info' });
   *   const response = await client.city(ipAddress);
   */
  async getLocation(ipAddress: string): Promise<GeoLocation> {
    if (isPrivateIp(ipAddress)) {
      return {
        countryCode: null,
        countryName: null,
        city: null,
        latitude: null,
        longitude: null,
        isVpnProxy: false,
        isTor: false,
      };
    }

    // Check Redis cache first
    const cacheKey = `geo:${ipAddress}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GeoLocation;
    }

    let location: GeoLocation;

    try {
      location = await this.fetchGeoLocation(ipAddress);
    } catch (err) {
      this.logger.warn(
        `Geo lookup failed for ${ipAddress}: ${(err as Error).message}`,
      );
      // Fail open: unknown location = allow (prevents DoS via geo-lookup failures)
      location = {
        countryCode: null,
        countryName: null,
        city: null,
        latitude: null,
        longitude: null,
        isVpnProxy: false,
        isTor: false,
      };
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify(location),
      'EX',
      this.geoCacheTtl,
    );
    return location;
  }

  /**
   * Perform the actual geo lookup.
   * Swap this implementation for MaxMind GeoIP2 or ipapi.co / ip-api.com.
   *
   * MaxMind GeoIP2 example (install: npm install @maxmind/geoip2-node):
   *
   *   const { WebServiceClient } = require('@maxmind/geoip2-node');
   *   const client = new WebServiceClient(
   *     this.configService.get('MAXMIND_ACCOUNT_ID'),
   *     this.configService.get('MAXMIND_LICENSE_KEY'),
   *   );
   *   const resp = await client.city(ipAddress);
   *   return {
   *     countryCode: resp.country?.isoCode ?? null,
   *     countryName: resp.country?.names?.en ?? null,
   *     city: resp.city?.names?.en ?? null,
   *     latitude: resp.location?.latitude ?? null,
   *     longitude: resp.location?.longitude ?? null,
   *     isVpnProxy: false,  // requires MaxMind Insights/Precision tier
   *     isTor: resp.traits?.isAnonymous ?? false,
   *   };
   */
  private async fetchGeoLocation(ipAddress: string): Promise<GeoLocation> {
    // ── Stub implementation — replace with MaxMind or preferred provider ──
    // This calls ip-api.com as a zero-config fallback for dev/testing.
    // Do NOT use ip-api.com in production (rate limits, privacy concerns).
    const provider = this.configService.get<string>('GEO_PROVIDER', 'stub');

    if (provider === 'stub') {
      // Return deterministic test data — useful in unit tests
      return {
        countryCode: 'US',
        countryName: 'United States',
        city: 'San Francisco',
        latitude: 37.77,
        longitude: -122.42,
        isVpnProxy: false,
        isTor: false,
      };
    }

    // ip-api.com integration (free tier, 45 req/min, for dev only)
    const url = `http://ip-api.com/json/${ipAddress}?fields=countryCode,country,city,lat,lon,proxy,hosting`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();

    return {
      countryCode: data.countryCode ?? null,
      countryName: data.country ?? null,
      city: data.city ?? null,
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
      isVpnProxy: data.proxy || data.hosting || false,
      isTor: false,
    };
  }

  // ─── Get or create geo restriction for user ───────────────────────────────

  async getRestriction(userId: string): Promise<GeoRestriction> {
    let restriction = await this.geoRepo.findOne({ where: { userId } });
    if (!restriction) {
      restriction = this.geoRepo.create({
        userId,
        allowedCountries: [],
        blockedCountries: [],
        enabled: false,
        blockVpnProxy: false,
      });
      await this.geoRepo.save(restriction);
    }
    return restriction;
  }

  // ─── Update geo restriction ───────────────────────────────────────────────

  async setRestriction(
    userId: string,
    dto: SetGeoRestrictionDto,
  ): Promise<GeoRestriction> {
    const restriction = await this.getRestriction(userId);

    if (dto.allowedCountries !== undefined) {
      restriction.allowedCountries = dto.allowedCountries.map((c) =>
        c.toUpperCase(),
      );
    }
    if (dto.blockedCountries !== undefined) {
      restriction.blockedCountries = dto.blockedCountries.map((c) =>
        c.toUpperCase(),
      );
    }
    if (dto.enabled !== undefined) restriction.enabled = dto.enabled;
    if (dto.blockVpnProxy !== undefined)
      restriction.blockVpnProxy = dto.blockVpnProxy;

    return this.geoRepo.save(restriction);
  }

  // ─── Core check: is this country/location allowed? ────────────────────────

  async isLocationAllowed(
    userId: string,
    location: GeoLocation,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const restriction = await this.getRestriction(userId);

    if (!restriction.enabled) return { allowed: true };

    // Private/unknown IP — skip geo check
    if (!location.countryCode) return { allowed: true };

    const country = location.countryCode.toUpperCase();

    // VPN/proxy block check
    if (restriction.blockVpnProxy && (location.isVpnProxy || location.isTor)) {
      return { allowed: false, reason: 'VPN/proxy/Tor exit nodes are blocked' };
    }

    // Explicit block list always wins
    if (restriction.blockedCountries.includes(country)) {
      return { allowed: false, reason: `Access from ${country} is blocked` };
    }

    // If an allowlist is defined, country must appear in it
    if (
      restriction.allowedCountries.length > 0 &&
      !restriction.allowedCountries.includes(country)
    ) {
      return {
        allowed: false,
        reason: `Access is only permitted from: ${restriction.allowedCountries.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  // ─── Invalidate cached geo lookup (e.g. after VPN detection correction) ──

  async invalidateGeoCache(ipAddress: string): Promise<void> {
    await this.redis.del(`geo:${ipAddress}`);
  }
}
