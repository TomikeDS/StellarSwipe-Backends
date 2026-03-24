import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProviderEarning } from './entities/provider-earning.entity';
import { Payout } from './entities/payout.entity';
import { ProviderRewardsService } from './services/provider-rewards.service';
import { PayoutService } from './services/payout.service';
import { ProviderRewardsController } from './provider-rewards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderEarning, Payout]),
    ConfigModule,
  ],
  controllers: [ProviderRewardsController],
  providers: [ProviderRewardsService, PayoutService],
  exports: [ProviderRewardsService, PayoutService],
})
export class ProviderRewardsModule {}
