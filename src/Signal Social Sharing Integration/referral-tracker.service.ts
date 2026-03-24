import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ReferralLink } from '../entities/referral-link.entity';
import { ShareEvent } from '../entities/share-event.entity';

export interface ReferralData {
  userId: string;
  signalId: string;
  platform: string;
}

export interface TrackClickData {
  referralCode: string;
  visitorIp?: string;
  userAgent?: string;
}

@Injectable()
export class ReferralTrackerService {
  private readonly logger = new Logger(ReferralTrackerService.name);

  constructor(
    @InjectRepository(ReferralLink)
    private readonly referralLinkRepo: Repository<ReferralLink>,
    @InjectRepository(ShareEvent)
    private readonly shareEventRepo: Repository<ShareEvent>,
  ) {}

  /**
   * Generate or reuse a referral code for user+signal pair
   */
  async generateReferralCode(userId: string, signalId: string): Promise<string> {
    const existing = await this.referralLinkRepo.findOne({
      where: { userId, signalId },
    });
    if (existing) return existing.referralCode;

    const referralCode = this.buildCode(userId);
    const link = this.referralLinkRepo.create({
      referralCode,
      userId,
      signalId,
      clickCount: 0,
      conversionCount: 0,
    });
    await this.referralLinkRepo.save(link);
    return referralCode;
  }

  buildReferralUrl(baseUrl: string, referralCode: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set('ref', referralCode);
    return url.toString();
  }

  /**
   * Track that a share event happened
   */
  async trackShare(data: ReferralData, referralCode: string): Promise<void> {
    try {
      const event = this.shareEventRepo.create({
        userId: data.userId,
        signalId: data.signalId,
        platform: data.platform,
        referralCode,
        sharedAt: new Date(),
      });
      await this.shareEventRepo.save(event);
    } catch (error) {
      this.logger.error(`Failed to track share event: ${error.message}`);
    }
  }

  /**
   * Track that someone clicked a referral link
   */
  async trackClick(data: TrackClickData): Promise<{ referrerId: string } | null> {
    try {
      const link = await this.referralLinkRepo.findOne({
        where: { referralCode: data.referralCode },
      });
      if (!link) return null;

      link.clickCount += 1;
      link.lastClickAt = new Date();
      await this.referralLinkRepo.save(link);

      return { referrerId: link.userId };
    } catch (error) {
      this.logger.error(`Failed to track click: ${error.message}`);
      return null;
    }
  }

  /**
   * Track a conversion (new user registered via referral)
   */
  async trackConversion(referralCode: string, newUserId: string): Promise<void> {
    try {
      const link = await this.referralLinkRepo.findOne({
        where: { referralCode },
      });
      if (!link) return;

      link.conversionCount += 1;
      await this.referralLinkRepo.save(link);
    } catch (error) {
      this.logger.error(`Failed to track conversion: ${error.message}`);
    }
  }

  async getShareStats(userId: string, signalId: string) {
    const [events, referralLink] = await Promise.all([
      this.shareEventRepo.find({ where: { userId, signalId } }),
      this.referralLinkRepo.findOne({ where: { userId, signalId } }),
    ]);

    return {
      totalShares: events.length,
      platformBreakdown: events.reduce<Record<string, number>>((acc, e) => {
        acc[e.platform] = (acc[e.platform] || 0) + 1;
        return acc;
      }, {}),
      referralClicks: referralLink?.clickCount ?? 0,
      referralConversions: referralLink?.conversionCount ?? 0,
    };
  }

  private buildCode(userId: string): string {
    // Short deterministic-ish code: first 8 chars of userId + random suffix
    const prefix = userId.replace(/-/g, '').substring(0, 6).toUpperCase();
    const suffix = uuidv4().replace(/-/g, '').substring(0, 4).toUpperCase();
    return `${prefix}${suffix}`;
  }
}
