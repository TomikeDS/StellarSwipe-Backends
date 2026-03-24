import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SocialService } from './social.service';
import { ShareImageGeneratorService } from './services/share-image-generator.service';
import { ReferralTrackerService } from './services/referral-tracker.service';
import { Signal } from '../signals/entities/signal.entity';

const mockSignal = {
  id: 'signal-123',
  pair: 'USDC/XLM',
  pnlPercent: 15.3,
  entryPrice: 0.12,
  exitPrice: 0.1384,
  tradeType: 'BUY',
  shareCount: 5,
  closedAt: new Date(),
  createdAt: new Date(),
  provider: { name: 'AlphaTrader' },
};

describe('SocialService', () => {
  let service: SocialService;
  let signalRepo: any;
  let imageGenerator: any;
  let referralTracker: any;
  let cache: any;

  beforeEach(async () => {
    signalRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockSignal }),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    imageGenerator = {
      generateShareImage: jest.fn().mockResolvedValue('/share-images/test.png'),
    };
    referralTracker = {
      generateReferralCode: jest.fn().mockResolvedValue('ABC123XY'),
      buildReferralUrl: jest.fn().mockReturnValue('https://stellarswipe.io/signals/signal-123?ref=ABC123XY'),
      trackShare: jest.fn().mockResolvedValue(undefined),
      getShareStats: jest.fn().mockResolvedValue({ totalShares: 2, platformBreakdown: {}, referralClicks: 5, referralConversions: 1 }),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: getRepositoryToken(Signal), useValue: signalRepo },
        { provide: ShareImageGeneratorService, useValue: imageGenerator },
        { provide: ReferralTrackerService, useValue: referralTracker },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://stellarswipe.io') } },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
  });

  describe('shareSignal', () => {
    it('should return complete share response', async () => {
      signalRepo.findOne
        .mockResolvedValueOnce({ ...mockSignal }) // initial fetch with relations
        .mockResolvedValueOnce({ ...mockSignal, shareCount: 6 }); // after increment

      const result = await service.shareSignal('signal-123', 'user-abc', {});

      expect(result.referralLink).toContain('ref=ABC123XY');
      expect(result.twitterIntentUrl).toContain('twitter.com/intent/tweet');
      expect(result.imageUrl).toContain('/share-images/test.png');
      expect(result.shareCount).toBe(6);
      expect(result.shareText).toContain('+15.3%');
      expect(result.shareText).toContain('USDC/XLM');
      expect(result.shareText).toContain('@StellarSwipe');
      expect(referralTracker.trackShare).toHaveBeenCalledWith(
        { userId: 'user-abc', signalId: 'signal-123', platform: 'twitter' },
        'ABC123XY',
      );
    });

    it('should throw NotFoundException for invalid signal', async () => {
      signalRepo.findOne.mockResolvedValue(null);
      await expect(service.shareSignal('bad-id', 'user-abc', {})).rejects.toThrow(NotFoundException);
    });

    it('should handle image generation failure gracefully', async () => {
      imageGenerator.generateShareImage.mockRejectedValue(new Error('Canvas error'));
      signalRepo.findOne
        .mockResolvedValueOnce({ ...mockSignal })
        .mockResolvedValueOnce({ ...mockSignal, shareCount: 6 });

      const result = await service.shareSignal('signal-123', 'user-abc', {});
      expect(result.imageUrl).toContain('share-placeholder.png');
      expect(result.shareUrl).toBeTruthy(); // rest of response still works
    });

    it('should enforce rate limiting', async () => {
      cache.get.mockResolvedValue(5); // already at max
      await expect(service.shareSignal('signal-123', 'user-abc', {})).rejects.toThrow(BadRequestException);
    });

    it('should increment share count', async () => {
      signalRepo.findOne
        .mockResolvedValueOnce({ ...mockSignal })
        .mockResolvedValueOnce({ ...mockSignal, shareCount: 6 });

      await service.shareSignal('signal-123', 'user-abc', {});
      expect(signalRepo.increment).toHaveBeenCalledWith({ id: 'signal-123' }, 'shareCount', 1);
    });
  });

  describe('share text template', () => {
    it('should match expected template for profit signal', async () => {
      signalRepo.findOne
        .mockResolvedValueOnce({ ...mockSignal, pnlPercent: 15 })
        .mockResolvedValueOnce({ ...mockSignal, shareCount: 6 });

      const result = await service.shareSignal('signal-123', 'user-abc', {});
      expect(result.shareText).toMatch(/\+15\.0% profit on USDC\/XLM/);
      expect(result.shareText).toContain('#DeFi #Stellar #CopyTrading');
    });

    it('should show negative sign for losing trade', async () => {
      signalRepo.findOne
        .mockResolvedValueOnce({ ...mockSignal, pnlPercent: -5.2 })
        .mockResolvedValueOnce({ ...mockSignal, shareCount: 6 });

      const result = await service.shareSignal('signal-123', 'user-abc', {});
      expect(result.shareText).toContain('-5.2%');
    });
  });
});
