import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PricingTier } from '../entities/pricing-tier.entity';

@Injectable()
export class QuotaEnforcer {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async checkAndIncrement(
    apiKeyId: string,
    tier: PricingTier,
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const now = Date.now();
    const minuteKey = `quota:rpm:${apiKeyId}:${Math.floor(now / 60000)}`;
    const dayKey = `quota:rpd:${apiKeyId}:${new Date().toISOString().slice(0, 10)}`;

    const [minuteCount, dayCount] = await Promise.all([
      this.cacheManager.get<number>(minuteKey).then((v) => v ?? 0),
      this.cacheManager.get<number>(dayKey).then((v) => v ?? 0),
    ]);

    if (minuteCount >= tier.maxRequestsPerMinute) {
      return { allowed: false, remaining: 0, resetIn: 60 - (now % 60000) / 1000 };
    }

    if (dayCount >= tier.maxRequestsPerDay) {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      return { allowed: false, remaining: 0, resetIn: (tomorrow.getTime() - now) / 1000 };
    }

    await Promise.all([
      this.cacheManager.set(minuteKey, minuteCount + 1, 60000),
      this.cacheManager.set(dayKey, dayCount + 1, 86400000),
    ]);

    return {
      allowed: true,
      remaining: Math.min(
        tier.maxRequestsPerMinute - minuteCount - 1,
        tier.maxRequestsPerDay - dayCount - 1,
      ),
      resetIn: 60 - (now % 60000) / 1000,
    };
  }
}
