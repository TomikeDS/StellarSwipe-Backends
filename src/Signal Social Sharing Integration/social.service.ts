import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ShareImageGeneratorService } from './services/share-image-generator.service';
import { ReferralTrackerService } from './services/referral-tracker.service';
import { ShareSignalDto, ShareSignalResponseDto } from './dto/share-signal.dto';
import { Signal } from '../signals/entities/signal.entity';

const RATE_LIMIT_WINDOW_SEC = 300; // 5 minutes
const MAX_SHARES_PER_WINDOW = 5;

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectRepository(Signal)
    private readonly signalRepo: Repository<Signal>,
    private readonly imageGenerator: ShareImageGeneratorService,
    private readonly referralTracker: ReferralTrackerService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async shareSignal(
    signalId: string,
    userId: string,
    dto: ShareSignalDto,
  ): Promise<ShareSignalResponseDto> {
    // 1. Rate limiting
    await this.enforceRateLimit(userId, signalId);

    // 2. Validate signal exists
    const signal = await this.signalRepo.findOne({
      where: { id: signalId },
      relations: ['provider'],
    });
    if (!signal) {
      throw new NotFoundException(`Signal ${signalId} not found`);
    }

    const platform = dto.platform ?? 'twitter';
    const baseAppUrl = this.config.get<string>('APP_URL', 'https://stellarswipe.io');

    // 3. Generate referral code & URL
    const referralCode = await this.referralTracker.generateReferralCode(userId, signalId);
    const signalPageUrl = `${baseAppUrl}/signals/${signalId}`;
    const referralLink = this.referralTracker.buildReferralUrl(signalPageUrl, referralCode);

    // 4. Generate share image (with graceful fallback)
    let imageUrl: string | null = null;
    const isProfit = signal.pnlPercent >= 0;
    try {
      imageUrl = await this.imageGenerator.generateShareImage({
        signalId,
        pair: signal.pair,
        pnlPercent: signal.pnlPercent,
        providerName: signal.provider?.name ?? 'Unknown',
        entryPrice: signal.entryPrice,
        exitPrice: signal.exitPrice,
        tradeType: signal.tradeType,
        timestamp: signal.closedAt ?? signal.createdAt,
      });
    } catch (err) {
      this.logger.warn(`Image generation failed for signal ${signalId}: ${err.message}`);
      // Use a static placeholder instead of failing the whole request
      imageUrl = `${baseAppUrl}/assets/share-placeholder.png`;
    }

    // 5. Build share text
    const pnlDisplay = `${isProfit ? '+' : ''}${signal.pnlPercent.toFixed(1)}%`;
    const shareText = this.buildShareText(pnlDisplay, signal.pair, referralLink);

    // 6. Build Twitter intent URL (URL without referral in text to keep it clean)
    const twitterIntentUrl = this.buildTwitterIntentUrl(shareText, referralLink, imageUrl);

    // 7. Track analytics
    await this.referralTracker.trackShare(
      { userId, signalId, platform },
      referralCode,
    );

    // 8. Increment share count
    await this.signalRepo.increment({ id: signalId }, 'shareCount', 1);
    const updatedSignal = await this.signalRepo.findOne({ where: { id: signalId } });

    return {
      shareUrl: referralLink,
      twitterIntentUrl,
      imageUrl: imageUrl ? `${baseAppUrl}${imageUrl}` : null,
      referralLink,
      shareCount: updatedSignal?.shareCount ?? 0,
      shareText,
    };
  }

  async getShareStats(signalId: string, userId: string) {
    const signal = await this.signalRepo.findOne({ where: { id: signalId } });
    if (!signal) throw new NotFoundException(`Signal ${signalId} not found`);

    const stats = await this.referralTracker.getShareStats(userId, signalId);
    return {
      signalId,
      signalShareCount: signal.shareCount,
      userStats: stats,
    };
  }

  // --------------- helpers ---------------

  private buildShareText(pnlDisplay: string, pair: string, referralLink: string): string {
    return `Just made ${pnlDisplay} profit on ${pair} with @StellarSwipe! 🚀\n\nCopy the best traders on Stellar with zero hassle.\nTry it: ${referralLink}\n\n#DeFi #Stellar #CopyTrading`;
  }

  private buildTwitterIntentUrl(
    text: string,
    url: string,
    imageUrl?: string,
  ): string {
    const params = new URLSearchParams({
      text: text.replace(url, '').trim(), // avoid duplicating the URL (Twitter appends it)
      url,
    });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  private async enforceRateLimit(userId: string, signalId: string): Promise<void> {
    const key = `share_rate:${userId}:${signalId}`;
    const current = (await this.cache.get<number>(key)) ?? 0;

    if (current >= MAX_SHARES_PER_WINDOW) {
      throw new BadRequestException(
        `Rate limit exceeded. You can share this signal at most ${MAX_SHARES_PER_WINDOW} times per ${RATE_LIMIT_WINDOW_SEC / 60} minutes.`,
      );
    }

    await this.cache.set(key, current + 1, RATE_LIMIT_WINDOW_SEC * 1000);
  }
}
