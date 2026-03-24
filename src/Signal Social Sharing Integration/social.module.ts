import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { ShareImageGeneratorService } from './services/share-image-generator.service';
import { ReferralTrackerService } from './services/referral-tracker.service';
import { ReferralLink } from './entities/referral-link.entity';
import { ShareEvent } from './entities/share-event.entity';
import { Signal } from '../signals/entities/signal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralLink, ShareEvent, Signal]),
    // Register CacheModule locally if not already global
    CacheModule.register({
      ttl: 300_000, // 5 minutes default
    }),
  ],
  controllers: [SocialController],
  providers: [SocialService, ShareImageGeneratorService, ReferralTrackerService],
  exports: [ReferralTrackerService],
})
export class SocialModule {}
